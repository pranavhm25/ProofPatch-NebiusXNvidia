# ProofPatch — Implementation Tasks and Delivery Plan

**Schedule:** 21–30 October 2026  
**Target code freeze:** 28 October  
**Target submission:** 29 October  
**Final deadline:** 30 October 2026, 10:30 PM IST  
**Budget:** ₹0 out-of-pocket

## 1. Delivery Rules

- Work is organized around a working vertical slice, not isolated components.
- Each task has an owner, dependencies, acceptance criteria, and a priority.
- P0 tasks must be complete before optional polish.
- Every workstream integrates into the main branch daily.
- No task is complete without evidence or a test.
- Any unverified provider or sandbox capability is an explicit blocker.

## 2. Workstreams

- **WS-AI:** Model integration and orchestration.
- **WS-BE:** API, upload validation, sandbox, execution.
- **WS-FE:** UI, interaction, diff/report display.
- **WS-QA:** Evaluation, security tests, deployment, docs and submission.
- **WS-INT:** Cross-team integration and release coordination.

## 3. Day 1 — 21 October: Feasibility and Contracts

### P0: Infrastructure gates
- [ ] **D1-01 — Verify Token Factory account and credits**  
  Owner: WS-AI  
  Acceptance: A real request succeeds with a confirmed NVIDIA open-source model; model ID, endpoint, response latency, and available limits are recorded without exposing secrets.

- [x] **D1-02 — Verify required sandbox workflow**  
  Owner: WS-BE  
  Acceptance: A minimal approved Python test project executes in the supported environment; exit code, output, timeout behavior, and cleanup are demonstrated. If blocked, escalate immediately.

- [x] **D1-03 — Create public repository and license**  
  Owner: WS-QA  
  Acceptance: Public repository exists, license is visible, README explains the project and current status, and no secrets are committed.

- [x] **D1-04 — Freeze API schemas**  
  Owner: WS-INT  
  Acceptance: Project, job, status, result, error, and model-output contracts are agreed and checked into the repository.

- [x] **D1-05 — Create synthetic bug fixture**  
  Owner: WS-QA  
  Acceptance: A small, licensed or original Python project has a reproducible defect and a test that fails before the fix and passes after the intended fix.

- [x] **D1-06 — Establish development environment**  
  Owner: All  
  Acceptance: Frontend and backend start locally using documented commands; `.env` is ignored by Git.

**Day 1 exit gate:** Real model call and real supported sandbox execution are both verified. Do not build the remaining product around unconfirmed assumptions.

## 4. Day 2 — 22 October: Vertical Slice

- [x] **D2-01 — ZIP upload endpoint** (WS-BE, P0)  
  Acceptance: Valid ZIP accepted; malformed ZIP and traversal archive rejected.

- [x] **D2-02 — Repository inventory** (WS-BE, P0)  
  Acceptance: File list excludes caches, binaries, oversized files, and configured secret paths.

- [x] **D2-03 — Token Factory adapter** (WS-AI, P0)  
  Acceptance: Server-side provider call works with configured model ID; errors are mapped to safe codes.

- [x] **D2-04 — Structured repair plan** (WS-AI, P0)  
  Acceptance: Valid model response passes schema validation; malformed response is rejected.

- [x] **D2-05 — Minimal UI shell** (WS-FE, P0)  
  Acceptance: User can select a ZIP, enter a bug report, and submit a request.

- [x] **D2-06 — Job state persistence** (WS-BE, P0)  
  Acceptance: Job ID and state can be queried after request completion.

**Day 2 exit gate:** A user can upload a project, submit a bug, and receive a model-generated plan through the backend.

## 5. Days 3–4 — 23–24 October: Patch and Execution

- [x] **D3-01 — Patch-generation schema and prompt** (WS-AI, P0)  
  Acceptance: Model returns a schema-valid patch for the prepared fixture.

- [x] **D3-02 — Patch path and size validator** (WS-BE, P0)  
  Acceptance: Absolute paths, traversal, protected files, malformed patches, and oversized patches are rejected.

- [x] **D3-03 — Atomic patch application** (WS-BE, P0)  
  Acceptance: Patch is applied to a disposable working copy; original baseline remains unchanged.

- [x] **D3-04 — Sandbox runner adapter** (WS-BE, P0)  
  Acceptance: Approved pytest command runs with timeout and bounded stdout/stderr.

- [x] **D3-05 — Test-result parser** (WS-BE/QA, P0)  
  Acceptance: Pass, fail, timeout, error, and no-tests cases are distinguishable.

- [x] **D3-06 — End-to-end repair fixture** (WS-INT, P0)  
  Acceptance: At least one known defect is repaired and actual tests pass through the full pipeline.

**Day 4 exit gate:** One complete repair works end to end.

## 6. Day 5 — 25 October: Retry and Report

- [x] **D5-01 — Bounded retry orchestration** (WS-AI, P0)  
  Acceptance: One retry can use actual test failure output; no job exceeds two total attempts.

- [x] **D5-02 — Attempt history persistence** (WS-BE, P0)  
  Acceptance: Initial and retry patches, test results, hashes, and status are retained separately.

