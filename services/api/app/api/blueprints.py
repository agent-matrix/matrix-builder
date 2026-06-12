from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.blueprint import (
    BlueprintCandidateResponse,
    BlueprintGenerationRequest,
    BlueprintResult,
)
from app.schemas.idea import IdeaRequest
from app.services.matrix_builder_service import MatrixBuilderService
from app.dependencies import get_matrix_builder_service

router = APIRouter()


@router.post("/candidates", response_model=BlueprintCandidateResponse)
def candidates(
    payload: IdeaRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> BlueprintCandidateResponse:
    return BlueprintCandidateResponse(candidates=service.generate_candidates(payload))


@router.post("", response_model=BlueprintResult)
def generate_blueprint(
    payload: IdeaRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> BlueprintResult:
    return service.generate_blueprint(payload)


@router.post("/generate", response_model=BlueprintResult)
def generate_selected_blueprint(
    payload: BlueprintGenerationRequest,
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> BlueprintResult:
    return service.generate_blueprint(payload.idea_request, candidate_id=payload.candidate_id)
