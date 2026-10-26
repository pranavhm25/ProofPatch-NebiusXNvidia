"""SQLite database initialisation and connection helpers.

The schema matches BACKEND_SCHEMA.md section 5.
No ORM is used — SQLite3 directly keeps the dependency surface minimal.
"""
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Generator

from app.core.config import settings

_local = threading.local()


def get_connection() -> sqlite3.Connection:
    """Return a thread-local SQLite connection with row_factory set."""
    if not hasattr(_local, "conn"):
        conn = sqlite3.connect(
            str(settings.db_path),
            check_same_thread=False,
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return _local.conn


def init_db() -> None:
    """Create all tables if they do not exist."""
    conn = get_connection()
    conn.executescript(_SCHEMA)
    conn.commit()


_SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id                  TEXT PRIMARY KEY,
    session_id          TEXT NOT NULL DEFAULT '',
    display_name        TEXT NOT NULL,
    language            TEXT NOT NULL DEFAULT 'python',
    archive_sha256      TEXT NOT NULL DEFAULT '',
    file_count          INTEGER NOT NULL DEFAULT 0,
    uncompressed_bytes  INTEGER NOT NULL DEFAULT 0,
    workspace_ref       TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL,
    expires_at          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'VALID'
);

CREATE TABLE IF NOT EXISTS jobs (
    id               TEXT PRIMARY KEY,
    project_id       TEXT NOT NULL REFERENCES projects(id),
    session_id       TEXT NOT NULL DEFAULT '',
    bug_report       TEXT NOT NULL,
    expected_behavior TEXT,
    observed_behavior TEXT,
    status           TEXT NOT NULL DEFAULT 'QUEUED',
    stage            TEXT NOT NULL DEFAULT '',
    final_verdict    TEXT,
    model_id         TEXT NOT NULL DEFAULT '',
    prompt_version   TEXT NOT NULL DEFAULT 'repair-v1',
    attempt_count    INTEGER NOT NULL DEFAULT 0,
    error_code       TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    completed_at     TEXT,
    expires_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      TEXT NOT NULL REFERENCES jobs(id),
    sequence_no INTEGER NOT NULL,
    stage       TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
    id                TEXT PRIMARY KEY,
    job_id            TEXT NOT NULL REFERENCES jobs(id),
    attempt_number    INTEGER NOT NULL,
    status            TEXT NOT NULL DEFAULT 'PLANNED',
    plan_json         TEXT NOT NULL DEFAULT '{}',
    patch_hash        TEXT,
    diff_ref          TEXT,
    changed_files_json TEXT NOT NULL DEFAULT '[]',
    started_at        TEXT NOT NULL,
    completed_at      TEXT,
    UNIQUE(job_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS test_runs (
    id                    TEXT PRIMARY KEY,
    attempt_id            TEXT NOT NULL REFERENCES attempts(id),
    status                TEXT NOT NULL DEFAULT 'NOT_RUN',
    command_id            TEXT NOT NULL DEFAULT 'pytest-default',
    exit_code             INTEGER,
    duration_ms           INTEGER,
    tests_discovered      INTEGER,
    tests_passed          INTEGER,
    tests_failed          INTEGER,
    stdout                TEXT NOT NULL DEFAULT '',
    stderr                TEXT NOT NULL DEFAULT '',
    output_truncated      INTEGER NOT NULL DEFAULT 0,
    sandbox_execution_ref TEXT,
    created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
    id           TEXT PRIMARY KEY,
    job_id       TEXT NOT NULL REFERENCES jobs(id),
    kind         TEXT NOT NULL,
    storage_ref  TEXT NOT NULL,
    sha256       TEXT NOT NULL DEFAULT '',
    size_bytes   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL
);
"""
