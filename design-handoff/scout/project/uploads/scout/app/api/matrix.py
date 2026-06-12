from fastapi import APIRouter, Query
from app.services.matrix_opportunities import matrix_opportunities
router = APIRouter(tags=["agent-matrix"])

@router.get("/matrix/opportunities")
def opportunities(country: str = "Italy", city: str | None = "Rome", goal: str = "create_agents", limit: int = Query(10, ge=1, le=50)):
    return matrix_opportunities(country=country, city=city, goal=goal, limit=limit)
