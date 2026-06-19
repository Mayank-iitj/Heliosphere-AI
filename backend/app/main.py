"""HelioSphere AI — FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import alerts, auth, copilot, forecast, solar, twin
from .bootstrap import bootstrap
from .config import settings
from .db import init_db
from .services import scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger("helio")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting %s v%s (%s)", settings.app_name, settings.version, settings.env)
    await init_db()
    await bootstrap()
    scheduler.start(app)
    try:
        yield
    finally:
        await scheduler.stop(app)
        log.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Solar weather intelligence: live feeds, ML flare forecasting, "
    "a 3D digital twin and a grounded copilot.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https?://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api"
app.include_router(auth.router, prefix=API)
app.include_router(solar.router, prefix=API)
app.include_router(forecast.router, prefix=API)
app.include_router(twin.router, prefix=API)
app.include_router(alerts.router, prefix=API)
app.include_router(copilot.router, prefix=API)


@app.get("/api/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "version": settings.version}


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "service": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "health": "/api/health",
    }
