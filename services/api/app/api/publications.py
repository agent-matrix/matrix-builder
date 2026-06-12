from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_matrix_builder_service
from app.schemas.publication import PublicationRequest, PublicationResponse
from app.services.matrix_builder_service import MatrixBuilderService
from app.services.publication_service import matrixhub_dry_run

router = APIRouter()


@router.post("/matrixhub", response_model=PublicationResponse)
def publish_matrixhub_dry_run() -> PublicationResponse:
    return matrixhub_dry_run()


@router.post("/matrixhub/{bundle_id}", response_model=PublicationResponse)
def publish_matrixhub_bundle(
    bundle_id: str,
    payload: PublicationRequest | None = None,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> PublicationResponse:
    return service.publish_to_matrixhub(bundle_id=bundle_id, payload=payload)
