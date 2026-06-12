from __future__ import annotations

from app.dependencies import get_matrix_builder_service
from app.schemas.validation import ValidationReport, ValidationRequest


def validate_bundle(bundle_id: str, payload: ValidationRequest | None = None) -> ValidationReport:
    return get_matrix_builder_service().validate_bundle(bundle_id, payload)


def get_placeholder_validation() -> ValidationReport:
    # Kept for legacy smoke tests: this endpoint means validation has not been requested yet.
    return ValidationReport(
        report_id="validation_not_run",
        bundle_id="bundle_demo",
        status="not-run",
        score=0,
        violations=[],
        checks=[],
        approved=False,
        matrixhub_publishable=False,
        summary="Validation has not been run yet.",
    )
