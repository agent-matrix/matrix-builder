from fastapi import APIRouter
from app.services.recommender import load_dataset
router = APIRouter(tags=["datasets"])

@router.get("/datasets/latest")
def latest_dataset():
    return load_dataset()
