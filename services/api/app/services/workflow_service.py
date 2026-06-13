"""Continuous Build workflow orchestration (Batch C2).

Drives the create-batch -> prompt -> submit-changes -> validation-run -> commit-or-repair loop
over the persisted workflow tables (``WorkflowRepository``) and the agent-generator adapter.

Responsibilities live here, not in agent-generator: Matrix Builder *orchestrates*; the engine
*generates and validates*. The engine's status vocabulary is stored verbatim
(``approved``/``needs-repair``/``rejected``); the UI label is derived only at the response edge.
"""

from __future__ import annotations

from app.db.engine import session_scope
from app.db.orm import (
    Artifact,
    BuildBatch,
    BundleVersion,
    MatrixCommit,
    Project,
    PromptVersion,
    ValidationRun,
)
from app.db.repository import WorkflowRepository
from app.integrations.agent_generator_adapter import (
    AgentGeneratorAdapter,
    BatchPlanResult,
    ChangeValidationResult,
)
from app.runtime.run_worker import RunJob
from app.schemas.workflow import (
    BatchCreate,
    ExecutionRequest,
    ProjectCreate,
    RepairBatchRequest,
    SyncRequest,
    VersionCreate,
)
from app.storage import workflow_paths
from app.utils.hashing import sha256_text

_OUTCOME = {
    "approved": ("committed", "continue-build"),
    "needs-repair": ("needs-repair", "repair-batch"),
    "rejected": ("rejected", "repair-batch"),
}


def _semver(label: str) -> tuple[int, int, int]:
    """Parse 'v1.2.3' / '1.2.3' into a comparable tuple; unknown sorts lowest."""
    parts = label.lstrip("vV").split(".")
    out = []
    for p in parts[:3]:
        try:
            out.append(int(p))
        except ValueError:
            out.append(0)
    while len(out) < 3:
        out.append(0)
    return (out[0], out[1], out[2])


