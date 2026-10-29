"""Patch validator and atomic applier.

Security requirements:
- Validate all target paths against workspace root.
- Reject absolute paths, traversal, protected files.
- Reject oversized patches and excessive file changes.
- Apply only to a disposable working copy.
- Preserve the original baseline.
- Record a SHA-256 hash of the patch.
"""
from __future__ import annotations

import hashlib
import logging
import re
import shutil
from pathlib import Path, PurePosixPath
from typing import List, Tuple

from app.core.config import settings
from app.core.errors import ErrorCode, ProofPatchError
from app.schemas.api import PatchProposal

logger = logging.getLogger(__name__)

# Protected paths that a patch must never write to
_PROTECTED_PATTERNS = [
    r"(^|[/\\])\.env",
    r"(^|[/\\])\.git([/\\]|$)",
    r"credentials",
    r"secrets?\.",
    r"\.pem$",
    r"\.key$",
    r"id_rsa",
    r"id_ed25519",
    r"service.account",
    r"(^|[/\\])\.aws([/\\]|$)",
    r"(^|[/\\])\.ssh([/\\]|$)",
]
_PROTECTED_RE = re.compile("|".join(_PROTECTED_PATTERNS), re.IGNORECASE)


def _is_safe_patch_target(path: str) -> bool:
    """Return True iff the patch target is an acceptable relative path."""
    if not path:
        return False
    if path.startswith("/") or path.startswith("\\"):
        return False
    if ".." in PurePosixPath(path.replace("\\", "/")).parts:
        return False
    if "\x00" in path:
        return False
    if _PROTECTED_RE.search(path):
        return False
    return True


def hash_patch(patch_text: str) -> str:
    return "sha256:" + hashlib.sha256(patch_text.encode()).hexdigest()


def _extract_changed_files_from_diff(diff_text: str) -> List[str]:
    """Parse file paths from unified diff headers."""
    files = []
    for line in diff_text.splitlines():
        if line.startswith("+++ "):
            path = line[4:].strip()
            # Strip b/ prefix if present
            path = re.sub(r"^b/", "", path)
            path = path.replace("\\", "/").strip()
            if path and path != "/dev/null":
                files.append(path)
    return list(dict.fromkeys(files))  # deduplicate, preserve order


def validate_patch(proposal: PatchProposal, workspace_path: Path) -> List[str]:
    """
    Validate a patch proposal before application.

    Returns: list of relative file paths that will be changed.
    Raises: ProofPatchError if the patch is invalid or unsafe.
    """
    patch_text = proposal.patch
    if not patch_text or not patch_text.strip():
        raise ProofPatchError(
            code=ErrorCode.PATCH_REJECTED,
            message="The generated patch is empty.",
            http_status=422,
        )

    patch_bytes = len(patch_text.encode())
    if patch_bytes > settings.max_patch_bytes:
        raise ProofPatchError(
            code=ErrorCode.PATCH_REJECTED,
            message=f"The patch exceeds the size limit ({settings.max_patch_bytes // 1024} KB).",
            http_status=422,
        )

    changed_files = _extract_changed_files_from_diff(patch_text)

    if not changed_files:
        raise ProofPatchError(
            code=ErrorCode.PATCH_REJECTED,
            message="The patch does not appear to modify any files.",
            http_status=422,
        )

    if len(changed_files) > settings.max_changed_files:
        raise ProofPatchError(
            code=ErrorCode.PATCH_REJECTED,
            message=f"The patch modifies more than {settings.max_changed_files} files.",
            http_status=422,
        )

    for path in changed_files:
        if not _is_safe_patch_target(path):
            raise ProofPatchError(
                code=ErrorCode.PATCH_REJECTED,
                message=f"The patch targets an unsafe path: {path!r}",
                http_status=422,
            )
        # Ensure target is inside workspace
        abs_target = (workspace_path / path).resolve()
        try:
            abs_target.relative_to(workspace_path.resolve())
        except ValueError:
            raise ProofPatchError(
                code=ErrorCode.PATCH_REJECTED,
                message="A patch target would escape the working directory.",
                http_status=422,
            )

    return changed_files


