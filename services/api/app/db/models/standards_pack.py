from __future__ import annotations

from dataclasses import dataclass

from app.db.base import Entity


@dataclass
class StandardsPackRecord(Entity):
    source: str = "matrix-definitions"
    version: str = ""
    digest: str | None = None
    rules_count: int | None = None
    status: str = "unknown"
