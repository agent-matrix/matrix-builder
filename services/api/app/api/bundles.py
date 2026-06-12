from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.dependencies import get_matrix_builder_service
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
from app.schemas.prompt import PromptResponse
from app.schemas.publication import PublicationRequest, PublicationResponse
from app.schemas.validation import ValidationReport, ValidationRequest
from app.services.matrix_builder_service import MatrixBuilderService

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
    # Token verification is intentionally permissive in dev mode; signed links are generated now
    # and strict enforcement can be enabled once auth/account policies arrive.
    path: Path | None = service.get_bundle_zip_path(bundle_id)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Bundle ZIP not found. Generate the bundle first.")
    return FileResponse(
        path=path,
        media_type="application/zip",
        filename=f"{bundle_id}.zip",
        headers={"X-Matrix-Bundle-Id": bundle_id},
    )
