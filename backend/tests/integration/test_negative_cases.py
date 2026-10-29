"""Permanent integration tests for ProofPatch negative cases.

Requirement 4:
  (a) A fixture where the bug is unfixable from the information given -> FAILED (never VERIFIED)
  (b) A repository with zero tests -> NOT_VERIFIED (never VERIFIED)
  (c) A repository whose tests hang -> FAILED/BLOCKED (never VERIFIED)
"""
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.database import init_db
from app.main import app
from app.schemas.api import FinalVerdict, JobStatus, PatchProposal, PlannedChange, RepairPlan

init_db()
client = TestClient(app)


def test_unfixable_fixture_results_in_failed_verdict(tmp_path: Path):
    """Test unfixable bug reaches FAILED verdict and NEVER VERIFIED."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "fixture_unfixable.zip"
    assert fixture_path.exists(), f"Expected fixture zip at {fixture_path}"

    with open(fixture_path, "rb") as f:
        upload_res = client.post(
            "/api/projects",
            files={"file": ("fixture_unfixable.zip", f.read(), "application/zip")},
        )
    assert upload_res.status_code == 201, upload_res.text
    project_id = upload_res.json()["project_id"]

    mock_plan = RepairPlan(
        summary="Attempt fix for unfixable secret",
        diagnosis_hypothesis="Cannot deduce external secret",
        target_files=["src/core.py"],
        planned_changes=[
            PlannedChange(
                file="src/core.py",
                change="return guess",
                reason="Speculation",
            )
        ],
        risks=[],
        verification_strategy=["pytest tests/test_core.py"],
    )

    mock_patch_1 = PatchProposal(
        summary="Guess 1",
        patch=(
            "--- a/src/core.py\n"
            "+++ b/src/core.py\n"
            "@@ -1,3 +1,3 @@\n"
            " def compute():\n"
            "-    return \"alpha\"\n"
            "+    return \"guess_1\"\n"
        ),
        files_expected_to_change=["src/core.py"],
    )

    mock_patch_2 = PatchProposal(
        summary="Guess 2",
        patch=(
            "--- a/src/core.py\n"
            "+++ b/src/core.py\n"
            "@@ -1,3 +1,3 @@\n"
            " def compute():\n"
            "-    return \"alpha\"\n"
            "+    return \"guess_2\"\n"
        ),
        files_expected_to_change=["src/core.py"],
    )

    with patch(
        "app.services.nebius_client.generate_plan",
        return_value=(mock_plan, "mock-model"),
    ), patch(
        "app.services.nebius_client.generate_patch",
        return_value=(mock_patch_1, "mock-model"),
    ), patch(
        "app.services.nebius_client.revise_patch",
        return_value=(mock_patch_2, "mock-model"),
    ):
        job_res = client.post(
            "/api/jobs",
            json={
                "project_id": project_id,
                "bug_report": "compute() must return valid token",
            },
        )
        assert job_res.status_code == 202, job_res.text
        job_id = job_res.json()["job_id"]

    result_res = client.get(f"/api/jobs/{job_id}/result")
    assert result_res.status_code == 200, result_res.text
    result_data = result_res.json()

    assert result_data["verdict"] == FinalVerdict.FAILED.value
    assert result_data["status"] == JobStatus.FAILED.value
    assert result_data["verdict"] != FinalVerdict.VERIFIED.value


def test_zero_tests_fixture_results_in_not_verified_verdict(tmp_path: Path):
    """Test repository with zero tests reaches NOT_VERIFIED and NEVER VERIFIED."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "fixture_zero_tests.zip"
    assert fixture_path.exists(), f"Expected fixture zip at {fixture_path}"

    with open(fixture_path, "rb") as f:
        upload_res = client.post(
            "/api/projects",
            files={"file": ("fixture_zero_tests.zip", f.read(), "application/zip")},
        )
    assert upload_res.status_code == 201, upload_res.text
    project_id = upload_res.json()["project_id"]

    mock_plan = RepairPlan(
        summary="Update greeting",
        diagnosis_hypothesis="No tests present",
        target_files=["src/util.py"],
        planned_changes=[
            PlannedChange(
                file="src/util.py",
                change="pass",
                reason="No-op",
            )
        ],
        risks=[],
        verification_strategy=[],
    )

    mock_patch = PatchProposal(
        summary="Update greeting",
        patch=(
            "--- a/src/util.py\n"
            "+++ b/src/util.py\n"
            "@@ -1,3 +1,3 @@\n"
            " def greet(name: str) -> str:\n"
            "-    return f\"Hello, {name}!\"\n"
            "+    return f\"Hello, {name}.\"\n"
        ),
        files_expected_to_change=["src/util.py"],
    )

    with patch(
        "app.services.nebius_client.generate_plan",
        return_value=(mock_plan, "mock-model"),
    ), patch(
        "app.services.nebius_client.generate_patch",
        return_value=(mock_patch, "mock-model"),
    ):
        job_res = client.post(
            "/api/jobs",
            json={
                "project_id": project_id,
                "bug_report": "greet should use period instead of exclamation mark",
            },
        )
        assert job_res.status_code == 202, job_res.text
        job_id = job_res.json()["job_id"]

    result_res = client.get(f"/api/jobs/{job_id}/result")
    assert result_res.status_code == 200, result_res.text
    result_data = result_res.json()

    assert result_data["verdict"] == FinalVerdict.NOT_VERIFIED.value
    assert result_data["verdict"] != FinalVerdict.VERIFIED.value


