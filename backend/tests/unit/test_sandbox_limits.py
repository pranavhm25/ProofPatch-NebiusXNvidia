"""Unit tests for sandbox isolation, timeout, and resource limits."""
import os
import sys
import zipfile
from pathlib import Path

import pytest

from app.core.config import settings
from app.services import sandbox


def test_safe_environ_scrubs_secrets(monkeypatch):
    monkeypatch.setenv("NEBIUS_API_KEY", "secret-key-12345")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-proj-xyz")
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@localhost/db")
    monkeypatch.setenv("API_KEY", "sensitive")
    monkeypatch.setenv("PASSWORD", "topsecret")
    monkeypatch.setenv("SAFE_ALLOWED_VAR", "ignored_unless_allowlisted")

    env = sandbox._safe_environ()

    assert "NEBIUS_API_KEY" not in env
    assert "OPENAI_API_KEY" not in env
    assert "DATABASE_URL" not in env
    assert "API_KEY" not in env
    assert "PASSWORD" not in env
    assert "PATH" in env


def test_sandbox_timeout_limit(tmp_path: Path, monkeypatch):
    """Verify that a hanging subprocess is terminated when sandbox_timeout_seconds is exceeded."""
    fixture_zip = Path(__file__).parent.parent / "fixtures" / "fixture_timeout.zip"
    assert fixture_zip.exists(), f"Missing fixture {fixture_zip}"

    dest_dir = tmp_path / "timeout_repo"
    with zipfile.ZipFile(fixture_zip, "r") as zf:
        zf.extractall(dest_dir)

    # Set aggressive timeout of 1 second for fast test execution
    monkeypatch.setattr(settings, "sandbox_timeout_seconds", 1)

    result = sandbox.run_tests(dest_dir, job_id="test-timeout-limit")

    assert result.timed_out is True
    assert result.test_status == "TIMED_OUT"
    assert result.duration_ms >= 900  # at least ~1s ran before timeout


@pytest.mark.skipif(sys.platform == "win32", reason="RLIMIT_AS memory enforcement requires Linux/POSIX sandbox")
def test_sandbox_memory_limit(tmp_path: Path):
    """Verify that an allocating memory-hog test fails cleanly and is bounded."""
    fixture_zip = Path(__file__).parent.parent / "fixtures" / "fixture_memory_hog.zip"
    assert fixture_zip.exists(), f"Missing fixture {fixture_zip}"

    dest_dir = tmp_path / "mem_repo"
    with zipfile.ZipFile(fixture_zip, "r") as zf:
        zf.extractall(dest_dir)

    result = sandbox.run_tests(dest_dir, job_id="test-mem-limit")

    assert result.exit_code != 0
    assert result.test_status in ("FAILED", "ERROR")
    # In Linux with RLIMIT_AS, or standard Python when memory allocation is tested:
    output = (result.stdout + "\n" + result.stderr)
    assert "MemoryError" in output or "FAILED" in output or result.exit_code != 0
