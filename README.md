# ProofPatch Project Documentation

This directory contains the implementation baseline for ProofPatch.

## Documents
- `PRD.md` — Product requirements, goals, scope, acceptance criteria, risks.
- `TRD.md` — Technical requirements, API behavior, security, testing, deployment.
- `ARCHITECTURE.md` — System components, data flow, trust boundaries, diagrams.
- `AGENTS.md` — Contributor and model-agent operating rules.
- `BACKEND_SCHEMA.md` — API contracts, state enums, persistence schema, verdict rules.
- `DESIGN.md` — UI structure, screen requirements, visual system, interaction and demo.
- `MEMORY.md` — Stable decisions, verified facts to collect, open questions, decision log.
- `TASKS.md` — Workstream-based implementation plan through the hackathon deadline.

## Important implementation gates
1. Confirm the actual NVIDIA model ID and Token Factory access.
2. Confirm the supported sandbox API and permissions required for the chosen track.
3. Do not claim sandbox integration until it has been tested with a real execution.
4. Never commit credentials or uploaded source code.
5. Never mark a repair verified based only on model-generated text.

These documents define the planned system. They do not imply that infrastructure access or any feature has already been verified.
