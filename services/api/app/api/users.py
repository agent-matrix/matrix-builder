from __future__ import annotations

from fastapi import APIRouter

from app.schemas.user import UserPlan
from app.services.quota_service import guest_limit

router = APIRouter()


@router.get("/guest-plan", response_model=UserPlan)
def guest_plan() -> UserPlan:
    return UserPlan(plan="guest", bundle_limit=guest_limit(), requires_signup=False)
