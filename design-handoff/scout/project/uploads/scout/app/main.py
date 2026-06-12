from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api.health import router as health_router
from app.api.trends import router as trends_router
from app.api.recommendations import router as recommendations_router
from app.api.topics import router as topics_router
from app.api.deep_dive import router as deep_dive_router
from app.api.matrix import router as matrix_router
from app.api.datasets import router as datasets_router
from app.api.sources import router as sources_router

app = FastAPI(
    title="Scout — Developer Trend Intelligence",
    description="Geolocated trend intelligence API for developers and agentic AI systems.",
    version="0.1.0",
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(trends_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(topics_router, prefix="/api/v1")
app.include_router(deep_dive_router, prefix="/api/v1")
app.include_router(matrix_router, prefix="/api/v1")
app.include_router(datasets_router, prefix="/api/v1")
app.include_router(sources_router, prefix="/api/v1")

if Path("dashboard").exists():
    app.mount("/dashboard", StaticFiles(directory="dashboard", html=True), name="dashboard")

@app.get("/")
def root():
    return {
        "name": "Scout",
        "description": "Developer trend intelligence API and dashboard",
        "dashboard": "/dashboard",
        "docs": "/docs",
    }
