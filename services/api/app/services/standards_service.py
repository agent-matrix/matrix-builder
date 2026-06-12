from __future__ import annotations

from app.dependencies import get_matrix_builder_service
from app.schemas.standards import StandardsStatus


def current_standards_status() -> StandardsStatus:
    return get_matrix_builder_service().current_standards()
