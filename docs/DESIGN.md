# ProofPatch — Product Design Specification

**Version:** 1.0  
**Design direction:** Technical, calm, evidence-led, minimal  
**Primary users:** Developers reviewing an automated repair  
**Primary action:** Submit a repository and inspect a repair result

## 1. Design Goals

1. Make the workflow understandable without a tutorial.
2. Keep the difference between AI-generated proposals and executed evidence visually explicit.
3. Surface failure states as clearly as success states.
4. Prioritize code readability and diff inspection over decorative dashboard elements.
5. Make the demo feel like a usable developer tool rather than a marketing landing page.
6. Keep the interface accessible, responsive, and quick to scan.

## 2. Information Architecture

Primary application areas:
- **New repair:** Upload a project and describe a defect.
- **Repair progress:** Track job stage and current action.
- **Repair result:** Review verdict, test evidence, changed files, diff, logs, and exports.
- **About / technical details:** Explain model attribution, Nebius integration, limitations, and privacy behavior.

Do not add a complex dashboard, user management, organization settings, or billing interface to the MVP.

## 3. Main User Flow

```mermaid
flowchart TD
    A[Open ProofPatch] --> B[Upload Python ZIP]
    B --> C{Archive valid?}
    C -- No --> D[Show actionable validation error]
    D --> B
    C -- Yes --> E[Enter bug report]
    E --> F[Start repair]
    F --> G[Show live job stage]
    G --> H{Job terminal?}
    H -- No --> G
    H -- Yes --> I[Show verdict and evidence]
    I --> J[Inspect diff and logs]
    J --> K[Download patch or ZIP]
```

## 4. Screen Specifications

### 4.1 Landing / New Repair

**Purpose:** Start a repair with minimal friction.

Elements:
- Wordmark: ProofPatch.
- Short statement: “Repair code. Verify the change.”
- One-paragraph explanation: ProofPatch proposes a patch, runs tests in an isolated environment, and reports what the tests actually establish.
- ZIP dropzone with browse action.
- Supported format and upload limit.
- Privacy note describing processing and temporary retention.
- Disabled state until a valid file is selected.
- After validation, show project name, file count, and detected language.
- Bug report textarea.
- Optional expected/observed behavior fields, collapsed or visually secondary.
- Primary CTA: “Analyze and repair”.
- Small technical note identifying the configured NVIDIA model through Nebius Token Factory after configuration is confirmed.

Avoid unsupported claims such as “guaranteed fix,” “fully secure,” or “zero bugs.”

### 4.2 Progress Screen

Show:
- Job ID in copyable form.
- A vertical stage timeline:
  1. Validating repository
  2. Inspecting source
  3. Planning repair
  4. Generating patch
  5. Running tests
  6. Optional retry
  7. Preparing report
- Current stage highlighted.
- Completed stages use a neutral completed indicator.
- Failed or blocked stages show a distinct warning/error state.
- Safe progress message and elapsed time.
- Cancel action only if cancellation is implemented reliably.
- No fake percentages derived from elapsed time. If a percentage is shown, label it approximate.

### 4.3 Result Screen

Header:
- Verdict label: `VERIFIED`, `NOT VERIFIED`, `FAILED`, or `BLOCKED`.
- One-sentence explanation.
- Model/provider attribution and total attempts.

Summary cards:
- Tests passed / failed / discovered.
- Duration.
- Changed files.
- Attempts.

Main sections:
1. **What changed:** short model-generated summary, explicitly labeled as explanation.
2. **Test evidence:** actual command identifier, exit code, duration, test output.
3. **Code diff:** unified diff with syntax highlighting and file navigation.
4. **Attempt history:** initial attempt and optional retry.
5. **Limitations:** no-tests, timeout, truncated output, incomplete verification, or other warnings.
6. **Export:** download patch and patched ZIP.

The verdict must be calculated by the backend and never inferred from the summary text.

### 4.4 Error and Empty States

Examples:
- Invalid ZIP: explain accepted format and how to create a ZIP without a parent-directory wrapper if needed.
- Unsupported project: state that the MVP currently supports Python projects.
- Provider unavailable: explain that model access is temporarily unavailable and no repair was verified.
- Sandbox unavailable: explain that execution could not be completed; do not show a success badge.
- No tests found: explain that the code may have been changed but the system could not establish a verified fix.
- Test failure: show failing test output and the retry count.
- Expired artifact: explain that temporary files have expired and the user must upload again.

