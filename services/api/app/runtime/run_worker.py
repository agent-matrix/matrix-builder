"""Real execution worker for validation runs (Batch C3).

Replaces the placeholder workers. A run is enqueued on an asyncio queue; the worker consumes it
and executes the pipeline in a thread (the DB and storage layers are synchronous, so this keeps
the event loop free to stream events to WebSocket clients):

    enqueue -> engine validate -> persist findings -> write artifacts (report.json, diff.patch,
    log.txt) to Storage -> create matrix_commit on approval, else attach a repair suggestion ->
    finalize the run and emit run.completed.

Each step appends to the append-only ``run_events`` table (durable, replayable) and publishes
the same event to the in-process bus for live streaming. Events are emitted in small committed
transactions so subscribers and the ``?after=`` cursor can read them immediately.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from app.db.engine import session_scope
from app.db.repository import WorkflowRepository
from app.integrations.agent_generator_adapter import (
    AgentGeneratorAdapter,
    ChangeValidationResult,
)
from app.runtime.event_bus import EventBus
from app.storage import workflow_paths
from app.utils.hashing import sha256_text

logger = logging.getLogger(__name__)

_TERMINAL_EVENTS = frozenset({"run.completed", "run.failed"})


@dataclass(frozen=True)
class RunJob:
    run_id: str
    owner_id: str
    batch_id: str
    version_id: str
    project_id: str
    changed_files: list[dict[str, Any]]
    allowed_files: list[str] | None = None
    forbidden_changes: list[str] | None = None
    patch: str | None = None
    summary: str = ""


@dataclass
class _State:
    loop: asyncio.AbstractEventLoop | None = None
    queue: asyncio.Queue | None = None
    task: asyncio.Task | None = None


class RunWorker:
    def __init__(
        self, *, bus: EventBus, adapter: AgentGeneratorAdapter, storage: Any
    ) -> None:
        self._bus = bus
        self._adapter = adapter
        self._storage = storage
        self._s = _State()

    # --- lifecycle ---------------------------------------------------------
    async def start(self) -> None:
        # Idempotent/restartable: bind a fresh queue + task to the current loop.
        self._s.loop = asyncio.get_running_loop()
        self._s.queue = asyncio.Queue()
        self._s.task = asyncio.create_task(self._consume())

    async def stop(self) -> None:
        if self._s.task is not None:
            self._s.task.cancel()
            try:
                await self._s.task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001 - shutdown is best-effort
                pass
        self._s = _State()

    async def enqueue(self, job: RunJob) -> None:
        if self._s.queue is None:
            raise RuntimeError("RunWorker is not started")
        await self._s.queue.put(job)

    async def _consume(self) -> None:
        assert self._s.queue is not None
        while True:
            job = await self._s.queue.get()
            try:
                await asyncio.to_thread(self._process, job)
            except Exception:  # noqa: BLE001 - one bad job must not kill the worker
                logger.exception("run worker failed for run %s", job.run_id)
                try:
                    await asyncio.to_thread(self._emit, job, "run.failed", {"error": "internal"})
                    await asyncio.to_thread(self._finalize, job, "failed", None, None)
                except Exception:  # noqa: BLE001
                    logger.exception("run worker failed to record failure for %s", job.run_id)
            finally:
                self._s.queue.task_done()

    # --- pipeline (sync, runs in a worker thread) --------------------------
    def _process(self, job: RunJob) -> None:
        self._emit(job, "run.started", {"batch_id": job.batch_id})

        result = self._adapter.validate_changes(
            changed_files=job.changed_files,
            allowed_files=job.allowed_files,
            forbidden_changes=job.forbidden_changes,
            patch=job.patch,
        )

        # Persist findings, then announce them.
        with session_scope(user_id=job.owner_id) as s:
            repo = WorkflowRepository(s)
            for finding in result.findings:
                repo.create_validation_finding(
                    owner_id=job.owner_id,
                    validation_run_id=job.run_id,
                    severity=finding["severity"],
                    status=finding["status"],
                    check_name=finding["check_name"],
                    message=finding["message"],
                    file_path=finding.get("file_path"),
                    remediation=finding.get("remediation"),
                )
        for finding in result.findings:
            self._emit(
                job,
                "check.recorded",
                {
                    "check_name": finding["check_name"],
                    "severity": finding["severity"],
                    "status": finding["status"],
                    "file_path": finding.get("file_path"),
                },
            )

        self._write_artifacts(job, result)
        self._emit(job, "artifacts.created", {"types": ["validation_report", "patch_diff", "log"]})

        if result.status == "approved":
            commit_id = self._create_commit(job, result)
            self._emit(job, "commit.created", {"commit_id": commit_id})
            self._finalize(job, result.status, result.score, commit_id)
        else:
            repair = self._attach_repair(job, result)
            self._emit(job, "repair.suggested", repair)
            self._finalize(job, result.status, result.score, None)

        self._emit(job, "run.completed", {"status": result.status})

    def _write_artifacts(self, job: RunJob, result: ChangeValidationResult) -> None:
        report = json.dumps(
            {
                "status": result.status,
                "score": result.score,
                "summary": result.summary,
                "findings": result.findings,
            },
            indent=2,
            sort_keys=True,
        )
        diff = self._adapter.diff_commits(
            head_commit_id=job.run_id,
            head_manifest={"added": result.added, "changed": result.changed, "deleted": result.deleted},
        )
        log = "\n".join(
            [
                f"run {job.run_id} validation",
                f"status: {result.status}  score: {result.score}",
                f"summary: {result.summary}",
                *[f"- [{f['severity']}] {f['check_name']}: {f['message']}" for f in result.findings],
            ]
        ) + "\n"

        keys = {
            "validation_report": (
                workflow_paths.run_report_key(job.project_id, job.version_id, job.run_id),
                report,
            ),
            "patch_diff": (
                workflow_paths.run_diff_key(job.project_id, job.version_id, job.run_id),
                diff.patch,
            ),
            "log": (
                workflow_paths.run_log_key(job.project_id, job.version_id, job.run_id),
                log,
            ),
        }
        for _atype, (key, content) in keys.items():
            self._storage.put_text(key, content)

        with session_scope(user_id=job.owner_id) as s:
            repo = WorkflowRepository(s)
            for atype, (key, content) in keys.items():
                repo.create_artifact(
                    owner_id=job.owner_id,
                    project_id=job.project_id,
                    version_id=job.version_id,
                    commit_id=None,
                    artifact_type=atype,
                    storage_key=key,
                    sha256=sha256_text(content),
                    size_bytes=len(content.encode("utf-8")),
                )

    def _create_commit(self, job: RunJob, result: ChangeValidationResult) -> str:
        with session_scope(user_id=job.owner_id) as s:
            repo = WorkflowRepository(s)
            parent = repo.latest_commit(job.version_id)
            commit = repo.create_commit(
                owner_id=job.owner_id,
                batch_id=job.batch_id,
                version_id=job.version_id,
                commit_no=repo.next_commit_no(job.version_id),
                tree_hash=result.tree_hash,
                summary=job.summary or result.summary,
                validation_status=result.status,
                parent_commit_id=parent.id if parent else None,
                manifest={
                    "added": result.added,
                    "changed": result.changed,
                    "deleted": result.deleted,
                    "summary": result.summary,
                },
            )
            batch = repo.get_batch(job.batch_id)
            if batch is not None:
                repo.set_batch_status(batch, "committed")
            return commit.id

    def _attach_repair(self, job: RunJob, result: ChangeValidationResult) -> dict[str, Any]:
        with session_scope(user_id=job.owner_id) as s:
            repo = WorkflowRepository(s)
            version = repo.get_version(job.version_id)
            validation = ChangeValidationResult(
                status=result.status,
                score=result.score,
                findings=result.findings,
                tree_hash=result.tree_hash,
                summary=result.summary,
                added=result.added,
                changed=result.changed,
                deleted=result.deleted,
            )
            ordinal = repo.next_batch_ordinal(version.id)
            parent = repo.latest_commit(version.id)
            plan = self._adapter.plan_repair_batch(
                version_label=version.version_label,
                validation=validation,
                ordinal=ordinal,
                parent_commit_id=parent.id if parent else None,
            )
            batch = repo.create_batch(
                owner_id=job.owner_id,
                version_id=version.id,
                ordinal=ordinal,
                title=plan.title,
                goal_md=plan.goal_md,
                change_type=plan.change_type,
                parent_commit_id=parent.id if parent else None,
            )
            pack = self._adapter.batch_prompt_pack(plan=plan, coder="generic-ai-coder")
            prompt = repo.create_prompt_version(
                owner_id=job.owner_id,
                batch_id=batch.id,
                coder=pack.coder,
                prompt_text=pack.prompt_text,
                constraints=pack.constraints,
            )
            repo.set_batch_status(batch, "ready")
            # Mark the originating batch as needing repair.
            origin = repo.get_batch(job.batch_id)
            if origin is not None:
                repo.set_batch_status(origin, result.status)
            return {"repair_batch_id": batch.id, "prompt_version_id": prompt.id}

    def _finalize(
        self, job: RunJob, status: str, score: int | None, commit_id: str | None
    ) -> None:
        with session_scope(user_id=job.owner_id) as s:
            repo = WorkflowRepository(s)
            run = repo.get_validation_run(job.run_id)
            if run is not None:
                repo.finalize_validation_run(run, status=status, score=score, commit_id=commit_id)

    # --- event emission ----------------------------------------------------
    def _emit(self, job: RunJob, event_type: str, payload: dict[str, Any]) -> None:
        with session_scope(user_id=job.owner_id) as s:
            event = WorkflowRepository(s).append_run_event(
                owner_id=job.owner_id, run_id=job.run_id, event_type=event_type, payload=payload
            )
            seq = event.seq
        message = {"run_id": job.run_id, "seq": seq, "event_type": event_type, "payload": payload}
        loop = self._s.loop
        if loop is not None:
            loop.call_soon_threadsafe(self._bus.publish_nowait, job.run_id, message)


__all__ = ["RunWorker", "RunJob"]
