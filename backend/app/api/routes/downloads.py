"""Artifact download endpoint."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

from app.core.errors import ErrorCode, make_error_response
from app.db.database import get_connection

router = APIRouter(prefix="/jobs", tags=["Downloads"])


@router.get("/{job_id}/download")
def download_artifact(
    job_id: str,
    format: str = Query("patch", pattern="^(patch|zip)$"),
):
    """Download repair artifacts (unified diff patch or patched repository ZIP)."""
    conn = get_connection()
    cur = conn.cursor()

    kind = "PATCH" if format == "patch" else "PATCHED_ZIP"
    cur.execute(
        "SELECT storage_ref, sha256 FROM artifacts WHERE job_id = ? AND kind = ?",
        (job_id, kind),
    )
    row = cur.fetchone()
    if not row:
        return make_error_response(
            status_code=404,
            code=ErrorCode.JOB_NOT_FOUND,
            message=f"No {format} artifact found for this job.",
        )

    storage_ref, _ = row
    file_path = Path(storage_ref)

    if not file_path.exists() or not file_path.is_file():
        return make_error_response(
            status_code=410,
            code=ErrorCode.EXPORT_FAILED,
            message="The requested artifact has expired or is no longer available.",
        )

    media_type = "text/plain" if format == "patch" else "application/zip"
    download_filename = f"proofpatch_{job_id[:8]}.{format}"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=download_filename,
    )
