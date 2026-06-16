from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.core.auth import optional_user_id
from app.core.config import get_settings
from app.dependencies import get_gitpilot_run_service, get_matrix_builder_service
from app.observability.metrics import metrics_registry
from app.schemas.bundle import (
    BundleCleanupResponse,
    BundleGenerationRequest,
    BundleManifest,
    BundleSaveRequest,
    BundleSaveResponse,
    BundleTreeNode,
    MatrixBundle,
    QuotaStatus,
    SignedBundleUrlResponse,
)
from app.schemas.gitpilot import (
    GitPilotPrRequest,
    GitPilotPrResponse,
    GitPilotRepairRequest,
    GitPilotRunRequest,
    GitPilotRunResponse,
    GitPilotValidationResult,
)
from app.schemas.prompt import PromptResponse
from app.schemas.publication import PublicationRequest, PublicationResponse
from app.schemas.validation import ChangedFile, ValidationReport, ValidationRequest
from app.services.gitpilot_run_service import (
    GitPilotError,
    GitPilotRunService,
    PrNotApprovedError,
    commit_gate,
)
from app.services.gitpilot_run_store import get_run_store
from app.services.matrix_builder_service import MatrixBuilderService
from app.services.signed_url_service import SignedUrlService

logger = logging.getLogger("matrix_builder.gitpilot")

router = APIRouter()


@router.get("/quota/guest", response_model=QuotaStatus)
def guest_quota(service: MatrixBuilderService = Depends(get_matrix_builder_service)) -> QuotaStatus:
    return service.guest_quota()


