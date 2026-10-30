"""Job Orchestrator service.

Owns the repair pipeline state machine:
  QUEUED -> VALIDATING -> ANALYZING -> PLANNING -> PATCHING -> TESTING -> [RETRYING] -> COMPLETED / FAILED / BLOCKED

Model role assignment:
- REASONING: Planning and initial candidate patch generation.
- ADVANCED: Test revision retry when initial attempt fails.
- FAST: Lightweight context preparation / summaries.
"""
from __future__ import annotations

import json
import logging
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.errors import ErrorCode, ProofPatchError
from app.db.database import get_connection
from app.schemas.api import (
    FinalVerdict,
    JobStatus,
    PatchProposal,
    RepairPlan,
    TestResultSchema,
    TestStatus,
)
from app.services import (
    archive,
    nebius_client,
    patch_applier,
    repo_inspector,
    sandbox,
    verdict as verdict_svc,
)
from app.services.model_registry import ModelRole

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def record_event(job_id: str, stage: str, message: str) -> None:
    """Record an audit event for the job."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM job_events WHERE job_id = ?", (job_id,))
    seq = cur.fetchone()[0]
    cur.execute(
        "INSERT INTO job_events (job_id, sequence_no, stage, message, created_at) VALUES (?, ?, ?, ?, ?)",
        (job_id, seq, stage, message, _utc_now()),
    )
    conn.commit()


def update_job_status(
    job_id: str,
    status: JobStatus,
    stage: str,
    error_code: Optional[str] = None,
    final_verdict: Optional[FinalVerdict] = None,
    attempt_count: Optional[int] = None,
    model_id: Optional[str] = None,
) -> None:
    """Update job status and stage in database."""
    conn = get_connection()
    now = _utc_now()
    completed_at = now if status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.BLOCKED, JobStatus.CANCELLED) else None

    fields = ["status = ?", "stage = ?", "updated_at = ?"]
    params = [status.value, stage, now]

    if error_code:
        fields.append("error_code = ?")
        params.append(error_code)
    if final_verdict:
        fields.append("final_verdict = ?")
        params.append(final_verdict.value)
    if completed_at:
        fields.append("completed_at = ?")
        params.append(completed_at)
    if attempt_count is not None:
        fields.append("attempt_count = ?")
        params.append(attempt_count)
    if model_id:
        fields.append("model_id = ?")
        params.append(model_id)

    params.append(job_id)
    sql = f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?"
    conn.execute(sql, params)
    conn.commit()
    record_event(job_id, status.value, stage)


def run_repair_job(job_id: str) -> None:
    """Execute the full repair pipeline for the specified job."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT j.id, j.project_id, j.bug_report, j.expected_behavior, j.observed_behavior,
               p.workspace_ref, p.display_name
        FROM jobs j
        JOIN projects p ON j.project_id = p.id
        WHERE j.id = ?
        """,
        (job_id,),
    )
    row = cur.fetchone()
    if not row:
        logger.error("Job %s not found for execution", job_id)
        return

    _, project_id, bug_report, exp_behavior, obs_behavior, workspace_ref, project_name = row
    baseline_dir = Path(workspace_ref)

    if not baseline_dir.exists():
        update_job_status(job_id, JobStatus.BLOCKED, "Project workspace not found.", ErrorCode.PROJECT_NOT_FOUND)
        return

    job_work_dir = settings.workspace_root / f"job_{job_id}"
    job_work_dir.mkdir(parents=True, exist_ok=True)
    models_used: list[str] = []

    try:
        # ── 1. VALIDATING & ANALYZING ──────────────────────────────────────────
        update_job_status(job_id, JobStatus.VALIDATING, "Validating repository structure")
        extracted_paths = [
            p.relative_to(baseline_dir).as_posix()
            for p in baseline_dir.rglob("*")
            if p.is_file() and not archive._is_ignored_path(p.relative_to(baseline_dir).as_posix())
        ]
        inventory = archive.build_file_inventory(baseline_dir, extracted_paths)

        update_job_status(job_id, JobStatus.ANALYZING, "Building context and inspecting source")
        context = repo_inspector.build_context(baseline_dir, inventory, bug_report)

        # ── 2. PLANNING (Role: REASONING) ───────────────────────────────────────
        update_job_status(job_id, JobStatus.PLANNING, "Requesting repair plan from model")
        plan, plan_model = nebius_client.generate_plan(
            context=context,
            bug_report=bug_report,
            expected_behavior=exp_behavior,
            observed_behavior=obs_behavior,
            job_id=job_id,
            role=ModelRole.REASONING,
        )
        models_used.append(plan_model)

        # ── 3. ATTEMPT 1: PATCHING & TESTING (Role: REASONING) ──────────────────
        update_job_status(
            job_id,
            JobStatus.PATCHING,
            "Generating candidate patch",
            attempt_count=1,
            model_id=plan_model,
        )
        proposal, patch_model = nebius_client.generate_patch(
            context=context,
            plan=plan,
            job_id=job_id,
            role=ModelRole.REASONING,
        )
        if patch_model not in models_used:
            models_used.append(patch_model)

        attempt1_dir = job_work_dir / "attempt_1"
        attempt1_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO attempts (id, job_id, attempt_number, status, plan_json, started_at) VALUES (?, ?, 1, 'PLANNED', ?, ?)",
            (attempt1_id, job_id, plan.model_dump_json(), _utc_now()),
        )
        conn.commit()

        attempt1_applied = False
        apply_error_msg = None
        try:
            patch_hash, changed_files, diff_text = patch_applier.apply_patch_to_copy(
                baseline_path=baseline_dir,
                working_copy_path=attempt1_dir,
                proposal=proposal,
            )
            cur.execute(
                "UPDATE attempts SET status = 'PATCH_APPLIED', patch_hash = ?, changed_files_json = ? WHERE id = ?",
                (patch_hash, json.dumps(changed_files), attempt1_id),
            )
            conn.commit()
            attempt1_applied = True
        except ProofPatchError as ppe:
            if ppe.code == ErrorCode.PATCH_APPLY_FAILED and settings.max_repair_attempts > 1:
                cur.execute(
                    "UPDATE attempts SET status = 'PATCH_APPLY_FAILED', completed_at = ? WHERE id = ?",
                    (_utc_now(), attempt1_id),
                )
                conn.commit()
                apply_error_msg = ppe.message
                logger.warning("Attempt 1 patch application failed: %s; escalating to retry", ppe.message)
            else:
                raise

        final_test_run = None
        final_working_dir = attempt1_dir
        final_diff = proposal.patch

        if not attempt1_applied:
            # Bounded retry for patch application failure (Robustness fix A)
            update_job_status(
                job_id,
                JobStatus.RETRYING,
                f"Revising patch after application failure: {apply_error_msg}",
                attempt_count=2,
            )
            revised_proposal, revise_model = nebius_client.revise_patch_on_apply_error(
                original_patch=proposal.patch,
                apply_error=apply_error_msg,
                context=context,
                plan=plan,
                job_id=job_id,
                role=ModelRole.ADVANCED,
            )
            if revise_model not in models_used:
                models_used.append(revise_model)

            attempt2_dir = job_work_dir / "attempt_2"
            attempt2_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO attempts (id, job_id, attempt_number, status, plan_json, started_at) VALUES (?, ?, 2, 'PLANNED', ?, ?)",
                (attempt2_id, job_id, plan.model_dump_json(), _utc_now()),
            )
            conn.commit()

            patch_hash_2, changed_files_2, diff_text_2 = patch_applier.apply_patch_to_copy(
                baseline_path=baseline_dir,
                working_copy_path=attempt2_dir,
                proposal=revised_proposal,
            )
            cur.execute(
                "UPDATE attempts SET status = 'PATCH_APPLIED', patch_hash = ?, changed_files_json = ? WHERE id = ?",
                (patch_hash_2, json.dumps(changed_files_2), attempt2_id),
            )
            conn.commit()

            update_job_status(job_id, JobStatus.TESTING, "Running tests for revised patch")
            test_run_2 = sandbox.run_tests(attempt2_dir, job_id=job_id)

            test_run_2_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO test_runs (
                    id, attempt_id, status, command_id, exit_code, duration_ms,
                    tests_discovered, tests_passed, tests_failed, stdout, stderr,
                    output_truncated, created_at
                ) VALUES (?, ?, ?, 'pytest-default', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    test_run_2_id,
                    attempt2_id,
                    test_run_2.test_status,
                    test_run_2.exit_code,
                    test_run_2.duration_ms,
                    test_run_2.tests_discovered,
                    test_run_2.tests_passed,
                    test_run_2.tests_failed,
                    test_run_2.stdout,
                    test_run_2.stderr,
                    1 if test_run_2.output_truncated else 0,
                    _utc_now(),
                ),
            )
            cur.execute(
                "UPDATE attempts SET status = 'TESTED', completed_at = ? WHERE id = ?",
                (_utc_now(), attempt2_id),
            )
            conn.commit()

            final_test_run = test_run_2
            final_working_dir = attempt2_dir
            final_diff = diff_text_2

        else:
            # Execute tests for attempt 1
            update_job_status(job_id, JobStatus.TESTING, "Running tests in isolated environment")
            test_run_1 = sandbox.run_tests(attempt1_dir, job_id=job_id)

            test_run_1_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO test_runs (
                    id, attempt_id, status, command_id, exit_code, duration_ms,
                    tests_discovered, tests_passed, tests_failed, stdout, stderr,
                    output_truncated, created_at
                ) VALUES (?, ?, ?, 'pytest-default', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    test_run_1_id,
                    attempt1_id,
                    test_run_1.test_status,
                    test_run_1.exit_code,
                    test_run_1.duration_ms,
                    test_run_1.tests_discovered,
                    test_run_1.tests_passed,
                    test_run_1.tests_failed,
                    test_run_1.stdout,
                    test_run_1.stderr,
                    1 if test_run_1.output_truncated else 0,
                    _utc_now(),
                ),
            )
            cur.execute(
                "UPDATE attempts SET status = 'TESTED', completed_at = ? WHERE id = ?",
                (_utc_now(), attempt1_id),
            )
            conn.commit()

            final_test_run = test_run_1
            final_working_dir = attempt1_dir
            final_diff = diff_text

            # The advanced role is reserved for this documented failed-test escalation.
            if test_run_1.test_status in ("FAILED", "ERROR") and settings.max_repair_attempts > 1:
                update_job_status(
                    job_id,
                    JobStatus.RETRYING,
                    "Revising patch using test failure evidence",
                    attempt_count=2,
                )
                try:
                    revised_proposal, revise_model = nebius_client.revise_patch(
                        original_patch=diff_text,
                        test_stdout=test_run_1.stdout,
                        test_stderr=test_run_1.stderr,
                        context=context,
                        plan=plan,
                        job_id=job_id,
                        role=ModelRole.ADVANCED,
                    )
                    if revise_model not in models_used:
                        models_used.append(revise_model)

                    attempt2_dir = job_work_dir / "attempt_2"
                    attempt2_id = str(uuid.uuid4())
                    cur.execute(
                        "INSERT INTO attempts (id, job_id, attempt_number, status, plan_json, started_at) VALUES (?, ?, 2, 'PLANNED', ?, ?)",
                        (attempt2_id, job_id, plan.model_dump_json(), _utc_now()),
                    )
                    conn.commit()

                    patch_hash_2, changed_files_2, diff_text_2 = patch_applier.apply_patch_to_copy(
                        baseline_path=baseline_dir,
                        working_copy_path=attempt2_dir,
                        proposal=revised_proposal,
                    )

                    cur.execute(
                        "UPDATE attempts SET status = 'PATCH_APPLIED', patch_hash = ?, changed_files_json = ? WHERE id = ?",
                        (patch_hash_2, json.dumps(changed_files_2), attempt2_id),
                    )
                    conn.commit()

                    update_job_status(job_id, JobStatus.TESTING, "Running tests for revised patch")
                    test_run_2 = sandbox.run_tests(attempt2_dir, job_id=job_id)

                    test_run_2_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO test_runs (
                            id, attempt_id, status, command_id, exit_code, duration_ms,
                            tests_discovered, tests_passed, tests_failed, stdout, stderr,
                            output_truncated, created_at
                        ) VALUES (?, ?, ?, 'pytest-default', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            test_run_2_id,
                            attempt2_id,
                            test_run_2.test_status,
                            test_run_2.exit_code,
                            test_run_2.duration_ms,
                            test_run_2.tests_discovered,
                            test_run_2.tests_passed,
                            test_run_2.tests_failed,
                            test_run_2.stdout,
                            test_run_2.stderr,
                            1 if test_run_2.output_truncated else 0,
                            _utc_now(),
                        ),
                    )
                    cur.execute(
                        "UPDATE attempts SET status = 'TESTED', completed_at = ? WHERE id = ?",
                        (_utc_now(), attempt2_id),
                    )
                    conn.commit()

                    final_test_run = test_run_2
                    final_working_dir = attempt2_dir
                    final_diff = diff_text_2

                except Exception as retry_exc:
                    logger.warning("Retry attempt failed: outcome=error type=%s", type(retry_exc).__name__)

        # ── 5. VERDICT & ARTIFACTS ────────────────────────────────────────────
        test_schema = TestResultSchema(
            status=TestStatus(final_test_run.test_status),
            command_id="pytest-default",
            exit_code=final_test_run.exit_code,
            duration_ms=final_test_run.duration_ms,
            tests_discovered=final_test_run.tests_discovered,
            tests_passed=final_test_run.tests_passed,
            tests_failed=final_test_run.tests_failed,
            stdout=final_test_run.stdout,
            stderr=final_test_run.stderr,
            output_truncated=final_test_run.output_truncated,
        )

        final_verdict, summary, _ = verdict_svc.compute_verdict(
            test_result=test_schema,
            attempt_status="TESTED",
        )

        _create_and_save_artifacts(
            job_id=job_id,
            diff_text=final_diff,
            working_copy_dir=final_working_dir,
            conn=conn,
        )

        terminal_status = JobStatus.COMPLETED if final_verdict == FinalVerdict.VERIFIED else JobStatus.FAILED
        primary_model = ", ".join(models_used) if models_used else "unconfigured"
        update_job_status(
            job_id=job_id,
            status=terminal_status,
            stage=summary,
            final_verdict=final_verdict,
            model_id=primary_model,
        )
        logger.info("Job %s completed: verdict=%s, models=%s", job_id, final_verdict.value, primary_model)

    except ProofPatchError as ppe:
        logger.warning("Job %s failed: error_code=%s", job_id, ppe.code)
        blocked_codes = (ErrorCode.PROVIDER_AUTH_ERROR, ErrorCode.SANDBOX_UNAVAILABLE, ErrorCode.PROVIDER_RATE_LIMIT)
        is_blocked = ppe.code in blocked_codes
        update_job_status(
            job_id=job_id,
            status=JobStatus.BLOCKED if is_blocked else JobStatus.FAILED,
            stage=ppe.message,
            error_code=ppe.code,
            final_verdict=FinalVerdict.BLOCKED if is_blocked else FinalVerdict.FAILED,
        )
    except Exception as exc:
        logger.error("Unexpected job failure: job=%s error_type=%s", job_id, type(exc).__name__)
        update_job_status(
            job_id=job_id,
            status=JobStatus.FAILED,
            stage="An unexpected internal error occurred during repair.",
            error_code=ErrorCode.INTERNAL_ERROR,
            final_verdict=FinalVerdict.FAILED,
        )


def _create_and_save_artifacts(
    job_id: str,
    diff_text: str,
    working_copy_dir: Path,
    conn,
) -> None:
    """Save patch file and patched ZIP archive to artifacts directory and record in DB."""
    artifacts_dir = settings.artifacts_root / job_id
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    patch_file = artifacts_dir / f"patch_{job_id}.patch"
    patch_file.write_text(diff_text, encoding="utf-8")
    patch_hash = patch_applier.hash_patch(diff_text)
    patch_size = patch_file.stat().st_size

    conn.execute(
        """
        INSERT INTO artifacts (id, job_id, kind, storage_ref, sha256, size_bytes, created_at, expires_at)
        VALUES (?, ?, 'PATCH', ?, ?, ?, ?, ?)
        """,
        (str(uuid.uuid4()), job_id, str(patch_file), patch_hash, patch_size, _utc_now(), _utc_now()),
    )

    zip_path = artifacts_dir / f"patched_project_{job_id}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in working_copy_dir.rglob("*"):
            if p.is_file() and not archive._is_ignored_path(p.relative_to(working_copy_dir).as_posix()):
                zf.write(p, arcname=p.relative_to(working_copy_dir).as_posix())

    zip_size = zip_path.stat().st_size
    conn.execute(
        """
        INSERT INTO artifacts (id, job_id, kind, storage_ref, sha256, size_bytes, created_at, expires_at)
        VALUES (?, ?, 'PATCHED_ZIP', ?, '', ?, ?, ?)
        """,
        (str(uuid.uuid4()), job_id, str(zip_path), zip_size, _utc_now(), _utc_now()),
    )
    conn.commit()
