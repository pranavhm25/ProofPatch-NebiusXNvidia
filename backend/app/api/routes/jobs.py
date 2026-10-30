"""Job creation, status polling, and result endpoints."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import ErrorCode, make_error_response
from app.db.database import get_connection
from app.schemas.api import (
    AttemptSchema,
    AttemptStatus,
    CreateJobRequest,
    CreateJobResponse,
    DiffInfoSchema,
    FinalVerdict,
    JobEvent,
    JobListItem,
    JobListResponse,
    JobResultResponse,
    JobStatus,
    JobStatusResponse,
    ModelAttributionSchema,
    TERMINAL_STATUSES,
    TestResultSchema,
    TestStatus,
)
from app.services.orchestrator import run_repair_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Jobs"])

_PROGRESS_ESTIMATES = {
    JobStatus.QUEUED: 5,
    JobStatus.VALIDATING: 15,
    JobStatus.ANALYZING: 30,
    JobStatus.PLANNING: 50,
    JobStatus.PATCHING: 65,
    JobStatus.TESTING: 80,
    JobStatus.RETRYING: 85,
    JobStatus.COMPLETED: 100,
    JobStatus.FAILED: 100,
    JobStatus.BLOCKED: 100,
    JobStatus.CANCELLED: 100,
}


@router.post("", response_model=CreateJobResponse, status_code=202)
def create_job(payload: CreateJobRequest, background_tasks: BackgroundTasks):
    """Start an automated repair job for an uploaded project."""
    conn = get_connection()
    cur = conn.cursor()

    # Validate project exists
    cur.execute("SELECT id, status FROM projects WHERE id = ?", (payload.project_id,))
    project_row = cur.fetchone()
    if not project_row:
        return make_error_response(
            status_code=404,
            code=ErrorCode.PROJECT_NOT_FOUND,
            message="The specified project was not found.",
        )

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.retention_minutes)

    cur.execute(
        """
        INSERT INTO jobs (
            id, project_id, session_id, bug_report, expected_behavior, observed_behavior,
            status, stage, model_id, prompt_version, attempt_count, created_at, updated_at, expires_at
        ) VALUES (?, ?, '', ?, ?, ?, 'QUEUED', 'Job queued for analysis', ?, 'repair-v1', 0, ?, ?, ?)
        """,
        (
            job_id,
            payload.project_id,
            payload.bug_report,
            payload.expected_behavior,
            payload.observed_behavior,
            "pending selection",
            now.isoformat(),
            now.isoformat(),
            expires_at.isoformat(),
        ),
    )
    conn.commit()

    # Launch repair orchestrator asynchronously
    background_tasks.add_task(run_repair_job, job_id)

    return CreateJobResponse(
        job_id=job_id,
        status=JobStatus.QUEUED,
        created_at=now.isoformat(),
        status_url=f"/api/jobs/{job_id}",
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    """Poll job status, stage, and event history."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, status, stage, created_at, updated_at FROM jobs WHERE id = ?", (job_id,))
    job_row = cur.fetchone()
    if not job_row:
        return make_error_response(
            status_code=404,
            code=ErrorCode.JOB_NOT_FOUND,
            message="Job not found.",
        )

    _, status_str, stage, created_at, updated_at = job_row
    status = JobStatus(status_str)
    progress_percent = _PROGRESS_ESTIMATES.get(status, 10)
    terminal = status in TERMINAL_STATUSES

    # Fetch events
    cur.execute(
        "SELECT stage, message, created_at FROM job_events WHERE job_id = ? ORDER BY sequence_no ASC",
        (job_id,),
    )
    events = [
        JobEvent(stage=r[0], message=r[1], timestamp=r[2])
        for r in cur.fetchall()
    ]

    return JobStatusResponse(
        job_id=job_id,
        status=status,
        stage=stage,
        progress_percent=progress_percent,
        created_at=created_at,
        updated_at=updated_at,
        terminal=terminal,
        events=events,
    )


