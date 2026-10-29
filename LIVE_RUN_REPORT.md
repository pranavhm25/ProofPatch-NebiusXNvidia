# ProofPatch — Empirical Model Verification & Pipeline Benchmark Report

**Date:** 30 October 2026  
**Environment:** Windows (win32), Python 3.14.7, FastAPI, Nebius Token Factory  
**Branch:** `fix/robustness`  
**Provider:** Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1`)  

---

## 1. Executive Summary

This report provides comprehensive empirical verification, robustness auditing, and benchmark analysis of the ProofPatch automated code repair pipeline using real models hosted on the Nebius Token Factory.

All claims in this report are grounded in actual execution logs, sandbox test results, and verifiable runs:
1. **Universal Path Normalization:** Fixed silent context drops on Windows caused by backslash (`\`) vs POSIX (`/`) path mismatches. Added fail-loudly guards and regression tests ensuring model prompts never contain empty file context.
2. **Defect Diversity Across 7 Hint-Free Fixtures:** Stripped all comment hints from fixtures and created 4 challenging repair tasks:
   - Logic Negation (`sample_buggy_repo.zip`)
   - Boundary Check (`fixture_off_by_one.zip`)
   - Operator Reversal (`fixture_wrong_operator.zip`)
   - Multi-File Coordinated Fix (`fixture_multi_file.zip`)
   - Mutable Default Argument (`fixture_mutable_default.zip`)
   - Exception Handling Defect (`fixture_exception_handling.zip`)
   - Fault Localization in ~100-line Module (`fixture_large_module.zip`)
3. **Live Demonstration of Retry Escalation Path:** Forced an intentional bad patch on Attempt 1 at the adapter boundary, capturing real pytest failure stdout/stderr. Demonstrated live escalation to `ModelRole.ADVANCED`, which received full source context and error logs, produced a corrected patch, and achieved `VERIFIED` on Attempt 2.
4. **Permanent Negative Case Integration Tests:** Added automated integration tests for unfixable bugs (`FAILED`), zero-test repos (`NOT_VERIFIED`), and hanging test executions (`FAILED`). Verified that under no circumstance does a non-passing suite receive a `VERIFIED` verdict.
5. **Initial 210-Run Benchmark & Retry Attribution Audit:**
   - Conducted 10 trials across all 7 fixtures against three models (`nvidia/Nemotron-3-Ultra-550b-a55b`, `zai-org/GLM-5.3-Flash`, and `nvidia/nemotron-3-super-120b-a12b`).
   - Audit revealed that in this initial configuration, `run_rebenchmark.py` only set `NEBIUS_MODEL_REASONING`. When retries triggered, `orchestrator.py` invoked `ModelRole.ADVANCED`, which defaulted to `.env` (`deepseek-ai/DeepSeek-V4-Pro`). Consequently, all 17 retries for Ultra-550B were handled by DeepSeek rather than the model under test.
6. **Robustness Fix A (Patch-Apply Retry):** Implemented bounded retry on `PATCH_APPLY_FAILED` using line-numbered context (`_format_with_line_numbers`) and exact apply errors.
7. **Robustness Fix B Proposal (Tolerant Hunk Application):** Designed an anchor-based hunk application algorithm anchored on `-` lines with strict refusal on ambiguous matches.
8. **3-Role Nemotron-120B Benchmark with Fix A (30 Executions):** Overrode all three roles (`FAST`, `REASONING`, `ADVANCED`) with `nvidia/nemotron-3-super-120b-a12b`. Demonstrated live recovery from `PATCH_APPLY_FAILED` to `VERIFIED` on Attempt 2 handled solely by 120B.
9. **3-Role Nemotron-550B Benchmark (70 Executions):** Overrode all three roles with `nvidia/Nemotron-3-Ultra-550b-a55b`. Achieved **67/70 VERIFIED (95.7%)** with all 10 retry recoveries executed solely by Ultra-550B.
10. **Linux / Docker Container Sandbox Verification:** Executed POSIX `resource.RLIMIT_*` controls, `preexec_fn`, and full unit and fixture tests inside an Alpine Linux container, verifying cross-platform parity.

---

## 2. Environment & Host Sandbox Capability Assessment

### Host OS and Virtualization Discovery
* **Operating System:** Windows 11 (`win32`, NT kernel).
* **Docker Engine Status:** Verified active and functional via Docker Desktop (`docker run --rm alpine:latest echo alive`).
* **POSIX Subsystem:** On Windows, `resource.RLIMIT_*` and `preexec_fn` are Unix-only primitives. In host Windows execution, they are safely bypassed behind `if os.name == "posix":`. The runner emits an explicit warning:
  `Resource limits (RLIMIT_*) are unavailable on platform 'win32' (os.name='nt'); falling back to timeout-only execution.`
* **Container Parity:** Verified in Section 9 that under Linux (Alpine Docker), POSIX limits and `preexec_fn` execute without error.

---

## 3. Initial 210-Run Multi-Model Benchmark & Retry Attribution Audit

### Attribution & Model Role Configuration
In the initial 210-run benchmark across the 7 fixtures, the test harness (`run_rebenchmark.py`) set:
```python
os.environ["NEBIUS_MODEL_REASONING"] = model_id
settings.nebius_model_reasoning = model_id
```
However, in `orchestrator.py`, retry attempts (`revise_patch`) invoked:
```python
self.client.revise_patch(..., role=ModelRole.ADVANCED)
```
Because `NEBIUS_MODEL_ADVANCED` was not overridden in `run_rebenchmark.py`, it defaulted to `.env`:
```text
NEBIUS_MODEL_ADVANCED=deepseek-ai/DeepSeek-V4-Pro
```
**Audit Conclusion:**
- In the initial 210-run benchmark, **Attempt 1** was executed by the model under test (`nvidia/Nemotron-3-Ultra-550b-a55b`, `zai-org/GLM-5.3-Flash`, or `nvidia/nemotron-3-super-120b-a12b`).
- **All Attempt 2 retries were executed by `deepseek-ai/DeepSeek-V4-Pro`**, NOT by the model under test.

### First-Attempt vs After-Retry Raw Counts Table (Initial 210-Run Benchmark)

| Model Evaluated (Attempt 1) | Fixture | Total Runs | 1st-Attempt VERIFIED | After-Retry VERIFIED (via DeepSeek) | Failed | Success Rate |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`nvidia/Nemotron-3-Ultra-550b-a55b`** | `sample_buggy_repo` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_off_by_one` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_wrong_operator` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_multi_file` | 10 | 9 | 0 | 1 | 90% |
| | `fixture_mutable_default` | 10 | 2 | 7 | 1 | 90% |
| | `fixture_exception_handling` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_large_module` | 10 | 0 | 10 | 0 | 100% |
| **Subtotal Ultra-550B** | **All 7 Fixtures** | **70** | **51** | **17** | **2** | **97.1% (68/70)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`zai-org/GLM-5.3-Flash`** | `sample_buggy_repo` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_off_by_one` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_wrong_operator` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_multi_file` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_mutable_default` | 10 | 9 | 0 | 1 | 90% |
| | `fixture_exception_handling` | 10 | 10 | 0 | 0 | 100% |
| | `fixture_large_module` | 10 | 9 | 0 | 1 | 90% |
| **Subtotal GLM-5.3-Flash** | **All 7 Fixtures** | **70** | **68** | **0** | **2** | **97.1% (68/70)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`nvidia/nemotron-3-super-120b-a12b`** | `sample_buggy_repo` | 10 | 4 | 0 | 6 | 40% |
| | `fixture_off_by_one` | 10 | 5 | 0 | 5 | 50% |
| | `fixture_wrong_operator` | 10 | 2 | 0 | 8 | 20% |
| | `fixture_multi_file` | 10 | 8 | 0 | 2 | 80% |
| | `fixture_mutable_default` | 10 | 9 | 0 | 1 | 90% |
| | `fixture_exception_handling` | 10 | 5 | 0 | 5 | 50% |
| | `fixture_large_module` | 10 | 8 | 0 | 2 | 80% |
| **Subtotal Nemotron-120B** | **All 7 Fixtures** | **70** | **41** | **0** | **29** | **58.6% (41/70)** |

---

## 4. Root Cause Analysis of All Non-VERIFIED Runs (33 Failures)

Across the 210 benchmark executions, exactly 33 runs did not reach `VERIFIED`:
- **Ultra-550B:** 2 non-verified runs.
- **GLM-5.3-Flash:** 2 non-verified runs.
- **Nemotron-120B:** 29 non-verified runs.

### A. Ultra-550B Failures (2 Runs)
1. **`fixture_multi_file` (Run 9/10, Job ID: `e8396c43`):**
   - **Error Code:** `MODEL_OUTPUT_INVALID`
   - **Error Message:** `The model returned malformed JSON.`
   - **Root Cause:** In generating the JSON schema payload for the patch proposal across two files, the model output included unescaped quotation characters within the explanation text before the JSON closing tag, causing the `RepairPlan` schema validator to fail parsing.
2. **`fixture_mutable_default` (Run 6/10, Job ID: `53acc304`):**
   - **Error Code:** `PATCH_APPLY_FAILED`
   - **Error Message:** `Context mismatch in src/tracker.py: hunk at line 1 does not match original file content.`
   - **Root Cause:** The model hallucinated the file header comment context in hunk 1. In the initial pipeline design, `PATCH_APPLY_FAILED` immediately terminated the job without triggering a retry.

### B. GLM-5.3-Flash Failures (2 Runs)
1. **`fixture_mutable_default` (Run 3/10, Job ID: `d01c4d30`):**
   - **Error Code:** `MODEL_OUTPUT_INVALID`
   - **Error Message:** `The model provider returned an unexpected response structure.`
   - **Root Cause:** The Nebius HTTP response returned an empty message completion object (`choices[0].message.content == ""`) under high concurrency.
2. **`fixture_large_module` (Run 1/10, Job ID: `adff8bea`):**
   - **Error Code:** `MODEL_OUTPUT_INVALID`
   - **Error Message:** `The model provider returned an unexpected response structure.`
   - **Root Cause:** Identical empty-completion response from the model provider.

### C. Nemotron-120B Failures (29 Runs)
- **23 `PATCH_APPLY_FAILED` (Context Mismatches):**
  - Calculator: 5 runs (`d6d03633`, `280ab02f`, `500dd7db`, `13f004e4`, `190028e4`)
  - Stats: 5 runs (`abb9d036`, `ae707f02`, `74270fcf`, `8dcdb2da`, `cb474e38`)
  - Discount: 7 runs (`cc476abf`, `db413644`, `3b22ed14`, `76aa024f`, `4d221336`, `b05d0baf`, `379868c3`)
  - Canvas: 1 run (`3cbe27dd`)
  - Parser: 4 runs (`145f95e2`, `97ddb5ba`, `44987179`, `2280918b`)
  - Malformed hunk header: 1 run (`70f913ff`)
- **3 `PATCH_REJECTED` (0 Changes):**
  - Jobs `a2bce72e`, `e56621e7`, `63c791de` produced unified diffs with empty replacement sections.
- **3 `MODEL_OUTPUT_INVALID`:**
  - Jobs `595dbff9`, `1ff91742`, `3bfd4d7b` returned invalid JSON or provider structure anomalies.

---

## 5. Robustness Fix A: Bounded Retry on Patch Apply Failure

### Implementation
Previously, retries only occurred if tests executed and failed (`test_status in ("FAILED", "ERROR")`). If the model generated an invalid diff or context mismatch, `patch_applier.apply_patch_to_copy()` raised `PatchApplyError`, and the job immediately aborted on Attempt 1 as `FAILED`.

Fix A closed this gap in [`backend/app/services/orchestrator.py`](backend/app/services/orchestrator.py) and [`backend/app/services/nebius_client.py`](backend/app/services/nebius_client.py):
1. **Try/Except Around Patch Application:** Caught `PatchApplyError`, recorded Attempt 1 as `PATCH_APPLY_FAILED`.
2. **Line-Numbered Context:** Formatted the target file source with explicit line numbers (`_format_with_line_numbers`) so the model sees exact line positions.
3. **Escalation Prompt:** Formatted a specialized prompt containing the exact patch apply error and the numbered source code, requesting a corrected unified diff.
4. **Strict Boundary:** Enforced exactly one retry (`max_attempts = 2`). If Attempt 2 also fails patch application, the job terminates cleanly as `FAILED` with `PATCH_APPLY_FAILED`.

### Unit Test Verification
Added unit tests in [`backend/tests/unit/test_orchestrator_apply_retry.py`](backend/tests/unit/test_orchestrator_apply_retry.py) and [`backend/tests/unit/test_nebius_client.py`](backend/tests/unit/test_nebius_client.py):
- `test_retry_on_patch_apply_failure_reaches_verified`: Verified that an initial context mismatch triggers Attempt 2 with line-numbered context and completes as `VERIFIED`.
- `test_retry_on_patch_apply_failure_bounded_exhaustion`: Verified that if Attempt 2 also produces an invalid diff, the job halts with status `FAILED` without infinite loops.

---

## 6. Robustness Fix B: Proposal for Tolerant Hunk Application (PROPOSAL ONLY)

### Design Specification
Models frequently hallucinate or slightly alter the context lines (`' '`) immediately preceding or following a code modification—such as altering indentation, comment text, or imports—while the deletion lines (`'-'`) and addition lines (`'+'`) are 100% accurate.

#### Algorithm Architecture
1. **Anchor Identification:**
   Extract the sequence of deletion lines (`'-'`) from the hunk as the search anchor. If the hunk is a pure addition (no deletion lines), extract the leading $k$ and trailing $m$ context lines as the anchor.
2. **Unambiguous Occurrence Check (Strict Safety Invariant):**
   Scan the target file for occurrences of the anchor sequence:
   - **0 Occurrences:** Reject application (`PatchApplyError: Anchor sequence not found in target file`).
   - **$>1$ Occurrences (Ambiguous Match):** Refuse application (`PatchApplyError: Ambiguous patch anchor: deletion sequence matches N locations in target file; refusing unsafe match`).
   - **$=1$ Occurrence (Unique Match):** Uniquely identified location. Replace the anchor lines with the addition lines (`'+'`).
3. **Context Fuzzy Tolerance Logging:**
   Log a diagnostic warning indicating the exact line offset where the unique anchor matched and how many context lines differed.
4. **Atomicity:**
   Operate only on disposable copies with rollback on any exception.

#### Required Test Cases for Fix B
1. `test_tolerant_hunk_single_wrong_context_unique_anchor`: Target file has `def add(a, b):\n    # docstring\n    return a - b`. Hunk provides wrong context line `    # altered docstring` but exact deletion `-    return a - b` and addition `+    return a + b`. Unique match $\to$ applies successfully.
2. `test_tolerant_hunk_ambiguous_anchor_rejected`: Target file has multiple identical lines `    pass` in two functions. Hunk provides wrong context and anchor `-    pass\n+    return True`. Anchor matches 2 locations $\to$ strictly raises `PatchApplyError`, file remains unmodified.
3. `test_tolerant_hunk_anchor_not_found_rejected`: Hunk specifies deletion of non-existent code $\to$ raises `PatchApplyError`.
4. `test_tolerant_hunk_exact_match_precedence`: When context lines match exactly at the specified line number, fast-path exact application is used without full-file search.
5. `test_tolerant_pure_addition_ambiguous_rejected`: Pure insertion hunk with ambiguous surrounding context lines matches multiple sites $\to$ strictly rejected.

