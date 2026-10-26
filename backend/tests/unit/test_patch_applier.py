"""Unit tests for patch validation and atomic application."""
from pathlib import Path

import pytest

from app.core.errors import ErrorCode, ProofPatchError
from app.schemas.api import PatchProposal
from app.services.patch_applier import (
    _is_safe_patch_target,
    apply_patch_to_copy,
    validate_patch,
)


def test_is_safe_patch_target():
    assert _is_safe_patch_target("src/module.py") is True
    assert _is_safe_patch_target("tests/test_foo.py") is True

    # Traversal and absolute
    assert _is_safe_patch_target("../evil.py") is False
    assert _is_safe_patch_target("/etc/passwd") is False

    # Protected paths
    assert _is_safe_patch_target(".env") is False
    assert _is_safe_patch_target("secrets.json") is False
    assert _is_safe_patch_target(".git/config") is False


def test_apply_patch_to_copy(tmp_path: Path):
    baseline = tmp_path / "baseline"
    baseline.mkdir()
    src_file = baseline / "calc.py"
    src_file.write_text("def add(a, b):\n    return a - b\n")

    working_copy = tmp_path / "working_copy"

    patch_text = """--- a/calc.py
+++ b/calc.py
@@ -1,2 +1,2 @@
 def add(a, b):
-    return a - b
+    return a + b
"""

    proposal = PatchProposal(
        summary="Fix subtraction in add function",
        patch=patch_text,
        files_expected_to_change=["calc.py"],
    )

    patch_hash, changed_files, diff = apply_patch_to_copy(
        baseline_path=baseline,
        working_copy_path=working_copy,
        proposal=proposal,
    )

    assert "calc.py" in changed_files
    assert patch_hash.startswith("sha256:")

    # Verify baseline is UNCHANGED
    assert "return a - b" in src_file.read_text()

    # Verify working copy IS CHANGED
    assert "return a + b" in (working_copy / "calc.py").read_text()


def test_reject_unsafe_patch(tmp_path: Path):
    baseline = tmp_path / "baseline"
    baseline.mkdir()

    patch_text = """--- a/.env
+++ b/.env
@@ -1,1 +1,1 @@
-SECRET=old
+SECRET=new
"""
    proposal = PatchProposal(
        summary="Modify .env",
        patch=patch_text,
        files_expected_to_change=[".env"],
    )

    with pytest.raises(ProofPatchError) as exc_info:
        validate_patch(proposal, baseline)

    assert exc_info.value.code == ErrorCode.PATCH_REJECTED
