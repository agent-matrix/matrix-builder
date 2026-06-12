from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.integrations.agent_generator_adapter import AgentGeneratorAdapter
from app.integrations.matrix_definitions_client import MatrixDefinitionsClient
from app.services.matrix_builder_service import MatrixBuilderService


@lru_cache
def get_agent_generator_adapter() -> AgentGeneratorAdapter:
    settings = get_settings()
    return AgentGeneratorAdapter(mode=settings.agent_generator_mode)


@lru_cache
def get_matrix_definitions_client() -> MatrixDefinitionsClient:
    return MatrixDefinitionsClient()


@lru_cache
def get_matrix_builder_service() -> MatrixBuilderService:
    return MatrixBuilderService(
        agent_generator=get_agent_generator_adapter(),
        matrix_definitions=get_matrix_definitions_client(),
    )
