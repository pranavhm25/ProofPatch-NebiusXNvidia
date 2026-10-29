"""Unit tests for FastAPI endpoints using TestClient."""
import io
import zipfile
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import init_db

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
    from app.db.database import get_connection
    from app.schemas.api import JobStatus, FinalVerdict

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
