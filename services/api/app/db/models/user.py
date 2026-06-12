from __future__ import annotations

from dataclasses import dataclass

from app.db.base import Entity


@dataclass
class User(Entity):
    email: str | None = None
    display_name: str | None = None
    plan: str = "guest"
    is_active: bool = True
