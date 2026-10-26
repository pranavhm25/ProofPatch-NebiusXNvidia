"""Unit tests for the evidence-based verdict calculator."""
from app.schemas.api import FinalVerdict, TestResultSchema, TestStatus
from app.services.verdict import compute_verdict


def _make_test_result(
    status: TestStatus,
    exit_code: int = 0,
    tests_discovered: int = 5,
    tests_passed: int = 5,
    tests_failed: int = 0,
) -> TestResultSchema:
    return TestResultSchema(
        status=status,
        command_id="pytest-default",
        exit_code=exit_code,
        duration_ms=450,
        tests_discovered=tests_discovered,
        tests_passed=tests_passed,
        tests_failed=tests_failed,
        stdout=f"{tests_passed} passed",
        stderr="",
        output_truncated=False,
    )


def test_verdict_verified_when_all_pass():
    tr = _make_test_result(TestStatus.PASSED, exit_code=0, tests_discovered=3, tests_passed=3, tests_failed=0)
    verdict, summary, limitations = compute_verdict(tr, "TESTED")
    assert verdict == FinalVerdict.VERIFIED
    assert "completed successfully" in summary
    assert any("Passing tests provide evidence" in lim for lim in limitations)


def test_verdict_not_verified_when_zero_tests():
    tr = _make_test_result(TestStatus.NO_TESTS, exit_code=0, tests_discovered=0, tests_passed=0, tests_failed=0)
    verdict, summary, _ = compute_verdict(tr, "TESTED")
    assert verdict == FinalVerdict.NOT_VERIFIED
    assert "no tests were discovered" in summary


def test_verdict_failed_when_tests_fail():
    tr = _make_test_result(TestStatus.FAILED, exit_code=1, tests_discovered=3, tests_passed=2, tests_failed=1)
    verdict, summary, _ = compute_verdict(tr, "TESTED")
    assert verdict == FinalVerdict.FAILED
    assert "1 test(s) failed" in summary


def test_verdict_blocked_on_infrastructure_error():
    verdict, summary, _ = compute_verdict(None, "BLOCKED", error_code="PROVIDER_AUTH_ERROR")
    assert verdict == FinalVerdict.BLOCKED
    assert "PROVIDER_AUTH_ERROR" in summary


def test_verdict_failed_on_patch_rejected():
    verdict, summary, _ = compute_verdict(None, "PATCH_REJECTED")
    assert verdict == FinalVerdict.FAILED
    assert "could not be safely validated" in summary
