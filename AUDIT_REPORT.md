# ProofPatch Repository Audit Report

**Date:** 2026-10-29  
**Branch:** `audit/status-check`  
**Target:** NVIDIA × Nebius Global AI Hackathon (Coding & Agentic Engineering track)  
**Auditor:** Automated Codebase & Execution Audit Agent  

---

## 1. Executive Summary

ProofPatch is approximately **60% complete**: the database, API routing, Pydantic schemas, and React 19 UI are built, and the frontend compiles cleanly (`dist/` created in 5.15s). However, the backend repair loop cannot execute end-to-end without failing due to three critical implementation defects. The top 3 risks are:
1. **Broken Core Pipeline Code:** A fatal `NameError: name 'Path' is not defined` crashes `GET /api/jobs/{id}/result` at [`jobs.py:226`](file:///backend/app/api/routes/jobs.py#L226), and a defective diff applier in [`patch_applier.py:276-296`](file:///backend/app/services/patch_applier.py#L276-L296) strips context lines, corrupting patched Python files with syntax and indentation errors.
2. **Zero Sandbox Isolation & Remote Code Execution:** Untrusted code runs directly on the host with no container, no chroot, no process limits, and unrestricted network access; any uploaded pytest file can execute arbitrary code with backend privileges.
3. **OS Incompatibility & Unverified LLM Integration:** Unconditioned Unix `resource` imports and `preexec_fn` crash on Windows with `ModuleNotFoundError` and `ValueError`, while live Nebius Token Factory inference remains completely unverified due to the absence of `NEBIUS_API_KEY`.

---

## 2. Implementation Status Table

| Feature / Component | Status | Evidence / Citations |
|---|---|---|
| **Archive Validator: Traversal & Absolute Paths** | **DONE** | [`archive.py:61-82`](file:///backend/app/services/archive.py#L61-L82), [`archive.py:189-196`](file:///backend/app/services/archive.py#L189-L196). Rejects `..`, `/`, `\\`, and NUL bytes. Verified by [`test_archive.py:test_is_safe_path`](file:///backend/tests/unit/test_archive.py#L25-L41). |
| **Archive Validator: 20 MB Upload Limit** | **DONE** | [`projects.py:37-43`](file:///backend/app/api/routes/projects.py#L37-L43), [`config.py:45`](file:///backend/app/core/config.py#L45). Enforced at route level, returns HTTP 413 `UPLOAD_LIMIT_EXCEEDED`. |
| **Archive Validator: Decompression Bomb Limits** | **DONE** | [`archive.py:133-138`](file:///backend/app/services/archive.py#L133-L138) (max 500 files), [`archive.py:176-182`](file:///backend/app/services/archive.py#L176-L182) (max 100 MB uncompressed). |
| **Archive Validator: Symlink Detection** | **PARTIAL** | [`archive.py:147-153`](file:///backend/app/services/archive.py#L147-L153). Only checks `(attr >> 16) & 0xFFFF == 0xA1ED` (specifically mode `0o120755`), failing to catch symlinks with permissions like `0777` or `0644`. |
| **Archive Validator: Secret & Cache Exclusion** | **DONE** | [`archive.py:27-53`](file:///backend/app/services/archive.py#L27-L53), [`repo_inspector.py:41-49`](file:///backend/app/services/repo_inspector.py#L41-L49). Filters out `.git`, `__pycache__`, virtualenvs, binary extensions, and secret filenames (`.env`, `credentials`, etc.). |
| **Job Orchestrator: State Machine Lifecycle** | **PARTIAL** | [`orchestrator.py:103-369`](file:///backend/app/services/orchestrator.py#L103-L369). Progresses through states `QUEUED` -> `VALIDATING` -> `ANALYZING` -> `PLANNING` -> `PATCHING` -> `TESTING` -> `RETRYING` -> `COMPLETED`/`FAILED`/`BLOCKED`. Downstream calls fail due to sandbox and result endpoint crashes. |
| **Nebius Token Factory Adapter** | **PARTIAL** / **UNVERIFIED** | [`nebius_client.py:44-205`](file:///backend/app/services/nebius_client.py#L44-L205), [`model_registry.py:22-148`](file:///backend/app/services/model_registry.py#L22-L148). OpenAI-compatible POST via `httpx`, role model IDs, safe fallback, and exponential backoff implemented. Unit tests with mocked HTTP pass (8 tests in [`test_nebius_client.py`](file:///backend/tests/unit/test_nebius_client.py)). **UNVERIFIED** against live API because `NEBIUS_API_KEY` is not configured. |
| **Pydantic v2 Schemas & Diff Validation** | **DONE** | [`schemas/api.py:166-186`](file:///backend/app/schemas/api.py#L166-L186). `RepairPlan` and `PatchProposal` validated with strict typing. Size and target path validation in [`patch_applier.py:75-132`](file:///backend/app/services/patch_applier.py#L75-L132). |
| **Atomic Patch Applier (Copy & Baseline)** | **PARTIAL** / **BROKEN** | [`patch_applier.py:135-174`](file:///backend/app/services/patch_applier.py#L135-L174). Baseline immutability verified, but diff parsing in [`patch_applier.py:276-296`](file:///backend/app/services/patch_applier.py#L276-L296) drops all context lines, deleting surrounding code and causing `IndentationError`. Also regex `^\.env` allows `subdir/.env`. |
| **Sandbox: Environment Scrubbing** | **DONE** | [`sandbox.py:38-58`](file:///backend/app/services/sandbox.py#L38-L58). Removes prefixes `NEBIUS`, `OPENAI`, `ANTHROPIC`, `AWS`, `GOOGLE_`, `SECRET`, `TOKEN`, `KEY`, plus exact matches `API_KEY`, `PASSWORD`, etc. |
| **Sandbox: Resource Limits & Timeouts** | **PARTIAL** | [`sandbox.py:61-74`](file:///backend/app/services/sandbox.py#L61-L74), [`sandbox.py:128`](file:///backend/app/services/sandbox.py#L128). Wall-clock timeout (60s) works. Memory and CPU limits are Linux-only via `resource.setrlimit`. `RLIMIT_NPROC` (process/fork limits) is omitted entirely. |
| **Sandbox: Network & Process Isolation** | **MISSING** | [`sandbox.py:12-18`](file:///backend/app/services/sandbox.py#L12-L18). No Docker, no network namespace, no cgroups. Untrusted code can access localhost/LAN/WAN and spawn arbitrary host processes. |
| **Bounded Retry (1 Attempt Max)** | **DONE** | [`orchestrator.py:234-313`](file:///backend/app/services/orchestrator.py#L234-L313). Exactly one retry triggered on initial failure; failure stdout/stderr fed to `nebius_client.revise_patch` under role `ADVANCED`. Verified during pipeline test run. |
| **Verdict Engine: Evidence-Based** | **DONE** | [`verdict.py:20-130`](file:///backend/app/services/verdict.py#L20-L130). `VERIFIED` requires `exit_code == 0` AND `tests_discovered > 0` AND `tests_passed > 0` AND `tests_failed == 0`. Correctly handles `NOT_VERIFIED`, `FAILED`, and `BLOCKED`. Verified by 5 unit tests in [`test_verdict.py`](file:///backend/tests/unit/test_verdict.py). |
| **SQLite Persistence (WAL mode)** | **DONE** | [`database.py:18-38`](file:///backend/app/db/database.py#L18-L38). Thread-local connection, `PRAGMA journal_mode=WAL`, foreign keys enabled. Schema covers `projects`, `jobs`, `job_events`, `attempts`, `test_runs`, `artifacts`. |
| **60-Minute Retention & Cleanup** | **STUB** / **MISSING** | [`main.py:28`](file:///backend/app/main.py#L28) has `# Cleanup tasks could go here`. Expiry timestamps are recorded in the DB, but no background worker or cleanup task exists. Workspaces and artifacts remain permanently on disk. |
| **Export: .patch and patched .zip** | **DONE** | [`orchestrator.py:371-408`](file:///backend/app/services/orchestrator.py#L371-L408), [`downloads.py:15-54`](file:///backend/app/api/routes/downloads.py#L15-L54). Artifacts saved to `artifacts/<job_id>/` and served via `GET /api/jobs/{id}/download?format=patch|zip`. |
| **REST API Endpoints** | **PARTIAL** | All 6 endpoints defined in [`projects.py`](file:///backend/app/api/routes/projects.py), [`jobs.py`](file:///backend/app/api/routes/jobs.py), [`downloads.py`](file:///backend/app/api/routes/downloads.py), [`health.py`](file:///backend/app/api/routes/health.py). However, `GET /api/jobs/{id}/result` crashes at [`jobs.py:226`](file:///backend/app/api/routes/jobs.py#L226) with `NameError: name 'Path' is not defined` whenever a patch artifact exists. |
| **Frontend: Build & Assembly** | **DONE** | [`frontend/package.json`](file:///frontend/package.json). `npm run build` succeeds (Vite v6.4.5, TypeScript 5.6.2). Produced bundle: 292.23 kB JS, 0.20 kB CSS. |
| **Frontend: Views & Interactive Flow** | **DONE** | [`NewRepairPage.tsx`](file:///frontend/src/pages/NewRepairPage.tsx), [`ProgressPage.tsx`](file:///frontend/src/pages/ProgressPage.tsx), [`ResultPage.tsx`](file:///frontend/src/pages/ResultPage.tsx). Includes dropzone upload, bug description form, live stage timeline poller, diff viewer, test evidence log viewer, and artifact downloads. |
| **Frontend: Real Backend Integration** | **DONE** | [`client.ts:21-52`](file:///frontend/src/api/client.ts#L21-L52). Calls real endpoints (`POST /api/projects`, `POST /api/jobs`, `GET /api/jobs/{id}`, `GET /api/jobs/{id}/result`, `GET /api/jobs/{id}/download`). No mock data used in frontend. |
| **Frontend Unit / E2E Tests** | **MISSING** | [`frontend/package.json:6-11`](file:///frontend/package.json#L6-L11). No test framework (Vitest, Jest, Playwright) or test files exist in `frontend/`. |
| **Pre-Packaged Bug Fixture Zip** | **MISSING** | `backend/tests/fixtures/sample_buggy_repo.zip` is claimed in README line 137, but is absent. Only unzipped directory `backend/tests/fixtures/sample_repo/` exists (`.gitignore:52-53` ignored `*.zip` outside `!tests/fixtures`). |
| **Containerization & CI** | **MISSING** | No `Dockerfile`, `docker-compose.yml`, or `.github/` workflow files exist in the repository. |

---

## 3. Test Results

### 3.1 Backend Unit Tests
Command executed:
```powershell
$env:PYTHONPATH="backend"; backend/.venv/Scripts/python -m pytest backend/tests/unit -v
```
**Outcome:** **FAILED (Exit code 1)**
- **Passed:** 27 tests (across `test_archive.py`, `test_model_registry.py`, `test_nebius_client.py`, `test_patch_applier.py`, `test_verdict.py`)
- **Errors / Failures:** 1 collection error in `backend/tests/unit/test_api.py` (which contains 4 tests):
  ```text
  ERROR collecting backend/tests/unit/test_api.py
  backend\app\services\sandbox.py:24: in <module>
      import resource
  E   ModuleNotFoundError: No module named 'resource'
  ```
- **Reasonable Fix Attempt:** Created `audit_tmp/resource.py` with mock `RLIMIT_*` stubs and ran with `$env:PYTHONPATH="audit_tmp;backend"`.
  - **Result with Fix:** **31 PASSED, 0 FAILED** in 1.07s.

### 3.2 Live Integration Tests
File: [`backend/tests/integration/test_live_nebius.py`](file:///backend/tests/integration/test_live_nebius.py)  
**Status:** **SKIPPED / UNVERIFIED**  
- Reason: `NEBIUS_API_KEY` was not configured in `.env` (per global rules, no live key was injected). Pytest mark `pytest.mark.skipif(not settings.nebius_api_key)` skips execution.

### 3.3 Frontend Build
Command executed:
```powershell
cd frontend && npm run build
```
**Outcome:** **PASSED (Exit code 0)**
- Output: `tsc -b && vite build` completed in 5.15s.
- Bundle output:
  - `dist/index.html` (0.51 kB)
  - `dist/assets/index-GiFeXZJj.css` (0.20 kB)
  - `dist/assets/index-BoANVPv1.js` (292.23 kB)

### 3.4 Live Server & Endpoint Verification
Started FastAPI backend on `127.0.0.1:8008` via Uvicorn:
- `GET /health` -> HTTP 200 `{'status': 'ok', 'version': '1.0.0', 'environment': 'development', 'has_nebius_config': False}`
- `POST /api/projects` (with text file) -> HTTP 415 `INVALID_ARCHIVE`
- `POST /api/projects` (with valid zip) -> HTTP 201 `{'validation_status': 'VALID', 'file_count': 3}`
- `POST /api/jobs` -> HTTP 202 `{'status': 'QUEUED', 'job_id': '3e8cb003-...'}`
- `GET /api/jobs/{job_id}` -> HTTP 200 `{'status': 'VALIDATING', 'stage': 'Validating repository structure'}`
- `GET /api/jobs/{job_id}/result` (when blocked on missing API key) -> HTTP 200 `{'status': 'BLOCKED', 'verdict': 'BLOCKED'}`

### 3.5 End-to-End Pipeline Execution on Buggy Repo Fixture
Ran `backend/tests/fixtures/sample_repo` through `orchestrator.run_repair_job` with mocked LLM output:
1. **Unmodified Code on Windows:**
   - Failed immediately with `JobStatus.BLOCKED` / `SANDBOX_UNAVAILABLE`.
   - Cause: [`sandbox.py:130`](file:///backend/app/services/sandbox.py#L130) passes `preexec_fn=_set_resource_limits` to `subprocess.run`, which raises `ValueError: preexec_fn is not supported on Windows platforms`.
2. **With Windows Subprocess Bypass & Standard Diff (Context Lines):**
   - Candidate patch was applied, but [`patch_applier.py:294`](file:///backend/app/services/patch_applier.py#L294) replaced the entire hunk lines with only `+` lines, deleting `def absolute_value(n: int) -> int:` and comments.
   - Result: `tests/test_calculator.py` threw `IndentationError: unexpected indent`.
   - Pytest returned exit code 2 (`TestStatus.ERROR`).
   - Bounded retry triggered Attempt 2 with `ADVANCED` model role. Attempt 2 failed identically.
   - When calling `get_job_result(job_id)`, execution crashed with:
     `NameError: name 'Path' is not defined` at [`backend/app/api/routes/jobs.py:226`](file:///backend/app/api/routes/jobs.py#L226).
3. **With Zero-Context Diff and `Path` Injected:**
   - Pytest passed (3 passed in 0.02s).
   - Verdict engine computed `FinalVerdict.VERIFIED`.
   - Proves the downstream pipeline and verdict engine work when the two bugs are bypassed.

---

## 4. Documentation & README Claims vs. Reality

| Claim in README / Docs | Reality | Discrepancy Severity | Evidence / Notes |
|---|---|---|---|
| **Fixture Zip Available:** `backend/tests/fixtures/sample_buggy_repo.zip` ready for demo (README line 137). | **FALSE** | **MEDIUM** | File does not exist. Only `sample_repo/` folder exists. `.gitignore:52-53` had `*.zip` and `!tests/fixtures/**/*.zip`, missing `backend/`. |
| **Atomic Patch Application:** Applies minimal unified diff cleanly (README lines 57, 147; TRD §8). | **BROKEN** | **HIGH** | [`patch_applier.py:276-296`](file:///backend/app/services/patch_applier.py#L276-L296) strips context lines in any multi-line hunk, destroying file syntax. |
| **Ephemeral Storage & 60-Minute Cleanup:** Workspaces & artifacts automatically deleted after 60 mins (README line 146; TRD §3). | **FALSE / STUB** | **HIGH** | No background scheduler or cleanup task exists. [`main.py:28`](file:///backend/app/main.py#L28) contains only a placeholder comment. Files accumulate permanently. |
| **Cross-Platform Compatibility:** Run commands specified without OS qualifiers (README lines 96-100, 123). | **FALSE** | **HIGH** | Top-level `import resource` ([`sandbox.py:24`](file:///backend/app/services/sandbox.py#L24)) and `preexec_fn` ([`sandbox.py:130`](file:///backend/app/services/sandbox.py#L130)) crash immediately on Windows. Hardcoded `python3` breaks on virtualenvs and Windows. |
| **Result Retrieval API:** Clean JSON result contract for completed jobs (BACKEND_SCHEMA §3.5). | **BROKEN** | **HIGH** | `GET /api/jobs/{id}/result` crashes with `NameError: name 'Path' is not defined` at [`jobs.py:226`](file:///backend/app/api/routes/jobs.py#L226) whenever a patch artifact exists. |
| **Isolated Execution Sandbox:** Scrubbed environment with resource limits (README lines 58, 145). | **PARTIAL** | **HIGH** | No container or network boundary. Code executes directly on the host with the permissions of the FastAPI server process. |

---

## 5. Security Findings (Ranked by Severity)

### [CRITICAL] 1. Uncontained Host Remote Code Execution (RCE) via Subprocess Test Runner
- **Location:** [`backend/app/services/sandbox.py:124-132`](file:///backend/app/services/sandbox.py#L124-L132)
- **Vector:** Uploaded repositories execute `pytest` directly via `subprocess.run` on the host machine. There is no containerization (Docker/Podman), no namespace isolation (unshare/bubblewrap), and no chroot.
- **Impact:** Any uploaded Python file (or `conftest.py`) can run arbitrary code: read/write host files, access the backend database `proofpatch.db`, or spawn long-running host processes.

### [CRITICAL] 2. Unrestricted Outbound Network Access in Execution Environment
- **Location:** [`backend/app/services/sandbox.py:12-19`](file:///backend/app/services/sandbox.py#L12-L19)
- **Vector:** The test subprocess shares the host network namespace.
- **Impact:** Malicious test suites can initiate external network connections, exfiltrate host data or server environment information, open reverse shells, or participate in DDoS attacks.

### [HIGH] 3. Incomplete Symlink Filter in Archive Extraction
- **Location:** [`backend/app/services/archive.py:147-153`](file:///backend/app/services/archive.py#L147-L153)
- **Vector:** Archive entry checks `(member.external_attr >> 16) & 0xFFFF == 0xA1ED`. In Unix zip archives, symlinks are identified by file mode `0o120000` (`(attr >> 16) & 0xF000 == 0xA000`).
- **Impact:** A symlink created with permissions other than `0755` (such as `0777` or `0644`) bypasses this check completely.

### [MEDIUM] 4. Patch Target Protection Regex Vulnerability
- **Location:** [`backend/app/services/patch_applier.py:27-41`](file:///backend/app/services/patch_applier.py#L27-L41)
- **Vector:** Protected file patterns use `r"^\.env"` which only matches `.env` at the root of the workspace.
- **Impact:** Calling `_is_safe_patch_target("config/.env")` returns `True`. A patch can overwrite `.env` files located in subdirectories.

### [MEDIUM] 5. Incomplete Environment Variable Scrubbing Allowlist vs Blocklist
- **Location:** [`backend/app/services/sandbox.py:38-58`](file:///backend/app/services/sandbox.py#L38-L58)
- **Vector:** Environment scrubbing relies on prefix matching (`NEBIUS`, `OPENAI`, etc.).
- **Impact:** Sensitive environment variables that don't match the list (e.g., `DATABASE_URL`, `POSTGRES_PASSWORD`, `SSH_AUTH_SOCK`, `GITHUB_TOKEN`, `HF_TOKEN`, `SLACK_WEBHOOK`) are leaked into the test process environment.

### [MEDIUM] 6. Missing Workspace and Artifact Disk Cleanup
- **Location:** [`backend/app/main.py:28`](file:///backend/app/main.py#L28)
- **Vector:** `expires_at` is stored in the database, but no background worker, cron, or lifespan cleanup deletes old files.
- **Impact:** Disk space exhaustion over time; private user-submitted code remains permanently stored on the host filesystem.

---

## 6. Prioritized TODO List for Hackathon Demo Readiness

| Priority | Task Description | Impact | Effort | Affected Files |
|---|---|---|---|---|
| **P0** | **Fix `NameError: Path` in `jobs.py`**<br>Add `from pathlib import Path` to `app/api/routes/jobs.py`. Without this, result retrieval crashes on every completed repair. | Blocker | **S** (5 min) | [`backend/app/api/routes/jobs.py`](file:///backend/app/api/routes/jobs.py) |
| **P0** | **Fix Unified Diff Context Stripping in `patch_applier.py`**<br>Rewrite `_apply_hunks` to preserve context lines (` `) during line replacement. Standard LLM diffs currently destroy file syntax. | Blocker | **M** (1-2 hrs) | [`backend/app/services/patch_applier.py`](file:///backend/app/services/patch_applier.py) |
| **P0** | **Fix Cross-Platform OS Crash in `sandbox.py`**<br>Make `import resource` conditional (`if sys.platform != "win32"`), omit `preexec_fn` on Windows, and use `sys.executable` instead of hardcoded `python3`. | Blocker | **S** (15 min) | [`backend/app/services/sandbox.py`](file:///backend/app/services/sandbox.py) |
| **P0** | **Package & Check in `sample_buggy_repo.zip`**<br>Create the zip fixture from `backend/tests/fixtures/sample_repo/` and fix `.gitignore` (`!backend/tests/fixtures/**/*.zip`). | High | **S** (5 min) | `.gitignore`, `backend/tests/fixtures/` |
| **P1** | **Implement Ephemeral Workspace Cleanup**<br>Add an async background task or startup/periodic loop to delete directories in `workspaces/` and `artifacts/` where `expires_at < utc_now()`. | High | **M** (1-2 hrs) | [`backend/app/main.py`](file:///backend/app/main.py), [`backend/app/db/database.py`](file:///backend/app/db/database.py) |
| **P1** | **Harden Symlink and Path Validation**<br>Check `(member.external_attr >> 16) & 0xF000 == 0xA000` for symlinks. Fix protected path regex to match `(^|/|\\)\.env` across all subdirectories. | High | **S** (20 min) | [`backend/app/services/archive.py`](file:///backend/app/services/archive.py), [`backend/app/services/patch_applier.py`](file:///backend/app/services/patch_applier.py) |
| **P1** | **Add Dockerfile & docker-compose**<br>Containerize backend and frontend for consistent deployment and basic process/network isolation. | High | **M** (2 hrs) | Root `Dockerfile`, `docker-compose.yml` |
| **P2** | **Pin Python and NPM Dependencies**<br>Replace `>=` in `requirements.txt` with pinned versions (`==`) and remove duplicate `httpx` entry. | Medium | **S** (15 min) | [`backend/requirements.txt`](file:///backend/requirements.txt) |
| **P2** | **Add Basic Frontend Smoke Tests**<br>Install Vitest + React Testing Library to verify dropzone, form submission, and badge rendering. | Medium | **M** (2 hrs) | `frontend/package.json`, `frontend/src/` |

---

## 7. Unverified Items

1. **Live Nebius Token Factory API Inference & Model Catalog:**
   - **Reason:** `NEBIUS_API_KEY` was not configured in `.env`.
   - **Status:** Marked **UNVERIFIED**. Unit tests with mock responses verify request payload construction, backoff, and role selection, but network connectivity, authentication, real token limits, and model response times against `https://api.tokenfactory.nebius.com/v1` were not verified.
2. **Linux-Specific `setrlimit` Sandbox Enforcement:**
   - **Reason:** The audit environment was executed on Windows.
   - **Status:** The code path for `resource.setrlimit` exists in [`sandbox.py:61-74`](file:///backend/app/services/sandbox.py#L61-L74), but enforcement behavior on a Linux host could not be physically exercised in this session.

