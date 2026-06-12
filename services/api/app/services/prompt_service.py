from __future__ import annotations

from app.schemas.common import CoderId
from app.schemas.prompt import PromptPack, PromptResponse
from app.services.ai_coder_prompt_service import (
    CONTRACT_FILES,
    build_prompt_content,
    build_prompt_pack,
    build_prompt_response,
    normalize_coder,
)


def build_prompt(bundle_id: str, coder: str | CoderId, bundle_url: str | None = None) -> PromptResponse:
    return build_prompt_response(bundle_id=bundle_id, coder=normalize_coder(coder), bundle_url=bundle_url)


def build_pack(bundle_id: str, blueprint_id: str, default_coder: str | CoderId = CoderId.CLAUDE_CODE, bundle_url: str | None = None) -> PromptPack:
    return build_prompt_pack(bundle_id=bundle_id, blueprint_id=blueprint_id, default_coder=default_coder, bundle_url=bundle_url)


def build_mock_prompt(coder: str) -> str:
    return build_prompt_content("bundle_demo", normalize_coder(coder))


__all__ = ["CONTRACT_FILES", "build_pack", "build_prompt", "build_mock_prompt", "normalize_coder"]
