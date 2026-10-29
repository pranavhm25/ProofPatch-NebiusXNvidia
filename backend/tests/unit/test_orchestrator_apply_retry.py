"""Unit test for bounded retry on patch application failure (Robustness fix A).

Verifies:
1. When attempt 1 produces a patch that fails unified diff context application (PATCH_APPLY_FAILED),
   orchestrator invokes revise_patch_on_apply_error with the apply error and line-numbered files.
2. When the revised patch applies cleanly and passes tests, the job reaches VERIFIED status on attempt 2.
3. When the revised patch also fails to apply, the job terminates cleanly with FAILED (bounded to exactly 1 retry).
"""
import io
import zipfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.db.database import init_db, get_connection
from app.main import app
from app.schemas.api import FinalVerdict, JobStatus, PatchProposal, PlannedChange, RepairPlan
from app.core.errors import ErrorCode

init_db()
client = TestClient(app)


def _make_test_project_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("src/__init__.py", "")
        zf.writestr(
            "src/calculator.py",
            "def absolute_value(n: int) -> int:\n"
            '    """Return the absolute value of an integer."""\n'
            "    return n\n"
        )
        zf.writestr(
            "tests/test_calculator.py",
            "from src.calculator import absolute_value\n\n"
            "def test_pos(): assert absolute_value(5) == 5\n"
            "def test_neg(): assert absolute_value(-5) == 5\n"
        )
        zf.writestr("pyproject.toml", "[project]\nname='calc-demo'\n")
    return buf.getvalue()


def test_retry_on_patch_apply_failure_reaches_verified(tmp_path: Path):
    """Attempt 1 fails context match -> retry produces clean patch -> VERIFIED."""
    upload_res = client.post(
        "/api/projects",
        files={"file": ("project.zip", _make_test_project_zip(), "application/zip")},
    )
    assert upload_res.status_code == 201
    project_id = upload_res.json()["project_id"]

    mock_plan = RepairPlan(
        summary="Fix negative numbers in absolute_value",
        diagnosis_hypothesis="Function returns n instead of -n for negative numbers",
        target_files=["src/calculator.py"],
        planned_changes=[
            PlannedChange(
                file="src/calculator.py",
                change="return -n if n < 0 else n",
                reason="Negate negatives",
            )
        ],
        risks=[],
        verification_strategy=["pytest tests/test_calculator.py"],
    )

    # Attempt 1: Context mismatch on original source line
    bad_patch = PatchProposal(
        summary="Bad patch with context mismatch",
        patch=(
            "--- a/src/calculator.py\n"
            "+++ b/src/calculator.py\n"
            "@@ -1,3 +1,3 @@\n"
            " def wrong_signature(n: int) -> int:\n"
            '     """Return the absolute value of an integer."""\n'
            "-    return n\n"
            "+    return -n if n < 0 else n\n"
        ),
        files_expected_to_change=["src/calculator.py"],
    )

    # Attempt 2: Correct patch matching actual lines
    good_patch = PatchProposal(
        summary="Corrected patch with exact context lines",
        patch=(
            "--- a/src/calculator.py\n"
            "+++ b/src/calculator.py\n"
            "@@ -1,3 +1,3 @@\n"
            " def absolute_value(n: int) -> int:\n"
            '     """Return the absolute value of an integer."""\n'
            "-    return n\n"
            "+    return -n if n < 0 else n\n"
        ),
        files_expected_to_change=["src/calculator.py"],
    )

    revise_calls = []

    def mock_revise_patch_on_apply_error(original_patch, apply_error, context, plan, job_id=None, role=None):
        revise_calls.append({
            "original_patch": original_patch,
            "apply_error": apply_error,
            "context": context,
            "plan": plan,
        })
        return good_patch, "mock-nvidia-nemotron-advanced"

    with patch(
        "app.services.nebius_client.generate_plan",
        return_value=(mock_plan, "mock-nvidia-nemotron-reasoning"),
    ), patch(
        "app.services.nebius_client.generate_patch",
        return_value=(bad_patch, "mock-nvidia-nemotron-reasoning"),
    ), patch(
        "app.services.nebius_client.revise_patch_on_apply_error",
        side_effect=mock_revise_patch_on_apply_error,
    ):
        job_res = client.post(
            "/api/jobs",
            json={
                "project_id": project_id,
                "bug_report": "absolute_value(-5) returns -5 instead of 5",
            },
        )
        assert job_res.status_code == 202
        job_id = job_res.json()["job_id"]

    # Verify revise_patch_on_apply_error was called once with apply error
    assert len(revise_calls) == 1
    call = revise_calls[0]
    assert "Context mismatch in src/calculator.py" in call["apply_error"]
    assert "def wrong_signature" in call["original_patch"]

    # Verify job completed and reached VERIFIED on attempt 2
    poll_res = client.get(f"/api/jobs/{job_id}")
    assert poll_res.status_code == 200
    assert poll_res.json()["terminal"] is True
    assert poll_res.json()["status"] == JobStatus.COMPLETED.value

    result_res = client.get(f"/api/jobs/{job_id}/result")
    assert result_res.status_code == 200
    result_data = result_res.json()
    assert result_data["verdict"] == FinalVerdict.VERIFIED.value

    # Verify attempts in DB
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT attempt_number, status FROM attempts WHERE job_id = ? ORDER BY attempt_number", (job_id,))
    attempts = cur.fetchall()
    assert len(attempts) == 2
    assert attempts[0][0] == 1
    assert attempts[0][1] == "PATCH_APPLY_FAILED"
    assert attempts[1][0] == 2
    assert attempts[1][1] == "TESTED"


