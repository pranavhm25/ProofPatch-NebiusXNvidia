# ProofPatch — NVIDIA × Nebius AI Hackathon Submission Writeup

## 1. Project Information
- **Project Name:** ProofPatch
- **Tagline:** Verification-First Automated Code Repair for Python Repositories
- **Track:** NVIDIA × Nebius Global AI Hackathon (NVIDIA Models on Nebius Token Factory)
- **GitHub Repository:** [pranavhm25/ProofPatch-NebiusXNvidia](https://github.com/pranavhm25/ProofPatch-NebiusXNvidia)
- **License:** Apache License 2.0

---

## 2. Problem Statement
Modern generative AI coding tools produce syntactically plausible code but frequently introduce subtle logical regressions, hallucinate fix completions, and fail silently in production environments. Furthermore, existing AI agents:
1. Make self-verifying assertions ("I fixed the bug!") without executing test suites.
2. Incur runaway costs through unbounded iterative retry loops.
3. Expose developer secrets through uncontrolled environment variable leakage into child subprocesses.
4. Risk code corruption through ungrounded patch application that fails on misaligned line numbers.

Software engineering requires **provable correctness**: a repair is only a repair when the underlying test suite demonstrates it.

---

## 3. The Solution: ProofPatch
**ProofPatch** is an enterprise-grade automated software repair agent that guarantees:
- **Evidence Over Assertion:** A patch is strictly labeled `VERIFIED` only if `pytest` returns exit code 0 with discovered tests passing. If no tests exist, it is honestly labeled `NOT_VERIFIED`. If tests fail, it is marked `FAILED`. Model claims never dictate verdicts.
- **NVIDIA Models on Nebius Token Factory:** Deep reasoning, targeted patch synthesis, and error diagnosis powered by NVIDIA's `Nemotron-3-Ultra-550b` and `nemotron-3-super-120b`, hosted on Nebius Token Factory's low-latency, OpenAI-compatible infrastructure.
- **Atomic Sandboxed Execution:** Patches are applied strictly to disposable working copies. Original codebases remain immutable. Subprocess environments are completely sanitized of API keys and host tokens.
- **Bounded Bounded Retry:** When tests or patch application fail, exactly one targeted retry is permitted using real failure output, eliminating infinite loops and runaway compute costs.
- **Hunk-Tolerant Patch Application (Fix B):** Tolerates hallucinated line offsets and minor context inaccuracies by anchoring on unique removed (`-`) lines while strictly refusing ambiguous matches.

---

## 4. NVIDIA & Nebius Usage

### NVIDIA open-source models
ProofPatch uses role-separated NVIDIA open-source Nemotron models to power a verification-first automated repair pipeline:
- **Planning & source inspection (FAST):** `nvidia/Nemotron-3_5-Lightning` for rapid repository context triage, file manifest parsing, and initial fault localization.
- **Unified diff patch generation (REASONING):** `nvidia/Nemotron-3-Ultra-550b-a55b` for deep architectural reasoning and synthesizing minimal, syntactically valid unified diffs (`.patch`).
- **Bounded retry & error revision (ADVANCED):** `nvidia/Nemotron-3-Ultra-550b-a55b` (with `nvidia/nemotron-3-super-120b-a12b` as evaluated alternative) for self-healing patch revision using real sandbox `pytest` failure traces, exit codes, and line-numbered source context. Across 70 benchmark runs on 7 hint-free defect fixtures, this model achieved a **95.7% pass rate (67/70 verified)** with a mean latency of 11.8s, successfully converting 10 initial failures into verified repairs on retry without external model fallbacks.

### Nebius Token Factory
All model requests route through Nebius Token Factory's OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1`). It enabled us to:
- **Dynamic Role-Based Multi-Model Routing:** Dynamically assign specialized model tiers (`FAST`, `REASONING`, `ADVANCED`) per pipeline stage through a single unified endpoint and API key without managing GPU infrastructure or Slurm clusters.
- **Interactive Repair Latency:** Benefit from high-throughput streaming and low time-to-first-token, keeping full end-to-end repair cycles under 12 seconds on average.
- **Live Catalog & Readiness Probing:** Validate model availability, context limits, and latency on startup using the authenticated `GET /models` endpoint.
- **Fail-Fast Budget & Rate Guardrails:** Integrate strict HTTP 402/429 handling directly into the client adapter to halt runaway execution loops immediately and protect hackathon credits.

### Other Nebius tools or services
None. (ProofPatch uses Nebius Token Factory exclusively for all LLM inference. Subprocess sandboxing, environment scrubbing, and POSIX memory/CPU limits are enforced independently by ProofPatch's containerized execution harness.)

---

## 5. Key Architectural Highlights

```
                                [Nebius Token Factory]
                           (NVIDIA Nemotron Open-Source)
                                        ^
                                        | (Structured JSON)
[Client / Web UI]  --->  [FastAPI Backend]  --->  [Atomic Patch Applier]
(Warm Minimal UI)        - Archive Safety         - Disposable Copy
                         - Model Orchestration    - Unique '-' Anchor
                                                  - Baseline Immutability
                                                          |
                                                          v
                                                 [Sandbox Execution]
                                                 - Subprocess Isolation
                                                 - Environment Scrubbed
                                                 - RLIMIT_AS & RLIMIT_CPU
                                                 - Non-Root (UID 10001)
                                                          |
                                                          v
                                                 [Verdict Engine]
                                                 - Evidence-Backed (Exit 0)
                                                 - Zero Model Self-Certification
```

### Technical Innovations
1. **Multi-Role Model Hierarchy:** ProofPatch separates model responsibilities across three distinct roles:
   - `REASONING` (`nvidia/Nemotron-3-Ultra-550b-a55b`): Deep repository diagnosis, risk analysis, and structured repair planning.
   - `FAST` (`zai-org/GLM-5.3-Flash` / `nvidia/Nemotron-3_5-Lightning`): Rapid context triage, file scanning, and initial syntax validation.
   - `ADVANCED` (`nvidia/Nemotron-3-Ultra-550b-a55b`): High-complexity patch revision using raw execution failure tracebacks.
2. **Fail-Fast Quota & Rate Limit Protection:** Explicit guards on HTTP 402/429 halt execution immediately with `BLOCKED` status, preventing wasted budget and retry loops.
3. **Hardened JSON Extraction:** Employs non-greedy markdown fence stripping with outermost delimiter extraction and unescaped newline tolerance (`strict=False`), eliminating model syntax formatting failures.
4. **Linux & Container Security:** Production Docker compose stack running the backend as unprivileged user `proofpatch` (UID 10001), enforcing POSIX memory (`RLIMIT_AS = 512 MB`) and CPU time limits.

---

## 6. Demonstration & Evidence Interface
- **Clean Developer UI:** Styled in a warm, calm, high-contrast palette (soft `#F3EFEA` background, white rounded cards, pill tabs, stat cards, accessible typography).
- **Persistent Job History:** Backed by database queries (`GET /api/jobs`) with real-time status filtering and pagination.
- **Interactive Multi-File Diff Viewer:** Full syntax highlighting, line numbers, and copy actions for unified diffs.
- **Direct Export:** Instant download of verified `.patch` files and complete patched `.zip` project archives.

---

## 7. Truthful Disclosures & Known Limitations
In accordance with the hackathon's honesty requirements:
- Subprocesses execute with host network access (no Linux network namespaces or chroot jail).
- On Windows hosts, POSIX `RLIMIT_*` limits fall back to hard wall-clock timeouts.
- Patches require existing automated tests in the repository to establish verification; repositories without tests conclude with `NOT_VERIFIED`.

---

## 8. Submission Checklist
- [x] NVIDIA open-source models utilized on Nebius Token Factory.
- [x] Evidence-based verdict logic (zero self-certifying model claims).
- [x] Working Dockerfile and Docker Compose orchestration.
- [x] Full unit test coverage across pipeline (67 unit tests passing in Linux).
- [x] Open-source Apache 2.0 License.
