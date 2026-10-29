"""End-to-end integration test for ProofPatch repair pipeline.

Runs the pre-packaged buggy repository fixture (sample_buggy_repo.zip) through the
pipeline with the LLM adapter mocked at its boundary.
Asserts:
  - Final verdict is VERIFIED.
  - Test evidence proves all tests pass with exit code 0.
  - Diff is correctly generated and recorded.
  - Downloadable .patch artifact applies cleanly to the baseline.
"""
import shutil
import zipfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.db.database import init_db
from app.main import app
from app.schemas.api import FinalVerdict, JobStatus, PatchProposal, PlannedChange, RepairPlan
from app.services import orchestrator
from app.services.patch_applier import apply_patch_to_copy

init_db()
client = TestClient(app)


def test_pipeline_e2e_verified_on_sample_buggy_repo(tmp_path: Path):
    fixture_path = Path(__file__).parent.parent / "fixtures" / "sample_buggy_repo.zip"
    assert fixture_path.exists(), f"Expected fixture zip at {fixture_path}"

    # 1. Upload project archive
    with open(fixture_path, "rb") as f:
        upload_res = client.post(
            "/api/projects",
            files={"file": ("sample_buggy_repo.zip", f.read(), "application/zip")},
        )
    assert upload_res.status_code == 201, upload_res.text
    project_id = upload_res.json()["project_id"]

    # 2. Define structured LLM outputs to mock at boundary
    mock_plan = RepairPlan(
        summary="Fix absolute value function for negative numbers",
        diagnosis_hypothesis="Function returns negative input without negation",
        target_files=["src/calculator.py"],
        planned_changes=[
            PlannedChange(
                file="src/calculator.py",
                change="return -n if n < 0 else n",
                reason="Handle negative numbers properly",
            )
        ],
        risks=[],
        verification_strategy=["pytest tests/test_calculator.py"],
    )

    mock_patch = PatchProposal(
        summary="Fix absolute value logic for negative integers",
        patch=(
            "--- a/src/calculator.py\n"
            "+++ b/src/calculator.py\n"
            "@@ -1,4 +1,4 @@\n"
            " def absolute_value(n: int) -> int:\n"
            '     """Return the absolute value of an integer."""\n'
            "     # Defect: negative numbers are returned without negation\n"
            "-    return n\n"
            "+    return -n if n < 0 else n\n"
        ),
        files_expected_to_change=["src/calculator.py"],
    )

    # 3. Create and execute repair job with LLM adapter mocked
    with patch(
        "app.services.nebius_client.generate_plan",
        return_value=(mock_plan, "mock-nvidia-nemotron-reasoning"),
    ), patch(
        "app.services.nebius_client.generate_patch",
        return_value=(mock_patch, "mock-nvidia-nemotron-reasoning"),
    ):
        job_res = client.post(
            "/api/jobs",
            json={
                "project_id": project_id,
                "bug_report": "In absolute_value(-15), negative numbers are returned without negation; expected 15.",
            },
        )
        assert job_res.status_code == 202, job_res.text
        job_id = job_res.json()["job_id"]

    # 5. Fetch and verify final status and evidence
    poll_res = client.get(f"/api/jobs/{job_id}")
    assert poll_res.status_code == 200
    assert poll_res.json()["terminal"] is True
    assert poll_res.json()["status"] == JobStatus.COMPLETED.value

    result_res = client.get(f"/api/jobs/{job_id}/result")
    assert result_res.status_code == 200, result_res.text
    result_data = result_res.json()

    # Assert verdict is VERIFIED
    assert result_data["status"] == JobStatus.COMPLETED.value
    assert result_data["verdict"] == FinalVerdict.VERIFIED.value

    # Assert test execution evidence
    attempt = result_data["attempts"][0]
    assert attempt["status"] == "TESTED"
    tr = attempt["test_result"]
    assert tr is not None
    assert tr["status"] == "PASSED"
    assert tr["exit_code"] == 0
    assert tr["tests_discovered"] == 3
    assert tr["tests_passed"] == 3
    assert tr["tests_failed"] == 0

    # Assert diff is correct
    diff_info = result_data["diff"]
    assert diff_info["available"] is True
    assert diff_info["changed_files"] == ["src/calculator.py"]
    assert "-    return n" in diff_info["unified_diff"]
    assert "+    return -n if n < 0 else n" in diff_info["unified_diff"]
    assert "def absolute_value" in diff_info["unified_diff"]

    # 6. Assert downloadable .patch artifact and verify it applies cleanly
    patch_download_res = client.get(f"/api/jobs/{job_id}/download?format=patch")
    assert patch_download_res.status_code == 200
    downloaded_patch = patch_download_res.text
    assert "return -n if n < 0 else n" in downloaded_patch

    # Apply downloaded patch onto fresh unpatched copy of the fixture
    baseline_dir = tmp_path / "baseline_repo"
    working_dir = tmp_path / "working_repo"
    baseline_dir.mkdir()

    with zipfile.ZipFile(fixture_path, "r") as zf:
        zf.extractall(baseline_dir)

    # Verify baseline is currently buggy
    assert "return n" in (baseline_dir / "src" / "calculator.py").read_text()

    # Apply patch to copy
    patch_proposal = PatchProposal(
        summary="Apply downloaded patch",
        patch=downloaded_patch,
        files_expected_to_change=["src/calculator.py"],
    )
    patch_hash, changed_files, diff_applied = apply_patch_to_copy(
        baseline_path=baseline_dir,
        working_copy_path=working_dir,
        proposal=patch_proposal,
    )

    assert "src/calculator.py" in changed_files
    patched_src = (working_dir / "src" / "calculator.py").read_text()
    assert "def absolute_value(n: int) -> int:" in patched_src
    assert "return -n if n < 0 else n" in patched_src
    assert "-    return n" not in patched_src

    # Also verify downloadable patched zip exists
    zip_download_res = client.get(f"/api/jobs/{job_id}/download?format=zip")
    assert zip_download_res.status_code == 200
    assert len(zip_download_res.content) > 0

