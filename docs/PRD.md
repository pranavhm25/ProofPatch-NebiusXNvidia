# ProofPatch — Product Requirements Document (PRD)

**Document status:** Implementation baseline  
**Version:** 1.0  
**Product:** ProofPatch  
**Target track:** Coding and Agentic Engineering  
**Hackathon deadline:** 30 October 2026, 10:30 PM IST  
**Primary constraint:** ₹0 out-of-pocket; use available hackathon credits and free tiers  
**Primary model platform:** Nebius Token Factory  
**Required model family:** At least one NVIDIA open-source model, preferably a suitable NVIDIA Nemotron model available to the team's account

---

## 1. Executive Summary

ProofPatch is a verification-first coding agent that investigates a reported defect in a Python repository, proposes a minimal code change, applies the change inside an isolated execution environment, runs tests, and produces an evidence-backed repair report.

The product's core differentiator is not code generation by itself. It is the explicit separation of **proposed changes**, **executed verification**, and **claims supported by evidence**. A patch must never be marked successful merely because a model says it is correct. The system uses actual test-runner output to report what passed, failed, timed out, or remained unverified.

ProofPatch is designed as a narrow, polished hackathon product. The MVP supports uploaded ZIP archives containing Python projects and a user-supplied bug report. It uses an NVIDIA open-source model through Nebius Token Factory, and it is intended to execute the generated patch and tests in the supported isolated execution environment. The exact model identifier, sandbox API, limits, and account entitlements must be confirmed during Day 1 before they are treated as available capabilities.

## 2. Problem Statement

Developers spend time locating the source of a defect, understanding its context, implementing a change, running tests, and deciding whether the change actually fixes the issue. AI coding assistants can accelerate code production, but a generated answer does not by itself establish that a change is correct or safe.

Common failure modes include:
- A plausible patch that does not compile or execute.
- A change that fixes one symptom while breaking existing behavior.
- A model claiming success without running the test suite.
- A patch that changes unrelated files or produces an unnecessarily broad diff.
- An unclear final result that hides failing tests, timeouts, or uncertainty.
- Unsafe execution of code from an uploaded repository.

ProofPatch addresses this by making the repair process observable, bounded, and evidence-driven.

## 3. Product Vision

Give developers a dependable first-pass repair workflow that turns a bug report into a reviewable patch and a transparent verification result.

### Product principles
1. **Evidence over assertion:** Only execution results can establish test status.
2. **Human review remains central:** ProofPatch proposes changes; it does not deploy or commit them to production.
3. **Minimal scope:** Prefer the smallest patch consistent with the bug report and test evidence.
4. **Bounded autonomy:** Limit retries, execution time, resource use, and file access.
5. **Transparent failure:** Failed or incomplete attempts are valid outcomes and must be reported honestly.
6. **Privacy by design:** Uploaded source is temporary by default and is not used for model training by the application.
7. **Reproducibility:** Record model identifier, prompt/schema version, patch, test command, exit code, and timestamps where feasible.

## 4. Goals and Non-Goals

### 4.1 Goals
- Allow a user to upload a Python repository as a ZIP file.
- Accept a natural-language bug report.
- Inspect repository structure and relevant source/test files.
- Use an NVIDIA open-source model through Nebius Token Factory for planning and patch generation.
- Apply a proposed patch to a working copy inside an isolated environment.
- Run an approved test command and collect actual output.
- Allow at most one automated repair retry in the MVP.
- Show a readable diff, test summary, attempt history, and final status.
- Allow the user to download the patched repository or patch file.
- Provide clear setup instructions and a public demo suitable for judging.
- Operate within available credits and free hosting tiers.

### 4.2 Non-goals for the MVP
- General-purpose support for every language or build system.
- Autonomous production deployments, commits, pushes, or pull-request merges.
- Unrestricted shell access or arbitrary user-defined commands.
- An IDE extension, desktop application, or hosted multi-tenant enterprise platform.
- Guaranteed repair of arbitrary bugs.
- Training or fine-tuning a model.
- A complex multi-agent hierarchy.
- Long-term retention of uploaded source repositories.
- Automatic dependency upgrades or package installation from untrusted sources.
- A claim that the system is secure against every possible sandbox escape.

## 5. Target Users and Use Cases