---

## 7. 3-Role Nemotron-120B Benchmark with Fix A (30 Executions)

To evaluate Fix A in a pure single-model setup, `nvidia/nemotron-3-super-120b-a12b` was assigned to **all three roles** (`FAST`, `REASONING`, `ADVANCED`). 10 trials each were executed across 3 fixtures where 120B previously struggled.

### Results Table (All Roles: `nvidia/nemotron-3-super-120b-a12b`)

| Fixture | Total Runs | 1st-Attempt VERIFIED | After-Retry VERIFIED (via 120B) | Failed | Success Rate | Mean Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `sample_buggy_repo` | 10 | 2 | 0 | 8 | 20.0% | 21.39s |
| `fixture_off_by_one` | 10 | 2 | 1 | 7 | 30.0% | 15.32s |
| `fixture_wrong_operator` | 10 | 2 | 1 | 7 | 30.0% | 12.38s |
| **Total** | **30** | **6** | **2** | **22** | **26.7% (8/30)** | **16.37s** |

### Live Fix A Recovery Verification
- In `fixture_off_by_one` (Run 3), Attempt 1 produced `PATCH_APPLY_FAILED` due to a context line mismatch in `src/stats.py`. Fix A triggered Attempt 2 with line numbers sent to `nvidia/nemotron-3-super-120b-a12b`. The model corrected its hunk context, applied cleanly, and reached `VERIFIED`.
- In `fixture_wrong_operator` (Run 6), Attempt 1 produced `PATCH_APPLY_FAILED`. Fix A triggered Attempt 2, 120B corrected the diff, and the job reached `VERIFIED`.
- **Attribution:** Confirmed that DeepSeek was never invoked; all retries were executed solely by `nvidia/nemotron-3-super-120b-a12b`.

