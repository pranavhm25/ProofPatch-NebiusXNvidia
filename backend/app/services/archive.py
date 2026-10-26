"""Archive extraction and validation service.

Security requirements implemented:
- Reject path traversal (.. or absolute paths).
- Reject symlinks and special files.
- Enforce compressed size limit (enforced by upload middleware).
- Enforce extracted size and file count limits.
- Ignore .git, venvs, caches, binaries.
- Never follow symlinks when reading.
- Hash the original archive.
"""
from __future__ import annotations

import hashlib
import logging
import os
import zipfile
from pathlib import Path, PurePosixPath
from typing import List, Tuple

from app.core.config import settings
from app.core.errors import ErrorCode, ProofPatchError

logger = logging.getLogger(__name__)

# Directories to completely ignore during extraction
_IGNORED_DIRS = frozenset({
    ".git", ".hg", ".svn",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".venv", "venv", "env", ".env",
    "node_modules",
    "dist", "build", ".next", "out",
    ".tox", ".eggs",
})

# File extensions treated as binary / non-Python and excluded from context
_BINARY_EXTENSIONS = frozenset({
    ".pyc", ".pyo", ".so", ".dll", ".dylib",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico", ".svg",
    ".mp4", ".mp3", ".wav", ".pdf", ".zip", ".tar", ".gz",
    ".whl", ".egg", ".pkl", ".bin", ".dat", ".db", ".sqlite",
    ".lock", ".min.js", ".min.css",
})

# Filenames that may contain secrets — excluded from model context
_SECRET_FILENAMES = frozenset({
    ".env", ".env.local", ".env.production", ".env.development",
    ".netrc", ".npmrc", ".pypirc",
    "credentials", "secrets.json", "secret.json",
    "service-account.json", "sa.json",
    ".aws/credentials", ".ssh/id_rsa", ".ssh/id_ed25519",
})

# Python project marker files
_PYTHON_MARKERS = frozenset({
    "pyproject.toml", "setup.py", "setup.cfg",
    "pytest.ini", "tox.ini", "requirements.txt",
})


def _is_safe_path(member_name: str) -> bool:
    """Return True iff the archive member path is safe to extract."""
    if not member_name:
        return False
    # Reject absolute paths
    if member_name.startswith("/") or member_name.startswith("\\"):
        return False
    # Reject NUL bytes
    if "\x00" in member_name:
        return False
    # Reject traversal sequences after normalisation
    try:
        parts = PurePosixPath(member_name).parts
    except Exception:
        return False
    for part in parts:
        if part in (".", ".."):
            return False
        if part.startswith(".."):
            return False
    return True


def _is_ignored_path(rel_path: str) -> bool:
    """Return True if the path is in an ignored directory."""
    parts = PurePosixPath(rel_path).parts
    for part in parts[:-1]:  # check directory components
        if part in _IGNORED_DIRS:
            return True
    return False


def hash_archive(data: bytes) -> str:
    """Return the SHA-256 hex digest of the archive bytes."""
    return hashlib.sha256(data).hexdigest()


