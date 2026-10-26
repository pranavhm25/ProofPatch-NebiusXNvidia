"""
ProofPatch Backend
==================
FastAPI application entry point. Configures CORS, mounts routers,
initialises the database and workspaces directory on startup.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.database import init_db
from app.api.routes import projects, jobs, downloads, health


configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    init_db()
    settings.workspace_root.mkdir(parents=True, exist_ok=True)
    settings.artifacts_root.mkdir(parents=True, exist_ok=True)
    yield
    # Cleanup tasks could go here (e.g., flush pending cleanups).


app = FastAPI(
    title="ProofPatch API",
    version="1.0.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(health.router)
app.include_router(projects.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(downloads.router, prefix="/api")
