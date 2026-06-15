from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.auth import current_user_id
from app.core.config import get_settings
from app.db.engine import session_scope
from app.integrations.agent_generator_adapter import AgentGeneratorAdapter
from app.integrations.matrix_definitions_client import MatrixDefinitionsClient
from app.services.gitpilot_run_service import GitPilotRunService
from app.services.matrix_builder_service import MatrixBuilderService
from app.services.workflow_service import WorkflowService


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


def get_gitpilot_run_service() -> GitPilotRunService:
    # Not cached: reads current settings so mode/secret/base_url stay live.
    return GitPilotRunService()


def get_db_session(user_id: str = Depends(current_user_id)) -> Iterator[Session]:
    """Per-request transactional session with RLS scoped to the authenticated Supabase user."""
    with session_scope(user_id=user_id) as session:
        yield session


def get_workflow_service(
    user_id: str = Depends(current_user_id),
    session: Session = Depends(get_db_session),
) -> WorkflowService:
    return WorkflowService(
        session=session, owner_id=user_id, adapter=get_agent_generator_adapter()
    )
