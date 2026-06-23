from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from app.schemas.standards import StandardsStatus
from app.services.matrix_builder_service import MatrixBuilderService
from app.dependencies import get_matrix_builder_service

router = APIRouter()


@router.get("/current", response_model=StandardsStatus)
def current(
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> StandardsStatus:
    return service.current_standards()


@router.get("/download")
def download(
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> RedirectResponse:
    """Resolve to the full Ruslan Definitions (RMD) pack for the pinned version.

    The controlled coder prompt cites a stable, same-origin URL
    (``/api/v1/standards/download``); this redirects to the canonical definitions so the
    coder can read the rule text and technology baseline behind MATRIX_STANDARDS.lock.
    """
    return RedirectResponse(url=service.matrix_definitions.download_url(), status_code=307)
