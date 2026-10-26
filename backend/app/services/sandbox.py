"""Sandbox adapter — isolated subprocess execution.

The 'local_process' implementation runs pytest in a tightly constrained
subprocess. Docker is not available, so isolation is achieved via:
  - A temporary working directory containing only the patched working copy.
  - Environment variable scrubbing (no Nebius key or host secrets passed in).
  - Resource limits via RLIMIT_* where supported (Linux only).
  - Hard wall-clock timeout via subprocess timeout.
  - Bounded stdout/stderr capture.
  - Non-shell execution (no shell=True, no user-controlled command strings).

LIMITATION (documented per TRD §9):
  Without Docker/container isolation, this runner does NOT provide:
  - Process count limits (no cgroups).
  - Network egress blocking (no network namespace).
  - Filesystem mount isolation.
  This is documented as a known limitation. The uploaded code still runs in a
  temporary directory with no application secrets in the environment.
"""
from __future__ import annotations

import logging
import os
import resource
import subprocess
import time
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.errors import ErrorCode, ProofPatchError

logger = logging.getLogger(__name__)

# Approved command template — user cannot modify this
_APPROVED_COMMAND = ["python3", "-m", "pytest", "--tb=short", "-q"]

# Environment variables to scrub from subprocess environment
_SCRUB_ENV_PREFIXES = ("NEBIUS", "OPENAI", "ANTHROPIC", "AWS", "GOOGLE_", "SECRET", "TOKEN", "KEY")

# Output size limits
_MAX_CAPTURE_BYTES = min(settings.max_log_bytes, 1024 * 1024)


def _safe_environ() -> dict:
    """Return a clean environment dict with secrets removed."""
    env = {}
    for k, v in os.environ.items():
        upper = k.upper()
        if any(upper.startswith(prefix) for prefix in _SCRUB_ENV_PREFIXES):
            continue
        if upper in ("API_KEY", "PASSWORD", "SECRET", "TOKEN", "CREDENTIALS"):
            continue
        env[k] = v
    # Ensure PATH is present for finding python3/pytest
    if "PATH" not in env:
        env["PATH"] = "/usr/bin:/usr/local/bin:/bin"
    return env


def _set_resource_limits() -> None:
    """Set CPU and address space limits where supported (Linux only)."""
    try:
        # CPU time limit (seconds)
        resource.setrlimit(resource.RLIMIT_CPU, (settings.sandbox_timeout_seconds, settings.sandbox_timeout_seconds + 5))
    except (AttributeError, ValueError, resource.error):
        pass
    try:
        # Virtual memory limit: 512 MB
        mem_limit = 512 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem_limit, mem_limit))
    except (AttributeError, ValueError, resource.error):
        pass


class SandboxResult:
    __slots__ = (
        "exit_code", "stdout", "stderr", "duration_ms",
        "timed_out", "output_truncated", "tests_discovered",
        "tests_passed", "tests_failed", "test_status",
    )

    def __init__(
        self,
        exit_code: Optional[int],
        stdout: str,
        stderr: str,
        duration_ms: int,
        timed_out: bool,
        output_truncated: bool,
    ) -> None:
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr
        self.duration_ms = duration_ms
        self.timed_out = timed_out
        self.output_truncated = output_truncated
        self.tests_discovered: Optional[int] = None
        self.tests_passed: Optional[int] = None
        self.tests_failed: Optional[int] = None
        self.test_status: str = "NOT_RUN"