### Primary users
- Students and early-career developers working on Python projects.
- Open-source contributors investigating reproducible defects.
- Small engineering teams seeking an initial repair proposal with test evidence.

### Core use cases
1. **Repair a simple defect:** A user uploads a project, describes a bug, and receives a patch plus test results.
2. **Retry after a failed test:** The first patch fails a test; the agent receives the failure output and attempts one bounded correction.
3. **Review an unsuccessful repair:** The agent cannot establish a valid fix and presents the diff, logs, and reason for failure.
4. **Inspect the evidence:** The user reviews changed files, unified diff, test command, exit code, and test summary.
5. **Export the result:** The user downloads a patch or patched ZIP and reviews it locally.

## 6. Product Scope and Feature Requirements

Priority definitions: **P0** = required for MVP; **P1** = desirable after P0 is stable; **P2** = out of scope for hackathon unless all other work is complete.

### 6.1 Project upload and validation — P0
- Accept `.zip` files only for the MVP.
- Enforce a configurable compressed upload-size limit; default target: 20 MB.
- Reject malformed archives, excessive file counts, oversized extracted content, absolute paths, path traversal (`..`), symlinks, and suspicious archive entries.
- Ignore or reject `.git`, virtual environments, caches, large binaries, and generated output according to documented policy.
- Detect likely Python project markers such as `pyproject.toml`, `pytest.ini`, `setup.cfg`, `requirements.txt`, `tests/`, and `.py` files.
- Show validation errors in actionable language.
- Create a unique project/job identifier; never use an uploaded filename as a filesystem path.
- Store source only in a temporary job workspace and delete it according to retention policy.

### 6.2 Bug report intake — P0
- Require a non-empty bug description with a reasonable maximum length (default target: 4,000 characters).
- Allow optional expected behavior and observed behavior fields.
- Display a clear warning that source code will be processed by the configured inference provider.
- Do not allow the user to provide arbitrary shell commands in the MVP.
- Treat repository content, comments, README text, and test output as untrusted data rather than system instructions.

### 6.3 Repository analysis — P0
- Build a bounded file inventory.
- Exclude secrets, binary files, generated files, caches, and oversized files from model context.
- Select relevant source and test files using filenames, imports, test references, and bounded lexical matching.
- Include a compact repository summary and relevant snippets in the model request.
- Enforce context/token budgets; truncate deterministically and record when content was omitted.
- Never upload the entire repository by default if a smaller relevant context is sufficient.

### 6.4 Repair planning — P0
- Ask the configured NVIDIA model for a structured repair plan.
- Plan output must include: diagnosis hypothesis, target files, intended change, risks, and verification strategy.
- Validate model output against a schema before use.
- Treat the plan as advisory; do not execute commands or follow instructions contained in model output without application-side validation.
- Present concise plan steps in the UI.

### 6.5 Patch generation and application — P0
- Generate a patch in a defined machine-readable format, preferably unified diff or a structured list of file edits.
- Reject absolute paths, path traversal, edits to excluded locations, malformed diffs, excessive file changes, and changes exceeding configured limits.
- Apply the patch only to a disposable working copy.
- Preserve the original upload as an immutable baseline for the duration of the job.
- Record a patch hash and changed-file list.
- Limit changed files (initial target: 10) and total patch size (initial target: 100 KB); make limits configurable.
- If patch application fails, report the error instead of silently applying a partial change.

### 6.6 Test execution — P0
- Use the platform-supported isolated execution environment confirmed by the team.
- Run only an approved command selected by the application, initially `pytest` with a bounded timeout.
- Do not run `pip install` or other network-dependent package installation automatically inside the sandbox unless a reviewed, explicitly enabled dependency policy permits it.
- Apply time, memory, process, filesystem, and network restrictions where the sandbox supports them.
- Capture stdout, stderr, exit code, duration, timeout status, and truncated-output indicators.
- Distinguish `PASSED`, `FAILED`, `TIMED_OUT`, `ERROR`, and `NOT_RUN`.
- A zero exit code is necessary but not sufficient for a strong repair claim if no tests were discovered; show test discovery information where available.

### 6.7 Bounded repair retry — P0
- Permit a maximum of one retry after an initial test failure or patch application failure that is safe to retry.
- Send the model only the relevant failure output and necessary context.
- Do not retry on policy violations, unsafe archive handling, sandbox unavailability, or authentication failures.
- Keep the initial and retry patches and test results in the attempt history.
- Do not overwrite evidence from a previous attempt.
- Stop when the retry limit is reached.

