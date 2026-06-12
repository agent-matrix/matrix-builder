from __future__ import annotations

from app.schemas.common import StrictModel


class StandardsStatus(StrictModel):
    source: str
    version: str
    status: str
    digest: str | None = None
    rules_count: int | None = None
