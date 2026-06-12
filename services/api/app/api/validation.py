from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_matrix_builder_service
from app.schemas.validation import ValidationReport, ValidationRequest
from app.services.matrix_builder_service import MatrixBuilderService
from app.services.validation_service import get_placeholder_validation

router = APIRouter()


@router.post("/reports", response_model=ValidationReport)
def validate_placeholder() -> ValidationReport:
    # Legacy route: tells the UI no generated repo/patch has been submitted yet.
    return get_placeholder_validation()


@router.post("/patch", response_model=ValidationReport)
def validate_patch(
    payload: ValidationRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> ValidationReport:
    bundle_id = payload.bundle_id or "bundle_demo"
    return service.validate_bundle(bundle_id=bundle_id, payload=payload)


@router.post("/repository", response_model=ValidationReport)
def validate_repository(
    payload: ValidationRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> ValidationReport:
    payload.mode = "repository"
    bundle_id = payload.bundle_id or "bundle_demo"
    return service.validate_bundle(bundle_id=bundle_id, payload=payload)
