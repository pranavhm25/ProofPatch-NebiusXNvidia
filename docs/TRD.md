# ProofPatch — Technical Requirements Document (TRD)

**Version:** 1.0  
**Status:** Engineering baseline  
**Related documents:** PRD.md, ARCHITECTURE.md, BACKEND_SCHEMA.md, DESIGN.md, AGENTS.md

## 1. Technical Objectives

The system must provide a repeatable pipeline that accepts a Python repository and bug report, uses an NVIDIA open-source model through Nebius Token Factory, applies a bounded patch in the supported isolated environment, runs tests, and returns a verifiable report.

The architecture prioritizes:
- Explicit contracts between modules.
- Minimal runtime dependencies.
- A bounded and auditable repair loop.
- Security boundaries around untrusted source code.
- Honest reporting when provider or sandbox evidence is incomplete.
- Cost controls appropriate to a zero-out-of-pocket project.

## 2. Proposed Stack

| Layer | Technology | Reason |
|---|---|---|
| Web UI | React + TypeScript + Vite | Fast development and typed UI contracts |
| Styling | Tailwind CSS or CSS modules | Consistent responsive layout |
| API | Python + FastAPI | Existing ecosystem, typed schemas, async-friendly API |
| Validation | Pydantic | Request and model-output validation |
| Inference client | OpenAI-compatible Python SDK, if confirmed compatible | Simplifies Token Factory calls |
| Test runner | pytest | Initial Python-only scope |
| Persistence | SQLite for local/demo metadata; in-memory only for prototype if necessary | Avoid managed database cost |
| File storage | Temporary local workspace or supported ephemeral storage | No long-term source retention |
| Execution | Confirmed Nebius Token Factory sandbox or other explicitly permitted supported environment | Required infrastructure alignment |
| Tests | pytest for backend; Vitest/Playwright if time permits | Regression and UI confidence |
| Hosting | Free tier where operationally suitable | Zero-cost requirement |

Do not introduce a queue broker, Kubernetes, a vector database, a multi-agent framework, or a managed database unless a proven need emerges.

## 3. Runtime Configuration

Configuration is loaded on the server only.

Required variables:
- `NEBIUS_API_KEY`: secret API key.
- `NEBIUS_BASE_URL`: official base URL confirmed for the account.
- `NEBIUS_MODEL`: exact model identifier verified against the current catalog.
- `SANDBOX_PROVIDER`: identifier for the confirmed execution implementation.
- `MAX_UPLOAD_BYTES`: compressed upload limit.
- `MAX_EXTRACTED_BYTES`: expanded content limit.
- `MAX_ARCHIVE_FILES`: maximum accepted archive entries.
- `MAX_FILE_BYTES`: maximum per-file context size.
- `MAX_PATCH_BYTES`: maximum generated patch size.
- `MAX_CHANGED_FILES`: maximum number of changed files.
- `MAX_REPAIR_ATTEMPTS`: fixed to 2 total attempts for the MVP (initial attempt plus one retry).
- `JOB_TIMEOUT_SECONDS`: total job deadline.
- `SANDBOX_TIMEOUT_SECONDS`: per-test execution deadline.
- `MAX_LOG_BYTES`: maximum stored/displayed output.
- `RETENTION_MINUTES`: temporary source/result retention.
- `CORS_ORIGINS`: explicit allowed frontend origins.
- `APP_ENV`: `development`, `test`, or `production`.

`NEBIUS_API_KEY` must never be exposed to the browser, returned from an API, or written into logs. `.env` files are excluded from version control. A `.env.example` contains blank values only.

## 4. API Requirements

### 4.1 Create project
`POST /api/projects`  
Content type: `multipart/form-data`

Request:
- `file`: ZIP archive.

Success: `201 Created`
```json
{
  "project_id": "uuid",
  "project_name": "example-project",
  "language": "python",
  "file_count": 24,
  "validation_status": "VALID"
}
```

Errors:
- `400`: invalid archive or unsupported project.
- `413`: upload or extracted size limit exceeded.
- `415`: unsupported media type.
- `422`: no recognizable Python project content.

### 4.2 Create job
`POST /api/jobs`

Request:
```json
{
  "project_id": "uuid",
  "bug_report": "Function returns the wrong result for negative values.",
  "expected_behavior": "Return the absolute value.",
  "observed_behavior": "Negative input is returned unchanged."
}
```

