from __future__ import annotations

from dataclasses import dataclass

from app.db.base import Entity


@dataclass
class PublicationRecord(Entity):
    bundle_id: str = ""
    target: str = "matrixhub"
    dry_run: bool = True
    accepted: bool = False
    status: str = "pending"
    matrixhub_slug: str | None = None
