## item_002_create_structured_journal_snapshot_and_action_ledger - Create structured journal snapshot and action ledger
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90%
> Confidence: 85%
> Progress: 0%
> Complexity: High
> Theme: Melvor assistant journal data
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.

# Problem
- Markdown-only journals are good for reading, but poor as the dashboard's source of truth.
- Without stable action ids and statuses, the assistant will repeat dismissed recommendations or lose approved work between sessions.
- Without stale detection, a recommendation can remain visible after the character state changed.

# Scope
- In:
  - Design and write `journal/latest.json` with account metadata and per-character `observed`, `analysis`, and `decisions` sections.
  - Design and append `journal/actions.jsonl` events for proposed actions and later status transitions.
  - Derive stable action ids from character, action type, target slot/item/activity, and recommendation context.
  - Merge current recommendations with existing action ledger state so dismissed/done/blocked actions are respected.
  - Mark actions stale when current observed state invalidates the original recommendation.
  - Keep generated data sanitized and local-path free.
- Out:
  - Executing actions in the game.
  - Editing old Markdown entries to update action status.
  - Introducing a database or dependency.
  - Building the visual dashboard layout beyond the minimum data contract needed by the next slice.

# Acceptance criteria
- `journal/latest.json` is valid JSON and includes `generatedAt`, `account`, `characters`, and `actionsSummary` top-level fields.
- Each character in `latest.json` has `observed`, `analysis`, and `decisions` keys.
- `observed` includes current action, relevant levels/gear/food/GP already available from existing helpers, last observed timestamp, and save-source/risk context.
- `analysis` includes recommendations, optimization plan, risk notes, and stale-data status.
- `decisions` includes proposed/approved/done/blocked/dismissed/stale action references derived from `actions.jsonl`.
- `actions.jsonl` is append-only JSON Lines and remains readable if one malformed historical line is skipped with a warning.
- The same recommendation does not create duplicate proposed actions when rerun without material state changes.
- Dismissed actions are not re-proposed unless their context hash changes.
- `npm run check` passes.

# AC Traceability
- request-`journal all --record` writes sanitized per-character Markdown, `journal/latest.json`, and `journal/index.html` from one read-only collection pass. -> This backlog slice. Proof: `journal/latest.json` is valid JSON and includes `generatedAt`, `account`, `characters`, and `actionsSummary` top-level fields.
- request-`journal/latest.json` explicitly separates `observed`, `analysis`, and `decisions` fields per character. -> This backlog slice. Proof: Each character in `latest.json` has `observed`, `analysis`, and `decisions` keys.
- request-`journal/actions.jsonl` stores append-only action events with stable ids, character, status, type, reason, risk, timestamps, and enough metadata to avoid duplicate recommendations. -> This backlog slice. Proof: `observed` includes current action, relevant levels/gear/food/GP already available from existing helpers, last observed timestamp, and save-source/risk context.
- request-Generated recommendations become structured proposed actions where practical, without applying them. -> This backlog slice. Proof: `analysis` includes recommendations, optimization plan, risk notes, and stale-data status.
- request-Rejected or dismissed actions are not repeatedly re-proposed unless the observed context materially changes. -> This backlog slice. Proof: `decisions` includes proposed/approved/done/blocked/dismissed/stale action references derived from `actions.jsonl`.
- request-Stale actions are detectable when the observed state no longer matches the original recommendation context. -> This backlog slice. Proof: `actions.jsonl` is append-only JSON Lines and remains readable if one malformed historical line is skipped with a warning.
- request-No generated file contains credentials, environment variables, save strings, absolute Chrome profile paths, or raw browser debugging URLs. -> This backlog slice. Proof: The same recommendation does not create duplicate proposed actions when rerun without material state changes.
- request-Implementation keeps the repository dependency-free and validates with `npm run check`, CLI help, a dry-run journal command, and recorded dashboard generation. -> This backlog slice. Proof: Dismissed actions are not re-proposed unless their context hash changes.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_003_melvin_journal_operating_model_and_dashboard`
- Architecture decision(s): (none yet)
- Request: `req_001_journal_operating_model_and_interactive_dashboard`
- Primary task(s): `task_002_implement_journal_data_model_ledger_dashboard_and_lifecycle_docs`

# AI Context
- Summary: Create structured journal snapshot and action ledger
- Keywords: scaffolded-backlog, create structured journal snapshot and action ledger, implementation-ready
- Use when: Implementing the scaffolded slice for Create structured journal snapshot and action ledger.
- Skip when: The change belongs to another backlog slice.

# Priority
- Priority: High
- Rationale: Set by scaffold input or defaulted for grooming.
