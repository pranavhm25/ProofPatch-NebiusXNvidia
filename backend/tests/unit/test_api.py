"""Unit tests for FastAPI endpoints using TestClient."""
from datetime import datetime, timezone
import io
import zipfile
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import init_db, get_connection
from app.schemas.api import JobStatus, FinalVerdict

init_db()
client = TestClient(app)


def _make_sample_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("src/__init__.py", "")
        zf.writestr("src/core.py", "def run(): return 42\n")
        zf.writestr("tests/test_core.py", "from src.core import run\ndef test_run(): assert run() == 42\n")
        zf.writestr("pyproject.toml", "[project]\nname='demo'\n")
    return buf.getvalue()


def _insert_test_job(
    conn,
    job_id: str,
    bug_report: str = "Bug",
    status: str = "QUEUED",
    stage: str = "Stage",
    final_verdict: str | None = None,
):
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT OR IGNORE INTO projects (id, display_name, created_at, expires_at)
           VALUES ('fake-proj', 'Fake Project', ?, ?)""",
        (now, now),
    )
    conn.execute(
        """INSERT OR REPLACE INTO jobs (id, project_id, bug_report, status, stage, final_verdict, created_at, updated_at, expires_at)
           VALUES (?, 'fake-proj', ?, ?, ?, ?, ?, ?, ?)""",
        (job_id, bug_report, status, stage, final_verdict, now, now, now),
    )


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_upload_project_endpoint():
    zip_bytes = _make_sample_zip()
    res = client.post(
        "/api/projects",
        files={"file": ("project.zip", zip_bytes, "application/zip")},
    )
    assert res.status_code == 201
    data = res.json()
    assert "project_id" in data
    assert data["language"] == "python"
    assert data["file_count"] >= 3


def test_upload_rejects_non_zip():
    res = client.post(
        "/api/projects",
        files={"file": ("test.txt", b"plain text", "text/plain")},
    )
    assert res.status_code == 415
    data = res.json()
    assert data["error"]["code"] == "INVALID_ARCHIVE"


def test_create_and_poll_job():
    zip_bytes = _make_sample_zip()
    upload_res = client.post(
        "/api/projects",
        files={"file": ("project.zip", zip_bytes, "application/zip")},
    )
    project_id = upload_res.json()["project_id"]

    job_res = client.post(
        "/api/jobs",
        json={
            "project_id": project_id,
            "bug_report": "The function returns 0 instead of 42.",
        },
    )
    assert job_res.status_code == 202
    job_id = job_res.json()["job_id"]

    poll_res = client.get(f"/api/jobs/{job_id}")
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    assert poll_data["job_id"] == job_id
    assert "status" in poll_data


def test_get_job_result_with_patch_artifact(tmp_path):
    zip_bytes = _make_sample_zip()
    upload_res = client.post(
        "/api/projects",
        files={"file": ("project.zip", zip_bytes, "application/zip")},
    )
    project_id = upload_res.json()["project_id"]

    job_res = client.post(
        "/api/jobs",
        json={
            "project_id": project_id,
            "bug_report": "The function returns 0 instead of 42.",
        },
    )
    job_id = job_res.json()["job_id"]

    patch_file = tmp_path / f"patch_{job_id}.patch"
    patch_file.write_text(
        "--- a/src/core.py\n+++ b/src/core.py\n@@ -1,1 +1,1 @@\n-def run(): return 0\n+def run(): return 42\n",
        encoding="utf-8",
    )

    conn = get_connection()
    conn.execute(
        "UPDATE jobs SET status = ?, stage = ?, final_verdict = ?, completed_at = datetime('now') WHERE id = ?",
        (JobStatus.COMPLETED.value, "Repair verified successfully", FinalVerdict.VERIFIED.value, job_id),
    )
    conn.execute(
        "INSERT INTO artifacts (id, job_id, kind, storage_ref, sha256, size_bytes, created_at, expires_at) VALUES (?, ?, 'PATCH', ?, 'fake-sha', 100, datetime('now'), datetime('now'))",
        (f"art_{job_id}", job_id, str(patch_file)),
    )
    conn.commit()

    res = client.get(f"/api/jobs/{job_id}/result")
    assert res.status_code == 200
    data = res.json()
    assert data["job_id"] == job_id
    assert data["status"] == "COMPLETED"
    assert data["verdict"] == "VERIFIED"
    assert data["diff"]["available"] is True
    assert "def run(): return 42" in data["diff"]["unified_diff"]


def test_list_jobs_basic():
    res = client.get("/api/jobs")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "jobs" in data
    assert isinstance(data["jobs"], list)


def test_list_jobs_pagination():
    conn = get_connection()
    for i in range(5):
        _insert_test_job(conn, f"test-pag-job-{i}", "Short bug", "COMPLETED", "Done")
    conn.commit()

    res = client.get("/api/jobs?limit=2&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert len(data["jobs"]) == 2
    assert data["total"] >= 5

    res2 = client.get("/api/jobs?limit=2&offset=2")
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["jobs"]) == 2
    assert data2["jobs"][0]["job_id"] != data["jobs"][0]["job_id"]


def test_list_jobs_filters_and_invalid():
    conn = get_connection()
    _insert_test_job(conn, "test-filter-verif", "Bug 1", "COMPLETED", "Done", "VERIFIED")
    _insert_test_job(conn, "test-filter-fail", "Bug 2", "FAILED", "Failed", "FAILED")
    conn.commit()

    # Valid filters
    res_verif = client.get("/api/jobs?verdict=VERIFIED")
    assert res_verif.status_code == 200
    for j in res_verif.json()["jobs"]:
        assert j["verdict"] == "VERIFIED"

    res_fail = client.get("/api/jobs?status=FAILED")
    assert res_fail.status_code == 200
    for j in res_fail.json()["jobs"]:
        assert j["status"] == "FAILED"

    # Invalid filters -> 400
    res_bad_status = client.get("/api/jobs?status=NONEXISTENT_STATUS")
    assert res_bad_status.status_code == 400
    assert res_bad_status.json()["error"]["code"] == "INVALID_FILTER"

    res_bad_verdict = client.get("/api/jobs?verdict=MAGIC_VERDICT")
    assert res_bad_verdict.status_code == 400
    assert res_bad_verdict.json()["error"]["code"] == "INVALID_FILTER"


def test_list_jobs_truncation():
    conn = get_connection()
    long_desc = "A" * 500
    job_id = "test-trunc-job"
    _insert_test_job(conn, job_id, bug_report=long_desc)
    conn.commit()

    res = client.get("/api/jobs?limit=100")
    assert res.status_code == 200
    target_job = next((j for j in res.json()["jobs"] if j["job_id"] == job_id), None)
    assert target_job is not None
    assert len(target_job["bug_report"]) == 200
    assert target_job["bug_report"] == "A" * 200
