"""Verdict calculation service.

Enforces the core product axiom: EVIDENCE OVER ASSERTION.
A repair is NEVER marked VERIFIED based on model prose. Only actual test execution
evidence from the sandbox runner can establish a VERIFIED verdict.

Verdicts:
- VERIFIED: approved test command exited 0 AND tests_discovered > 0 AND tests_passed > 0 AND tests_failed == 0.
- NOT_VERIFIED: tests ran but 0 tests discovered, tests were not run, or evidence is inconclusive.
- FAILED: tests ran and failed (exit_code != 0, tests_failed > 0), or patch could not be applied.
- BLOCKED: infrastructure, authentication, sandbox, or security policy prevented execution.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from app.schemas.api import FinalVerdict, TestResultSchema, TestStatus


def compute_verdict(
    test_result: Optional[TestResultSchema],
    attempt_status: str,
    error_code: Optional[str] = None,
) -> Tuple[FinalVerdict, str, List[str]]:
    """
    Compute final verdict, summary statement, and limitations list.

    Returns:
        (FinalVerdict, summary_text, list_of_limitations)
    """
    limitations: List[str] = [
        "Passing tests provide evidence for tested behavior only; they do not prove the absence of all defects.",
    ]

    # Infrastructure / policy blocking
    if error_code in (
        "PROVIDER_AUTH_ERROR",
        "PROVIDER_TIMEOUT",
        "PROVIDER_RATE_LIMIT",
        "SANDBOX_UNAVAILABLE",
        "ARCHIVE_PATH_REJECTED",
        "UPLOAD_LIMIT_EXCEEDED",
    ):
        return (
            FinalVerdict.BLOCKED,
            f"Execution was blocked by an infrastructure or safety condition: {error_code}.",
            limitations,
        )

    # Patch rejection or application failure
    if attempt_status in ("PATCH_REJECTED", "PATCH_APPLY_FAILED") or error_code in (
        "PATCH_REJECTED",
        "PATCH_APPLY_FAILED",
    ):
        return (
            FinalVerdict.FAILED,
            "The candidate patch could not be safely validated or applied to the repository.",
            limitations,
        )

    # If no test result exists
    if test_result is None or test_result.status == TestStatus.NOT_RUN:
        return (
            FinalVerdict.NOT_VERIFIED,
            "No tests were executed. Repair could not be verified.",
            limitations,
        )

    # Timeout
    if test_result.status == TestStatus.TIMED_OUT:
        limitations.append("Execution reached the sandbox timeout limit.")
        return (
            FinalVerdict.FAILED,
            "Test suite execution timed out inside the sandbox.",
            limitations,
        )

    # Test runner execution error (e.g. syntax error or collection failure)
    if test_result.status == TestStatus.ERROR:
        return (
            FinalVerdict.FAILED,
            "The test runner encountered an error while collecting or executing tests.",
            limitations,
        )

    # Zero tests discovered
    if test_result.status == TestStatus.NO_TESTS or (
        test_result.tests_discovered is not None and test_result.tests_discovered == 0
    ):
        limitations.append("No test cases were discovered in the repository.")
        return (
            FinalVerdict.NOT_VERIFIED,
            "The test command ran with exit code 0, but no tests were discovered.",
            limitations,
        )

    # Tests ran and failed
    if (
        test_result.status == TestStatus.FAILED
        or (test_result.exit_code is not None and test_result.exit_code != 0)
        or (test_result.tests_failed is not None and test_result.tests_failed > 0)
    ):
        return (
            FinalVerdict.FAILED,
            f"Test execution failed: {test_result.tests_failed or 0} test(s) failed.",
            limitations,
        )

    # Success condition: exit_code 0 AND tests_discovered > 0 AND tests_passed > 0 AND tests_failed == 0
    if (
        test_result.status == TestStatus.PASSED
        and test_result.exit_code == 0
        and test_result.tests_discovered is not None
        and test_result.tests_discovered > 0
        and (test_result.tests_failed is None or test_result.tests_failed == 0)
    ):
        if test_result.output_truncated:
            limitations.append("Test output was truncated to fit the configured output limit.")
        return (
            FinalVerdict.VERIFIED,
            f"The approved test suite completed successfully ({test_result.tests_passed} test(s) passed).",
            limitations,
        )

    # Fallback if conditions are ambiguous
    return (
        FinalVerdict.NOT_VERIFIED,
        "Test execution completed, but evidence was inconclusive.",
        limitations,
    )
