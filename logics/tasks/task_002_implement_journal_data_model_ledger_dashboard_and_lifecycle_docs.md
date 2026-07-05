## task_002_implement_journal_data_model_ledger_dashboard_and_lifecycle_docs - Implement journal data model, ledger, dashboard, and lifecycle docs
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90
> Confidence: 85
> Progress: 0
> Complexity: Medium
> Theme: Implementation delivery
> Reminder: Update status/understanding/confidence/progress and linked request/backlog references when you edit this doc.

# Context
- Implement the full journal operating model described by `req_001_journal_operating_model_and_interactive_dashboard`.
- Build the data model first: `latest.json` and `actions.jsonl` are the source for the dashboard and future AI handoff.
- Keep generation read-only. Do not mutate Melvor game state or add any action execution path in this task.

# Plan
- [ ] 1. Read README, MELVOR_RUNBOOK, MELVOR.md, melvor-report.js, the prior journal corpus, and this request chain.
- [ ] 2. Implement `latest.json` and `actions.jsonl` generation first; do not start with dashboard markup.
- [ ] 3. Make recommendation-to-action ids stable and suppress duplicates from existing action ledger entries.
- [ ] 4. Add stale/dismissed handling before building visual filters.
- [ ] 5. Generate `journal/index.html` from sanitized latest-state data with embedded CSS/JS and no external assets.
- [ ] 6. Document the artifact lifecycle and AI handoff rules.
- [ ] 7. Run `npm run check`, `./melvor-report.js --help`, a single-character journal dry run, `./melvor-report.js journal all --record`, and inspect `journal/index.html`.
- [ ] 8. Run Logics validation, lint, and audit before closeout.
- [ ] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_002_create_structured_journal_snapshot_and_action_ledger`
- `item_003_generate_interactive_offline_journal_dashboard`
- `item_004_document_journal_lifecycle_and_ai_handoff_rules`

# Definition of Done (DoD)
- [ ] `journal all --record` writes per-character Markdown, `journal/latest.json`, `journal/actions.jsonl` when needed, and `journal/index.html`.
- [ ] `latest.json` separates `observed`, `analysis`, and `decisions` per character.
- [ ] `actions.jsonl` is append-only JSON Lines with stable action ids, statuses, timestamps, risk, reason, and context metadata.
- [ ] Reruns suppress duplicate recommendations and respect dismissed/done/blocked actions unless context changes.
- [ ] Stale actions are detectable when observed state invalidates the recommendation context.
- [ ] `journal/index.html` works offline with search, action/risk/status filters, stale highlighting, account indicators, and per-character detail.
- [ ] README and MELVOR_RUNBOOK document artifacts, lifecycle statuses, handoff rules, and read-only safety boundaries.
- [ ] No generated artifact contains credentials, save strings, environment variables, absolute profile paths, or raw browser debugging URLs.
- [ ] `npm run check`, `./melvor-report.js --help`, one dry-run journal command, one recorded `journal all --record`, and Logics validation/lint/audit are recorded at closeout.

# AC Traceability
- request-AC1 -> This task. Proof: one read-only `journal all --record` pass writes Markdown, `latest.json`, and `index.html`.
- request-AC2 -> This task. Proof: `latest.json` has `observed`, `analysis`, and `decisions` per character.
- request-AC3 -> This task. Proof: `actions.jsonl` records stable append-only action events.
- request-AC4 -> This task. Proof: recommendations are structured as proposed actions without applying them.
- request-AC5 -> This task. Proof: dashboard filters and expands sanitized journal state.
- request-AC6 -> This task. Proof: dashboard account indicators summarize scan time, save risks, stale characters, approved/blocking actions, and top recommendations.
- request-AC7 -> This task. Proof: dismissed actions are not re-proposed unless context changes.
- request-AC8 -> This task. Proof: stale actions are detected from observed state versus action context.
- request-AC9 -> This task. Proof: generated artifacts are sanitized.
- request-AC10 -> This task. Proof: dependency-free implementation passes required checks.

# Validation
- Run `npm run check`.
- Run `./melvor-report.js --help`.
- Run `./melvor-report.js journal GrifhinZ`.
- Run `./melvor-report.js journal all --record`.
- Open or inspect `journal/index.html` for dashboard rendering and filters.
- Validate `journal/latest.json` with `node -e "JSON.parse(require('fs').readFileSync('journal/latest.json','utf8'))"`.
- Validate `journal/actions.jsonl` by parsing each non-empty line if the file exists.
- Run `logics-manager flow validate logics/request/req_001_journal_operating_model_and_interactive_dashboard.md`.
- Run `logics-manager lint --require-status`.
- Run `logics-manager audit --group-by-doc`.

# Report
- Not implemented yet. Ready for a development agent.

# AI Context
- Summary: Implement journal data model, ledger, dashboard, and lifecycle docs
- Keywords: scaffolded-task, request-chain-scaffold, orchestration
- Use when: Coordinating implementation of a scaffolded request chain.
- Skip when: Working on one isolated sibling slice.

# Links
- Request: `req_001_journal_operating_model_and_interactive_dashboard`
- Product brief(s): `prod_003_melvin_journal_operating_model_and_dashboard`
- Architecture decision(s): (none yet)
