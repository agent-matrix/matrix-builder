from __future__ import annotations
from fastapi import APIRouter, Response
from app.observability.metrics import metrics_registry
router=APIRouter()
@router.get('/metrics', include_in_schema=False)
def metrics() -> Response: return Response(content=metrics_registry.render_prometheus(), media_type='text/plain')
