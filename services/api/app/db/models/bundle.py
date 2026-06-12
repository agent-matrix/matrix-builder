from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.db.base import Entity


@dataclass
class BundleRecord(Entity):
    blueprint_id: str = ""
    title: str = ""
    status: str = "draft"
    manifest_digest: str | None = None
    zip_digest: str | None = None
    zip_size_bytes: int | None = None
    expires_at: datetime | None = None
    artifact_uri: str | None = None
    signed_download_url: str | None = None
    owner_id: str | None = None
    persisted: bool = False
    payload: dict[str, object] = field(default_factory=dict)