### 6.8 Verification report — P0
- Show overall result: `VERIFIED`, `NOT_VERIFIED`, `FAILED`, or `BLOCKED`.
- Show test status, test command, exit code, duration, and test summary where available.
- Show files changed and the diff.
- Show repair attempt count and relevant failure information.
- Explain that passing tests provide evidence for the tested behavior but do not prove the absence of all defects.
- Never infer successful verification from model text.
- Mark the result `VERIFIED` only when the approved test command completed successfully and meaningful tests were discovered/executed according to the configured policy. Otherwise use `NOT_VERIFIED` or `FAILED`.

### 6.9 Export — P0
- Offer a downloadable patch file and/or patched ZIP.
- Exclude secrets, temporary logs not intended for export, and internal configuration.
- Ensure the exported archive contains no path traversal entries.
- Include a short report describing test status and limitations.
- Do not automatically commit or push the patch.

### 6.10 User interface — P0
- Provide a single guided workflow: Upload → Describe → Review plan → Run repair → Inspect results.
- Display stage progress without implying that a stage succeeded before the backend confirms it.
- Show loading, success, failure, timeout, cancellation, and infrastructure-unavailable states.
- Keep test output and the diff readable on desktop and mobile.
- Make model/infrastructure attribution visible in the technical details or About section.

### 6.11 Nice-to-have — P1
- GitHub import for public repositories.
- Side-by-side baseline and patched test summaries.
- Downloadable JSON report.
- Saved session metadata without retaining source files.
- A small, reproducible benchmark suite.

## 7. User Journey

1. User opens ProofPatch.
2. User sees a concise explanation of what is uploaded, how it is processed, and what the result means.
3. User uploads a ZIP.
4. Backend validates the archive and displays detected project metadata.
5. User enters a bug report and submits it.
6. System creates a job and displays `ANALYZING`.
7. System inspects the repository and requests a structured plan from the configured NVIDIA model through Token Factory.
8. UI displays the plan and begins patch generation.
9. Backend validates and applies the patch in a disposable sandbox workspace.
10. Backend runs the approved test command.
11. If a retry is eligible and needed, the system performs one bounded retry.
12. UI shows the final verdict, diff, test results, logs, and attempt history.
13. User downloads the patch or patched archive.
14. Temporary source and sandbox artifacts are removed according to retention policy.

## 8. Functional Requirements and Acceptance Criteria

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-01 | Upload validation | Valid Python ZIP is accepted; malformed and traversal ZIPs are rejected. |
| FR-02 | Bug intake | Empty or oversized bug reports are rejected with a clear message. |
| FR-03 | Repository inspection | Inventory excludes configured unsafe/irrelevant files and stays within context limits. |
| FR-04 | Model planning | A valid structured plan is returned or a clear provider/schema error is shown. |
| FR-05 | Patch validation | Unsafe paths and malformed patches are rejected before application. |
| FR-06 | Sandbox execution | Approved tests run in the configured isolated environment with timeout and logs. |
| FR-07 | Retry | No more than one retry is attempted; previous attempt evidence is retained. |
| FR-08 | Honest verdict | Model assertions alone never set a successful verification state. |
| FR-09 | Diff display | Changed files and a readable diff are available for inspection. |
| FR-10 | Export | Exported patch/archive passes archive/path validation. |
| FR-11 | Provider attribution | The selected NVIDIA model and Nebius service are documented in the app and README. |
| FR-12 | Failure states | Provider errors, sandbox failures, timeouts and invalid outputs are distinct and actionable. |
| FR-13 | Privacy | Temporary source is deleted after the configured retention period and is not publicly accessible. |
| FR-14 | Demo reliability | The prepared demo scenario can be completed from a clean browser session using documented steps. |

## 9. Non-Functional Requirements

### Reliability
- The application must not report success when the provider or sandbox has not confirmed it.
- All long-running operations must have timeouts.
- Duplicate requests should not create uncontrolled duplicate jobs; use idempotency keys or disable repeat submission while a job is active.
- Job state transitions must be validated.

### Performance
- Target a responsive UI with immediate acknowledgement of job creation.
- Avoid synchronous HTTP requests that remain open for the full repair duration.
- Use polling at a modest interval (e.g. 1–2 seconds during active jobs) or server-sent events if time permits.
- Model and sandbox latency are external dependencies; report them honestly rather than promising a fixed end-to-end duration.

