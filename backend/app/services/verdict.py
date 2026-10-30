"""Verdict calculation service.

Enforces the core product axiom: EVIDENCE OVER ASSERTION.
A repair is NEVER marked VERIFIED based on model prose. Only actual test execution
evidence from the sandbox runner, verified against pristine test file integrity
and complete baseline test collection, can establish a VERIFIED verdict.

Verdicts:
- VERIFIED: approved test command exited 0 AND tests_discovered > 0 AND tests_passed > 0
  AND tests_failed == 0 AND all baseline tests collected and passed AND test files unmodified.
- NOT_VERIFIED: tests ran but 0 tests discovered, tests were not run, baseline inventory
  mismatched (skipped/xfailed/missing tests), or evidence is inconclusive.
- FAILED: tests ran and failed (exit_code != 0, tests_failed > 0), or patch could not be applied.
- BLOCKED: infrastructure, authentication, sandbox, or security policy / test integrity violation.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from app.core.errors import ErrorCode
from app.schemas.api import FinalVerdict, TestResultSchema, TestStatus
from app.services.test_integrity import verify_baseline_inventory_passed


def compute_verdict(
    test_result: Optional[TestResultSchema],
    attempt_status: str,
    error_code: Optional[str] = None,
    test_integrity_valid: bool = True,
    test_integrity_detail: Optional[str] = None,
    baseline_inventory: Optional[List[str]] = None,
    protected_files_count: int = 0,
    hardcoding_warning: Optional[str] = None,
) -> Tuple[FinalVerdict, str, List[str]]:
    """
    Compute final verdict, summary statement, and limitations list.

    Returns:
        (FinalVerdict, summary_text, list_of_limitations)
    """
    limitations: List[str] = [
        "Passing tests provide evidence for tested behavior only; they do not prove the absence of all defects.",
    ]

    # Test integrity violation (anti-tampering)
    if error_code == ErrorCode.TEST_INTEGRITY_VIOLATION or not test_integrity_valid:
        detail = test_integrity_detail or "Test files were modified or tampered with."
        limitations.append("Test files are read-only and must remain unmodified.")
        return (
            FinalVerdict.BLOCKED,
            f"Test integrity violation: {detail}",
            limitations,
        )

    # Infrastructure / policy blocking
    if error_code in (
        ErrorCode.PROVIDER_AUTH_ERROR,
        ErrorCode.PROVIDER_TIMEOUT,
        ErrorCode.PROVIDER_RATE_LIMIT,
        ErrorCode.SANDBOX_UNAVAILABLE,
        ErrorCode.ARCHIVE_PATH_REJECTED,
        ErrorCode.UPLOAD_LIMIT_EXCEEDED,
    ):
        return (
            FinalVerdict.BLOCKED,
            f"Execution was blocked by an infrastructure or safety condition: {error_code}.",
            limitations,
        )

    # Patch rejection or application failure
    if attempt_status in ("PATCH_REJECTED", "PATCH_APPLY_FAILED") or error_code in (
        ErrorCode.PATCH_REJECTED,
        ErrorCode.PATCH_REJECTED_PROTECTED_PATH,
        ErrorCode.PATCH_APPLY_FAILED,
    ):
        msg = "The candidate patch could not be safely validated or applied to the repository."
        if error_code == ErrorCode.PATCH_REJECTED_PROTECTED_PATH:
            msg = "The patch was rejected because test files are read-only. Fix the source code."
        return (
            FinalVerdict.FAILED,
            msg,
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

    # Success candidate: exit_code 0 AND tests_discovered > 0 AND tests_passed > 0 AND tests_failed == 0
    if (
        test_result.status == TestStatus.PASSED
        and test_result.exit_code == 0
        and test_result.tests_discovered is not None
        and test_result.tests_discovered > 0
        and (test_result.tests_failed is None or test_result.tests_failed == 0)
    ):
        if test_result.output_truncated:
            limitations.append("Test output was truncated to fit the configured output limit.")

        # Baseline inventory verification (must pass all pristine baseline tests)
        if baseline_inventory:
            all_passed, passed_count, total_count, explanation = verify_baseline_inventory_passed(
                baseline_inventory,
                test_result.stdout,
                test_result.stderr,
            )
            if not all_passed:
                limitations.append(explanation or "Not all baseline tests passed.")
                limitations.append("Skipped or xfail tests never count as passing.")
                return (
                    FinalVerdict.NOT_VERIFIED,
                    explanation or "Baseline test inventory mismatch. Skipped or xfail tests never count as passing.",
                    limitations,
                )
            inventory_summary = f"{passed_count} of {total_count} baseline tests passed"
        else:
            inventory_summary = f"{test_result.tests_passed} test(s) passed"

        integrity_phrase = f"Test files unmodified ({protected_files_count} files hashed)" if protected_files_count > 0 else "Test files unmodified"
        summary = f"The approved test suite completed successfully ({test_result.tests_passed} test(s) passed). {integrity_phrase}. {inventory_summary}."

        if hardcoding_warning:
            summary = f"{summary} {hardcoding_warning}"
            limitations.append(hardcoding_warning)

        return (
            FinalVerdict.VERIFIED,
            summary,
            limitations,
        )

    # Fallback if conditions are ambiguous
    return (
        FinalVerdict.NOT_VERIFIED,
        "Test execution completed, but evidence was inconclusive.",
        limitations,
    )
