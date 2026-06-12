from __future__ import annotations

from pydantic import BaseModel


class UserPlan(BaseModel):
    plan: str
    bundle_limit: int
    requires_signup: bool
