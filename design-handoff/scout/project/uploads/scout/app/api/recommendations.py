from fastapi import APIRouter, Query
from datetime import datetime, timezone
from app.services.recommender import recommend
router = APIRouter(tags=["recommendations"])

@router.get("/recommendations")
def recommendations(country: str = "Italy", city: str | None = "Rome", goal: str = "career", profile: str = "developer", limit: int = Query(10, ge=1, le=50), depth: str = "summary"):
    return {
        "location": {"country": country, "city": city},
        "goal": goal,
        "profile": profile,
        "depth": depth,
        "recommendations": recommend(country=country, city=city, goal=goal, profile=profile, limit=limit, depth=depth),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "methodology": "METHODOLOGY.md",
    }
