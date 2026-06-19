from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.auth import optional_user_id
from app.schemas.blueprint import (
    BlueprintCandidateResponse,
    BlueprintChatRequest,
    BlueprintChatResponse,
    BlueprintDetails,
    BlueprintGenerationRequest,
    BlueprintResult,
    BlueprintSavedResponse,
    BlueprintSaveRequest,
    DesignerCandidate,
    DesignerCandidatesResponse,
)
from app.schemas.idea import IdeaRequest
from app.services.designer_client import DesignerClient, get_designer_client
from app.services.design_bundle_store import DesignBundleStore, get_design_bundle_store
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


# --- Matrix Designer: Blueprint Details page (fail-open via designer_client) -----------
@router.get("/designer-candidates", response_model=DesignerCandidatesResponse)
def designer_candidates(
    idea: str = Query(..., description="The build idea to design the 3 blueprints for."),
    designer: DesignerClient = Depends(get_designer_client),
) -> DesignerCandidatesResponse:
    data = designer.blueprints(idea)
    return DesignerCandidatesResponse(
        candidates=[DesignerCandidate.model_validate(c) for c in data.get("candidates", [])]
    )


@router.get("/{candidate_id}/details", response_model=BlueprintDetails)
def blueprint_details(
    candidate_id: str,
    idea: str = Query(..., description="The build idea this blueprint is for."),
    designer: DesignerClient = Depends(get_designer_client),
) -> BlueprintDetails:
    return BlueprintDetails.model_validate(designer.details(idea, candidate_id))


@router.post("/{candidate_id}/chat", response_model=BlueprintChatResponse)
def blueprint_chat(
    candidate_id: str,
    payload: BlueprintChatRequest,
    designer: DesignerClient = Depends(get_designer_client),
) -> BlueprintChatResponse:
    out = designer.refine(payload.idea or "", payload.message, candidate_id)
    details = out["details"].get(candidate_id) or out["details"].get("standard") or {}
    return BlueprintChatResponse(reply=out.get("reply", ""), details=BlueprintDetails.model_validate(details))


@router.post("/{candidate_id}/save", response_model=BlueprintDetails)
def blueprint_save(
    candidate_id: str,
    payload: BlueprintSaveRequest,
    owner_id: str = Depends(optional_user_id),
    store: DesignBundleStore = Depends(get_design_bundle_store),
) -> BlueprintDetails:
    # batch-10 — persist the edited blueprint + chat for this build, owner-scoped (RLS), so
    # reopening the build restores it. The contract only changes when the user saves.
    if payload.build_id:
        store.save(
            owner_id=owner_id, build_id=payload.build_id, candidate_id=candidate_id,
            idea=payload.idea or "", details=payload.details.model_dump(),
            chat_history=[m.model_dump() for m in payload.details.chat_history],
        )
    return payload.details


@router.get("/{candidate_id}/saved", response_model=BlueprintSavedResponse)
def blueprint_saved(
    candidate_id: str,
    build_id: str = Query(..., description="The build to restore the saved blueprint for."),
    owner_id: str = Depends(optional_user_id),
    store: DesignBundleStore = Depends(get_design_bundle_store),
) -> BlueprintSavedResponse:
    rec = store.get(owner_id, build_id, candidate_id)
    if not rec:
        return BlueprintSavedResponse(found=False)
    return BlueprintSavedResponse(found=True, idea=rec.get("idea", ""),
                                  details=BlueprintDetails.model_validate(rec["details"]))