@router.post("/cleanup/expired", response_model=BundleCleanupResponse)
def cleanup_expired_bundles(
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> BundleCleanupResponse:
    return service.cleanup_expired_bundles()


@router.post("", response_model=MatrixBundle)
def generate_bundle(
    payload: BundleGenerationRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> MatrixBundle:
    return service.generate_bundle(payload)


@router.get("/{bundle_id}", response_model=MatrixBundle)
def get_bundle(
    bundle_id: str,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> MatrixBundle:
    return service.get_bundle(bundle_id=bundle_id)


@router.get("/{bundle_id}/manifest", response_model=BundleManifest)
def get_bundle_manifest(
    bundle_id: str,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> BundleManifest:
    manifest = service.get_bundle_manifest(bundle_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Bundle manifest not found")
    return manifest


@router.get("/{bundle_id}/tree", response_model=list[BundleTreeNode])
def get_bundle_tree(
    bundle_id: str,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> list[BundleTreeNode]:
    return service.get_bundle_tree(bundle_id)


@router.get("/{bundle_id}/prompt/{coder}", response_model=PromptResponse)
def get_bundle_prompt(
    bundle_id: str,
    coder: str,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> PromptResponse:
    return service.get_prompt(bundle_id=bundle_id, coder=coder)


@router.post("/{bundle_id}/signed-url", response_model=SignedBundleUrlResponse)
def create_signed_bundle_url(
    bundle_id: str,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> SignedBundleUrlResponse:
    return service.get_signed_bundle_url(bundle_id)


@router.post("/{bundle_id}/gitpilot/runs", response_model=GitPilotRunResponse)
def create_gitpilot_run(
    bundle_id: str,
    payload: GitPilotRunRequest | None = None,
    service: GitPilotRunService = Depends(get_gitpilot_run_service),
    owner_id: str = Depends(optional_user_id),
) -> GitPilotRunResponse:
    """Start a cloud GitPilot run for a bundle.

    The signed bundle URL and the A2A secret are added server-side and never
    reach the browser. GitPilot only ever implements inside the contract. The run
    is recorded (owner-scoped) so it shows in the user's history.
    """
    request = payload or GitPilotRunRequest()
    try:
        result = service.create_run(bundle_id, request)
    except GitPilotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    get_run_store().record(
        run_id=result.run_id,
        owner_id=owner_id,
        bundle_id=bundle_id,
        task_id=request.task_id,
        source="cloud",
        status=result.status,
    )
    metrics_registry.inc("gitpilot_runs_created")
    logger.info("gitpilot.run.created run_id=%s bundle_id=%s", result.run_id, bundle_id)
    return result


@router.post(
    "/{bundle_id}/gitpilot/runs/{run_id}/validate", response_model=GitPilotValidationResult
)
def validate_gitpilot_run(
    bundle_id: str,
    run_id: str,
    gitpilot: GitPilotRunService = Depends(get_gitpilot_run_service),
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
    owner_id: str = Depends(optional_user_id),
) -> GitPilotValidationResult:
    """Feed a GitPilot run's diff into Matrix validation (Batch 7).

    The verdict (approved / needs-repair / rejected) drives the commit gate.
    GitPilot's own test pass is NOT approval — only this Matrix validation is.
    """
    try:
        run = gitpilot.get_run(run_id)
    except GitPilotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    request = ValidationRequest(
        bundle_id=bundle_id,
        mode="patch",
        changed_files=[ChangedFile(path=path) for path in run.changed_files],
    )
    report = service.validate_bundle(bundle_id=bundle_id, payload=request)
    gate = commit_gate(report.status)
    store = get_run_store()
    store.update_status(
        run_id,
        owner_id,
        status=run.status,
        test_status=run.test_status,
        summary=run.summary,
        changed_files=run.changed_files,
    )
    store.record_validation(
        run_id, owner_id, validation_status=str(report.status), can_commit=gate.can_commit
    )
    verdict = str(report.status).replace("-", "_")
    metrics_registry.inc("gitpilot_validations_total")
    metrics_registry.inc(f"gitpilot_validations_{verdict}")
    logger.info("gitpilot.run.validated run_id=%s verdict=%s", run_id, report.status)
    return GitPilotValidationResult(run_id=run_id, gate=gate, report=report)


@router.post("/{bundle_id}/gitpilot/runs/{run_id}/repair", response_model=GitPilotRunResponse)
def repair_gitpilot_run(
    bundle_id: str,
    run_id: str,
    payload: GitPilotRepairRequest | None = None,
    gitpilot: GitPilotRunService = Depends(get_gitpilot_run_service),
    owner_id: str = Depends(optional_user_id),
) -> GitPilotRunResponse:
    """Dispatch a repair to GitPilot (Batch 8); it re-runs inside the contract."""
    try:
        child = gitpilot.repair_run(run_id, payload or GitPilotRepairRequest())
    except GitPilotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    get_run_store().record(
        run_id=child.run_id,
        owner_id=owner_id,
        bundle_id=bundle_id,
        source="cloud",
        status=child.status,
        parent_run_id=run_id,
    )
    metrics_registry.inc("gitpilot_repairs")
    logger.info("gitpilot.run.repaired parent=%s child=%s", run_id, child.run_id)
    return child


@router.post("/{bundle_id}/gitpilot/runs/{run_id}/pr", response_model=GitPilotPrResponse)
def open_gitpilot_pr(
    bundle_id: str,
    run_id: str,
    payload: GitPilotPrRequest | None = None,
    gitpilot: GitPilotRunService = Depends(get_gitpilot_run_service),
    owner_id: str = Depends(optional_user_id),
) -> GitPilotPrResponse:
    """Open a PR for an approved run (Batch 11).

    Gated on the Matrix verdict: only a run Matrix has approved can become a PR.
    409 otherwise — opening a PR is Matrix authority, not GitPilot's test pass.
    """
    try:
        result = gitpilot.create_pr(run_id, owner_id, payload or GitPilotPrRequest())
    except PrNotApprovedError as exc:
        metrics_registry.inc("gitpilot_prs_blocked")
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except GitPilotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    metrics_registry.inc("gitpilot_prs_opened")
    logger.info("gitpilot.pr.opened run_id=%s status=%s", run_id, result.status)
    return result


@router.post("/{bundle_id}/save", response_model=BundleSaveResponse)
def save_bundle(
    bundle_id: str,
    payload: BundleSaveRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> BundleSaveResponse:
    try:
        return service.save_bundle(bundle_id, payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Bundle not found") from exc


@router.post("/{bundle_id}/validate", response_model=ValidationReport)
def validate_bundle(
    bundle_id: str,
    payload: ValidationRequest | None = None,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> ValidationReport:
    return service.validate_bundle(bundle_id=bundle_id, payload=payload)


@router.post("/{bundle_id}/publish-to-matrixhub", response_model=PublicationResponse)
def publish_bundle_to_matrixhub(
    bundle_id: str,
    payload: PublicationRequest | None = None,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> PublicationResponse:
    return service.publish_to_matrixhub(bundle_id=bundle_id, payload=payload)


@router.get("/{bundle_id}/download")
def download_bundle(
    bundle_id: str,
    expires: int | None = Query(default=None),
    token: str | None = Query(default=None),
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> FileResponse:
    # In prod (SIGNED_URL_ENFORCE), the signed token is verified and expired or
    # tampered links are rejected. In dev it stays permissive so local fixtures
    # and unsigned links keep working.
    settings = get_settings()
    if settings.signed_url_enforce:
        if expires is None or not token:
            raise HTTPException(status_code=401, detail="Signed URL required")
        if not SignedUrlService().verify_download_token(bundle_id, expires, token):
            raise HTTPException(status_code=403, detail="Signed URL expired or invalid")
    path: Path | None = service.get_bundle_zip_path(bundle_id)
    if path is None or not path.exists():
        raise HTTPException(
            status_code=404, detail="Bundle ZIP not found. Generate the bundle first."
        )
    return FileResponse(
        path=path,
        media_type="application/zip",
        filename=f"{bundle_id}.zip",
        headers={"X-Matrix-Bundle-Id": bundle_id},
    )
