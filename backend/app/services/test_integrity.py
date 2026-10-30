"""Test integrity and anti-tampering verification service.

Enforces:
1. Protected test and configuration files are strictly read-only.
2. SHA-256 pristine baseline hashing before patching, after patching, and after pytest execution.
3. Baseline test inventory collection and strict all-passed verification.
4. Hardcoding heuristic to detect test-literal hardcoding.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Approved python executable for test collection
_PYTHON_EXE = sys.executable if sys.executable else "python3"

# Protected configuration filenames (case-insensitive)
_PROTECTED_CONFIG_FILENAMES = frozenset({
    "pytest.ini",
    "tox.ini",
    "setup.cfg",
    "pyproject.toml",
    ".coveragerc",
    "sitecustomize.py",
    "usercustomize.py",
})

# Protected test directory names (case-insensitive)
_PROTECTED_DIR_NAMES = frozenset({"tests", "test"})


def normalize_repo_path(path: str) -> str:
    """Normalize a path to clean POSIX format without leading/trailing slashes or 'a/'/'b/' diff prefixes."""
    p = path.replace("\\", "/").strip()
    # Strip git diff prefixes
    if p.startswith("a/") or p.startswith("b/"):
        p = p[2:]
    # Strip leading ./ or /
    while p.startswith("./") or p.startswith("/"):
        if p.startswith("./"):
            p = p[2:]
        elif p.startswith("/"):
            p = p[1:]
    return p


def is_protected_path(path: str) -> bool:
    """
    Check whether a relative path targets a protected test or test configuration file.

    Protected targets include:
    - Any file under a directory named 'tests' or 'test' (at any depth)
    - Files named test_*.py or *_test.py
    - Files named conftest.py (anywhere in repo)
    - Configuration files: pytest.ini, tox.ini, setup.cfg, pyproject.toml, .coveragerc
    - Python environment hooks: sitecustomize.py, usercustomize.py
    - Any *.pth file
    - Also blocks path traversal (..)
    """
    if not path:
        return False

    norm = normalize_repo_path(path)
    posix_path = PurePosixPath(norm)

    # Any traversal segment is forbidden
    if ".." in posix_path.parts:
        return True

    lower_parts = [part.lower() for part in posix_path.parts]
    if not lower_parts:
        return False

    # Ignore runtime cache and compiler artifacts
    if any(part in ("__pycache__", ".pytest_cache", ".hypothesis", ".tox", ".mypy_cache") for part in lower_parts):
        return False

    filename = lower_parts[-1]
    if filename.endswith((".pyc", ".pyo", ".pyd")):
        return False

    parent_dirs = lower_parts[:-1]

    # 1. Any file inside a 'tests' or 'test' directory
    if any(d in _PROTECTED_DIR_NAMES for d in parent_dirs):
        return True

    # 2. Test file naming conventions
    if filename.startswith("test_") and filename.endswith(".py"):
        return True
    if filename.endswith("_test.py"):
        return True
    if filename == "conftest.py":
        return True

    # 3. Test & build configuration files
    if filename in _PROTECTED_CONFIG_FILENAMES:
        return True

    # 4. Any .pth file
    if filename.endswith(".pth"):
        return True

    return False


def hash_file_sha256(filepath: Path) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def hash_protected_files(repo_path: Path) -> Dict[str, str]:
    """
    Scan repo_path and compute SHA-256 hashes for all protected test and config files.
    Returns mapping of normalized relative path -> sha256 hex string.
    """
    hashes: Dict[str, str] = {}
    if not repo_path.exists():
        return hashes

    for root, dirs, files in os.walk(repo_path):
        # Prune cache directories
        dirs[:] = [d for d in dirs if d.lower() not in ("__pycache__", ".pytest_cache", ".hypothesis", ".git", ".tox", ".mypy_cache")]
        root_path = Path(root)
        for fname in files:
            if fname.lower().endswith((".pyc", ".pyo", ".pyd")):
                continue
            full_path = root_path / fname
            try:
                rel_path = full_path.relative_to(repo_path).as_posix()
            except ValueError:
                continue

            if is_protected_path(rel_path):
                norm_key = normalize_repo_path(rel_path).lower()
                try:
                    hashes[norm_key] = hash_file_sha256(full_path)
                except OSError as exc:
                    logger.warning("Could not hash protected file %s: %s", full_path, exc)

    return hashes


def verify_test_integrity(
    baseline_hashes: Dict[str, str],
    current_dir: Path,
) -> Tuple[bool, Optional[str]]:
    """
    Verify that all protected files in current_dir exactly match baseline_hashes,
    and no new protected files were added.

    Returns:
        (is_valid, violation_detail)
    """
    current_hashes = hash_protected_files(current_dir)

    # Check for modified or deleted baseline files
    for path, expected_hash in baseline_hashes.items():
        if path not in current_hashes:
            return False, f"Protected test or config file was deleted: '{path}'"
        if current_hashes[path] != expected_hash:
            return False, f"Protected test or config file was modified: '{path}'"

    # Check for newly created protected files
    for path in current_hashes:
        if path not in baseline_hashes:
            return False, f"New protected test or config file was created: '{path}'"

    return True, None


def normalize_test_node_id(node: str) -> str:
    """Normalize test node ID to a canonical 'tests/...::test_name' form, stripping workspace path prefixes."""
    cleaned = node.replace("\\", "/").strip()
    while "//" in cleaned:
        cleaned = cleaned.replace("//", "/")
    lower = cleaned.lower()
    for marker in ("tests/", "test/"):
        idx = lower.find(marker)
        if idx != -1:
            return cleaned[idx:]
    return cleaned


def collect_baseline_test_inventory(workspace_dir: Path, timeout_seconds: int = 30) -> List[str]:
    """
    Run pytest --collect-only -q on the unpatched baseline workspace to discover all test node IDs.
    Returns list of node IDs.
    """
    if not workspace_dir.exists():
        return []

    cmd = [_PYTHON_EXE, "-m", "pytest", "--collect-only", "-q"]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(workspace_dir),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=False,
        )
    except Exception as exc:
        logger.warning("Baseline test collection failed: %s", exc)
        return []

    node_ids: List[str] = []
    output = proc.stdout + "\n" + proc.stderr
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        # Pytest -q collect-only outputs node IDs like:
        # tests/test_core.py::test_alpha
        # Skip collection summary lines
        if "collected" in line or "no tests ran" in line or line.startswith("="):
            continue
        if "::" in line:
            node_ids.append(normalize_test_node_id(line))

    return list(dict.fromkeys(node_ids))  # preserve order, deduplicate


def parse_pytest_detailed_outcomes(stdout: str, stderr: str) -> Dict[str, Set[str]]:
    """
    Parse test outcomes from pytest output when run with -rA (all summary).
    Returns dict with keys: 'passed', 'failed', 'skipped', 'xfailed', 'error'.
    """
    outcomes: Dict[str, Set[str]] = {
        "passed": set(),
        "failed": set(),
        "skipped": set(),
        "xfailed": set(),
        "error": set(),
    }

    combined = (stdout or "") + "\n" + (stderr or "")
    lines = combined.splitlines()

    for line in lines:
        stripped = line.strip()
        # Look for summary lines produced by -rA or normal pytest:
        # PASSED tests/test_core.py::test_alpha
        # FAILED tests/test_core.py::test_beta - AssertionError...
        # SKIPPED [1] tests/test_core.py::test_gamma: ...
        # XFAIL tests/test_core.py::test_delta
        # ERROR tests/test_core.py::test_epsilon
        def _clean_node(raw_node: str) -> str:
            cleaned = raw_node.split()[0].rstrip(":")
            return normalize_test_node_id(cleaned)

        m_pass = re.match(r"^PASSED\s+(\S+)", stripped)
        if m_pass:
            outcomes["passed"].add(_clean_node(m_pass.group(1)))
            continue

        m_fail = re.match(r"^FAILED\s+(\S+)", stripped)
        if m_fail:
            outcomes["failed"].add(_clean_node(m_fail.group(1)))
            continue

        m_skip = re.match(r"^SKIPPED\s+(?:\[\d+\]\s+)?(\S+)", stripped)
        if m_skip:
            outcomes["skipped"].add(_clean_node(m_skip.group(1)))
            continue

        m_xfail = re.match(r"^XFAIL\s+(\S+)", stripped)
        if m_xfail:
            outcomes["xfailed"].add(_clean_node(m_xfail.group(1)))
            continue

        m_err = re.match(r"^ERROR\s+(\S+)", stripped)
        if m_err:
            outcomes["error"].add(_clean_node(m_err.group(1)))
            continue

    return outcomes


def verify_baseline_inventory_passed(
    baseline_inventory: List[str],
    stdout: str,
    stderr: str,
) -> Tuple[bool, int, int, Optional[str]]:
    """
    Verify that every test in baseline_inventory is present, collected, and PASSED.
    Skipped or xfail tests never count as passing.

    Returns:
        (all_passed, passed_count, total_baseline_count, explanation_if_failed)
    """
    total = len(baseline_inventory)
    if total == 0:
        return False, 0, 0, "No baseline tests were discovered in the pristine repository."

    outcomes = parse_pytest_detailed_outcomes(stdout, stderr)
    passed_set = outcomes["passed"]
    norm_inventory = [normalize_test_node_id(n) for n in baseline_inventory]

    passed_count = sum(1 for node in norm_inventory if node in passed_set)
    missing = [node for node in norm_inventory if node not in passed_set]

    if not missing:
        return True, passed_count, total, None

    # Categorize why tests didn't pass
    skipped = [node for node in missing if node in outcomes["skipped"]]
    xfailed = [node for node in missing if node in outcomes["xfailed"]]
    failed = [node for node in missing if node in outcomes["failed"]]
    not_collected = [node for node in missing if node not in outcomes["skipped"] and node not in outcomes["xfailed"] and node not in outcomes["failed"]]

    reasons = []
    if skipped:
        reasons.append(f"{len(skipped)} skipped (skipped tests never count as passing)")
    if xfailed:
        reasons.append(f"{len(xfailed)} xfailed (xfail tests never count as passing)")
    if failed:
        reasons.append(f"{len(failed)} failed")
    if not_collected:
        reasons.append(f"{len(not_collected)} not collected / deselected")

    reason_str = ", ".join(reasons) if reasons else "not all tests passed"
    explanation = f"Baseline test inventory mismatch: {passed_count} of {total} baseline tests passed ({reason_str}). Skipped or xfail tests never count as passing."
    return False, passed_count, total, explanation


def detect_hardcoding_heuristic(
    diff_text: str,
    baseline_dir: Path,
) -> Optional[str]:
    """
    Hardcoding Heuristic (warning only, never blocks).

    After a patch passes, extract added string and numeric literals (length >= 6 chars for strings,
    or distinctive numbers >= 4 digits) from the diff's '+' lines in non-test files.
    If a literal occurs in test files but did not exist in that source file before the patch,
    returns a review recommendation warning string.
    """
    if not diff_text or not baseline_dir.exists():
        return None

    # Extract all test file text in baseline
    test_files_text = []
    for root, _, files in os.walk(baseline_dir):
        for fname in files:
            fpath = Path(root) / fname
            try:
                rel = fpath.relative_to(baseline_dir).as_posix()
            except ValueError:
                continue
            if is_protected_path(rel):
                try:
                    test_files_text.append(fpath.read_text(encoding="utf-8", errors="replace"))
                except OSError:
                    pass

    all_tests_combined = "\n".join(test_files_text)
    if not all_tests_combined:
        return None

    # Parse diff per file to identify target file and added lines
    lines = diff_text.splitlines()
    current_file = None
    added_lines_by_file: Dict[str, List[str]] = {}

    for line in lines:
        if line.startswith("+++ "):
            path = line[4:].strip()
            path = re.sub(r"^b/", "", path).split("\t")[0].strip().replace("\\", "/")
            current_file = path
            if current_file and current_file != "/dev/null":
                added_lines_by_file.setdefault(current_file, [])
        elif line.startswith("+") and not line.startswith("+++"):
            if current_file and not is_protected_path(current_file):
                added_lines_by_file.setdefault(current_file, []).append(line[1:])

    for target_rel_path, added_lines in added_lines_by_file.items():
        original_file_path = baseline_dir / target_rel_path
        original_source_text = ""
        if original_file_path.exists():
            try:
                original_source_text = original_file_path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                original_source_text = ""

        # Extract literals from added lines
        for added_line in added_lines:
            # 1. String literals (length >= 6)
            # Find all quoted substrings
            string_matches = re.findall(r'(["\'])(.*?)\1', added_line)
            for _, s_val in string_matches:
                s_val_clean = s_val.strip()
                if len(s_val_clean) >= 6:
                    # Check if literal appears in tests but was NOT in original source file
                    if s_val_clean in all_tests_combined and s_val_clean not in original_source_text:
                        return (
                            "Review recommended: the patch adds a value that also appears in the tests. "
                            "Passing tests do not prove the fix is general."
                        )

            # 2. Distinctive numeric literals (>= 4 digits)
            numeric_matches = re.findall(r'\b\d{4,}\b', added_line)
            for n_val in numeric_matches:
                if n_val in all_tests_combined and n_val not in original_source_text:
                    return (
                        "Review recommended: the patch adds a value that also appears in the tests. "
                        "Passing tests do not prove the fix is general."
                    )

    return None