class WorkflowError(Exception):
    """A workflow-level failure that maps to an HTTP error (defaults to 400)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class WorkflowService:
    def __init__(
        self, *, session, owner_id: str, adapter: AgentGeneratorAdapter
    ) -> None:
        self.repo = WorkflowRepository(session)
        self.owner_id = owner_id
        self.adapter = adapter
        self.repo.upsert_user(owner_id)

    # --- projects ----------------------------------------------------------
    def create_project(self, payload: ProjectCreate) -> Project:
        return self.repo.create_project(
            owner_id=self.owner_id,
            title=payload.title,
            slug=payload.slug,
            description=payload.description,
        )

    def list_projects(self) -> list[Project]:
        return self.repo.list_projects(self.owner_id)

    def get_project(self, project_id: str) -> Project:
        project = self.repo.get_project(project_id)
        if project is None:
            raise WorkflowError("Project not found.", status_code=404)
        return project

    # --- versions ----------------------------------------------------------
    def create_version(self, payload: VersionCreate) -> BundleVersion:
        self.get_project(payload.project_id)  # ownership + existence (RLS-scoped)
        return self.repo.create_version(
            owner_id=self.owner_id,
            project_id=payload.project_id,
            version_label=payload.version_label,
            title=payload.title,
            requirements_md=payload.requirements_md,
            parent_version_id=payload.parent_version_id,
        )

    def get_version(self, version_id: str) -> BundleVersion:
        version = self.repo.get_version(version_id)
        if version is None:
            raise WorkflowError("Version not found.", status_code=404)
        return version

    # --- batches -----------------------------------------------------------
    def create_batch(self, payload: BatchCreate) -> BuildBatch:
        version = self.get_version(payload.version_id)
        self._guard_version_is_current(version)
        parent = self.repo.latest_commit(version.id)
        ordinal = self.repo.next_batch_ordinal(version.id)
        title = payload.title or payload.goal_md.strip().splitlines()[0][:80]
        return self.repo.create_batch(
            owner_id=self.owner_id,
            version_id=version.id,
            ordinal=ordinal,
            title=title,
            goal_md=payload.goal_md,
            change_type=payload.change_type.value,
            parent_commit_id=parent.id if parent else None,
        )

    def get_batch(self, batch_id: str) -> BuildBatch:
        batch = self.repo.get_batch(batch_id)
        if batch is None:
            raise WorkflowError("Batch not found.", status_code=404)
        return batch

    def _guard_version_is_current(self, version: BundleVersion) -> None:
        """Reject batches on a stale version (the "you're editing v1.0.0 but v1.2.0 is current")."""
        latest = self.repo.latest_version(version.project_id)
        if latest is not None and latest.id != version.id:
            raise WorkflowError(
                f"You're editing {version.version_label} but {latest.version_label} is current. "
                "Continue building on the current version, or update requirements to create a new one.",
                status_code=409,
            )

    # --- prompt packs ------------------------------------------------------
    def generate_prompt_pack(
        self, batch_id: str, coder: str
    ) -> tuple[BuildBatch, PromptVersion]:
        """Plan the batch, persist its prompt pack, and mark the batch ready."""
        batch = self.get_batch(batch_id)
        version = self.get_version(batch.version_id)
        plan = self.adapter.plan_batch(
            version_label=version.version_label,
            goal_md=batch.goal_md,
            change_type=batch.change_type,
            ordinal=batch.ordinal,
            parent_commit_id=batch.parent_commit_id,
        )
        pack = self.adapter.batch_prompt_pack(plan=plan, coder=coder)

        prompt = self.repo.create_prompt_version(
            owner_id=self.owner_id,
            batch_id=batch.id,
            coder=pack.coder,
            prompt_text=pack.prompt_text,
            constraints=pack.constraints,
        )
        self._record_artifact(
            version=version,
            artifact_type="prompt_md",
            storage_key=workflow_paths.batch_prompt_key(
                version.project_id, version.id, batch.id, pack.coder
            ),
            content=pack.prompt_text,
        )
        self.repo.set_batch_status(batch, "ready")
        return batch, prompt

    # --- execution / validation -------------------------------------------
    def submit_execution(
        self, batch_id: str, payload: ExecutionRequest
    ) -> tuple[MatrixCommit, ValidationRun, str, str]:
        batch = self.get_batch(batch_id)
        version = self.get_version(batch.version_id)
        allowed, forbidden = self._scope_for_batch(batch.id)

        result = self.adapter.validate_changes(
            changed_files=[f.model_dump() for f in payload.changed_files],
            allowed_files=allowed,
            forbidden_changes=forbidden,
            patch=payload.patch,
        )

        parent = self.repo.latest_commit(version.id)
        commit = self.repo.create_commit(
            owner_id=self.owner_id,
            batch_id=batch.id,
            version_id=version.id,
            commit_no=self.repo.next_commit_no(version.id),
            tree_hash=result.tree_hash,
            summary=payload.summary or result.summary,
            validation_status=result.status,
            parent_commit_id=parent.id if parent else None,
            manifest={
                "added": result.added,
                "changed": result.changed,
                "deleted": result.deleted,
                "summary": result.summary,
            },
        )

        run = self.repo.create_validation_run(
            owner_id=self.owner_id,
            commit_id=commit.id,
            status=result.status,
            score=result.score,
        )
        for finding in result.findings:
            self.repo.create_validation_finding(
                owner_id=self.owner_id,
                validation_run_id=run.id,
                severity=finding["severity"],
                status=finding["status"],
                check_name=finding["check_name"],
                message=finding["message"],
                file_path=finding.get("file_path"),
                remediation=finding.get("remediation"),
            )

        # Persist the diff metadata for this commit.
        diff = self.adapter.diff_commits(
            head_commit_id=commit.id,
            head_manifest=commit.manifest,
            base_commit_id=parent.id if parent else None,
            base_manifest=parent.manifest if parent else None,
        )
        self._record_artifact(
            version=version,
            artifact_type="patch_diff",
            storage_key=workflow_paths.commit_diff_key(version.project_id, version.id, commit.id),
            content=diff.patch,
            commit_id=commit.id,
        )

        outcome, next_action = _OUTCOME[result.status]
        self.repo.set_batch_status(batch, outcome if outcome == "committed" else result.status)
        return commit, run, outcome, next_action

    def enqueue_run(self, batch_id: str, payload: ExecutionRequest) -> tuple[ValidationRun, RunJob]:
        """Create a running validation + its first event, then build the worker job (Batch C3).

        The writes go in a dedicated committed transaction (not the request session, which only
        commits after the response) so the worker's separate session sees the run immediately.
        """
        with session_scope(user_id=self.owner_id) as session:
            repo = WorkflowRepository(session)
            batch = repo.get_batch(batch_id)
            if batch is None:
                raise WorkflowError("Batch not found.", status_code=404)
            version = repo.get_version(batch.version_id)
            prompts = repo.list_prompt_versions(batch.id)
            constraints = (prompts[-1].constraints or {}) if prompts else {}
            run = repo.create_validation_run(
                owner_id=self.owner_id, batch_id=batch.id, status="running"
            )
            repo.append_run_event(
                owner_id=self.owner_id,
                run_id=run.id,
                event_type="run.enqueued",
                payload={"batch_id": batch.id},
            )
            repo.set_batch_status(batch, "running")
            job = RunJob(
                run_id=run.id,
                owner_id=self.owner_id,
                batch_id=batch.id,
                version_id=version.id,
                project_id=version.project_id,
                changed_files=[f.model_dump() for f in payload.changed_files],
                allowed_files=constraints.get("allowed_files"),
                forbidden_changes=constraints.get("forbidden_changes"),
                patch=payload.patch,
                summary=payload.summary,
            )
        return run, job

    def get_run(self, run_id: str) -> ValidationRun:
        return self.get_validation_run(run_id)

    def list_run_events(self, run_id: str, after: int = 0):
        self.get_validation_run(run_id)  # ownership/existence check (RLS-scoped)
        return self.repo.list_run_events_after(run_id, after)

    def _scope_for_batch(self, batch_id: str) -> tuple[list[str] | None, list[str] | None]:
        prompts = self.repo.list_prompt_versions(batch_id)
        if not prompts:
            return None, None
        constraints = prompts[-1].constraints or {}
        return constraints.get("allowed_files"), constraints.get("forbidden_changes")

    # --- commits / diffs / artifacts --------------------------------------
    def get_commit(self, commit_id: str) -> MatrixCommit:
        commit = self.repo.get_commit(commit_id)
        if commit is None:
            raise WorkflowError("Commit not found.", status_code=404)
        return commit

    def diff_commit(self, commit_id: str):
        commit = self.get_commit(commit_id)
        parent = self.repo.get_commit(commit.parent_commit_id) if commit.parent_commit_id else None
        return self.adapter.diff_commits(
            head_commit_id=commit.id,
            head_manifest=commit.manifest,
            base_commit_id=parent.id if parent else None,
            base_manifest=parent.manifest if parent else None,
        )

    def list_commit_artifacts(self, commit_id: str) -> list[Artifact]:
        self.get_commit(commit_id)
        return self.repo.list_artifacts_for_commit(commit_id)

    # --- validation runs ---------------------------------------------------
    def get_validation_run(self, run_id: str) -> ValidationRun:
        run = self.repo.get_validation_run(run_id)
        if run is None:
            raise WorkflowError("Validation run not found.", status_code=404)
        return run

    def list_findings(self, run_id: str):
        return self.repo.list_findings(run_id)

    # --- repair batches ----------------------------------------------------
    def create_repair_batch(self, payload: RepairBatchRequest) -> tuple[BuildBatch, PromptVersion]:
        run = self.get_validation_run(payload.validation_run_id)
        commit = self.get_commit(run.commit_id)
        version = self.get_version(commit.version_id)
        findings = [
            {
                "severity": f.severity,
                "status": f.status,
                "check_name": f.check_name,
                "file_path": f.file_path,
                "message": f.message,
                "remediation": f.remediation,
            }
            for f in self.repo.list_findings(run.id)
        ]
        validation = ChangeValidationResult(
            status=run.status,
            score=run.score or 0,
            findings=findings,
            tree_hash=commit.tree_hash,
            summary=commit.summary,
            added=commit.manifest.get("added", []),
            changed=commit.manifest.get("changed", []),
            deleted=commit.manifest.get("deleted", []),
        )
        ordinal = self.repo.next_batch_ordinal(version.id)
        plan: BatchPlanResult = self.adapter.plan_repair_batch(
            version_label=version.version_label,
            validation=validation,
            ordinal=ordinal,
            parent_commit_id=commit.id,
        )
        batch = self.repo.create_batch(
            owner_id=self.owner_id,
            version_id=version.id,
            ordinal=ordinal,
            title=plan.title,
            goal_md=plan.goal_md,
            change_type=plan.change_type,
            parent_commit_id=commit.id,
        )
        # A repair batch ships ready-to-implement, so emit its prompt pack immediately.
        return self.generate_prompt_pack(batch.id, payload.coder)

    # --- thumbnails --------------------------------------------------------
    def version_thumbnail(self, version_id: str) -> tuple[str, str]:
        """Render (and immutably store, once) the seeded SVG thumbnail for a version.

        The status folded into the seed is the version's current aggregate state — its latest
        commit's validation status, or ``active`` before any commit. Returns ``(svg, status)``.
        """
        from app.integrations.object_storage import ObjectStorage
        from app.services.thumbnails import render_thumbnail

        version = self.get_version(version_id)
        latest = self.repo.latest_commit(version.id)
        status = latest.validation_status if latest else "active"
        svg = render_thumbnail(version.project_id, version.id, status)

        key = workflow_paths.thumbnail_status_key(version.project_id, version.id, status)
        if self.repo.find_artifact_by_key(key) is None:
            ObjectStorage().put_text(key, svg)
            self.repo.create_artifact(
                owner_id=self.owner_id,
                project_id=version.project_id,
                version_id=version.id,
                artifact_type="thumbnail_svg",
                storage_key=key,
                sha256=sha256_text(svg),
                size_bytes=len(svg.encode("utf-8")),
            )
        return svg, status

    # --- sync (Track L2) ---------------------------------------------------
    def sync(self, payload: SyncRequest) -> tuple[str, str, dict]:
        """Upsert a local .mb/ project+version+batches+commits by id, owner-scoped.

        Conflict rule = the server's version-conflict guard: if a *newer* version already exists
        for this project (e.g. an "update requirements" bump from the web), reject the push of a
        stale version rather than clobbering it. Returns (project_id, version_id, applied counts).
        """
        p, v = payload.project, payload.version

        latest = self.repo.latest_version(p.id)
        if latest is not None and latest.id != v.id and _semver(latest.version_label) > _semver(v.version_label):
            raise WorkflowError(
                f"You're editing {v.version_label} but {latest.version_label} is current. "
                "Pull the current version before syncing (sync is upsert-by-id, not a force-push).",
                status_code=409,
            )

        self.repo.upsert(Project(
            id=p.id, owner_id=self.owner_id, title=p.title or p.slug, slug=p.slug,
            description=p.description,
        ))
        self.repo.upsert(BundleVersion(
            id=v.id, owner_id=self.owner_id, project_id=p.id, version_label=v.version_label,
            title=v.title or p.title or p.slug, requirements_md=v.requirements_md,
            created_by=self.owner_id,
        ))
        for b in payload.batches:
            self.repo.upsert(BuildBatch(
                id=b.id, owner_id=self.owner_id, version_id=b.version_id, ordinal=b.ordinal,
                title=b.title, goal_md=b.goal_md, change_type=b.change_type, status=b.status,
                parent_commit_id=b.parent_commit_id, requested_by=self.owner_id,
            ))
        for c in sorted(payload.commits, key=lambda c: c.commit_no):
            self.repo.upsert(MatrixCommit(
                id=c.id, owner_id=self.owner_id, batch_id=c.batch_id, version_id=c.version_id,
                commit_no=c.commit_no, summary=c.summary, tree_hash=c.tree_hash,
                validation_status=c.validation_status, parent_commit_id=c.parent_commit_id,
                manifest=c.manifest,
            ))
        return p.id, v.id, {"batches": len(payload.batches), "commits": len(payload.commits)}

    # --- timeline ----------------------------------------------------------
    def timeline(self, version_id: str) -> tuple[BundleVersion, list[dict]]:
        version = self.get_version(version_id)
        entries: list[dict] = []
        for batch in self.repo.list_batches(version_id):
            entries.append(
                {
                    "kind": "batch",
                    "id": batch.id,
                    "ordinal": batch.ordinal,
                    "title": batch.title,
                    "status": batch.status,
                    "created_at": batch.created_at,
                }
            )
        for commit in self.repo.list_commits(version_id):
            entries.append(
                {
                    "kind": "commit",
                    "id": commit.id,
                    "commit_no": commit.commit_no,
                    "title": commit.summary,
                    "status": commit.validation_status,
                    "created_at": commit.created_at,
                }
            )
        for run in self.repo.list_runs_for_version(version_id):
            entries.append(
                {
                    "kind": "run",
                    "id": run.id,
                    "title": f"Validation {run.status}",
                    "status": run.status,
                    "created_at": run.started_at,
                }
            )
        entries.sort(key=lambda e: e["created_at"])
        return version, entries

    # --- helpers -----------------------------------------------------------
    def _record_artifact(
        self,
        *,
        version: BundleVersion,
        artifact_type: str,
        storage_key: str,
        content: str,
        commit_id: str | None = None,
    ) -> Artifact:
        # C2 persists artifact *metadata* (key, digest, size); bytes are written to object
        # storage in C4. The content-addressed digest keeps the record honest in the meantime.
        encoded = content.encode("utf-8")
        return self.repo.create_artifact(
            owner_id=self.owner_id,
            project_id=version.project_id,
            version_id=version.id,
            commit_id=commit_id,
            artifact_type=artifact_type,
            storage_key=storage_key,
            sha256=sha256_text(content),
            size_bytes=len(encoded),
        )


__all__ = ["WorkflowService", "WorkflowError"]
