"""Unit tests for archive extraction, validation, and security."""
import io
import zipfile
from pathlib import Path

import pytest

from app.core.errors import ErrorCode, ProofPatchError
from app.services.archive import (
    _is_safe_path,
    detect_python_project,
    extract_archive,
    hash_archive,
)


def _make_zip(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_is_safe_path():
    assert _is_safe_path("src/module.py") is True
    assert _is_safe_path("tests/test_foo.py") is True
    assert _is_safe_path("README.md") is True

    # Traversal attempts
    assert _is_safe_path("../etc/passwd") is False
    assert _is_safe_path("foo/../../etc/passwd") is False
    assert _is_safe_path("..") is False

    # Absolute paths
    assert _is_safe_path("/etc/passwd") is False
    assert _is_safe_path("\\Windows\\System32") is False

    # NUL bytes
    assert _is_safe_path("foo\x00bar.py") is False


def test_extract_valid_archive(tmp_path: Path):
    data = _make_zip({
        "src/calc.py": "def add(a, b): return a + b\n",
        "tests/test_calc.py": "def test_add(): assert True\n",
        "pyproject.toml": "[project]\nname = 'calc'\n",
    })

    dest = tmp_path / "extracted"
    paths, count, total_bytes = extract_archive(data, dest)

    assert count == 3
    assert "src/calc.py" in paths
    assert (dest / "src/calc.py").exists()
    assert detect_python_project(paths) is True


def test_extract_rejects_path_traversal(tmp_path: Path):
    data = _make_zip({
        "../evil.py": "import os; os.system('echo pwned')",
    })

    dest = tmp_path / "extracted"
    with pytest.raises(ProofPatchError) as exc_info:
        extract_archive(data, dest)

    assert exc_info.value.code == ErrorCode.ARCHIVE_PATH_REJECTED


def test_detect_python_project():
    assert detect_python_project(["src/main.py"]) is True
    assert detect_python_project(["pyproject.toml"]) is True
    assert detect_python_project(["requirements.txt"]) is True
    assert detect_python_project(["index.js", "style.css"]) is False


def test_hash_archive():
    data = b"test zip content"
    h = hash_archive(data)
    assert len(h) == 64  # sha256 hex string
