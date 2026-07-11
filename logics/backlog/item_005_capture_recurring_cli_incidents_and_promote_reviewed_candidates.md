## item_005_capture_recurring_cli_incidents_and_promote_reviewed_candidates - Capture recurring CLI incidents and promote reviewed candidates
> From version: 0.1.0
> Schema version: 1.0
> Status: Done
> Understanding: 90%
> Confidence: 85%
> Progress: 100%
> Complexity: Medium
> Theme: Assistant reliability operations
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.

# Problem
- Reliability lessons are currently recorded only when a person notices and writes them down.
- One-off and recurring failures are not distinguished automatically.
- There is no durable link between repeated CLI failures and Logics intake.

# Scope
- In:
  - Append sanitized failures under journal/.
  - Derive stable signatures and recurrence counts with Node standard-library APIs.
  - Extend improve output with recurring candidates.
  - Use explicit improve --record as the only promotion boundary.
  - Track promoted signatures locally to prevent duplicate requests.
  - Document the feedback loop and its privacy boundary.
- Out:
  - Automatic fixes or commits.
  - Game-state mutation.
  - Background monitoring or external reporting.
  - A general-purpose logging framework.

# Acceptance criteria
- Two failures with the same normalized message produce one recurring candidate with count two.
- Variable PIDs, durations, ports, timestamps, and local paths do not split equivalent signatures.
- A first occurrence is retained locally but does not become a promotion candidate.
- improve output includes command, count, sanitized message, first seen, and last seen for recurring candidates.
- Repeated improve --record runs do not promote the same signature twice.
- npm run check passes without adding a dependency.

# AC Traceability
- request-Unexpected melvor-report failures append a sanitized event with timestamp, command, duration, message, and stable signature to a private JSON Lines file. -> This backlog slice. Proof: Two failures with the same normalized message produce one recurring candidate with count two.
- request-Repeated signatures are counted from the append-only history without a database or dependency. -> This backlog slice. Proof: Variable PIDs, durations, ports, timestamps, and local paths do not split equivalent signatures.
- request-improve displays recurring incident candidates and a ready-to-review improvement entry. -> This backlog slice. Proof: A first occurrence is retained locally but does not become a promotion candidate.
- request-Only improve --record may promote recurring unpromoted signatures into Logics, and each signature is promoted at most once. -> This backlog slice. Proof: improve output includes command, count, sanitized message, first seen, and last seen for recurring candidates.
- request-Incident capture never stores environment values, save strings, home-directory paths, browser URLs, or credentials. -> This backlog slice. Proof: Repeated improve --record runs do not promote the same signature twice.
- request-The automation never edits implementation code or mutates Melvor game state. -> This backlog slice. Proof: npm run check passes without adding a dependency.
- request-Offline checks cover sanitization, stable signatures, recurrence counting, and promotion deduplication. -> This backlog slice. Proof: npm run check passes without adding a dependency.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_004_melvin_incident_driven_reliability_loop`
- Architecture decision(s): (none yet)
- Request: `req_002_incident_driven_assistant_self_improvement`
- Primary task(s): `task_003_implement_incident_driven_assistant_self_improvement`

# AI Context
- Summary: Capture recurring CLI incidents and promote reviewed candidates
- Keywords: scaffolded-backlog, capture recurring cli incidents and promote reviewed candidates, implementation-ready
- Use when: Implementing the scaffolded slice for Capture recurring CLI incidents and promote reviewed candidates.
- Skip when: The change belongs to another backlog slice.

# Priority
- Priority: Medium
- Rationale: Set by scaffold input or defaulted for grooming.

# Tasks
- `task_003_implement_incident_driven_assistant_self_improvement`

# Notes
- Task `task_003_implement_incident_driven_assistant_self_improvement` was finished via `logics-manager flow finish task` on 2026-07-12.
