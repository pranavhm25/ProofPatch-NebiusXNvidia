# ProofPatch — Backend Schema and API Contract

**Version:** 1.0  
**Purpose:** Define API payloads, persistence entities, state transitions, error codes, and artifact contracts.

## 1. General Conventions

- API prefix: `/api`
- JSON encoding: UTF-8
- Identifiers: UUID strings
- Timestamps: ISO 8601 UTC
- Request validation: Pydantic
- Unknown fields: reject where practical at security-sensitive boundaries
- Errors: stable `code`, human-readable `message`, optional safe `details`, and `request_id`
- Do not return filesystem paths, provider credentials, internal exception traces, or raw secret-bearing source.

## 2. Enumerations

### JobStatus
```text
QUEUED
VALIDATING
ANALYZING
PLANNING
PATCHING
TESTING
RETRYING
COMPLETED
FAILED
BLOCKED
CANCELLED
```

### FinalVerdict
```text
VERIFIED
NOT_VERIFIED
FAILED
BLOCKED
```

### TestStatus
```text
PASSED
FAILED
TIMED_OUT
ERROR
NOT_RUN
NO_TESTS
```

### AttemptStatus
```text
PLANNED
PATCH_REJECTED
PATCH_APPLIED
TESTED
FAILED
TIMED_OUT
BLOCKED
```

