from __future__ import annotations

from app.dependencies import get_matrix_builder_service
from app.schemas.idea import IdeaIntent, IdeaRequest


def parse_idea(payload: IdeaRequest) -> IdeaIntent:
    return get_matrix_builder_service().parse_idea(payload)