- [x] **D5-03 — Evidence-based verdict service** (WS-AI/BE, P0)  
  Acceptance: Verdict is computed from test evidence; model prose cannot set `VERIFIED`.

- [x] **D5-04 — Result report contract** (WS-INT, P0)  
  Acceptance: Diff, changed files, test status, exit code, duration, attempts, model attribution, and limitations are available.

- [x] **D5-05 — Failure scenario fixture** (WS-QA, P0)  
  Acceptance: A case that cannot be verified is reported as not verified/failed/blocked, never as success.

## 7. Days 6–7 — 26–27 October: UI, Security, Deployment

- [x] **D6-01 — Progress timeline** (WS-FE, P0)  
  Acceptance: UI reflects backend states and never advances optimistically to completed.

- [x] **D6-02 — Diff viewer** (WS-FE, P0)  
  Acceptance: Changed files and diff are readable, responsive, and distinguish additions/deletions accessibly.

- [x] **D6-03 — Test evidence panel** (WS-FE, P0)  
  Acceptance: Actual test output, status, exit code, duration, and truncation warning are visible.

- [x] **D6-04 — Patch and ZIP export** (WS-BE, P0)  
  Acceptance: Downloaded artifacts are safe, correctly associated with the job, and validated.

- [x] **D6-05 — Archive/security test suite** (WS-QA, P0)  
  Acceptance: Traversal, oversized archives, symlinks, output flooding, timeouts, and protected-path edits are tested.

- [ ] **D7-01 — Public demo deployment** (WS-QA, P0)  
  Acceptance: Public URL works from a clean browser; secrets are configured server-side.

- [ ] **D7-02 — Cost and latency measurement** (WS-QA/AI, P0)  
  Acceptance: Record model calls, token usage if available, completion times, provider failures, and credit consumption for the fixture set.

- [ ] **D7-03 — Clean-session rehearsal** (WS-INT, P0)  
  Acceptance: A teammate who did not build the feature can run the demo from the README.

## 8. Day 8 — 28 October: Freeze and Submission Assets

- [x] **D8-01 — Feature freeze** (Project lead, P0)  
  Acceptance: Only release-blocking fixes are permitted after the freeze.

- [x] **D8-02 — README and setup guide** (WS-QA, P0)  
  Acceptance: Includes architecture, environment setup, model configuration, sandbox setup, run commands, tests, security notes, and limitations.

- [x] **D8-02b — Frontend Quality, Test Automation & Accessibility Pass** (WS-FE/QA, P0)  
  Acceptance: 118 Vitest/RTL tests, 18 Playwright E2E/Axe tests, code coverage >94% lines, 0 WCAG 2.1 AA violations, CI workflows, and zero secret leaks. Documented in docs/FRONTEND_TEST_REPORT.md.

- [ ] **D8-03 — Benchmark summary** (WS-QA, P0)  
  Acceptance: Report actual fixture count, conditions, successes, failures, latency, and limitations; no invented metrics.

- [ ] **D8-04 — Demo video recording** (WS-QA/FE, P0)  
  Acceptance: Public YouTube video is under three minutes, shows the working product, and explains NVIDIA/Nebius use without unauthorized trademarks/music.

- [x] **D8-05 — Submission description** (Project lead, P0)  
  Acceptance: Problem, solution, features, architecture, model usage, Nebius service usage, impact, limitations, and demo links are accurate.

## 9. Day 9 — 29 October: Submission

- [x] **D9-01 — Repository audit**  
  Acceptance: Public access, license visible, README complete, setup instructions tested, no secrets.

- [ ] **D9-02 — Demo audit**  
  Acceptance: Public URL works; main scenario completes; no dependency on developer-only local files.

- [ ] **D9-03 — Video audit**  
  Acceptance: Public, under three minutes, correct links, all content authorized.

- [ ] **D9-04 — Feedback on tools**  
  Acceptance: Specific, truthful feedback on Token Factory, AI Cloud if used, and NVIDIA tools/models.

- [ ] **D9-05 — Submit and verify confirmation**  
  Acceptance: Submission is saved and confirmation is recorded.

## 10. Day 10 — 30 October: Contingency Only

- [ ] Fix only critical submission or demo failures.
- [ ] Confirm submission status well before 10:30 PM IST.
- [ ] Do not add new features.
- [ ] Keep a working local demonstration as backup.

## 11. P1 Tasks — Only After All P0 Work Is Stable

- [ ] Public GitHub import.
- [ ] JSON report download.
- [ ] Better diff navigation.
- [ ] Additional prepared benchmark cases.
- [ ] Optional second model for difficult repairs, only if measured benefit and credits justify it.

## 12. Release Checklist

- [ ] Genuine NVIDIA model inference through Nebius Token Factory.
- [x] Required execution sandbox demonstrated.
- [x] End-to-end repair works.
- [x] Retry is bounded.
- [x] Verdict uses actual test evidence.
- [x] Security tests pass.
- [ ] Public demo and repository work.
- [x] License and setup documentation are visible.
- [ ] Public demo video under three minutes.
- [ ] Tool feedback and project description are complete.
- [ ] Submission is complete before the deadline.