### ErrorCode
```text
INVALID_ARCHIVE
UNSUPPORTED_PROJECT
UPLOAD_LIMIT_EXCEEDED
EXTRACTED_SIZE_LIMIT_EXCEEDED
ARCHIVE_PATH_REJECTED
PROJECT_NOT_FOUND
JOB_NOT_FOUND
INVALID_BUG_REPORT
PROVIDER_AUTH_ERROR
PROVIDER_RATE_LIMIT
PROVIDER_TIMEOUT
MODEL_OUTPUT_INVALID
PATCH_REJECTED
PATCH_APPLY_FAILED
SANDBOX_UNAVAILABLE
SANDBOX_TIMEOUT
TESTS_FAILED
NO_TESTS_DISCOVERED
EXPORT_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

## 3. API Contracts

### 3.1 Health check
`GET /health`

Response:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

Do not include secrets, endpoint credentials, or raw configuration.

### 3.2 Create project
`POST /api/projects`  
`Content-Type: multipart/form-data`

Form field:
- `file`: ZIP archive.

Response `201`:
```json
{
  "project_id": "3b4a2a14-0b57-4b57-9b6f-82bfc4c19d9d",
  "project_name": "sample-service",
  "language": "python",
  "file_count": 18,
  "total_uncompressed_bytes": 42891,
  "validation_status": "VALID",
  "created_at": "2026-10-21T12:00:00Z"
}
```

Failure example:
```json
{
  "error": {
    "code": "ARCHIVE_PATH_REJECTED",
    "message": "The archive contains an unsupported path and was not accepted.",
    "request_id": "req_abc123"
  }
}
```

### 3.3 Create job
`POST /api/jobs`

Request:
```json
{
  "project_id": "3b4a2a14-0b57-4b57-9b6f-82bfc4c19d9d",
  "bug_report": "The parser returns an empty list for a valid single-item input.",
  "expected_behavior": "Return a list containing the parsed item.",
  "observed_behavior": "Returns an empty list.",
  "idempotency_key": "optional-client-generated-key"
}
```

Response `202`:
```json
{
  "job_id": "6f3f98ab-945e-4f53-bd6a-95c5e7b48f32",
  "status": "QUEUED",
  "created_at": "2026-10-21T12:01:00Z",
  "status_url": "/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32"
}
```

Validation:
- `bug_report`: required, trimmed, 1–4,000 characters.
- Optional behavior fields: maximum 2,000 characters each.
- Project must exist and be associated with the current demo session.
- A repeated idempotency key returns the original job where feasible.

### 3.4 Get job status
`GET /api/jobs/{job_id}`

Response:
```json
{
  "job_id": "6f3f98ab-945e-4f53-bd6a-95c5e7b48f32",
  "status": "TESTING",
  "stage": "Running approved test suite",
  "progress_percent": 75,
  "created_at": "2026-10-21T12:01:00Z",
  "updated_at": "2026-10-21T12:01:12Z",
  "terminal": false,
  "events": [
    {
      "timestamp": "2026-10-21T12:01:03Z",
      "stage": "ANALYZING",
      "message": "Repository inspection completed."
    },
    {
      "timestamp": "2026-10-21T12:01:06Z",
      "stage": "PATCHING",
      "message": "A candidate patch was validated."
    }
  ]
}
```

Progress percentage is an approximate UI indicator, not a promise of time remaining. Do not expose raw internal logs through this endpoint.

### 3.5 Get result
`GET /api/jobs/{job_id}/result`

Response:
```json
{
  "job_id": "6f3f98ab-945e-4f53-bd6a-95c5e7b48f32",
  "status": "COMPLETED",
  "verdict": "VERIFIED",
  "summary": "The approved test command completed successfully and tests were discovered.",
  "limitations": [
    "Passing tests do not prove that all possible defects have been eliminated."
  ],
  "model": {
    "provider": "Nebius Token Factory",
    "model_id": "configured-model-id",
    "prompt_version": "repair-v1"
  },
  "attempts": [
    {
      "attempt_number": 1,
      "status": "TESTED",
      "patch_hash": "sha256:...",
      "changed_files": ["src/parser.py"],
      "test_result": {
        "status": "PASSED",
        "command_id": "pytest-default",
        "exit_code": 0,
        "duration_ms": 1420,
        "tests_discovered": 12,
        "tests_passed": 12,
        "tests_failed": 0,
        "stdout": "12 passed in 1.42s",
        "stderr": "",
        "output_truncated": false
      }
    }
  ],
  "diff": {
    "available": true,
    "unified_diff": "--- a/src/parser.py\n+++ b/src/parser.py\n...",
    "changed_files": ["src/parser.py"],
    "download_patch_url": "/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=patch",
    "download_zip_url": "/api/jobs/6f3f98ab-945e-4f53-bd6a-95c5e7b48f32/download?format=zip"
  },
  "completed_at": "2026-10-21T12:01:18Z"
}
```

The `VERIFIED` example is valid only if the test evidence meets the configured verification policy. Do not emit this verdict merely because the model says the code is fixed.

### 3.6 Download
`GET /api/jobs/{job_id}/download?format=patch|zip`

- `patch`: validated unified diff.
- `zip`: patched source archive and a report file.
- Return `404` if the artifact does not exist or is not associated with the job.
- Return `410` if the artifact has expired.
- Set a safe `Content-Disposition`.
- Validate every path before creating or serving the archive.

## 4. Error Envelope

```json
{
  "error": {
    "code": "PROVIDER_RATE_LIMIT",
    "message": "The model provider is temporarily rate-limiting requests. Please try again later.",
    "details": {
      "retryable": true
    },
    "request_id": "req_abc123"
  }
}
```

`details` must not include secrets, raw prompts containing private source, internal host paths, or raw stack traces.

HTTP mapping:
- `400`: invalid input/archive.
- `401`/`403`: authentication or access failure where appropriate.
- `404`: unknown project/job/artifact.
- `409`: invalid state or duplicate conflicting operation.
- `413`: upload too large.
- `415`: unsupported media type.
- `422`: schema/project validation failure.
- `429`: rate limit.
- `500`: unexpected internal error.
- `502`/`503`/`504`: upstream provider or sandbox failure, with safe messaging.

## 5. Persistence Schema

SQLite is sufficient for the MVP. The schema below is logical; column types should be adapted to the chosen ORM.

### 5.1 `projects`
| Column | Type | Constraints / purpose |
|---|---|---|
| `id` | TEXT | Primary key UUID |
| `session_id` | TEXT | Demo session/owner association |
| `display_name` | TEXT | Sanitized display name, not a path |
| `language` | TEXT | Initially `python` |
| `archive_sha256` | TEXT | Hash of uploaded archive |
| `file_count` | INTEGER | Validated inventory count |
| `uncompressed_bytes` | INTEGER | Expanded content size |
| `workspace_ref` | TEXT | Internal opaque reference, never returned |
| `created_at` | TEXT | UTC timestamp |
| `expires_at` | TEXT | Retention expiry |
| `status` | TEXT | `VALID`, `REJECTED`, `EXPIRED` |

### 5.2 `jobs`
| Column | Type | Constraints / purpose |
|---|---|---|
| `id` | TEXT | Primary key UUID |
| `project_id` | TEXT | Foreign key to projects |
| `session_id` | TEXT | Owner association |
| `bug_report` | TEXT | User-provided report; retention limited |
| `expected_behavior` | TEXT nullable | Optional context |
| `observed_behavior` | TEXT nullable | Optional context |
| `status` | TEXT | JobStatus enum |
| `stage` | TEXT | Safe progress stage |
| `final_verdict` | TEXT nullable | FinalVerdict enum |
| `model_id` | TEXT | Configured model identifier |
| `prompt_version` | TEXT | Prompt/schema version |
| `attempt_count` | INTEGER | 0–2 for MVP |
| `error_code` | TEXT nullable | Stable failure code |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |
| `completed_at` | TEXT nullable | UTC timestamp |
| `expires_at` | TEXT | Retention expiry |

### 5.3 `job_events`
| Column | Type | Purpose |
|---|---|---|
| `id` | INTEGER | Primary key |
| `job_id` | TEXT | Foreign key |
| `sequence_no` | INTEGER | Monotonic event order |
| `stage` | TEXT | Job stage |
| `message` | TEXT | Sanitized user-visible message |
| `created_at` | TEXT | UTC timestamp |

### 5.4 `attempts`
| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `job_id` | TEXT | Foreign key |
| `attempt_number` | INTEGER | 1 or 2 |
| `status` | TEXT | AttemptStatus |
| `plan_json` | TEXT | Validated plan; avoid storing unnecessary source |
| `patch_hash` | TEXT nullable | SHA-256 |
| `diff_ref` | TEXT nullable | Opaque artifact reference |
| `changed_files_json` | TEXT | List of safe relative paths |
| `started_at` | TEXT | UTC timestamp |
| `completed_at` | TEXT nullable | UTC timestamp |

Unique constraint: `(job_id, attempt_number)`.

### 5.5 `test_runs`
| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `attempt_id` | TEXT | Foreign key |
| `status` | TEXT | TestStatus |
| `command_id` | TEXT | Approved command identifier, not arbitrary shell text |
| `exit_code` | INTEGER nullable | Process exit code |
| `duration_ms` | INTEGER nullable | Measured duration |
| `tests_discovered` | INTEGER nullable | Parsed count |
| `tests_passed` | INTEGER nullable | Parsed count |
| `tests_failed` | INTEGER nullable | Parsed count |
| `stdout` | TEXT | Bounded output |
| `stderr` | TEXT | Bounded output |
| `output_truncated` | INTEGER | Boolean |
| `sandbox_execution_ref` | TEXT nullable | Provider reference |
| `created_at` | TEXT | UTC timestamp |

### 5.6 `artifacts`
| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `job_id` | TEXT | Foreign key |
| `kind` | TEXT | `PATCH`, `DIFF`, `REPORT`, `PATCHED_ZIP` |
| `storage_ref` | TEXT | Opaque internal reference |
| `sha256` | TEXT | Content hash |
| `size_bytes` | INTEGER | Size |
| `created_at` | TEXT | UTC timestamp |
| `expires_at` | TEXT | Retention expiry |

## 6. Model Output Schemas

### Repair plan
```json
{
  "summary": "string",
  "diagnosis_hypothesis": "string",
  "target_files": ["src/module.py"],
  "planned_changes": [
    {
      "file": "src/module.py",
      "change": "string",
      "reason": "string"
    }
  ],
  "risks": ["string"],
  "verification_strategy": ["string"]
}
```

### Patch proposal
```json
{
  "summary": "string",
  "patch_format": "unified_diff",
  "patch": "string",
  "files_expected_to_change": ["src/module.py"],
  "notes": ["string"]
}
```

The schema is not a security boundary by itself. Validate file paths, patch structure, file count, size, and protected targets separately.

## 7. Verdict Rules

- `VERIFIED`: approved test command completed with exit code 0 and meaningful tests were discovered/executed according to policy.
- `NOT_VERIFIED`: no tests, insufficient evidence, or no approved verification completed.
- `FAILED`: executed tests fail after the permitted retry, or the patch fails acceptance.
- `BLOCKED`: infrastructure, credentials, safety policy, or sandbox unavailability prevents valid evaluation.

If tests pass but no meaningful tests were discovered, do not use `VERIFIED`. A test command exit code alone may not establish useful coverage.

## 8. Retention and Cleanup

- Source archive and extracted workspace: delete at job expiry, with a default target of 60 minutes unless operational needs require less.
- Sandbox artifacts: clean up immediately after results are collected where supported.
- Logs: retain only bounded, sanitized output.
- Result artifacts: expire according to configured retention.
- Cleanup failures must be logged and retried; the UI must not expose expired artifacts.
- Never persist provider API keys in SQLite.
