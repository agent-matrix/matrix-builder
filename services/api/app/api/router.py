from __future__ import annotations
from fastapi import APIRouter
from app.api import audit, auth, blueprints, bundles, gitpilot, health, ideas, ingest, metrics, prompts, publications, standards, users, validation, workflow
api_router=APIRouter()
api_router.include_router(health.router, tags=['health'])
api_router.include_router(auth.router, tags=['auth'])
api_router.include_router(audit.router, tags=['audit'])
api_router.include_router(metrics.router, tags=['metrics'])
api_router.include_router(ideas.router, prefix='/ideas', tags=['ideas'])
api_router.include_router(blueprints.router, prefix='/blueprints', tags=['blueprints'])
api_router.include_router(bundles.router, prefix='/bundles', tags=['bundles'])
api_router.include_router(gitpilot.router, prefix='/gitpilot', tags=['gitpilot'])
api_router.include_router(ingest.router, prefix='/ingest', tags=['ingest'])
api_router.include_router(prompts.router, prefix='/prompts', tags=['prompts'])
api_router.include_router(validation.router, prefix='/validation', tags=['validation'])
api_router.include_router(standards.router, prefix='/standards', tags=['standards'])
api_router.include_router(publications.router, prefix='/publications', tags=['publications'])
api_router.include_router(users.router, prefix='/users', tags=['users'])
api_router.include_router(workflow.router, tags=['workflow'])