Success: `202 Accepted`
```json
{
  "job_id": "uuid",
  "status": "QUEUED",
  "created_at": "2026-10-21T12:00:00Z"
}
```

The server validates project ownership/session association and prevents duplicate active submissions where appropriate.

### 4.3 Get job
`GET /api/jobs/{job_id}`

Returns current status, current stage, timestamps, safe progress messages, and whether a result is ready. It must not return secrets or internal absolute paths.

### 4.4 Get result
`GET /api/jobs/{job_id}/result`

Returns final status, attempts, changed files, diff metadata, test summaries, provider/model attribution, and report warnings. Large logs should be separately paginated or truncated.

### 4.5 Download result
`GET /api/jobs/{job_id}/download?format=patch|zip`

Only available when a safe export artifact exists. The server validates the artifact and sets a safe content disposition. Download URLs must not expose a predictable path or allow arbitrary file retrieval.

### 4.6 Health
`GET /health`

Returns application health only. A separate readiness check may verify configured dependencies without revealing secret values.

## 5. Job State Machine

Allowed states:
- `QUEUED`
- `VALIDATING`
- `ANALYZING`
- `PLANNING`
- `PATCHING`
- `TESTING`
- `RETRYING`
- `COMPLETED`
- `FAILED`
- `BLOCKED`
- `CANCELLED` (optional if cancellation is implemented)

Terminal states: `COMPLETED`, `FAILED`, `BLOCKED`, `CANCELLED`.

Rules:
- A job cannot skip directly from `QUEUED` to `COMPLETED`.
- A retry is permitted only from an eligible failed test/patch state.
- `RETRYING` can occur no more than once.
- Provider authentication failures and sandbox unavailability should transition to `BLOCKED` or a well-defined `FAILED` reason, not be treated as code defects.
- Every transition records a timestamp and a safe event message.
- A terminal state cannot be changed by a late worker update without an explicit recovery mechanism.

## 6. Model Integration

### 6.1 Requirements
- Use a verified NVIDIA open-source model accessible through Nebius Token Factory.
- Keep model ID configurable.
- Record model ID and prompt/schema version with each job.
- Use low-variance generation settings where supported.
- Request structured output, then validate it independently.
- Set token and request limits.
- Use retries only for transient transport errors, with capped exponential backoff and jitter.
- Do not automatically retry invalid or unsafe model output without recording the failure.
- Redact sensitive strings from logs where possible.

### 6.2 Suggested model calls
1. `plan_repair`: return diagnosis hypothesis, candidate files, intended change, risks, and verification strategy.
2. `generate_patch`: return patch content or a list of edits with paths and replacement content.
3. `revise_patch`: accept test failure summary and previous patch, return one revised patch.

Use one model initially. A second model is optional and must be justified by measured improvement and available credits.

### 6.3 Prompt safety
- System instructions are maintained by the application, not repository files.
- Repository content is explicitly delimited as untrusted data.
- The model cannot choose arbitrary commands, endpoints, secrets, or sandbox policy.
- The application selects allowed commands and validates every file path and patch.
- Model output never directly sets the final verdict.

## 7. Repository Processing

- Treat ZIP filenames and all archive entries as untrusted.
- Normalize and validate every path before writing.
- Reject absolute paths, parent traversal, NUL bytes, symlinks, and unsupported special entries.
- Enforce both compressed and extracted size limits.
- Ignore `.git`, `.venv`, `venv`, `node_modules`, `__pycache__`, build output, binary files, secret files, and files exceeding configured limits.
- Detect likely secrets and avoid sending them to inference.
- Keep the original baseline immutable.
- Create a separate working copy for each attempt.
- Hash the original archive and each patch for traceability.
- Never follow symlinks when inventorying or reading repository files.

## 8. Patch Validation

Before application:
- Parse the patch using a reliable parser.
- Normalize every target path.
- Confirm targets remain inside the working directory.
- Reject writes to `.env`, credentials, `.git`, CI secrets, deployment configuration, and protected application paths unless explicitly reviewed.
- Reject oversized patches, excessive file counts, binary changes, and malformed edits.
- Check that the patch applies cleanly against the intended baseline.
- Record changed files and patch hash.
- Apply atomically where supported; on error, discard the working copy and return a patch failure.

## 9. Sandbox Execution

The selected execution implementation must be verified against the hackathon requirements. The MVP must not quietly substitute unrestricted host execution for the required sandbox.

