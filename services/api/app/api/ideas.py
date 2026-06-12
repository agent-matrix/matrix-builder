from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.idea import IdeaIntent, IdeaRequest
from app.services.matrix_builder_service import MatrixBuilderService
from app.dependencies import get_matrix_builder_service

router = APIRouter()


@router.post("/parse", response_model=IdeaIntent)
def parse(
    payload: IdeaRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> IdeaIntent:
    return service.parse_idea(payload)