@router.get("/{job_id}/result", response_model=JobResultResponse)
def get_job_result(job_id: str):
    """Retrieve full repair results, diff, test evidence, and verdict."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, status, stage, final_verdict, model_id, prompt_version, completed_at, error_code
        FROM jobs WHERE id = ?
        """,
        (job_id,),
    )
    job_row = cur.fetchone()
    if not job_row:
        return make_error_response(
            status_code=404,
            code=ErrorCode.JOB_NOT_FOUND,
            message="Job not found.",
        )

    _, status_str, stage, verdict_str, model_id, prompt_version, completed_at, error_code = job_row
    status = JobStatus(status_str)
    verdict = FinalVerdict(verdict_str) if verdict_str else None

    # Fetch attempts and associated test runs
    cur.execute(
        """
        SELECT a.id, a.attempt_number, a.status, a.patch_hash, a.changed_files_json,
               t.status, t.command_id, t.exit_code, t.duration_ms, t.tests_discovered,
               t.tests_passed, t.tests_failed, t.stdout, t.stderr, t.output_truncated
        FROM attempts a
        LEFT JOIN test_runs t ON t.attempt_id = a.id
        WHERE a.job_id = ?
        ORDER BY a.attempt_number ASC
        """,
        (job_id,),
    )
    attempts: list[AttemptSchema] = []
    latest_changed_files: list[str] = []

    for row in cur.fetchall():
        (
            att_id, att_num, att_status, patch_hash, chg_json,
            t_status, t_cmd, t_exit, t_dur, t_disc, t_pass, t_fail, t_out, t_err, t_trunc
        ) = row

        chg_files = json.loads(chg_json) if chg_json else []
        if chg_files:
            latest_changed_files = chg_files

        test_result = None
        if t_status is not None:
            test_result = TestResultSchema(
                status=TestStatus(t_status),
                command_id=t_cmd or "pytest-default",
                exit_code=t_exit,
                duration_ms=t_dur,
                tests_discovered=t_disc,
                tests_passed=t_pass,
                tests_failed=t_fail,
                stdout=t_out or "",
                stderr=t_err or "",
                output_truncated=bool(t_trunc),
            )

        attempts.append(
            AttemptSchema(
                attempt_number=att_num,
                status=AttemptStatus(att_status),
                patch_hash=patch_hash,
                changed_files=chg_files,
                test_result=test_result,
            )
        )

    # Check for artifacts (diff / patch)
    cur.execute("SELECT storage_ref FROM artifacts WHERE job_id = ? AND kind = 'PATCH'", (job_id,))
    patch_artifact = cur.fetchone()
    unified_diff_text = None
    if patch_artifact and Path(patch_artifact[0]).exists():
        try:
            unified_diff_text = Path(patch_artifact[0]).read_text(encoding="utf-8")
        except OSError:
            pass

    diff_available = unified_diff_text is not None
    diff_info = DiffInfoSchema(
        available=diff_available,
        unified_diff=unified_diff_text,
        changed_files=latest_changed_files,
        download_patch_url=f"/api/jobs/{job_id}/download?format=patch" if diff_available else None,
        download_zip_url=f"/api/jobs/{job_id}/download?format=zip" if diff_available else None,
    )

    limitations = [
        "Passing tests provide evidence for tested behavior only; they do not prove the absence of all defects."
    ]

    return JobResultResponse(
        job_id=job_id,
        status=status,
        verdict=verdict,
        summary=stage,
        limitations=limitations,
        model=ModelAttributionSchema(
            provider="Nebius Token Factory",
            model_id=model_id or "unconfigured",
            prompt_version=prompt_version or "repair-v1",
        ),
        attempts=attempts,
        diff=diff_info,
        completed_at=completed_at,
    )


@router.get("", response_model=JobListResponse)
def list_jobs(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    verdict: Optional[str] = None,
):
    """List historical repair jobs with filtering and pagination."""
    valid_statuses = {s.value for s in JobStatus}
    if status is not None and status not in valid_statuses:
        return make_error_response(
            status_code=400,
            code="INVALID_FILTER",
            message=f"Invalid status filter: '{status}'. Allowed values: {', '.join(sorted(valid_statuses))}",
        )

    valid_verdicts = {v.value for v in FinalVerdict}
    if verdict is not None and verdict not in valid_verdicts:
        return make_error_response(
            status_code=400,
            code="INVALID_FILTER",
            message=f"Invalid verdict filter: '{verdict}'. Allowed values: {', '.join(sorted(valid_verdicts))}",
        )

    safe_limit = max(1, min(limit, 100))
    safe_offset = max(0, offset)

    conn = get_connection()
    cur = conn.cursor()

    conditions = []
    params = []

    if status:
        conditions.append("j.status = ?")
        params.append(status)
    if verdict:
        conditions.append("j.final_verdict = ?")
        params.append(verdict)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_sql = f"SELECT COUNT(*) as total FROM jobs j {where_clause}"
    cur.execute(count_sql, tuple(params))
    total_row = cur.fetchone()
    total = total_row["total"] if total_row else 0

    data_sql = f"""
        SELECT j.id, j.project_id, COALESCE(p.display_name, 'unknown') AS project_name,
               j.bug_report, j.status, j.stage, j.final_verdict, j.attempt_count,
               j.model_id, j.created_at, j.completed_at
        FROM jobs j
        LEFT JOIN projects p ON j.project_id = p.id
        {where_clause}
        ORDER BY j.created_at DESC
        LIMIT ? OFFSET ?
    """
    cur.execute(data_sql, tuple(params + [safe_limit, safe_offset]))
    rows = cur.fetchall()

    jobs_list = []
    for row in rows:
        duration_seconds = None
        if row["completed_at"] and row["created_at"]:
            try:
                t0 = datetime.fromisoformat(row["created_at"])
                t1 = datetime.fromisoformat(row["completed_at"])
                duration_seconds = max(0.0, round((t1 - t0).total_seconds(), 2))
            except Exception:
                pass

        truncated_bug_report = (row["bug_report"] or "")[:200]

        verdict_val = None
        if row["final_verdict"]:
            try:
                verdict_val = FinalVerdict(row["final_verdict"])
            except ValueError:
                pass

        jobs_list.append(
            JobListItem(
                job_id=row["id"],
                project_id=row["project_id"],
                project_name=row["project_name"],
                bug_report=truncated_bug_report,
                status=JobStatus(row["status"]),
                stage=row["stage"] or "",
                verdict=verdict_val,
                attempt_count=row["attempt_count"] or 0,
                model_id=row["model_id"] or None,
                duration_seconds=duration_seconds,
                created_at=row["created_at"],
                completed_at=row["completed_at"],
            )
        )

    return JobListResponse(total=total, jobs=jobs_list)
