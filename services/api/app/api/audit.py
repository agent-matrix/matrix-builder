from __future__ import annotations
from fastapi import APIRouter, Query
from app.services.audit_service import audit_service
router=APIRouter()
@router.get('/audit/recent')
def recent_audit_events(limit: int=Query(default=25, ge=1, le=100)) -> dict[str, object]: return {'events': audit_service.recent(limit=limit)}
