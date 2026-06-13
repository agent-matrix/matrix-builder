from __future__ import annotations
from typing import Any
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.rate_limits import RateLimitMiddleware
from app.core.request_id import RequestIdMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.observability.metrics import metrics_registry
from app.services.audit_service import audit_service
logger=get_logger(__name__)
def create_app() -> FastAPI:
    settings=get_settings(); configure_logging(settings.log_level, settings.json_logs)
    app=FastAPI(title='Matrix Builder API', version=settings.app_version, description='Public orchestration API for controlled Matrix Bundle generation.')
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    if settings.enable_security_headers: app.add_middleware(SecurityHeadersMiddleware, settings=settings)
    app.add_middleware(RequestIdMiddleware); app.add_middleware(RateLimitMiddleware, settings=settings)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allow_headers=['*'])
    app.include_router(api_router, prefix='/api/v1')
    @app.middleware('http')
    async def count_requests(request: Request, call_next: Any) -> Response:
        metrics_registry.inc('http_requests_total'); response=await call_next(request); return response
    @app.on_event('startup')
    async def startup() -> None:
        from app.runtime import get_run_worker
        await get_run_worker().start()
        audit_service.record('service.startup', resource_type='service', resource_id=settings.app_name); logger.info('Matrix Builder API started')
    @app.on_event('shutdown')
    async def shutdown() -> None:
        from app.runtime import get_run_worker
        await get_run_worker().stop()
    @app.get('/health', tags=['health'])
    def root_health() -> dict[str, str]: return {'status':'ok','service':settings.app_name,'version':settings.app_version}
    @app.get('/metrics', include_in_schema=False)
    def root_metrics() -> Response: return Response(content=metrics_registry.render_prometheus(), media_type='text/plain')
    return app
app=create_app()