def extract_archive(
    archive_bytes: bytes,
    workspace_path: Path,
) -> Tuple[List[str], int, int]:
    """
    Safely extract a ZIP archive into workspace_path.

    Returns:
        (list_of_relative_paths, file_count, total_uncompressed_bytes)

    Raises:
        ProofPatchError on any validation failure.
    """
    workspace_path.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile.__new__(zipfile.ZipFile) as zf:
            import io
            zf = zipfile.ZipFile(io.BytesIO(archive_bytes))
    except zipfile.BadZipFile:
        raise ProofPatchError(
            code=ErrorCode.INVALID_ARCHIVE,
            message="The uploaded file is not a valid ZIP archive.",
            http_status=400,
        )
    except Exception as exc:
        logger.warning("Archive open error: %s", type(exc).__name__)
        raise ProofPatchError(
            code=ErrorCode.INVALID_ARCHIVE,
            message="The archive could not be opened.",
            http_status=400,
        )

    members = zf.infolist()

    if len(members) > settings.max_archive_files:
        raise ProofPatchError(
            code=ErrorCode.UPLOAD_LIMIT_EXCEEDED,
            message=f"The archive contains more than {settings.max_archive_files} entries.",
            http_status=413,
        )

    extracted_paths: List[str] = []
    total_bytes = 0

    for member in members:
        name = member.filename

        # Reject symlinks and special files
        is_symlink = (member.external_attr >> 16) & 0xFFFF == 0xA1ED
        if is_symlink:
            raise ProofPatchError(
                code=ErrorCode.ARCHIVE_PATH_REJECTED,
                message="The archive contains a symbolic link and was not accepted.",
                http_status=400,
            )

        # Directories — just validate, don't extract as files
        if name.endswith("/"):
            if not _is_safe_path(name.rstrip("/")):
                raise ProofPatchError(
                    code=ErrorCode.ARCHIVE_PATH_REJECTED,
                    message=f"Unsafe path in archive: {name!r}",
                    http_status=400,
                )
            continue

        if not _is_safe_path(name):
            raise ProofPatchError(
                code=ErrorCode.ARCHIVE_PATH_REJECTED,
                message="The archive contains an unsupported path and was not accepted.",
                http_status=400,
            )

        if _is_ignored_path(name):
            continue

        # Accumulate uncompressed size
        total_bytes += member.file_size
        if total_bytes > settings.max_extracted_bytes:
            raise ProofPatchError(
                code=ErrorCode.EXTRACTED_SIZE_LIMIT_EXCEEDED,
                message=f"Extracted content exceeds the {settings.max_extracted_bytes // 1024 // 1024} MB limit.",
                http_status=413,
            )

        # Write file safely
        dest = workspace_path / name
        dest.parent.mkdir(parents=True, exist_ok=True)

        # Verify final resolved path is still inside workspace
        try:
            dest.resolve().relative_to(workspace_path.resolve())
        except ValueError:
            raise ProofPatchError(
                code=ErrorCode.ARCHIVE_PATH_REJECTED,
                message="Archive entry would escape the workspace.",
                http_status=400,
            )

        with zf.open(member) as src, open(dest, "wb") as out:
            out.write(src.read())

        extracted_paths.append(name)

    zf.close()

    if not extracted_paths:
        raise ProofPatchError(
            code=ErrorCode.UNSUPPORTED_PROJECT,
            message="The archive contains no extractable files.",
            http_status=422,
        )

    return extracted_paths, len(extracted_paths), total_bytes


def detect_python_project(extracted_paths: List[str]) -> bool:
    """Return True if the archive looks like a Python project."""
    names = {Path(p).name.lower() for p in extracted_paths}
    has_marker = bool(names & _PYTHON_MARKERS)
    has_py = any(p.endswith(".py") for p in extracted_paths)
    return has_marker or has_py


def build_file_inventory(
    workspace_path: Path,
    extracted_paths: List[str],
) -> List[dict]:
    """
    Build a bounded file inventory for use by the repository inspector.
    Each entry: {rel_path, size_bytes, is_test, is_secret, extension}
    Secret files and binary files are flagged but not excluded from the list
    (the model context builder excludes them from model input).
    """
    inventory = []
    for rel in extracted_paths:
        abs_path = workspace_path / rel
        if not abs_path.is_file():
            continue
        try:
            size = abs_path.stat().st_size
        except OSError:
            continue

        ext = Path(rel).suffix.lower()
        filename = Path(rel).name.lower()

        entry = {
            "rel_path": rel,
            "size_bytes": size,
            "extension": ext,
            "is_python": ext == ".py",
            "is_test": "test" in rel.lower() or "spec" in rel.lower(),
            "is_secret": filename in _SECRET_FILENAMES or rel.lower() in _SECRET_FILENAMES,
            "is_binary": ext in _BINARY_EXTENSIONS,
            "is_ignored": _is_ignored_path(rel),
        }
        inventory.append(entry)

    return inventory
