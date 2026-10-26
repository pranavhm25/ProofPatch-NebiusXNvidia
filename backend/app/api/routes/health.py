"""Health endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    environment: str
    has_nebius_config: bool


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Application health endpoint."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        environment=settings.app_env,
        has_nebius_config=settings.has_nebius_config,
    )