def test_hanging_tests_fixture_times_out_and_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Test hanging test execution times out and reaches FAILED (never VERIFIED)."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "fixture_timeout.zip"
    assert fixture_path.exists(), f"Expected fixture zip at {fixture_path}"

    # Set hard timeout to 2 seconds for test speed
    monkeypatch.setattr(settings, "sandbox_timeout_seconds", 2)

    with open(fixture_path, "rb") as f:
        upload_res = client.post(
            "/api/projects",
            files={"file": ("fixture_timeout.zip", f.read(), "application/zip")},
        )
    assert upload_res.status_code == 201, upload_res.text
    project_id = upload_res.json()["project_id"]

    mock_plan = RepairPlan(
        summary="Fix worker task",
        diagnosis_hypothesis="Worker task hangs",
        target_files=["src/worker.py"],
        planned_changes=[
            PlannedChange(
                file="src/worker.py",
                change="pass",
                reason="No-op",
            )
        ],
        risks=[],
        verification_strategy=["pytest tests/test_worker.py"],
    )

    mock_patch = PatchProposal(
        summary="Touch worker",
        patch=(
            "--- a/src/worker.py\n"
            "+++ b/src/worker.py\n"
            "@@ -1,3 +1,3 @@\n"
            " def perform_task():\n"
            "-    return True\n"
            "+    return True\n"
        ),
        files_expected_to_change=["src/worker.py"],
    )

    with patch(
        "app.services.nebius_client.generate_plan",
        return_value=(mock_plan, "mock-model"),
    ), patch(
        "app.services.nebius_client.generate_patch",
        return_value=(mock_patch, "mock-model"),
    ), patch(
        "app.services.nebius_client.revise_patch",
        return_value=(mock_patch, "mock-model"),
    ):
        job_res = client.post(
            "/api/jobs",
            json={
                "project_id": project_id,
                "bug_report": "Worker test hangs indefinitely",
            },
        )
        assert job_res.status_code == 202, job_res.text
        job_id = job_res.json()["job_id"]

    result_res = client.get(f"/api/jobs/{job_id}/result")
    assert result_res.status_code == 200, result_res.text
    result_data = result_res.json()

    assert result_data["verdict"] == FinalVerdict.FAILED.value
    assert result_data["status"] == JobStatus.FAILED.value
    assert result_data["verdict"] != FinalVerdict.VERIFIED.value
