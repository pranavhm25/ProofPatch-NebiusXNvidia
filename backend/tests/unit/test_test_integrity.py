"""Unit tests for test integrity, protected paths, baseline inventory, and hardcoding heuristic."""
import tempfile
from pathlib import Path

import pytest

from app.core.errors import ErrorCode, ProofPatchError
from app.schemas.api import PatchProposal
from app.services import patch_applier, test_integrity
from app.services.test_integrity import (
    detect_hardcoding_heuristic,
    hash_protected_files,
    is_protected_path,
    normalize_repo_path,
    verify_baseline_inventory_passed,
    verify_test_integrity,
)


def test_normalize_repo_path():
    assert normalize_repo_path("a/tests/test_core.py") == "tests/test_core.py"
    assert normalize_repo_path("b/tests/test_core.py") == "tests/test_core.py"
    assert normalize_repo_path("./tests/test_core.py") == "tests/test_core.py"
    assert normalize_repo_path(r"tests\test_core.py") == "tests/test_core.py"
    assert normalize_repo_path("/tests/test_core.py") == "tests/test_core.py"


def test_is_protected_path_cases():
    # Direct tests directories
    assert is_protected_path("tests/test_math.py")
    assert is_protected_path("test/test_math.py")
    assert is_protected_path("sub/tests/test_foo.py")
    assert is_protected_path("tests/helper.py")
    assert is_protected_path("tests/__init__.py")

    # Windows separators
    assert is_protected_path(r"tests\test_math.py")
    assert is_protected_path(r"sub\tests\test_foo.py")

    # Case variations
    assert is_protected_path("TESTS/TEST_MATH.PY")
    assert is_protected_path("Tests/Test_Core.py")
    assert is_protected_path("CONFTEST.PY")
    assert is_protected_path("PyProject.TOML")

    # Test file patterns
    assert is_protected_path("test_something.py")
    assert is_protected_path("src/test_something.py")
    assert is_protected_path("something_test.py")
    assert is_protected_path("conftest.py")
    assert is_protected_path("deep/dir/conftest.py")

    # Protected configuration files
    assert is_protected_path("pytest.ini")
    assert is_protected_path("tox.ini")
    assert is_protected_path("setup.cfg")
    assert is_protected_path("pyproject.toml")
    assert is_protected_path(".coveragerc")
    assert is_protected_path("sitecustomize.py")
    assert is_protected_path("usercustomize.py")
    assert is_protected_path("custom_plugin.pth")

    # Traversal tricks
    assert is_protected_path("../tests/test_core.py")
    assert is_protected_path("src/../../tests/test_core.py")

    # Non-protected normal source files
    assert not is_protected_path("src/core.py")
    assert not is_protected_path("app/main.py")
    assert not is_protected_path("math_utils.py")
    assert not is_protected_path("README.md")
    assert not is_protected_path("requirements.txt")


def test_patch_applier_rejects_protected_files():
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        (root / "tests").mkdir()
        (root / "tests" / "test_math.py").write_text("def test_add(): assert 1 == 1\n")
        (root / "src").mkdir()
        (root / "src" / "math_ops.py").write_text("def add(a, b): return a + b\n")

        # Modifying a test file directly
        cheat_diff = """--- a/tests/test_math.py
+++ b/tests/test_math.py
@@ -1,1 +1,1 @@
-def test_add(): assert 1 == 1
+def test_add(): assert 2 == 2
"""
        proposal = PatchProposal(
            summary="Cheat patch",
            patch=cheat_diff,
            files_expected_to_change=["tests/test_math.py"],
        )

        with pytest.raises(ProofPatchError) as exc_info:
            patch_applier.validate_patch(proposal, root)
        assert exc_info.value.code == ErrorCode.PATCH_REJECTED_PROTECTED_PATH
        assert "tests/test_math.py" in exc_info.value.message

        # Deleting a test file (+++ /dev/null)
        delete_diff = """--- a/tests/test_math.py
+++ /dev/null
@@ -1,1 +0,0 @@
-def test_add(): assert 1 == 1
"""
        del_proposal = PatchProposal(
            summary="Delete test",
            patch=delete_diff,
            files_expected_to_change=["tests/test_math.py"],
        )
        with pytest.raises(ProofPatchError) as exc_info:
            patch_applier.validate_patch(del_proposal, root)
        assert exc_info.value.code == ErrorCode.PATCH_REJECTED_PROTECTED_PATH

        # Creating conftest.py
        create_conftest = """--- /dev/null
+++ b/conftest.py
@@ -0,0 +1,2 @@
+def pytest_collection_modifyitems(items):
+    items.clear()
"""
        conftest_prop = PatchProposal(
            summary="Create conftest",
            patch=create_conftest,
            files_expected_to_change=["conftest.py"],
        )
        with pytest.raises(ProofPatchError) as exc_info:
            patch_applier.validate_patch(conftest_prop, root)
        assert exc_info.value.code == ErrorCode.PATCH_REJECTED_PROTECTED_PATH


