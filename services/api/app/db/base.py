from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.utils.time import utc_now


@dataclass
class Entity:
    """Base persistence shape used before the SQLAlchemy layer is introduced.

    Batch 4 intentionally keeps models dependency-free so tests and local API development work
    without a database. Batch 5/8 can map these shapes to real Postgres tables.
    """

    id: str
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
    metadata: dict[str, Any] = field(default_factory=dict)

    def touch(self) -> None:
        self.updated_at = utc_now()
