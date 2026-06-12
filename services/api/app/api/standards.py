from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.standards import StandardsStatus
from app.services.matrix_builder_service import MatrixBuilderService
from app.dependencies import get_matrix_builder_service

router = APIRouter()


@router.get("/current", response_model=StandardsStatus)
def current(
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> StandardsStatus:
    return service.current_standards()
