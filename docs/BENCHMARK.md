# ProofPatch — Automated Code Repair Benchmark Suite

> **Status:** Architecture and evaluation methodology frozen; formal model benchmark results are **PENDING live run** upon Nebius Token Factory budget restoration.

---

## 1. Overview & Evaluation Methodology

The ProofPatch evaluation suite tests automated software repair across 10 reproducible Python repositories (7 defect repair fixtures and 3 negative control fixtures).

### Strict Evaluation Axiom: Evidence Over Assertion
- **VERIFIED:** Pytest exit code is 0, at least 1 test was discovered and passed, and zero tests failed.
- **FAILED:** Pytest ran but tests failed (exit code != 0), or repair attempt failed schema/patch validation.
- **NOT_VERIFIED:** Repository executed without discovering tests, or executed in an indeterminate state.
- **BLOCKED:** Provider timeout, HTTP 402/429 quota exhaustion, or unrecoverable sandbox unavailability.

---

## 2. Benchmark Fixture Catalog

| Fixture Name | Category | Defect Type | Baseline Behavior | Intended Fix |
|---|---|---|---|---|
| `sample_buggy_repo.zip` | Logic / Arithmetic | Negative negation off-by-one | `absolute_value(-15) == -15` (Fails) | `return -n if n < 0 else n` |
| `fixture_off_by_one.zip` | Boundary | Slice index upper bound | Returns `items[:len(items)-1]` | Fix slice indexing to include full range |
| `fixture_wrong_operator.zip` | Operator | Comparison operator error | Uses `<` instead of `<=` | Correct comparison operator |
| `fixture_mutable_default.zip` | Python Semantics | Mutable default argument `def add(item, lst=[])` | State leaks across invocations | Change default to `None` and initialize inside |
| `fixture_exception_handling.zip` | Robustness | Uncaught `KeyError` / `IndexError` | Crashing on missing keys | Add defensive lookup / `try...except` |
| `fixture_multi_file.zip` | Multi-module | Dependency call mismatch across files | Module A passes incorrect args to Module B | Update interface invocation in caller |
| `fixture_large_module.zip` | Context Window | Targeted change in 500+ line module | Finding defect in large file context | Surgical one-line repair without breaking surrounding code |
| `fixture_unfixable.zip` | Negative Control | Contradictory requirements (A and not A) | Mathematically unsatisfiable test suite | Must terminate cleanly with `FAILED`, never `VERIFIED` |
| `fixture_zero_tests.zip` | Negative Control | Repository with zero test functions | Code runs but 0 tests discovered | Must conclude `NOT_VERIFIED`, never `VERIFIED` |
| `fixture_timeout.zip` | Negative Control | Infinite loop / `time.sleep(300)` | Subprocess hangs indefinitely | Hard timeout terminates process; reports `TIMED_OUT` |
| `fixture_memory_hog.zip` | Sandbox Limit | Unbounded virtual memory allocation (1 GB) | Exceeds 512 MB `RLIMIT_AS` | Fails with `MemoryError` without crashing host |

---

## 3. Robustness Hardening: Fix A and Fix B

The pipeline incorporates two enterprise robustness layers to prevent spurious patch application failures:

1. **Robustness Fix A (Bounded Apply Retry):**
   When a model-generated unified diff fails initial context application (`PATCH_APPLY_FAILED`), the orchestrator triggers a single bounded retry passing the real source file lines with 1-based line numbers and the patch apply error. Exactly one retry is allowed across the entire job lifecycle.

2. **Robustness Fix B (Hunk-Tolerant Patch Application):**
   When model hunk headers hallucinate line offsets or slightly misquote surrounding context lines, the applier anchors on the `-` (removed) lines.
   - **Strict Uniqueness Rule:** If the anchor matches more than once in the target file, application is strictly refused as ambiguous (`Ambiguous patch anchor`).
   - **Strict Removal Rule:** If the `-` lines do not exist in the file, application is refused (`Removed lines mismatch`).
   - **Clean Application:** When a unique anchor is identified, changes are applied surgically without injecting hallucinated context lines into the codebase.

---

## 4. Benchmark Execution Plan

```
Models Under Test:
- REASONING Role: nvidia/Nemotron-3-Ultra-550b-a55b
- FAST Role:      zai-org/GLM-5.3-Flash
- ADVANCED Role:  nvidia/Nemotron-3-Ultra-550b-a55b

Test Configuration:
- Trials: 5 independent trials per fixture across all 7 hint-free fixtures (35 trials total)
- Negative Controls: 1 run each for fixture_unfixable, fixture_zero_tests, fixture_timeout (3 runs)
- Total Estimated Model Invocations: ~80–100 calls (Plan + Patch + bounded Retry)
```

### Results Table

> [!NOTE]
> Formal live evaluation results will be populated here as soon as Nebius Token Factory credits are active. All test harnesses, mock verification suites, and Linux sandbox constraints are 100% verified locally.

| Model Config | Fixture | First-Attempt Pass | After-Retry Pass | Total Pass Rate | Mean Duration |
|---|---|---|---|---|---|
| Nemotron Ultra | `sample_buggy_repo` | *PENDING live run* | *PENDING live run* | *PENDING* | *PENDING* |
| Nemotron Ultra | `fixture_off_by_one` | *PENDING live run* | *PENDING live run* | *PENDING* | *PENDING* |
| Nemotron Ultra | `fixture_wrong_operator` | *PENDING live run* | *PENDING live run* | *PENDING* | *PENDING* |
| Nemotron Ultra | `fixture_mutable_default` | *PENDING live run* | *PENDING live run* | *PENDING* | *PENDING* |
| Nemotron Ultra | `fixture_exception_handling` | *PENDING live run* | *PENDING live run* | *PENDING* | *PENDING* |
| Nemotron Ultra | `fixture_multi_file` | *PENDING live run* | *PENDING live run* | *PENDING* | *PENDING* |
| Nemotron Ultra | `fixture_large_module` | *PENDING live run* | *PENDING live run* | *PENDING* | *PENDING* |
| Nemotron Ultra | `fixture_unfixable` | Negative Control | Negative Control | Expected: FAILED | *PENDING* |
| Nemotron Ultra | `fixture_zero_tests` | Negative Control | Negative Control | Expected: NOT_VERIFIED | *PENDING* |
| Nemotron Ultra | `fixture_timeout` | Negative Control | Negative Control | Expected: TIMED_OUT | *PENDING* |

---

## 5. Truthful Disclosures
- Benchmark metrics quoted in submission materials will come strictly from recorded logs in `benchmark_results.json`.
- No mock data or synthetic successes will ever be passed off as live model benchmarks.
