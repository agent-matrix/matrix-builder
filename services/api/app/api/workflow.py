"""/v1 Continuous Build workflow API (Batch C2).

The create-batch -> prompt -> submit-changes -> validation-run -> commit-or-repair loop, served
over HTTP and persisted in Postgres with owner-scoped RLS. Every route requires a valid Supabase
JWT (via ``get_workflow_service`` -> ``current_user_id``); rows are isolated per user.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Response, WebSocket, WebSocketDisconnect

from app.core.auth import AuthError, user_id_from_token
from app.db.engine import session_scope
from app.db.orm import (
    Artifact,
    BuildBatch,
    BundleVersion,
    MatrixCommit,
    Project,
    ValidationRun,
)
from app.db.repository import WorkflowRepository
from app.dependencies import get_workflow_service
from app.runtime import get_event_bus, get_run_worker
from app.schemas.workflow import (
    ArtifactResponse,
    BatchCreate,
    BatchResponse,
    CommitDiffResponse,
    CommitResponse,
    ExecutionRequest,
    ExecutionResponse,
    ProjectCreate,
    ProjectResponse,
    PromptPackRequest,
    PromptPackResponse,
    RepairBatchRequest,
    RunEnqueueResponse,
    RunEventResponse,
    RunResponse,
    SyncRequest,
    SyncResponse,
    TimelineEntry,
    TimelineResponse,
    ValidationFindingResponse,
    ValidationRunResponse,
    VersionCreate,
    VersionResponse,
    ui_label,
)
from app.services.workflow_service import WorkflowError, WorkflowService

router = APIRouter()

_TERMINAL_EVENTS = frozenset({"run.completed", "run.failed"})


def _service(svc: WorkflowService = Depends(get_workflow_service)) -> WorkflowService:
    return svc


def _handle(exc: WorkflowError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# --- serializers ---------------------------------------------------------------------------


def _project(p: Project) -> ProjectResponse:
    return ProjectResponse(
        id=p.id, owner_id=p.owner_id, title=p.title, slug=p.slug, description=p.description,
        status=p.status, privacy=p.privacy, created_at=p.created_at,
    )


def _version(v: BundleVersion) -> VersionResponse:
    return VersionResponse(
        id=v.id, project_id=v.project_id, parent_version_id=v.parent_version_id,
        version_label=v.version_label, title=v.title, requirements_md=v.requirements_md,
        status=v.status, created_at=v.created_at,
    )


def _batch(b: BuildBatch) -> BatchResponse:
    return BatchResponse(
        id=b.id, version_id=b.version_id, ordinal=b.ordinal, title=b.title, goal_md=b.goal_md,
        change_type=b.change_type, status=b.status, parent_commit_id=b.parent_commit_id,
        created_at=b.created_at,
    )


def _commit(c: MatrixCommit) -> CommitResponse:
    return CommitResponse(
        id=c.id, version_id=c.version_id, batch_id=c.batch_id, commit_no=c.commit_no,
        summary=c.summary, tree_hash=c.tree_hash, validation_status=c.validation_status,
        ui_label=ui_label(c.validation_status), parent_commit_id=c.parent_commit_id,
        created_at=c.created_at,
    )


def _artifact(a: Artifact) -> ArtifactResponse:
    return ArtifactResponse(
        id=a.id, artifact_type=a.artifact_type, storage_key=a.storage_key,
        sha256=a.sha256, size_bytes=a.size_bytes,
    )


def _run(svc: WorkflowService, run: ValidationRun) -> ValidationRunResponse:
    findings = [
        ValidationFindingResponse(
            id=f.id, severity=f.severity, status=f.status, check_name=f.check_name,
            file_path=f.file_path, message=f.message, remediation=f.remediation,
        )
        for f in svc.list_findings(run.id)
    ]
    return ValidationRunResponse(
        id=run.id, commit_id=run.commit_id, status=run.status, ui_label=ui_label(run.status),
        score=run.score, runner=run.runner, findings=findings,
    )


# --- projects ------------------------------------------------------------------------------


@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, svc: WorkflowService = Depends(_service)) -> ProjectResponse:
    return _project(svc.create_project(payload))


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(svc: WorkflowService = Depends(_service)) -> list[ProjectResponse]:
    return [_project(p) for p in svc.list_projects()]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, svc: WorkflowService = Depends(_service)) -> ProjectResponse:
    try:
        return _project(svc.get_project(project_id))
    except WorkflowError as exc:
        raise _handle(exc) from exc


# --- versions ------------------------------------------------------------------------------


@router.post("/versions", response_model=VersionResponse, status_code=201)
def create_version(payload: VersionCreate, svc: WorkflowService = Depends(_service)) -> VersionResponse:
    try:
        return _version(svc.create_version(payload))
    except WorkflowError as exc:
        raise _handle(exc) from exc


@router.get("/versions/{version_id}", response_model=VersionResponse)
def get_version(version_id: str, svc: WorkflowService = Depends(_service)) -> VersionResponse:
    try:
        return _version(svc.get_version(version_id))
    except WorkflowError as exc:
        raise _handle(exc) from exc


@router.get("/versions/{version_id}/timeline", response_model=TimelineResponse)
def get_timeline(version_id: str, svc: WorkflowService = Depends(_service)) -> TimelineResponse:
    try:
        version, entries = svc.timeline(version_id)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return _timeline_response(version, entries)


def _timeline_response(version, entries) -> TimelineResponse:
    return TimelineResponse(
        version_id=version.id,
        version_label=version.version_label,
        entries=[
            TimelineEntry(
                kind=e["kind"], id=e["id"], ordinal=e.get("ordinal"), commit_no=e.get("commit_no"),
                title=e["title"], status=e["status"],
                ui_label=ui_label(e["status"]) if e["kind"] in ("commit", "run") else None,
                created_at=e["created_at"],
            )
            for e in entries
        ],
    )


@router.post("/sync", response_model=SyncResponse)
def sync(payload: SyncRequest, svc: WorkflowService = Depends(_service)) -> SyncResponse:
    """Upsert a local .mb/ workspace into the server (Track L2). Idempotent by id."""
    try:
        project_id, version_id, applied = svc.sync(payload)
        version, entries = svc.timeline(version_id)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return SyncResponse(
        project_id=project_id, version_id=version_id, applied=applied,
        timeline=_timeline_response(version, entries),
    )


@router.get("/versions/{version_id}/thumbnail.svg")
def get_version_thumbnail(
    version_id: str, svc: WorkflowService = Depends(_service)
) -> Response:
    try:
        svg, status = svc.version_thumbnail(version_id)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"X-Thumbnail-Status": status, "Cache-Control": "public, max-age=86400"},
    )


# --- batches -------------------------------------------------------------------------------


@router.post("/batches", response_model=BatchResponse, status_code=201)
def create_batch(payload: BatchCreate, svc: WorkflowService = Depends(_service)) -> BatchResponse:
    try:
        return _batch(svc.create_batch(payload))
    except WorkflowError as exc:
        raise _handle(exc) from exc


@router.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: str, svc: WorkflowService = Depends(_service)) -> BatchResponse:
    try:
        return _batch(svc.get_batch(batch_id))
    except WorkflowError as exc:
        raise _handle(exc) from exc


@router.post("/batches/{batch_id}/prompt-pack", response_model=PromptPackResponse, status_code=201)
def generate_prompt_pack(
    batch_id: str, payload: PromptPackRequest, svc: WorkflowService = Depends(_service)
) -> PromptPackResponse:
    try:
        batch, prompt = svc.generate_prompt_pack(batch_id, payload.coder.value)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return PromptPackResponse(
        batch_id=batch.id, prompt_version_id=prompt.id, coder=prompt.coder,
        prompt_text=prompt.prompt_text, constraints=prompt.constraints, batch_status=batch.status,
    )


@router.post("/batches/{batch_id}/executions", response_model=ExecutionResponse, status_code=201)
def submit_execution(
    batch_id: str, payload: ExecutionRequest, svc: WorkflowService = Depends(_service)
) -> ExecutionResponse:
    try:
        commit, run, outcome, next_action = svc.submit_execution(batch_id, payload)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return ExecutionResponse(
        commit=_commit(commit), validation_run=_run(svc, run),
        outcome=outcome, next_action=next_action,
    )


# --- commits -------------------------------------------------------------------------------


@router.get("/commits/{commit_id}", response_model=CommitResponse)
def get_commit(commit_id: str, svc: WorkflowService = Depends(_service)) -> CommitResponse:
    try:
        return _commit(svc.get_commit(commit_id))
    except WorkflowError as exc:
        raise _handle(exc) from exc


@router.get("/commits/{commit_id}/diff", response_model=CommitDiffResponse)
def get_commit_diff(commit_id: str, svc: WorkflowService = Depends(_service)) -> CommitDiffResponse:
    try:
        diff = svc.diff_commit(commit_id)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return CommitDiffResponse(
        base_commit_id=diff.base_commit_id, head_commit_id=diff.head_commit_id, patch=diff.patch
    )


@router.get("/commits/{commit_id}/artifacts", response_model=list[ArtifactResponse])
def list_commit_artifacts(commit_id: str, svc: WorkflowService = Depends(_service)) -> list[ArtifactResponse]:
    try:
        return [_artifact(a) for a in svc.list_commit_artifacts(commit_id)]
    except WorkflowError as exc:
        raise _handle(exc) from exc


# --- validation runs -----------------------------------------------------------------------


@router.get("/validation-runs/{run_id}", response_model=ValidationRunResponse)
def get_validation_run(run_id: str, svc: WorkflowService = Depends(_service)) -> ValidationRunResponse:
    try:
        return _run(svc, svc.get_validation_run(run_id))
    except WorkflowError as exc:
        raise _handle(exc) from exc


# --- repair batches ------------------------------------------------------------------------


@router.post("/repair-batches", response_model=PromptPackResponse, status_code=201)
def create_repair_batch(
    payload: RepairBatchRequest, svc: WorkflowService = Depends(_service)
) -> PromptPackResponse:
    try:
        batch, prompt = svc.create_repair_batch(payload)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return PromptPackResponse(
        batch_id=batch.id, prompt_version_id=prompt.id, coder=prompt.coder,
        prompt_text=prompt.prompt_text, constraints=prompt.constraints, batch_status=batch.status,
    )


# --- async runs + live events (Batch C3) ---------------------------------------------------


def _run_response(run: ValidationRun) -> RunResponse:
    return RunResponse(
        id=run.id, batch_id=run.batch_id, commit_id=run.commit_id, status=run.status,
        ui_label=ui_label(run.status), score=run.score, runner=run.runner,
    )


@router.post("/batches/{batch_id}/runs", response_model=RunEnqueueResponse, status_code=202)
async def enqueue_run(
    batch_id: str, payload: ExecutionRequest, svc: WorkflowService = Depends(_service)
) -> RunEnqueueResponse:
    """Enqueue an asynchronous, worker-driven validation run and stream its events."""
    try:
        run, job = svc.enqueue_run(batch_id, payload)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    await get_run_worker().enqueue(job)
    return RunEnqueueResponse(
        run_id=run.id, status=run.status, ui_label=ui_label(run.status),
        events_url=f"/api/v1/runs/{run.id}/events", ws_url=f"/api/v1/ws/runs/{run.id}",
    )


@router.get("/runs/{run_id}", response_model=RunResponse)
def get_run(run_id: str, svc: WorkflowService = Depends(_service)) -> RunResponse:
    try:
        return _run_response(svc.get_run(run_id))
    except WorkflowError as exc:
        raise _handle(exc) from exc


@router.get("/runs/{run_id}/events", response_model=list[RunEventResponse])
def get_run_events(
    run_id: str, after: int = 0, svc: WorkflowService = Depends(_service)
) -> list[RunEventResponse]:
    try:
        events = svc.list_run_events(run_id, after)
    except WorkflowError as exc:
        raise _handle(exc) from exc
    return [
        RunEventResponse(
            seq=e.seq, run_id=e.run_id, event_type=e.event_type, payload=e.payload,
            created_at=e.created_at,
        )
        for e in events
    ]


def _ws_token(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token")
    if token:
        return token
    auth = websocket.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


def _replay_events(user_id: str, run_id: str, after: int) -> list[dict]:
    with session_scope(user_id=user_id) as session:
        rows = WorkflowRepository(session).list_run_events_after(run_id, after)
        return [
            {"run_id": r.run_id, "seq": r.seq, "event_type": r.event_type, "payload": r.payload}
            for r in rows
        ]


@router.websocket("/ws/runs/{run_id}")
async def ws_run(websocket: WebSocket, run_id: str, after: int = 0) -> None:
    """Stream a run's events. Replays everything after ``after`` from the durable log, then
    follows the live tail. On overflow the socket closes so the client reconnects and replays
    (drop-and-replay; the engine is never back-pressured).
    """
    token = _ws_token(websocket)
    try:
        user_id = user_id_from_token(token) if token else None
    except AuthError:
        user_id = None
    if not user_id:
        await websocket.close(code=1008)
        return

    bus = get_event_bus()
    queue = bus.subscribe(run_id)  # subscribe BEFORE replay so nothing slips through the gap
    await websocket.accept()
    try:
        last_seq = after
        for event in await asyncio.to_thread(_replay_events, user_id, run_id, after):
            await websocket.send_json(event)
            last_seq = max(last_seq, event["seq"])
            if event["event_type"] in _TERMINAL_EVENTS:
                await websocket.close()
                return

        while True:
            event = await queue.get()
            if event.get("__overflow__"):
                await websocket.close(code=1011)
                return
            if event["run_id"] != run_id or event["seq"] <= last_seq:
                continue
            await websocket.send_json(event)
            last_seq = event["seq"]
            if event["event_type"] in _TERMINAL_EVENTS:
                await websocket.close()
                return
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(run_id, queue)