def test_hash_protected_files_and_integrity_verification():
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        (root / "tests").mkdir()
        test_file = root / "tests" / "test_a.py"
        test_file.write_text("def test_a(): pass\n")
        cfg_file = root / "pytest.ini"
        cfg_file.write_text("[pytest]\n")
        src_file = root / "main.py"
        src_file.write_text("print('hello')\n")

        baseline_hashes = hash_protected_files(root)
        assert len(baseline_hashes) == 2
        assert "tests/test_a.py" in baseline_hashes
        assert "pytest.ini" in baseline_hashes

        # Initial check passes
        valid, msg = verify_test_integrity(baseline_hashes, root)
        assert valid
        assert msg is None

        # Modifying a test file fails
        test_file.write_text("def test_a(): assert False\n")
        valid, msg = verify_test_integrity(baseline_hashes, root)
        assert not valid
        assert "modified" in msg

        # Reverting modification
        test_file.write_text("def test_a(): pass\n")
        valid, _ = verify_test_integrity(baseline_hashes, root)
        assert valid

        # Creating a new test file fails
        new_test = root / "tests" / "test_b.py"
        new_test.write_text("def test_b(): pass\n")
        valid, msg = verify_test_integrity(baseline_hashes, root)
        assert not valid
        assert "created" in msg

        # Deleting the config file fails
        new_test.unlink()
        cfg_file.unlink()
        valid, msg = verify_test_integrity(baseline_hashes, root)
        assert not valid
        assert "deleted" in msg


def test_verify_baseline_inventory_passed():
    inventory = [
        "tests/test_core.py::test_alpha",
        "tests/test_core.py::test_beta",
    ]

    # 1. Both passed
    stdout_ok = """
PASSED tests/test_core.py::test_alpha
PASSED tests/test_core.py::test_beta
2 passed in 0.05s
"""
    ok, passed_cnt, total_cnt, exp = verify_baseline_inventory_passed(inventory, stdout_ok, "")
    assert ok
    assert passed_cnt == 2
    assert total_cnt == 2
    assert exp is None

    # 2. One skipped
    stdout_skip = """
PASSED tests/test_core.py::test_alpha
SKIPPED [1] tests/test_core.py::test_beta: reason
1 passed, 1 skipped in 0.05s
"""
    ok, passed_cnt, total_cnt, exp = verify_baseline_inventory_passed(inventory, stdout_skip, "")
    assert not ok
    assert passed_cnt == 1
    assert "skipped tests never count as passing" in exp

    # 3. One xfailed
    stdout_xfail = """
PASSED tests/test_core.py::test_alpha
XFAIL tests/test_core.py::test_beta
1 passed, 1 xfailed in 0.05s
"""
    ok, passed_cnt, total_cnt, exp = verify_baseline_inventory_passed(inventory, stdout_xfail, "")
    assert not ok
    assert passed_cnt == 1
    assert "xfail tests never count as passing" in exp

    # 4. One deselected / missing
    stdout_missing = """
PASSED tests/test_core.py::test_alpha
1 passed in 0.03s
"""
    ok, passed_cnt, total_cnt, exp = verify_baseline_inventory_passed(inventory, stdout_missing, "")
    assert not ok
    assert passed_cnt == 1
    assert "not collected / deselected" in exp


def test_hardcoding_heuristic_detection():
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        (root / "tests").mkdir()
        (root / "src").mkdir()

        test_file = root / "tests" / "test_core.py"
        test_file.write_text('def test_token(): assert compute() == "impossible-external-token-938210948"\n')

        src_file = root / "src" / "core.py"
        src_file.write_text('def compute():\n    return "unimplemented"\n')

        # True Positive: model hardcodes the exact test literal into the source
        cheat_diff = """--- a/src/core.py
+++ b/src/core.py
@@ -1,2 +1,2 @@
 def compute():
-    return "unimplemented"
+    return "impossible-external-token-938210948"
"""
        warning = detect_hardcoding_heuristic(cheat_diff, root)
        assert warning is not None
        assert "Review recommended: the patch adds a value that also appears in the tests" in warning

        # True Negative: normal algorithmic fix (no copied test literal)
        normal_src = root / "src" / "math_ops.py"
        normal_src.write_text("def abs_val(n):\n    return n\n")
        normal_diff = """--- a/src/math_ops.py
+++ b/src/math_ops.py
@@ -1,2 +1,2 @@
 def abs_val(n):
-    return n
+    return -n if n < 0 else n
"""
        warning_clean = detect_hardcoding_heuristic(normal_diff, root)
        assert warning_clean is None
