## task_003_implement_incident_driven_assistant_self_improvement - Implement incident-driven assistant self-improvement
> From version: 0.1.0
> Schema version: 1.0
> Status: Done
> Understanding: 100
> Confidence: 95
> Progress: 100%
> Complexity: Medium
> Theme: Implementation delivery
> Reminder: Update status/understanding/confidence/progress and linked request/backlog references when you edit this doc.
> Owner: codex

# Context
- Orchestrate the scaffolded request chain and keep sibling implementation slices linked.

# Plan
- [x] 1. Read the current improve command, CLI error boundary, journal storage rules, and this request chain.
- [x] 2. Add sanitized append-only incident capture at the shared CLI failure boundary.
- [x] 3. Add stable signature grouping and recurring-candidate output to improve.
- [x] 4. Add explicit idempotent Logics promotion for improve --record.
- [x] 5. Document the local privacy and human-review boundaries.
- [x] 6. Run offline checks, CLI help, Logics validation, lint, and audit before closeout.
- [x] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_005_capture_recurring_cli_incidents_and_promote_reviewed_candidates`

# Definition of Done (DoD)
- [x] Generated request, product, backlog, and task docs are present.
- [x] Context-pack handoff is available when requested.
- [x] Validation passes.

# AC Traceability
- request-AC1 -> This task. Proof: scaffold command generated the request-chain corpus.
- request-AC4 -> This task. Proof: optional context-pack handoff is supported.
- request-AC6 -> This task. Proof: dry-run and collision checks bound file changes.
- request-AC8 -> This task. Proof: CLI help documents the one-pass scaffold workflow.

# Validation
- Run `python3 -m logics_manager lint --require-status`.
- Run scaffold command tests.
- npm run check passed; CLI help passed; offline checks cover sanitization, stable signatures, recurrence thresholding, incident capture, and idempotent promotion with a fake Logics runner. No dependency was added. Documentation records the private-data and human-review boundaries. Commits: caf34d1, 0a0caf5, 9e38533.
- npm run check and CLI help passed; offline incident and idempotent promotion checks passed.
- Finish workflow executed on 2026-07-12.
- Linked backlog/request close verification passed.

# Report
- Implementation complete.
- Finished on 2026-07-12.
- Linked backlog item(s): `item_005_capture_recurring_cli_incidents_and_promote_reviewed_candidates`
- Related request(s): `req_002_incident_driven_assistant_self_improvement`

# AI Context
- Summary: Implement incident-driven assistant self-improvement
- Keywords: scaffolded-task, request-chain-scaffold, orchestration
- Use when: Coordinating implementation of a scaffolded request chain.
- Skip when: Working on one isolated sibling slice.

# Links
- Request: `req_002_incident_driven_assistant_self_improvement`
- Product brief(s): `prod_004_melvin_incident_driven_reliability_loop`
- Architecture decision(s): (none yet)