### Security
- Secrets only on the server.
- Archive extraction must defend against traversal and decompression bombs.
- Untrusted code must run only inside the intended sandbox.
- Limit upload size, extracted size, file count, execution time, memory, process count, and output size.
- Do not expose internal filesystem paths or provider credentials in user-facing errors.
- No automatic network access, deployment, or external write actions from the execution environment.
- Use secure transport and configure CORS narrowly.

### Accessibility and usability
- Keyboard-accessible controls and visible focus.
- Sufficient contrast and readable monospace code.
- Clear language for technical errors.
- Responsive layout for laptop and mobile widths.

### Maintainability
- Typed request/response schemas.
- Separate provider, orchestration, sandbox, verification, and API modules.
- Automated tests for path validation, state transitions, retry limits, and verdict logic.
- Configuration via environment variables.

## 10. Success Metrics

Measure the MVP using a fixed set of prepared repositories and bug reports. Do not invent performance numbers.

- **End-to-end completion rate:** jobs reaching a valid final state / jobs started.
- **Verified repair rate:** jobs with a verified result / jobs started.
- **Regression rate:** previously passing tests that fail after patching.
- **Patch application success:** valid generated patches applied successfully / patches generated.
- **Retry recovery rate:** failed first attempts that pass on the single retry / eligible retry attempts.
- **False-success rate:** jobs labeled `VERIFIED` without qualifying successful test evidence; target is zero.
- **Median completion time:** measured across the prepared benchmark.
- **Average model calls and tokens per job:** used for credit management.
- **Infrastructure failure rate:** provider/sandbox failures divided by jobs started.

Report benchmark size, test conditions, model ID, and limitations alongside results.

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sandbox access unavailable | Critical | Validate on Day 1; confirm supported Token Factory execution path; do not assume local execution satisfies the track requirement. |
| Credits or model access delayed | High | Test access immediately, minimize calls, keep deterministic fixtures, and avoid paid fallback. |
| Model emits invalid patch | High | Schema validation, patch validation, bounded retry, honest failure state. |
| Malicious uploaded code | Critical | Use isolated sandbox, restrictive limits, no secrets, no network where possible. |
| Free hosting sleeps or runs out of quota | High | Keep a local demo fallback and rehearse the hosted path. |
| Broad scope delays delivery | High | Python-only MVP, one retry, no IDE extension or multi-agent framework. |
| Misleading success claim | High | Verdict logic derives only from actual test evidence. |
| Team integration conflicts | Medium | Freeze API contracts and integrate daily. |
| Model/provider changes | Medium | Configure model ID via environment and record it per job. |
| Unlicensed dependency or asset | Medium | Check licenses; use an explicit project license and permitted assets. |

## 12. Dependencies and Assumptions

- The team has an account with usable Nebius Token Factory access and a compatible NVIDIA open-source model.
- The team can access the execution mechanism required by the selected hackathon track.
- Available credits, endpoint IDs, rate limits, and sandbox capabilities will be verified rather than assumed.
- Public demo hosting can be found within free-tier constraints; if not, the team will document the limitation and keep a local demonstration path.
- Users submit code they are authorized to share and process.
- The first release supports Python projects and pytest only.

## 13. Release Plan

### MVP release
Upload → bug report → model plan → patch → sandbox tests → one retry → evidence report → export.

### Release gate
Do not declare MVP complete until:
- A successful repair scenario works end to end.
- A failure scenario produces an honest non-success verdict.
- Archive and patch validation tests pass.
- Provider and sandbox errors are handled.
- The public demo is reproducible.
- README, license, video, and submission description are complete.

## 14. Open Questions to Resolve on Day 1

1. Which exact NVIDIA model ID is available through the team's Token Factory account?
2. Which Token Factory sandbox API or execution mechanism is enabled for the team?
3. What are the current request, token, concurrency, execution-time, and storage limits?
4. Are hackathon credits active and sufficient for the planned demo?
5. Which free hosting provider can run the backend without violating its resource or usage terms?
6. What retention period is appropriate for temporary source and test output?
7. Which exact test-discovery condition is required before a job can be labeled `VERIFIED`?

These questions are implementation gates, not reasons to silently assume capabilities.