Required controls, to the extent supported by the selected platform:
- Non-root execution.
- No host filesystem mount containing secrets.
- No access to environment variables holding provider keys.
- No network egress by default.
- CPU, memory, process, disk, and execution-time limits.
- Output capture with byte limits.
- Approved command allowlist.
- Per-job workspace isolation.
- Cleanup after completion or timeout.
- No privileged mode or host Docker socket.
- No automatic dependency installation from arbitrary repositories.

If the platform sandbox does not support a needed control, document the limitation and reduce the accepted workload rather than claiming the control exists.

## 10. Test Execution and Verdict Logic

The initial approved test command is `pytest` invoked in the sandbox using an application-selected command template. Do not concatenate user text into a shell command.

Collect:
- Command identifier/template.
- Start/end timestamps and duration.
- Exit code.
- Standard output and standard error, truncated safely.
- Timeout flag.
- Test discovery count and summary where available.
- Sandbox/provider execution ID if supplied.

Verdicts:
- `VERIFIED`: approved test command completed successfully and meaningful tests were discovered/executed under the configured policy.
- `NOT_VERIFIED`: tests were not run, no tests were discovered, or evidence is insufficient.
- `FAILED`: tests ran and failed, or a repair did not meet acceptance criteria.
- `BLOCKED`: infrastructure, authentication, safety, or policy conditions prevented execution.

Passing tests do not prove all possible behavior is correct. The UI and report must say so.

## 11. Error Handling

Define typed errors such as:
- `INVALID_ARCHIVE`
- `UNSUPPORTED_PROJECT`
- `UPLOAD_LIMIT_EXCEEDED`
- `PROVIDER_AUTH_ERROR`
- `PROVIDER_RATE_LIMIT`
- `PROVIDER_TIMEOUT`
- `MODEL_OUTPUT_INVALID`
- `PATCH_REJECTED`
- `PATCH_APPLY_FAILED`
- `SANDBOX_UNAVAILABLE`
- `SANDBOX_TIMEOUT`
- `TESTS_FAILED`
- `NO_TESTS_DISCOVERED`
- `EXPORT_FAILED`
- `INTERNAL_ERROR`

User-facing messages should be actionable and must not reveal secrets, raw stack traces, host paths, or internal infrastructure details. Detailed diagnostics can be retained in restricted server logs.

## 12. Testing Strategy

### Unit tests
- Archive path normalization and traversal rejection.
- Size/file-count limits.
- Secret-file exclusion.
- Model schema validation.
- Patch path validation and atomic application.
- State transition rules.
- Retry cap.
- Verdict calculation.
- Output truncation.
- Export archive safety.

### Integration tests
- Mocked provider responses for valid, malformed, timeout, and rate-limit scenarios.
- Sandbox adapter tests using a safe fixture.
- Full repair pipeline on a deliberately buggy Python project.
- Failed first attempt followed by a successful retry.
- No-fix scenario that must not be marked verified.
- Empty test suite and test discovery failure.

### End-to-end tests
- Upload → bug report → job progress → result → diff → download.
- Browser refresh during an active job.
- Provider outage and sandbox outage.
- Mobile-width result view.

## 13. Observability

Use structured logs with:
- Timestamp, request ID, project ID, job ID, stage, duration, error code, model ID, attempt number, and token usage when available.
- No API keys, complete source files, or unnecessary personal data.
- Log redaction and output truncation.
- Per-job model-call and token totals for cost tracking.
- Metrics for job completion, verified rate, provider errors, sandbox errors, retry recovery, and median duration.

## 14. Deployment and Operations

- Build and test locally first.
- Use a free hosting tier only after confirming its runtime, memory, timeout, storage, and public-access limits.
- Keep temporary source in ephemeral storage; do not rely on local disk persistence if the host can restart.
- Store secrets in the host's secret manager/environment configuration.
- Use HTTPS and restrictive CORS.
- Run database migrations or initialize the minimal schema on startup safely.
- Provide a health endpoint.
- Keep a local demo path as contingency.
- Test the public demo from a clean browser session and a separate network/profile.

## 15. Technical Exit Criteria

- The selected NVIDIA model responds through Token Factory.
- The required execution sandbox is usable.
- A complete sample repair runs end to end.
- Security-focused tests pass.
- No API key is present in frontend assets or repository history.
- All verdicts are based on recorded test evidence.
- Deployment instructions work from a clean environment.
