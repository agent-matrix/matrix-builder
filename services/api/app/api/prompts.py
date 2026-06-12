from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_matrix_builder_service
from app.schemas.prompt import PromptPack, PromptResponse
from app.services.matrix_builder_service import MatrixBuilderService
from app.services.prompt_service import build_pack, normalize_coder

router = APIRouter()


@router.get("/{coder}", response_model=PromptResponse)
def get_demo_prompt(
    coder: str,
    bundle_url: str | None = Query(default=None),
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> PromptResponse:
    return service.get_prompt(bundle_id="bundle_demo", coder=normalize_coder(coder), bundle_url=bundle_url)


@router.get("/{bundle_id}/{coder}", response_model=PromptResponse)
def get_prompt_for_bundle(
    bundle_id: str,
    coder: str,
    bundle_url: str | None = Query(default=None),
    service: MatrixBuilderService = Depends(get_matrix_builder_service),
) -> PromptResponse:
    return service.get_prompt(bundle_id=bundle_id, coder=normalize_coder(coder), bundle_url=bundle_url)


@router.get("/{bundle_id}/pack/all", response_model=PromptPack)
def get_prompt_pack(bundle_id: str) -> PromptPack:
    return build_pack(bundle_id=bundle_id, blueprint_id="bp_demo_standard", default_coder="claude-code")
