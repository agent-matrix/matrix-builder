from __future__ import annotations

from app.schemas.bundle import MatrixBundle
from app.schemas.publication import PublicationRequest, PublicationResponse
from app.schemas.validation import ValidationReport
from app.utils.ids import stable_id

MATRIXHUB_REQUIRED_ARTIFACTS = [
    "README.md",
    "MATRIX_BLUEPRINT.yaml",
    "MATRIX_STANDARDS.lock",
    "docs/standards-report.md",
    "artifacts/manifest.json",
    "artifacts/checksums.txt",
]


class MatrixHubClient:
    def status(self) -> dict[str, str]:
        return {"status": "ready", "integration": "matrixhub", "mode": "dry-run-first"}

    def publish_bundle(
        self,
        bundle: MatrixBundle,
        validation: ValidationReport,
        payload: PublicationRequest | None = None,
    ) -> PublicationResponse:
        request = payload or PublicationRequest(bundle_id=bundle.bundle_id, dry_run=True)
        present = {file.path for file in bundle.files}
        missing = [path for path in MATRIXHUB_REQUIRED_ARTIFACTS if path not in present]
        if validation.status != "approved":
            return PublicationResponse(
                publication_id=stable_id("pub", f"{bundle.bundle_id}:rejected"),
                bundle_id=bundle.bundle_id,
                dry_run=request.dry_run,
                accepted=False,
                status="rejected",
                matrixhub_slug=request.slug,
                required_artifacts=MATRIXHUB_REQUIRED_ARTIFACTS,
                missing_artifacts=missing,
                validation_status=str(validation.status),
                validation_report_id=validation.report_id,
                trust_status="unverified",
                message="MatrixHub rejected the bundle because validation is not approved.",
            )
        if missing:
            return PublicationResponse(
                publication_id=stable_id("pub", f"{bundle.bundle_id}:missing"),
                bundle_id=bundle.bundle_id,
                dry_run=request.dry_run,
                accepted=False,
                status="rejected",
                matrixhub_slug=request.slug,
                required_artifacts=MATRIXHUB_REQUIRED_ARTIFACTS,
                missing_artifacts=missing,
                validation_status=str(validation.status),
                validation_report_id=validation.report_id,
                trust_status="unverified",
                message="MatrixHub rejected the bundle because required trust artifacts are missing.",
            )
        return PublicationResponse(
            publication_id=stable_id("pub", f"{bundle.bundle_id}:matrixhub:{request.dry_run}"),
            bundle_id=bundle.bundle_id,
            dry_run=request.dry_run,
            accepted=True,
            status="accepted" if request.dry_run else "pending",
            matrixhub_slug=request.slug or _slug_from(bundle.title),
            required_artifacts=MATRIXHUB_REQUIRED_ARTIFACTS,
            missing_artifacts=[],
            validation_status=str(validation.status),
            validation_report_id=validation.report_id,
            trust_status="dry-run" if request.dry_run else "verified",
            message=(
                "MatrixHub dry-run accepted the controlled bundle."
                if request.dry_run
                else "MatrixHub publication request accepted for processing."
            ),
        )


def _slug_from(value: str) -> str:
    return "-".join(value.lower().replace("/", " ").split())[:80] or "matrix-bundle"
