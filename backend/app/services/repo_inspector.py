"""Repository inspector — builds bounded context for the model.

Selects relevant source and test files within token/size budgets.
Never sends secret files or unnecessarily large files to the model.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import settings
from app.services.archive import _BINARY_EXTENSIONS, _SECRET_FILENAMES

logger = logging.getLogger(__name__)

# Maximum characters of a single file to include in model context
_MAX_SNIPPET_CHARS = 8_000

# Maximum total context characters for the model
_MAX_TOTAL_CONTEXT_CHARS = 80_000

# Maximum number of files to include in context
_MAX_CONTEXT_FILES = 30


def build_context(
    workspace_path: Path,
    inventory: List[dict],
    bug_report: str,
) -> Dict:
    """
    Build a bounded context manifest for the model.

    Returns a dict with:
      - repo_summary: dict with project stats
      - relevant_files: list of {rel_path, content, truncated}
      - omitted_files: list of rel_paths omitted
      - context_chars: total included chars
    """
    # Filter to includable files: Python source only, no secrets, no binaries
    includable = [
        f for f in inventory
        if f["is_python"]
        and not f["is_secret"]
        and not f["is_binary"]
        and f["size_bytes"] <= settings.max_file_bytes
    ]

    # Score files by relevance to bug report
    bug_lower = bug_report.lower()
    scored = []
    for f in includable:
        score = 0
        rel = f["rel_path"]
        name = Path(rel).stem.lower()
        # Boost test files
        if f["is_test"]:
            score += 10
        # Boost files mentioned in bug report
        if name in bug_lower:
            score += 20
        # Boost files with shorter paths (likely core modules)
        score -= rel.count("/")
        scored.append((score, f))

    scored.sort(key=lambda x: -x[0])

    relevant_files = []
    omitted_files = []
    total_chars = 0

    for _, f in scored:
        if len(relevant_files) >= _MAX_CONTEXT_FILES:
            omitted_files.append(f["rel_path"])
            continue

        abs_path = workspace_path / f["rel_path"]
        try:
            content = abs_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            omitted_files.append(f["rel_path"])
            continue

        truncated = False
        if len(content) > _MAX_SNIPPET_CHARS:
            content = content[:_MAX_SNIPPET_CHARS]
            truncated = True

        if total_chars + len(content) > _MAX_TOTAL_CONTEXT_CHARS:
            # Truncate to fit budget
            allowed = _MAX_TOTAL_CONTEXT_CHARS - total_chars
            if allowed < 200:
                omitted_files.append(f["rel_path"])
                continue
            content = content[:allowed]
            truncated = True

        total_chars += len(content)
        relevant_files.append({
            "rel_path": f["rel_path"],
            "content": content,
            "truncated": truncated,
        })

    python_files = sum(1 for f in inventory if f["is_python"])
    test_files = sum(1 for f in inventory if f["is_test"])

    repo_summary = {
        "total_files": len(inventory),
        "python_files": python_files,
        "test_files": test_files,
        "included_in_context": len(relevant_files),
        "omitted_from_context": len(omitted_files),
        "context_chars": total_chars,
        "omitted_files": omitted_files,
    }

    logger.info(
        "Context built: %d files included, %d omitted, %d chars total",
        len(relevant_files),
        len(omitted_files),
        total_chars,
    )

    return {
        "repo_summary": repo_summary,
        "relevant_files": relevant_files,
        "omitted_files": omitted_files,
        "context_chars": total_chars,
    }
