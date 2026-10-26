# ProofPatch

> **Verification-First Automated Code Repair for Python Repositories**  
> *Built for the NVIDIA × Nebius Global AI Hackathon*

---

## 1. Overview

**ProofPatch** is a verification-first coding agent that investigates reported defects in Python repositories, generates targeted minimal patches using NVIDIA open-source models hosted on **Nebius Token Factory**, applies changes to isolated working copies, and derives honest verdicts backed exclusively by actual test execution.

### The Core Axiom: Evidence Over Assertion
AI coding assistants often produce plausible-looking patches that fail tests, break existing functionality, or hallucinate fixes. ProofPatch strictly separates:
1. **Proposed Changes:** What the model suggests changing and why.
2. **Executed Verification:** Actual test runner exit codes, durations, and output streams.
3. **Claims Supported by Evidence:** A patch is **never** labeled `VERIFIED` based on model prose. Only zero exit codes with positive discovered test cases can establish a verified repair.

---

## 2. Architecture & Workflow

```mermaid
flowchart LR
    subgraph Client
        UI[React + Vite Web UI]
    end
    subgraph Backend [FastAPI Monolith]
        API[API Router]
        ARCH[Archive Validator]
        ORCH[Job Orchestrator]
        LLM[Nebius Token Factory Adapter]
        PATCH[Atomic Patch Applier]
        BOX[Isolated Subprocess Sandbox]
        VERIFY[Verdict Engine]
        DB[(SQLite Persistence)]
    end
    subgraph External [Nebius AI Cloud]
        NVIDIA[NVIDIA Open-Source Model]
    end

    UI -->|1. Upload ZIP + Bug Report| API
    API --> ARCH
    ARCH -->|Validated Workspace| ORCH
    ORCH -->|2. Context + Diagnostics| LLM
    LLM <-->|OpenAI-Compatible REST| NVIDIA
    ORCH -->|3. Validated Unified Diff| PATCH
    PATCH -->|4. Disposable Copy| BOX
    BOX -->|5. Run pytest| BOX
    BOX -->|6. Raw Output + Exit Code| VERIFY
    VERIFY -->|7. Evidence-Backed Verdict| DB
    UI <-->|Poll Status & Inspect Diff| API
```

### Repair Lifecycle
1. **Upload & Inspection:** Users upload a `.zip` Python archive (max 20 MB). Traversal attacks (`..`), symlinks, caches, and secret files are rejected/excluded.
2. **Diagnosis & Planning:** The NVIDIA model produces a structured `RepairPlan` with root-cause hypothesis and target files.
3. **Patch Generation:** Model returns a unified diff patch (`PatchProposal`), validated for size and target paths.
4. **Isolated Execution:** Pytest runs inside a sandboxed subprocess with environment scrubbing (all API keys removed) and resource limits.
5. **Bounded Retry:** If tests fail, exactly one retry is attempted by passing actual stdout/stderr failure logs back to the model.
6. **Verdict & Export:** Verdict (`VERIFIED`, `NOT_VERIFIED`, `FAILED`, `BLOCKED`) is computed. Users can inspect diffs, test logs, and download `.patch` or patched `.zip` files.

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS | High-contrast, evidence-driven developer UI |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2 | Async REST API & strict boundary validation |
| **Persistence** | SQLite 3 (WAL mode) | Relational job, attempt, and event metadata |
| **Model Platform** | Nebius Token Factory | OpenAI-compatible REST inference for NVIDIA models |
| **Model Family** | NVIDIA Open-Source (e.g., Nemotron) | Low-variance planning and patch generation |
| **Test Runner** | pytest | Automated test execution |

---

## 4. Getting Started

### Prerequisites
- Python 3.11+
- Node.js v18+ and npm
- Nebius Token Factory API key and configured role model IDs

### 1. Backend Setup
```bash
# Clone repository
git clone https://github.com/pranavhm25/ProofPatch-NebiusXNvidia.git
cd ProofPatch-NebiusXNvidia

# Configure environment
cp .env.example .env
# Set NEBIUS_API_KEY and the three role model IDs in .env.
# Confirm IDs with the authenticated Token Factory catalog before use.

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```bash
# In a new terminal window
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Testing & Verification

### Run Backend Unit Tests
Execute the comprehensive test suite covering archive traversal protection, atomic patch application, verdict logic, and REST endpoints:
```bash
PYTHONPATH=backend pytest backend/tests/unit -v
```

### Verify Token Factory Connectivity
The optional live check compares every configured model ID with the account's
authenticated `/models` catalog and makes one real inference request using the
configured reasoning model. It requires the API key and role IDs in `.env` and
may consume credits:
```bash
PYTHONPATH=backend pytest backend/tests/integration/test_live_nebius.py -v
```

### Sample Bug Fixture
A pre-packaged buggy repository is available at:
`backend/tests/fixtures/sample_buggy_repo.zip`  
Contains a known off-by-logic bug in `absolute_value(-15) == 15` ready for demonstration and verification.

---

## 6. Security Boundaries

- **Untrusted Source Code:** Uploaded archives are treated as untrusted data. Directory traversal, decompression bombs, and absolute paths are rejected.
- **Environment Scrubbing:** Test execution subprocesses scrub all environment variables starting with `NEBIUS`, `TOKEN`, `KEY`, `SECRET`, and `API_KEY`.
- **Ephemeral Storage:** Workspaces and artifacts are scheduled for deletion after 60 minutes.
- **Zero Host Writes:** Patches are applied strictly inside disposable working copies; the baseline upload remains immutable.

---

## 7. License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