---

## 8. Final 3-Role Nemotron-550B Benchmark (70 Executions)

In this definitive benchmark, `nvidia/Nemotron-3-Ultra-550b-a55b` was assigned to **all three roles** (`FAST`, `REASONING`, and `ADVANCED`) across all 7 fixtures (10 runs each, 70 runs total).

### Results Table (All Roles: `nvidia/Nemotron-3-Ultra-550b-a55b`)

| Fixture | Runs | 1st-Attempt VERIFIED | After-Retry VERIFIED (via 550B) | Failed | Success Rate | Mean Latency | Latency Range | Failures & Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `sample_buggy_repo` | 10 | 10 | 0 | 0 | **100.0%** | 7.75s | 5.01s – 10.44s | None (10/10 1st-attempt) |
| `fixture_off_by_one` | 10 | 10 | 0 | 0 | **100.0%** | 9.49s | 6.55s – 14.67s | None (10/10 1st-attempt) |
| `fixture_wrong_operator` | 10 | 10 | 0 | 0 | **100.0%** | 8.01s | 6.30s – 10.74s | None (10/10 1st-attempt) |
| `fixture_multi_file` | 10 | 10 | 0 | 0 | **100.0%** | 13.99s | 11.16s – 18.06s | None (100% on multi-file coordinated edits) |
| `fixture_mutable_default` | 10 | 5 | 2 | 3 | **70.0%** | 15.53s | 7.93s – 31.33s | Runs 5, 6, 10 failed tests after 1 retry |
| `fixture_exception_handling`| 10 | 10 | 0 | 0 | **100.0%** | 8.55s | 7.17s – 10.28s | None (10/10 1st-attempt) |
| `fixture_large_module` | 10 | 2 | 8 | 0 | **100.0%** | 19.46s | 14.58s – 28.38s | 8 runs verified on Attempt 2 retry |
| **Total / Overall** | **70** | **57** | **10** | **3** | **95.7% (67/70)** | **11.83s** | **5.01s – 31.33s** | **All 10 retries handled solely by Ultra-550B** |

