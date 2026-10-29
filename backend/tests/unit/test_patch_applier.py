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

    # Protected paths (root and subdirectories)
    assert _is_safe_patch_target(".env") is False
    assert _is_safe_patch_target("subdir/.env") is False
    assert _is_safe_patch_target("config/.env.local") is False
    assert _is_safe_patch_target("secrets.json") is False
    assert _is_safe_patch_target(".git/config") is False
    assert _is_safe_patch_target("foo/.git/HEAD") is False


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

    # Verify working copy IS CHANGED and function header is intact
    result_text = (working_copy / "calc.py").read_text()
    assert "def add(a, b):\n    return a + b\n" == result_text


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


def test_multi_hunk_diff(tmp_path: Path):
    baseline = tmp_path / "baseline_multi"
    baseline.mkdir()
    src_file = baseline / "module.py"
    lines = [f"line_{i}\n" for i in range(1, 21)]
    src_file.write_text("".join(lines))

    working_copy = tmp_path / "working_copy_multi"

    patch_text = """--- a/module.py
+++ b/module.py
@@ -2,3 +2,3 @@
 line_2
-line_3
+line_three_updated
 line_4
@@ -15,3 +15,3 @@
 line_15
-line_16
+line_sixteen_updated
 line_17
"""
    proposal = PatchProposal(
        summary="Update lines 3 and 16",
        patch=patch_text,
        files_expected_to_change=["module.py"],
    )

    apply_patch_to_copy(baseline, working_copy, proposal)

    result_lines = (working_copy / "module.py").read_text().splitlines(keepends=True)
    assert len(result_lines) == 20
    assert result_lines[0] == "line_1\n"
    assert result_lines[1] == "line_2\n"
    assert result_lines[2] == "line_three_updated\n"
    assert result_lines[3] == "line_4\n"
    assert result_lines[14] == "line_15\n"
    assert result_lines[15] == "line_sixteen_updated\n"
    assert result_lines[16] == "line_17\n"
    assert result_lines[19] == "line_20\n"


def test_context_only_offsets(tmp_path: Path):
    baseline = tmp_path / "baseline_offset"
    baseline.mkdir()
    src_file = baseline / "offset.py"
    # Header comments cause the target block to be offset from line 3 to line 7
    src_file.write_text(
        "# Header line 1\n# Header line 2\n# Header line 3\n# Header line 4\n"
        "def compute(x):\n    val = x * 2\n    return val\n"
    )

    working_copy = tmp_path / "working_copy_offset"

    # Patch claims hunk starts at line 2, but context matches at line 5
    patch_text = """--- a/offset.py
+++ b/offset.py
@@ -2,3 +2,3 @@
 def compute(x):
-    val = x * 2
+    val = x * 3
     return val
"""
    proposal = PatchProposal(
        summary="Change multiplier with offset line numbers",
        patch=patch_text,
        files_expected_to_change=["offset.py"],
    )

    apply_patch_to_copy(baseline, working_copy, proposal)

    result_text = (working_copy / "offset.py").read_text()
    assert "val = x * 3" in result_text
    assert "# Header line 1\n" in result_text
    assert "def compute(x):\n    val = x * 3\n    return val\n" in result_text


def test_indentation_sensitive_python(tmp_path: Path):
    baseline = tmp_path / "baseline_indent"
    baseline.mkdir()
    src_file = baseline / "nested.py"
    original_code = (
        "class Processor:\n"
        "    def run(self, flag):\n"
        "        if flag:\n"
        "            # Nested indentation check\n"
        "            total = 10\n"
        "            return total\n"
        "        return 0\n"
    )
    src_file.write_text(original_code)

    working_copy = tmp_path / "working_copy_indent"

    patch_text = """--- a/nested.py
+++ b/nested.py
@@ -3,4 +3,4 @@
         if flag:
             # Nested indentation check
-            total = 10
+            total = 20
             return total
"""
    proposal = PatchProposal(
        summary="Update total value while preserving nested indentation",
        patch=patch_text,
        files_expected_to_change=["nested.py"],
    )

    apply_patch_to_copy(baseline, working_copy, proposal)

    result_code = (working_copy / "nested.py").read_text()
    expected_code = (
        "class Processor:\n"
        "    def run(self, flag):\n"
        "        if flag:\n"
        "            # Nested indentation check\n"
        "            total = 20\n"
        "            return total\n"
        "        return 0\n"
    )
    assert result_code == expected_code


def test_context_mismatch_fails_cleanly(tmp_path: Path):
    baseline = tmp_path / "baseline_mismatch"
    baseline.mkdir()
    src_file = baseline / "mismatch.py"
    src_file.write_text("def target():\n    return 'original'\n")

    working_copy = tmp_path / "working_copy_mismatch"

    patch_text = """--- a/mismatch.py
+++ b/mismatch.py
@@ -1,2 +1,2 @@
 def unexpected_name():
-    return 'wrong'
+    return 'new'
"""
    proposal = PatchProposal(
        summary="Patch with mismatching context",
        patch=patch_text,
        files_expected_to_change=["mismatch.py"],
    )

    with pytest.raises(ProofPatchError) as exc_info:
        apply_patch_to_copy(baseline, working_copy, proposal)

    assert exc_info.value.code == ErrorCode.PATCH_APPLY_FAILED
    assert "Context mismatch in mismatch.py" in exc_info.value.message

    # Baseline remains unchanged
    assert src_file.read_text() == "def target():\n    return 'original'\n"

    # Working copy is discarded / does not persist corrupted files
    assert not working_copy.exists()


def test_no_newline_at_eof(tmp_path: Path):
    baseline = tmp_path / "baseline_nonl"
    baseline.mkdir()
    src_file = baseline / "nonl.py"
    src_file.write_text("line_1\nline_2")  # No trailing newline

    working_copy = tmp_path / "working_copy_nonl"

    patch_text = """--- a/nonl.py
+++ b/nonl.py
@@ -1,2 +1,2 @@
 line_1
-line_2
\\ No newline at end of file
+line_2_patched
\\ No newline at end of file
"""
    proposal = PatchProposal(
        summary="Patch EOF without newline",
        patch=patch_text,
        files_expected_to_change=["nonl.py"],
    )

    apply_patch_to_copy(baseline, working_copy, proposal)

    result_text = (working_copy / "nonl.py").read_text()
    assert result_text == "line_1\nline_2_patched"
