from fastapi import APIRouter, HTTPException
from app.services.recommender import get_deep_dive
router = APIRouter(tags=["deep-dive"])

@router.get("/topics/{topic_id}/deep-dive")
def deep_dive(topic_id: str, country: str = "Italy", city: str | None = "Rome", goal: str = "career", profile: str = "developer"):
    result = get_deep_dive(topic_id, country=country, city=city, goal=goal, profile=profile)
    if not result:
        raise HTTPException(status_code=404, detail="Topic not found")
    return result