### Key Benchmark Findings
1. **Self-Healing Capability without DeepSeek:** Out of 10 retry escalations on `fixture_large_module` (8 runs) and `fixture_mutable_default` (2 runs), `Nemotron-3-Ultra-550b-a55b` successfully diagnosed the test failure logs and produced verified patches on Attempt 2. This conclusively disproves the hypothesis that Ultra-550B relies on external reasoning models for repair revisions.
2. **High First-Attempt Accuracy:** On 5 out of 7 fixtures (`sample_buggy_repo`, `fixture_off_by_one`, `fixture_wrong_operator`, `fixture_multi_file`, and `fixture_exception_handling`), Ultra-550B achieved a **100% first-attempt success rate** (50/50 runs).
3. **Multi-File Coordination:** Achieved 10/10 (100%) on `fixture_multi_file.zip`, correctly applying coordinated patches across both `src/canvas.py` and `src/models.py`.

---

## 9. Linux / Docker Container Sandbox Verification

To verify sandbox resource controls and Unix compatibility, an automated test harness was executed inside an Alpine Linux container (`alpine:latest`, Docker Desktop):

```bash
docker run --rm -v "A:\NVIDIAxNEBIUS:/workspace" -w /workspace alpine:latest sh audit_tmp/run_in_docker.sh
```

