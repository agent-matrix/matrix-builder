from __future__ import annotations

from app.dependencies import get_matrix_builder_service
from app.schemas.publication import PublicationRequest, PublicationResponse


def matrixhub_dry_run() -> PublicationResponse:
    return PublicationResponse(
        publication_id="pub_matrixhub_dry_run",
        bundle_id="bundle_demo",
        target="matrixhub",
        dry_run=True,
        accepted=False,
        status="not-connected",
        required_artifacts=[
            "README.md",
            "MATRIX_BLUEPRINT.yaml",
            "MATRIX_STANDARDS.lock",
            "docs/standards-report.md",
        ],
        trust_status="dry-run",
        message="Provide a bundle id to run the MatrixHub publication gate.",
    )


def publish_to_matrixhub(bundle_id: str, payload: PublicationRequest | None = None) -> PublicationResponse:
    return get_matrix_builder_service().publish_to_matrixhub(bundle_id, payload)