def apply_patch_to_copy(
    baseline_path: Path,
    working_copy_path: Path,
    proposal: PatchProposal,
) -> Tuple[str, List[str], str]:
    """
    Copy the baseline workspace and apply the validated patch.

    Returns: (patch_hash, changed_files, unified_diff_text)
    Raises: ProofPatchError if anything fails.
    """
    # Validate first
    changed_files = validate_patch(proposal, baseline_path)

    # Create a clean working copy
    if working_copy_path.exists():
        shutil.rmtree(working_copy_path)
    shutil.copytree(baseline_path, working_copy_path, symlinks=False)

    patch_text = proposal.patch
    patch_hash = hash_patch(patch_text)

    # Apply patch using Python's patch-apply logic
    try:
        _apply_unified_diff(patch_text, working_copy_path)
    except ProofPatchError:
        # Clean up failed working copy
        shutil.rmtree(working_copy_path, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(working_copy_path, ignore_errors=True)
        logger.warning("Patch application error: %s", exc)
        raise ProofPatchError(
            code=ErrorCode.PATCH_APPLY_FAILED,
            message="The patch could not be applied cleanly.",
            http_status=422,
        )

    return patch_hash, changed_files, patch_text


def _apply_unified_diff(diff_text: str, working_dir: Path) -> None:
    """
    Apply a unified diff to files in working_dir.
    Implements a minimal but correct unified diff parser/applier.
    Raises ProofPatchError on failure.
    """
    lines = diff_text.splitlines(keepends=True)
    i = 0
    n = len(lines)

    while i < n:
        # Find file header
        if not lines[i].startswith("---"):
            i += 1
            continue

        # Parse --- and +++ headers
        old_header = lines[i].strip()
        i += 1
        if i >= n or not lines[i].startswith("+++"):
            raise ProofPatchError(
                code=ErrorCode.PATCH_APPLY_FAILED,
                message="Malformed patch: missing +++ header.",
                http_status=422,
            )
        new_header = lines[i].strip()
        i += 1

        # Extract target path from +++ line
        new_path = re.sub(r"^\+\+\+\s+", "", new_header).strip()
        new_path = re.sub(r"^b/", "", new_path).split("\t")[0].strip().replace("\\", "/")

        if not _is_safe_patch_target(new_path):
            raise ProofPatchError(
                code=ErrorCode.PATCH_REJECTED,
                message=f"Patch target path {new_path!r} is not safe.",
                http_status=422,
            )

        target_file = working_dir / new_path
        try:
            target_file.resolve().relative_to(working_dir.resolve())
        except ValueError:
            raise ProofPatchError(
                code=ErrorCode.PATCH_REJECTED,
                message="Patch would escape the working directory.",
                http_status=422,
            )

        # Read existing file content (if file exists)
        if target_file.exists():
            original_lines = target_file.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
        else:
            original_lines = []

        # Collect all hunks for this file
        hunks = []
        while i < n and lines[i].startswith("@@"):
            hunk_header = lines[i]
            i += 1

            # Parse @@ -old_start,old_count +new_start,new_count @@
            m = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", hunk_header)
            if not m:
                raise ProofPatchError(
                    code=ErrorCode.PATCH_APPLY_FAILED,
                    message="Malformed patch hunk header.",
                    http_status=422,
                )
            old_start = int(m.group(1))
            old_count = int(m.group(2)) if m.group(2) is not None else 1
            new_start = int(m.group(3))
            new_count = int(m.group(4)) if m.group(4) is not None else 1

            hunk_lines = []
            while i < n and not lines[i].startswith("@@") and not lines[i].startswith("---") and not lines[i].startswith("diff "):
                hunk_lines.append(lines[i])
                i += 1

            hunks.append((old_start, old_count, new_start, new_count, hunk_lines))

        # Apply hunks to file content
        result_lines = _apply_hunks(original_lines, hunks, new_path)

        # Write result
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text("".join(result_lines), encoding="utf-8")


def _apply_hunks(
    original: List[str],
    hunks: List[Tuple],
    filename: str,
) -> List[str]:
    """Apply a list of parsed hunks to original line list, return patched lines."""
    result: List[str] = []
    orig_idx = 0

    for old_start, old_count, new_start, new_count, hunk_lines in hunks:
        parsed_ops: List[Tuple[str, str]] = []
        for line in hunk_lines:
            if line.startswith(("+", "-", " ")):
                parsed_ops.append((line[0], line[1:]))
            elif line.startswith("\\"):
                # Handle '\ No newline at end of file'
                if parsed_ops:
                    last_op, last_text = parsed_ops[-1]
                    if last_text.endswith(("\r\n", "\n")):
                        parsed_ops[-1] = (last_op, last_text.rstrip("\r\n"))
            elif line in ("\n", "\r\n"):
                # Allow empty context lines that omit leading space
                parsed_ops.append((" ", line))

        expected_from_orig = [text for op, text in parsed_ops if op in (" ", "-")]
        nominal_pos = max(0, old_start - 1) if old_start > 0 else 0

        def check_match(pos: int) -> bool:
            if pos < orig_idx:
                return False
            if pos + len(expected_from_orig) > len(original):
                return False
            for j, exp in enumerate(expected_from_orig):
                actual = original[pos + j]
                if actual.rstrip("\r\n") != exp.rstrip("\r\n"):
                    return False
            return True

        match_pos = None
        if check_match(nominal_pos):
            match_pos = nominal_pos
        else:
            # Search nearby for matching context (handling context-only offsets)
            max_search = max(len(original), 100)
            for delta in range(1, max_search):
                cand1 = nominal_pos + delta
                if cand1 <= len(original) and check_match(cand1):
                    match_pos = cand1
                    break
                cand2 = nominal_pos - delta
                if cand2 >= orig_idx and check_match(cand2):
                    match_pos = cand2
                    break

        if match_pos is None:
            raise ProofPatchError(
                code=ErrorCode.PATCH_APPLY_FAILED,
                message=f"Context mismatch in {filename}: hunk at line {old_start} does not match original file content.",
                http_status=422,
            )

        # Copy unchanged lines preceding this hunk
        result.extend(original[orig_idx:match_pos])
        curr_orig = match_pos

        for op, text in parsed_ops:
            if op == " ":
                # Preserve original context line and its exact newline style
                result.append(original[curr_orig])
                curr_orig += 1
            elif op == "-":
                curr_orig += 1
            elif op == "+":
                result.append(text)

        orig_idx = curr_orig

    # Copy remaining unchanged lines after the last hunk
    result.extend(original[orig_idx:])
    return result
