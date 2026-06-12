from fastapi import APIRouter
from app.trust.source_health import source_health
router = APIRouter(tags=["sources"])

@router.get("/sources/health")
def health():
    return source_health()
