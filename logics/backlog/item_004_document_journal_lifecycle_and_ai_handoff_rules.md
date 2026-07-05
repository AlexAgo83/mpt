## item_004_document_journal_lifecycle_and_ai_handoff_rules - Document journal lifecycle and AI handoff rules
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90
> Confidence: 85
> Progress: 0
> Complexity: Medium
> Theme: Melvor assistant operations
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.

# Problem
- Future AI sessions need rules for interpreting latest snapshots, action statuses, and stale recommendations.
- The player needs to know which artifacts to review and which ones are machine-generated.
- Without lifecycle documentation, action status changes will drift into ad hoc edits.

# Scope
- In:
  - Document the journal artifacts in README and MELVOR_RUNBOOK.
  - Document the action status lifecycle: proposed, approved, done, blocked, dismissed, stale.
  - Document the rule that `observed` is game state, `analysis` is assistant interpretation, and `decisions` are user/session decisions.
- Document how future AI sessions should read `latest.json` and `actions.jsonl` before making recommendations.
- Document that `journal/` is local player data and must remain git-ignored.
- Document safety expectations before any future apply-action command is designed.
- Out:
  - Implementing action approval UI persistence.
  - Implementing apply-action or mutation workflows.
  - Changing Melvor helper mutation behavior.

# Acceptance criteria
- README names `journal/latest.json`, `journal/actions.jsonl`, `journal/index.html`, and per-character Markdown files.
- MELVOR_RUNBOOK explains how a future AI should start from the dashboard and structured files.
- Action statuses and stale/dismissed recommendation rules are documented.
- Docs explicitly state that dashboard/journal generation is read-only.
- Docs explicitly state that generated journal files are private local output and must not be committed.
- Docs warn that action execution remains out of scope and still requires source-of-truth checks and user approval.
- `npm run check` passes after docs changes.

# AC Traceability
- request-`journal/latest.json` explicitly separates `observed`, `analysis`, and `decisions` fields per character. -> This backlog slice. Proof: README names `journal/latest.json`, `journal/actions.jsonl`, `journal/index.html`, and per-character Markdown files.
- request-`journal/actions.jsonl` stores append-only action events with stable ids, character, status, type, reason, risk, timestamps, and enough metadata to avoid duplicate recommendations. -> This backlog slice. Proof: MELVOR_RUNBOOK explains how a future AI should start from the dashboard and structured files.
- request-Rejected or dismissed actions are not repeatedly re-proposed unless the observed context materially changes. -> This backlog slice. Proof: Action statuses and stale/dismissed recommendation rules are documented.
- request-Stale actions are detectable when the observed state no longer matches the original recommendation context. -> This backlog slice. Proof: Docs explicitly state that dashboard/journal generation is read-only.
- request-Implementation keeps the repository dependency-free and validates with `npm run check`, CLI help, a dry-run journal command, and recorded dashboard generation. -> This backlog slice. Proof: Docs warn that action execution remains out of scope and still requires source-of-truth checks and user approval.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_003_melvin_journal_operating_model_and_dashboard`
- Architecture decision(s): (none yet)
- Request: `req_001_journal_operating_model_and_interactive_dashboard`
- Primary task(s): `task_002_implement_journal_data_model_ledger_dashboard_and_lifecycle_docs`

# AI Context
- Summary: Document journal lifecycle and AI handoff rules
- Keywords: scaffolded-backlog, document journal lifecycle and ai handoff rules, implementation-ready
- Use when: Implementing the scaffolded slice for Document journal lifecycle and AI handoff rules.
- Skip when: The change belongs to another backlog slice.

# Priority
- Priority: Medium
- Rationale: Set by scaffold input or defaulted for grooming.
