from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.core.auth import optional_user_id
from app.dependencies import get_gitpilot_run_service
from app.schemas.gitpilot import (
    GitPilotMetricsSummary,
    GitPilotRunHistory,
    GitPilotRunRecord,
    GitPilotRunStatusResponse,
)
from app.services.gitpilot_run_service import GitPilotError, GitPilotRunService
from app.services.gitpilot_run_store import get_run_store

router = APIRouter()


@router.get("/metrics", response_model=GitPilotMetricsSummary)
def gitpilot_metrics(owner_id: str = Depends(optional_user_id)) -> GitPilotMetricsSummary:
    """Observability summary of the caller's GitPilot runs (status + verdicts).

    Process-wide Prometheus counters live at /metrics; this is the per-owner
    view used by the UI / demo dashboard.
    """
    store = get_run_store()
    runs = store.list(owner_id, limit=500)
    by_status = Counter(r["status"] for r in runs)
    by_verdict = Counter(r["validation_status"] for r in runs if r.get("validation_status"))
    return GitPilotMetricsSummary(
        runs=len(runs),
        by_status=dict(by_status),
        by_verdict=dict(by_verdict),
        committable=sum(1 for r in runs if r.get("can_commit")),
        history_backend=store.backend,
    )


@router.get("/runs", response_model=GitPilotRunHistory)
def list_gitpilot_runs(
    bundle_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    owner_id: str = Depends(optional_user_id),
) -> GitPilotRunHistory:
    """The caller's GitPilot run history (persisted, owner-scoped)."""
    store = get_run_store()
    runs = [
        GitPilotRunRecord(**{k: v for k, v in r.items() if k != "owner_id"})
        for r in store.list(owner_id, bundle_id=bundle_id, limit=limit)
    ]
    return GitPilotRunHistory(backend=store.backend, runs=runs)


@router.get("/runs/{run_id}", response_model=GitPilotRunStatusResponse)
def get_gitpilot_run(
    run_id: str,
    service: GitPilotRunService = Depends(get_gitpilot_run_service),
    owner_id: str = Depends(optional_user_id),
) -> GitPilotRunStatusResponse:
    """Result-sync for a cloud GitPilot run.

    NOTE: a passing GitPilot run is NOT Matrix approval. Matrix Builder runs its
    own validation to approve / reject — this only reflects GitPilot's
    implementation state (diff / logs / tests).
    """
    try:
        status = service.get_run(run_id)
    except GitPilotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    # Keep the persisted history current with the latest synced state.
    get_run_store().update_status(
        run_id,
        owner_id,
        status=status.status,
        test_status=status.test_status,
        summary=status.summary,
        changed_files=status.changed_files,
    )
    return status


@router.get("/runs/{run_id}/diff", response_class=PlainTextResponse)
def get_gitpilot_run_diff(
    run_id: str,
    service: GitPilotRunService = Depends(get_gitpilot_run_service),
) -> str:
    try:
        return service.get_run_diff(run_id)
    except GitPilotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/runs/{run_id}/logs", response_class=PlainTextResponse)
def get_gitpilot_run_logs(
    run_id: str,
    service: GitPilotRunService = Depends(get_gitpilot_run_service),
) -> str:
    try:
        return service.get_run_logs(run_id)
    except GitPilotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
