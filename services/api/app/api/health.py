from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.services.matrix_builder_service import MatrixBuilderService
from app.dependencies import get_matrix_builder_service

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}


@router.get("/ready")
def ready(
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> dict[str, object]:
    return {"ready": True, **service.runtime_status()}