## 5. Visual System

### Color roles
Use a neutral dark or light developer-tool theme. Choose one base theme and ensure contrast. Suggested semantic roles:
- Background: neutral slate/charcoal or near-white.
- Surface: slightly elevated neutral surface.
- Text: high-contrast neutral.
- Primary action: restrained blue or violet.
- Success: green reserved for verified evidence.
- Warning: amber for incomplete or cautionary states.
- Error: red for failed or blocked states.
- Borders: subtle neutral.
- Diff additions/deletions: standard green/red backgrounds with text contrast.

Do not use color alone to communicate state; pair it with text and icons.

### Typography
- UI font: system sans-serif or a bundled, properly licensed modern sans font.
- Code font: system monospace.
- Use a clear type scale: page title, section title, body, secondary text, metadata.
- Keep body text comfortably readable.
- Avoid oversized marketing headlines in the main workflow.

### Spacing and layout
- 8-point spacing rhythm.
- Main content maximum width around 1,200 px.
- Form width comfortable for reading.
- Results page can use a two-column layout on desktop: file list on the left, diff/report on the right.
- Collapse to one column on small screens.
- Preserve visible navigation and clear focus states.

### Components
- `Button`: primary, secondary, destructive/disabled as needed.
- `Dropzone`: idle, drag-over, uploading, accepted, rejected.
- `Textarea`: label, helper text, character count, error.
- `StatusBadge`: all job/verdict states.
- `StageTimeline`: pending, active, completed, failed, blocked.
- `MetricCard`: test counts, duration, changed files.
- `DiffViewer`: file selector, additions/deletions, copy/download.
- `LogPanel`: bounded output, expand/collapse, truncation notice.
- `AttemptCard`: attempt number, patch hash, test status, duration.
- `Alert`: info, warning, error, success.
- `EmptyState`: clear next action.

## 6. Interaction Rules

- Primary action is disabled until required inputs are valid.
- While a job is active, prevent accidental duplicate submission.
- Polling failures must not erase the last known job state.
- On browser refresh, the UI should be able to reload the job by ID if session association permits.
- Use optimistic UI only for local actions such as selecting a file; never optimistically mark backend stages complete.
- Diff and logs should remain accessible after the job ends.
- Copy actions show confirmation.
- Downloads show a clear error if the artifact has expired.
- Model-generated text is rendered as plain text or sanitized Markdown; never execute HTML from model output.

## 7. Accessibility

- Full keyboard operation.
- Visible focus indicators.
- Form controls have explicit labels.
- Status changes are announced through an accessible live region.
- Contrast meets WCAG AA where feasible.
- Do not rely on color alone.
- Provide a non-color indicator for diff additions/deletions.
- Support reduced motion.
- Ensure dialogs, if any, manage focus correctly.

## 8. Content and Microcopy

Preferred language:
- “Tests passed” rather than “The fix is guaranteed.”
- “Verification incomplete” rather than hiding missing evidence.
- “The sandbox could not run the test command” rather than a generic “Something went wrong.”
- “Proposed repair” for model output.
- “Executed test result” for measured evidence.

Avoid:
- Unsupported performance claims.
- Claims of total security.
- Overly anthropomorphic agent language.
- Statements that imply the model itself executed tests when the sandbox did.
- Fake progress or invented benchmark values.

## 9. Demo Presentation

Recommended demo sequence (under three minutes):
1. 0:00–0:15 — State the defect and explain the verification-first approach.
2. 0:15–0:35 — Upload a prepared Python project and submit the bug report.
3. 0:35–1:10 — Show the model-powered plan and proposed patch.
4. 1:10–1:45 — Show actual sandbox test output and the retry if applicable.
5. 1:45–2:20 — Inspect the diff and evidence-backed verdict.
6. 2:20–2:45 — Explain Token Factory/NVIDIA integration, safety boundaries, and limitations.

Use a prepared scenario that is known to work. If showing a failed scenario, clearly distinguish it from the main successful demo. Do not edit the video to imply an unperformed test ran successfully.