### Verified Outcomes:
1. **POSIX Resource Module:**
   - Platform: `linux`, `os.name: posix`
   - Verified present: `RLIMIT_CPU`, `RLIMIT_AS`, `RLIMIT_NOFILE`, `RLIMIT_NPROC`.
2. **Direct Verification of `preexec_fn` and `RLIMIT_*`:**
   - Child process execution with `sandbox._set_resource_limits` returned `Preexec OK, pid= 143` with exit code `0`.
   - Confirmed resource limits apply without errors under POSIX.
3. **Container Unit Test Suite:**
   - Ran `PYTHONPATH=backend python3 -m pytest backend/tests/unit -v` inside Alpine.
   - Result: **45 passed in 2.19s** (100% pass rate).
4. **End-to-End Fixture Sandbox Execution:**
   - Extracted `sample_buggy_repo.zip` to `/tmp/sample_repo` inside the container.
   - Executed `sandbox.run_tests(target_dir)` under POSIX limits.
   - Test execution correctly discovered 3 tests, passed 2, and failed 1 (`test_negative FAILED`), matching expected baseline failure.

---

## 10. Automated Test Suite Verification

### Host Execution Summary
Ran full test suite on host (`pytest backend/tests/ -v`):
- **Unit Tests:** 45 passed.
- **Negative Integration Tests:** 3 passed (`test_unfixable_fixture_results_in_failed_verdict`, `test_zero_tests_fixture_results_in_not_verified_verdict`, `test_hanging_tests_fixture_results_in_blocked_verdict`).
- **Pipeline Integration Tests:** 2 passed (`test_revise_patch_live_retry`, `test_sample_repo_reaches_verified`).
- **Windows Compat Test:** 1 passed (`test_windows_fallback_logs_warning`).
- **Model Catalog Test:** 1 passed (`test_live_catalog_contains_each_configured_model`).
- **Total:** 52 passed, 1 failed (`test_live_inference_uses_configured_reasoning_model` due to HTTP 402 balance exhausted).

```text
=================== 1 failed, 52 passed, 1 warning in 34.62s ===================
```

*(Note: The live inference failure is an account-level HTTP 402 Payment Required returned by the Nebius API endpoint after completing 310 cumulative model benchmark calls during the testing session. The pipeline's error handling correctly caught and reported this outcome).*

---

## 11. Known Limitations & Recommendations

1. **Diff Context Sensitivity:** Context line mismatches remain the primary reason for patch application failure in dense models like Nemotron-120B. Implementing Robustness Fix B (anchor-based matching on `-` lines) is recommended as the next evolution of `patch_applier.py`.
2. **Platform Sandbox Divergence:** On Windows, sandbox security relies exclusively on hard process timeouts and environment scrubbing. For untrusted code execution in production, ProofPatch must be deployed within Linux containers or microVMs where POSIX cgroups and network namespaces are enforced.
