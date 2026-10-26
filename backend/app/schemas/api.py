"""Pydantic schemas for all API request/response payloads.
These mirror BACKEND_SCHEMA.md exactly.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# ── Enumerations ──────────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    VALIDATING = "VALIDATING"
    ANALYZING = "ANALYZING"
    PLANNING = "PLANNING"
    PATCHING = "PATCHING"
    TESTING = "TESTING"
    RETRYING = "RETRYING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


TERMINAL_STATUSES = {
    JobStatus.COMPLETED,
    JobStatus.FAILED,
    JobStatus.BLOCKED,
    JobStatus.CANCELLED,
}


class FinalVerdict(str, Enum):
    VERIFIED = "VERIFIED"
    NOT_VERIFIED = "NOT_VERIFIED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


class TestStatus(str, Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"
    ERROR = "ERROR"
    NOT_RUN = "NOT_RUN"
    NO_TESTS = "NO_TESTS"


class AttemptStatus(str, Enum):
    PLANNED = "PLANNED"
    PATCH_REJECTED = "PATCH_REJECTED"
    PATCH_APPLIED = "PATCH_APPLIED"
    TESTED = "TESTED"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"
    BLOCKED = "BLOCKED"


# ── Project ───────────────────────────────────────────────────────────────────

class CreateProjectResponse(BaseModel):
    project_id: str
    project_name: str
    language: str
    file_count: int
    total_uncompressed_bytes: int
    validation_status: str
    created_at: str


# ── Job ───────────────────────────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    project_id: str
    bug_report: str = Field(min_length=1, max_length=4000)
    expected_behavior: Optional[str] = Field(default=None, max_length=2000)
    observed_behavior: Optional[str] = Field(default=None, max_length=2000)
    idempotency_key: Optional[str] = Field(default=None, max_length=128)

    @field_validator("bug_report")
    @classmethod
    def bug_report_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Bug report must not be empty or whitespace only.")
        return v.strip()


class CreateJobResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: str
    status_url: str


class JobEvent(BaseModel):
    timestamp: str
    stage: str
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    stage: str
    progress_percent: int
    created_at: str
    updated_at: str
    terminal: bool
    events: List[JobEvent]


# ── Result ────────────────────────────────────────────────────────────────────

class TestResultSchema(BaseModel):
    status: TestStatus
    command_id: str
    exit_code: Optional[int]
    duration_ms: Optional[int]
    tests_discovered: Optional[int]
    tests_passed: Optional[int]
    tests_failed: Optional[int]
    stdout: str
    stderr: str
    output_truncated: bool


class AttemptSchema(BaseModel):
    attempt_number: int
    status: AttemptStatus
    patch_hash: Optional[str]
    changed_files: List[str]
    test_result: Optional[TestResultSchema]


class DiffInfoSchema(BaseModel):
    available: bool
    unified_diff: Optional[str]
    changed_files: List[str]
    download_patch_url: Optional[str]
    download_zip_url: Optional[str]


class ModelAttributionSchema(BaseModel):
    provider: str
    model_id: str
    prompt_version: str


class JobResultResponse(BaseModel):
    job_id: str
    status: JobStatus
    verdict: Optional[FinalVerdict]
    summary: str
    limitations: List[str]
    model: ModelAttributionSchema
    attempts: List[AttemptSchema]
    diff: DiffInfoSchema
    completed_at: Optional[str]


# ── Model output schemas (validated before use) ───────────────────────────────

class PlannedChange(BaseModel):
    file: str = Field(max_length=512)
    change: str
    reason: str


class RepairPlan(BaseModel):
    summary: str
    diagnosis_hypothesis: str
    target_files: List[str] = Field(max_length=20)
    planned_changes: List[PlannedChange]
    risks: List[str]
    verification_strategy: List[str]


class PatchProposal(BaseModel):
    summary: str
    patch_format: str = "unified_diff"
    patch: str
    files_expected_to_change: List[str]
    notes: List[str] = Field(default_factory=list)
