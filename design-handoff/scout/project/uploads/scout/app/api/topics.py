from fastapi import APIRouter, HTTPException
from app.services.recommender import get_topic
router = APIRouter(tags=["topics"])

@router.get("/topics/{topic_id}")
def topic(topic_id: str):
    topic = get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic
