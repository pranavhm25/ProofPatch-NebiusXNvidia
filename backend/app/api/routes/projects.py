"""Project upload and validation endpoint."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import ErrorCode, ProofPatchError, make_error_response
from app.db.database import get_connection
from app.schemas.api import CreateProjectResponse
from app.services import archive

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=CreateProjectResponse, status_code=201)
async def create_project(file: UploadFile = File(...)):
    """Upload and validate a Python project ZIP archive."""
    # Check media type / extension
    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        return make_error_response(
            status_code=415,
            code=ErrorCode.INVALID_ARCHIVE,
            message="Unsupported media type. Only .zip archives are accepted.",
        )

    # Read uploaded bytes with size enforcement
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        return make_error_response(
            status_code=413,
            code=ErrorCode.UPLOAD_LIMIT_EXCEEDED,
            message=f"Uploaded file exceeds the maximum limit of {settings.max_upload_bytes // 1024 // 1024} MB.",
        )

    project_id = str(uuid.uuid4())
    project_workspace = settings.workspace_root / f"project_{project_id}"

    try:
        extracted_paths, file_count, uncompressed_bytes = archive.extract_archive(
            archive_bytes=content,
            workspace_path=project_workspace,
        )

        if not archive.detect_python_project(extracted_paths):
            return make_error_response(
                status_code=422,
                code=ErrorCode.UNSUPPORTED_PROJECT,
                message="The archive does not contain a recognizable Python project.",
            )

    except ProofPatchError as exc:
        return make_error_response(
            status_code=exc.http_status,
            code=exc.code,
            message=exc.message,
            details=exc.details,
        )
    except Exception as exc:
        logger.exception("Unexpected error extracting project %s", project_id)
        return make_error_response(
            status_code=500,
            code=ErrorCode.INTERNAL_ERROR,
            message="An unexpected error occurred while processing the archive.",
        )

    # Display name derived from filename (sanitized, basename only)
    display_name = Path(filename).stem[:64] or "unnamed-project"
    archive_hash = archive.hash_archive(content)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.retention_minutes)

    conn = get_connection()
    conn.execute(
        """
        INSERT INTO projects (
            id, session_id, display_name, language, archive_sha256,
            file_count, uncompressed_bytes, workspace_ref, created_at, expires_at, status
        ) VALUES (?, '', ?, 'python', ?, ?, ?, ?, ?, ?, 'VALID')
        """,
        (
            project_id,
            display_name,
            archive_hash,
            file_count,
            uncompressed_bytes,
            str(project_workspace),
            now.isoformat(),
            expires_at.isoformat(),
        ),
    )
    conn.commit()

    return CreateProjectResponse(
        project_id=project_id,
        project_name=display_name,
        language="python",
        file_count=file_count,
        total_uncompressed_bytes=uncompressed_bytes,
        validation_status="VALID",
        created_at=now.isoformat(),
    )
