"""Application configuration loaded from environment variables.
Never expose these values in API responses or logs.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List

from pydantic import BaseModel, Field


def _get_list(env_key: str, default: List[str]) -> List[str]:
    raw = os.getenv(env_key)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings(BaseModel):
    # ── Nebius / Model ────────────────────────────────────────────────────────
    nebius_api_key: str = Field(default_factory=lambda: os.getenv("NEBIUS_API_KEY", ""))
    nebius_base_url: str = Field(default_factory=lambda: os.getenv("NEBIUS_BASE_URL", "https://api.studio.nebius.ai/v1"))
    nebius_model: str = Field(default_factory=lambda: os.getenv("NEBIUS_MODEL", ""))
    provider_timeout_seconds: int = Field(default_factory=lambda: int(os.getenv("PROVIDER_TIMEOUT_SECONDS", "60")))

    # ── Sandbox ───────────────────────────────────────────────────────────────
    sandbox_provider: str = Field(default_factory=lambda: os.getenv("SANDBOX_PROVIDER", "local_process"))

    # ── Upload / Archive limits ───────────────────────────────────────────────
    max_upload_bytes: int = Field(default_factory=lambda: int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024))))
    max_extracted_bytes: int = Field(default_factory=lambda: int(os.getenv("MAX_EXTRACTED_BYTES", str(100 * 1024 * 1024))))
    max_archive_files: int = Field(default_factory=lambda: int(os.getenv("MAX_ARCHIVE_FILES", "500")))
    max_file_bytes: int = Field(default_factory=lambda: int(os.getenv("MAX_FILE_BYTES", str(512 * 1024))))

    # ── Patch limits ─────────────────────────────────────────────────────────
    max_patch_bytes: int = Field(default_factory=lambda: int(os.getenv("MAX_PATCH_BYTES", str(100 * 1024))))
    max_changed_files: int = Field(default_factory=lambda: int(os.getenv("MAX_CHANGED_FILES", "10")))

    # ── Repair loop ───────────────────────────────────────────────────────────
    max_repair_attempts: int = Field(default_factory=lambda: int(os.getenv("MAX_REPAIR_ATTEMPTS", "2")))

    # ── Timeouts ──────────────────────────────────────────────────────────────
    job_timeout_seconds: int = Field(default_factory=lambda: int(os.getenv("JOB_TIMEOUT_SECONDS", "300")))
    sandbox_timeout_seconds: int = Field(default_factory=lambda: int(os.getenv("SANDBOX_TIMEOUT_SECONDS", "60")))

    # ── Output limits ─────────────────────────────────────────────────────────
    max_log_bytes: int = Field(default_factory=lambda: int(os.getenv("MAX_LOG_BYTES", str(50 * 1024))))

    # ── Retention ─────────────────────────────────────────────────────────────
    retention_minutes: int = Field(default_factory=lambda: int(os.getenv("RETENTION_MINUTES", "60")))

    # ── Server ────────────────────────────────────────────────────────────────
    cors_origins: List[str] = Field(default_factory=lambda: _get_list("CORS_ORIGINS", ["http://localhost:5173"]))
    app_env: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    log_level: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

    # ── Internal paths ────────────────────────────────────────────────────────
    @property
    def workspace_root(self) -> Path:
        base = Path(__file__).parent.parent.parent
        return base / "workspaces"

    @property
    def artifacts_root(self) -> Path:
        base = Path(__file__).parent.parent.parent
        return base / "artifacts"

    @property
    def db_path(self) -> Path:
        base = Path(__file__).parent.parent.parent
        return base / "proofpatch.db"

    @property
    def has_nebius_config(self) -> bool:
        return bool(self.nebius_api_key and self.nebius_model)


settings = Settings()