def run_tests(working_copy_path: Path, job_id: Optional[str] = None) -> SandboxResult:
    """
    Run pytest in the working copy using the approved command.
    Returns a SandboxResult with actual exit code and captured output.
    Never raises on test failure — failure is a valid result.
    """
    if not working_copy_path.exists():
        raise ProofPatchError(
            code=ErrorCode.SANDBOX_UNAVAILABLE,
            message="The working copy does not exist.",
            http_status=500,
        )

    env = _safe_environ()
    cmd = _APPROVED_COMMAND

    logger.info("Sandbox run start (job=%s, path=%s)", job_id, working_copy_path.name)
    start = time.monotonic()

    try:
        proc = subprocess.run(
            cmd,
            cwd=str(working_copy_path),
            capture_output=True,
            timeout=settings.sandbox_timeout_seconds,
            env=env,
            preexec_fn=_set_resource_limits,  # Linux only, no-op on error
            shell=False,
        )
        elapsed_ms = int((time.monotonic() - start) * 1000)
        timed_out = False
        exit_code = proc.returncode

        raw_stdout = proc.stdout[:_MAX_CAPTURE_BYTES]
        raw_stderr = proc.stderr[:_MAX_CAPTURE_BYTES]
        truncated = (
            len(proc.stdout) > _MAX_CAPTURE_BYTES
            or len(proc.stderr) > _MAX_CAPTURE_BYTES
        )

        stdout = raw_stdout.decode("utf-8", errors="replace")
        stderr = raw_stderr.decode("utf-8", errors="replace")

    except subprocess.TimeoutExpired:
        elapsed_ms = int(settings.sandbox_timeout_seconds * 1000)
        timed_out = True
        exit_code = None
        stdout = ""
        stderr = "Test run timed out."
        truncated = False
        logger.warning("Sandbox timeout (job=%s)", job_id)

    except FileNotFoundError:
        raise ProofPatchError(
            code=ErrorCode.SANDBOX_UNAVAILABLE,
            message="Python/pytest is not available in the execution environment.",
            http_status=503,
        )

    except Exception as exc:
        logger.error("Sandbox unexpected error: %s (job=%s)", type(exc).__name__, job_id)
        raise ProofPatchError(
            code=ErrorCode.SANDBOX_UNAVAILABLE,
            message="The test runner encountered an unexpected error.",
            http_status=503,
        )

    result = SandboxResult(
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        duration_ms=elapsed_ms,
        timed_out=timed_out,
        output_truncated=truncated,
    )

    _parse_pytest_output(result)

    logger.info(
        "Sandbox run complete (job=%s, exit_code=%s, duration_ms=%d, tests_discovered=%s)",
        job_id,
        exit_code,
        elapsed_ms,
        result.tests_discovered,
    )

    return result


def _parse_pytest_output(result: SandboxResult) -> None:
    """Parse pytest output to extract test counts and status."""
    import re

    if result.timed_out:
        result.test_status = "TIMED_OUT"
        return

    combined = result.stdout + "\n" + result.stderr

    # Match pytest summary line: "3 passed, 1 failed in 0.5s" or "5 passed in 0.2s"
    # Also handles "no tests ran"
    m = re.search(
        r"(\d+) passed(?:,\s*(\d+) failed)?(?:,\s*(\d+) error)?.*?in",
        combined,
        re.IGNORECASE,
    )
    if m:
        result.tests_passed = int(m.group(1))
        result.tests_failed = int(m.group(2) or 0)
        errors = int(m.group(3) or 0)
        result.tests_discovered = result.tests_passed + result.tests_failed + errors
    else:
        # Check for "no tests ran"
        if re.search(r"no tests ran|collected 0 items", combined, re.IGNORECASE):
            result.tests_discovered = 0
            result.tests_passed = 0
            result.tests_failed = 0
        elif re.search(r"ERROR|error", combined):
            result.tests_discovered = None

    # Determine test status
    if result.exit_code == 0:
        if result.tests_discovered == 0:
            result.test_status = "NO_TESTS"
        elif result.tests_discovered is not None and (result.tests_passed or 0) > 0:
            result.test_status = "PASSED"
        else:
            result.test_status = "NOT_RUN"
    elif result.exit_code is None:
        result.test_status = "TIMED_OUT"
    elif re.search(r"ERROR collecting|ImportError|SyntaxError", combined):
        result.test_status = "ERROR"
    else:
        result.test_status = "FAILED"
