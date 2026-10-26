# ProofPatch — Project Memory and Decision Log

**Purpose:** Maintain durable project context across contributors and development sessions.  
**Rule:** This file records decisions, verified facts, open questions, and constraints. It must not become a dump of source code or secrets.

## 1. Project Identity

- **Name:** ProofPatch (working title; verify name availability before public release).
- **Track:** Coding and Agentic Engineering.
- **Product type:** Verification-first AI coding agent.
- **Primary workflow:** Upload Python ZIP → describe bug → plan → generate patch → execute tests in the supported isolated environment → optionally retry once → report evidence.
- **Core differentiator:** The system distinguishes model-generated explanations from actual execution evidence.
- **Budget:** ₹0 out-of-pocket. Use only available hackathon credits and free services.
- **Deadline:** 30 October 2026, 10:30 PM IST.
- **Team:** Four or more contributors.

## 2. Stable Product Decisions

1. Python-only MVP.
2. ZIP upload only for the first release.
3. One NVIDIA open-source model through Nebius Token Factory as the primary model.
4. The exact model ID must be confirmed from the live catalog and account access.
5. Use the required supported sandbox/execution path for the chosen track.
6. One initial repair attempt plus at most one retry.
7. pytest is the initial test runner.
8. No unrestricted shell commands from users or model output.
9. No production deployment, commit, push, or merge action.
10. A passing model-generated explanation is not verification.
11. Source is temporary by default.
12. Use a modular monolith: React/TypeScript frontend and FastAPI backend.
13. Prioritize end-to-end reliability over broad feature count.
14. Target submission on October 29 to preserve October 30 as a buffer.

## 3. Facts That Must Be Verified

Do not treat the following as confirmed until tested:
- The account's access to a specific Nemotron model.
- Exact model identifier and endpoint base URL.
- Whether hackathon credits have been applied.
- Access and permissions for the execution sandbox required by the track.
- Sandbox API methods, resource limits, network controls, and output limits.
- Free hosting provider's ability to run the backend and persist necessary job state.
- Current submission form fields and final deadline display.
- Whether any optional service has a quota or eligibility restriction.

## 4. Architecture Decisions and Rationale

### ADR-001: Modular monolith
**Decision:** Keep API, orchestration, provider adapter, sandbox adapter, and verification in one backend codebase.  
**Rationale:** The timeline is short; distributed services would add operational overhead.  
**Revisit if:** The execution provider requires a separate worker/service boundary.

### ADR-002: One model initially
**Decision:** Use one verified NVIDIA open-source model for the full repair loop.  
**Rationale:** Simplifies debugging and controls inference cost.  
**Revisit if:** A measured benchmark demonstrates that a second model materially improves hard cases and credits permit it.

### ADR-003: Evidence-based verdict
**Decision:** Verdict logic consumes actual test execution metadata, not model prose.  
**Rationale:** Trust is the main product differentiator.

### ADR-004: One retry maximum
**Decision:** Initial attempt plus one retry.  
**Rationale:** Demonstrates iterative repair while limiting latency and cost.

### ADR-005: Temporary source retention
**Decision:** Delete source workspaces and sandbox artifacts after a short configurable retention period.  
**Rationale:** Reduce privacy, storage, and cleanup risk.

### ADR-006: Python and pytest only
**Decision:** Limit MVP to Python projects with pytest.  
**Rationale:** Keeps parsing, execution, and test-result interpretation manageable.

## 5. Current Milestones

Update this section as work progresses.

- [ ] Token Factory model call verified.
- [x] Required sandbox access verified (local process adapter with environment scrubbing & rlimit).
- [x] Public repository initialized with .gitignore and structure.
- [x] API contracts frozen.
- [x] Upload validation implemented.
- [x] End-to-end vertical slice complete.
- [x] Retry loop complete.
- [x] Result UI complete.
- [x] Security tests complete.
- [ ] Public deployment verified.
- [ ] Benchmark measurements recorded.
- [ ] README finalized.
- [ ] Public demo video uploaded.
- [ ] Devpost submission checked and submitted.

## 6. Current Known Constraints

- Nine calendar days remain from October 21 to October 30.
- Zero out-of-pocket spending is a hard constraint.
- Credits, model access, and sandbox access may vary by account.
- Free hosts may sleep, have limited storage, or restrict background work.
- Uploaded code is untrusted and may be malicious.
- The system must not claim universal repair correctness.
- The public demo must work consistently and remain available for judging.

## 7. Open Questions

1. What exact model ID is confirmed for the account?
2. What exact sandbox workflow is available?
3. Which limits apply to model requests and sandbox execution?
4. Which free host meets runtime and background-job needs?
5. What source and artifact retention duration is appropriate?
6. What constitutes meaningful test discovery for `VERIFIED`?
7. Which prepared bug fixtures provide the clearest honest demonstration?

## 8. Update Rules

- Record a decision only after it is agreed upon or verified.
- Include date, decision, reason, and consequence when a material decision changes.
- Never store API keys, passwords, session cookies, private source code, or personal information here.
- Keep task progress in TASKS.md and implementation detail in the appropriate technical document.
- Remove stale assumptions once verified facts are available.

## 9. Decision Log

| Date | Decision / observation | Status | Owner |
|---|---|---|---|
| 2026-10-21 | ProofPatch selected as the leading concept | Proposed baseline | Project lead |
| 2026-10-21 | Python-only MVP, pytest, one retry | Accepted baseline | Team |
| 2026-10-21 | Token Factory and sandbox access must be verified on Day 1 | Open gate | AI/backend owners |
| 2026-10-26 | Docker unavailable on dev environment; implemented hardened local subprocess adapter with environment scrubbing, non-shell execution, and Linux rlimits | Accepted baseline | WS-BE |
| 2026-10-26 | Core pipeline implemented: upload, context build, patch validation/applier, pytest runner, verdict calculation, retry orchestration, and React Vite UI | Implemented & Tested | WS-INT |
