from __future__ import annotations

from dataclasses import dataclass

from app.schemas.standards import StandardsStatus
from app.utils.hashing import sha256_text


@dataclass(frozen=True)
class MatrixDefinitionsClient:
    """Client boundary for the matrix-definitions signed standards pack.

    Batch 4 keeps this as a deterministic local client. Later batches can load a signed release
    bundle from disk, object storage, or the matrix-definitions release API without changing the
    Matrix Builder service layer.
    """

    source: str = "matrix-definitions"
    version: str = "2026.06.0-preview"
    rules_count: int = 161
    # Canonical, public location of the full RMD pack (rule text + technology baseline).
    # The prompt points coders here so they can read the rules, not just their ids.
    pages_url: str = "https://agent-matrix.github.io/matrix-definitions/definitions/"

    def status(self) -> dict[str, str]:
        return {
            "source": self.source,
            "version": self.version,
            "status": "preview-pack-loaded",
            "contract": "matrix-definitions-provides-rules",
        }

    def current(self) -> StandardsStatus:
        digest = sha256_text(f"{self.source}:{self.version}:{self.rules_count}")
        return StandardsStatus(
            source=self.source,
            version=self.version,
            status="preview-pack-loaded",
            digest=digest,
            rules_count=self.rules_count,
        )

    def download_url(self) -> str:
        """Where a coder fetches the full Ruslan Definitions pack for the pinned version."""
        return self.pages_url

    def required_control_files(self) -> list[str]:
        return [
            "MATRIX_BLUEPRINT.yaml",
            "MATRIX_STANDARDS.lock",
            "MATRIX_TASKS.md",
            "MATRIX_ALLOWED_CHANGES.md",
            "MATRIX_ACCEPTANCE_CRITERIA.md",
            "MATRIX_VALIDATION.md",
        ]
