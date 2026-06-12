from __future__ import annotations

from app.dependencies import get_matrix_builder_service
from app.schemas.blueprint import BlueprintCandidate, BlueprintResult
from app.schemas.idea import IdeaRequest


def generate_candidates(payload: IdeaRequest) -> list[BlueprintCandidate]:
    return get_matrix_builder_service().generate_candidates(payload)


def generate_blueprint(payload: IdeaRequest, candidate_id: str | None = None) -> BlueprintResult:
    return get_matrix_builder_service().generate_blueprint(payload, candidate_id=candidate_id)


# Backwards-compatible names from earlier batches.
def generate_mock_candidates(payload: IdeaRequest) -> list[BlueprintCandidate]:
    return generate_candidates(payload)


def generate_mock_blueprint(payload: IdeaRequest) -> BlueprintResult:
    return generate_blueprint(payload)
