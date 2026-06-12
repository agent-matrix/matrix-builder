from fastapi import APIRouter, Query
from app.services.recommender import load_topics, rank_for_location
router = APIRouter(tags=["trends"])

@router.get("/trends/global")
def global_trends(limit: int = Query(10, ge=1, le=50)):
    return {"scope": "global", "topics": load_topics()[:limit]}

@router.get("/trends/location")
def location_trends(country: str = "Italy", city: str | None = "Rome", limit: int = Query(10, ge=1, le=50)):
    return {"scope": "location", "country": country, "city": city, "topics": rank_for_location(country, city)[:limit]}
