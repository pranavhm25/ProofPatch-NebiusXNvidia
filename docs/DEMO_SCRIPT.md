# ProofPatch — 3-Minute Demo Script

**Hackathon Track:** NVIDIA × Nebius Global AI Hackathon  
**Target Video Duration:** 2 minutes 50 seconds  
**Speaker:** Lead Developer / Demonstrator  

---

## [0:00 – 0:35] Part 1: The Problem & The Core Axiom

> *(Visual: Screen shows a typical AI coding tool outputting code with "Looks good! Tests should pass now!", followed by a split-screen error showing broken CI.)*

**Spoken Audio:**  
"Every software engineer has experienced this: an AI coding assistant generates a confident, plausible-looking code patch, tells you it fixed the bug, and when you open a pull request, CI turns red. The model didn't fix the bug—it hallucinated success.

We built **ProofPatch** around a single foundational axiom: **Evidence Over Assertion**. 

ProofPatch is a verification-first automated software repair agent. It never labels a bug fixed based on model prose. It downloads Python repositories, diagnoses defects using NVIDIA Nemotron models hosted on Nebius Token Factory, applies patches atomically to isolated working copies, and derives verdicts solely from real sandbox test execution."

---

## [0:35 – 1:30] Part 2: Architecture & Live Demonstration

> *(Visual: Switch to browser at `http://localhost:5173`. Show the warm, minimal, high-contrast UI. Click "Try Sample Bug".)*

**Spoken Audio:**  
"Let's see it in action. Here is the ProofPatch dashboard.

I'll upload a Python repository archive—or click our 1-click sample bug button. This repository has an off-by-logic bug where negative inputs in `absolute_value(-15)` return `-15` instead of `15`.

When I click **Analyze and Repair**, the backend initiates our multi-stage pipeline:
1. First, our **Archive Validator** checks the upload—rejecting path traversal, symlinks, and decompression bombs.
2. In the **Planning Stage**, our reasoning role on Nebius Token Factory—using NVIDIA's `Nemotron-3-Ultra-550b`—inspects repository context and synthesizes a structured repair hypothesis.
3. Next, in the **Patching Stage**, the model emits a validated unified diff.
4. Our **Atomic Patch Applier** applies this patch exclusively to a disposable working copy, leaving the original baseline immutable. Notice our hunk-tolerant parser: even if line numbers shift or context lines have minor hallucinations, it anchors safely on removed lines with strict uniqueness checks.
5. Finally, the **Sandbox Execution Engine** executes `pytest` in an isolated subprocess with all host API keys and tokens scrubbed, bounded by POSIX CPU and memory limits."

---

## [1:30 – 2:15] Part 3: Evidence-Backed Verdict & Artifacts

> *(Visual: Result page opens. Point to the green `VERIFIED` badge, duration metrics, multi-file diff viewer, raw stdout/stderr logs, and download buttons.)*

**Spoken Audio:**  
"The job reaches completion! Look at the result:
- The verdict badge reads **VERIFIED**—not because the model claimed it worked, but because the underlying test suite returned exit code zero with passing tests.
- We can inspect the clean unified diff showing the exact surgical one-line change.
- We have the full, raw test execution logs showing `pytest tests/test_calculator.py` passing in milliseconds.
- And with one click, developers can download the ready-to-merge `.patch` file or the complete patched repository `.zip` archive.

If the tests had failed, our bounded retry engine would have provided the failure logs back to the model for a single corrective revision, preventing infinite loops."

---

## [2:15 – 2:50] Part 4: Enterprise Safety, Nebius Infrastructure & Conclusion

> *(Visual: Show `docker-compose.yml` and `/security` page disclosing subprocess isolation truths and non-root execution.)*

**Spoken Audio:**  
"ProofPatch was built with production enterprise safety:
- It runs inside containerized Linux using Docker Compose as an unprivileged non-root user.
- Secrets are aggressively scrubbed from all execution environments.
- And all inference is powered by NVIDIA's high-performance open-source models hosted seamlessly on Nebius Token Factory's ultra-low latency infrastructure.

ProofPatch: Automated software repair where code is only trusted when proven. Thank you!"