def test_retry_on_patch_apply_failure_bounded_exhaustion(tmp_path: Path):
    """Attempt 1 fails apply -> Attempt 2 also fails apply -> Job fails cleanly without looping."""
    upload_res = client.post(
        "/api/projects",
        files={"file": ("project.zip", _make_test_project_zip(), "application/zip")},
    )
    assert upload_res.status_code == 201
    project_id = upload_res.json()["project_id"]

    mock_plan = RepairPlan(
        summary="Fix negative numbers",
        diagnosis_hypothesis="hypothesis",
        target_files=["src/calculator.py"],
        planned_changes=[],
        risks=[],
        verification_strategy=["pytest"],
    )

    bad_patch = PatchProposal(
        summary="Bad patch with context mismatch",
        patch=(
            "--- a/src/calculator.py\n"
            "+++ b/src/calculator.py\n"
            "@@ -1,3 +1,3 @@\n"
            " def wrong_signature(n: int) -> int:\n"
            '     """Return the absolute value of an integer."""\n'
            "-    return n\n"
            "+    return -n if n < 0 else n\n"
        ),
        files_expected_to_change=["src/calculator.py"],
    )

    with patch(
        "app.services.nebius_client.generate_plan",
        return_value=(mock_plan, "mock-nvidia-nemotron-reasoning"),
    ), patch(
        "app.services.nebius_client.generate_patch",
        return_value=(bad_patch, "mock-nvidia-nemotron-reasoning"),
    ), patch(
        "app.services.nebius_client.revise_patch_on_apply_error",
        return_value=(bad_patch, "mock-nvidia-nemotron-advanced"),
    ):
        job_res = client.post(
            "/api/jobs",
            json={
                "project_id": project_id,
                "bug_report": "absolute_value(-5) returns -5 instead of 5",
            },
        )
        assert job_res.status_code == 202
        job_id = job_res.json()["job_id"]

    # Verify job failed with PATCH_APPLY_FAILED and no infinite loop
    poll_res = client.get(f"/api/jobs/{job_id}")
    assert poll_res.status_code == 200
    assert poll_res.json()["status"] == JobStatus.FAILED.value

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT error_code FROM jobs WHERE id = ?", (job_id,))
    assert cur.fetchone()[0] == ErrorCode.PATCH_APPLY_FAILED
    cur = conn.cursor()
    cur.execute("SELECT attempt_number, status FROM attempts WHERE job_id = ? ORDER BY attempt_number", (job_id,))
    attempts = cur.fetchall()
    assert len(attempts) == 2
    assert attempts[0][1] == "PATCH_APPLY_FAILED"
    assert attempts[1][1] == "PLANNED"  # failed during patch application
