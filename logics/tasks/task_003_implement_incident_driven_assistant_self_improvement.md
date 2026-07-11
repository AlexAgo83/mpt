## task_003_implement_incident_driven_assistant_self_improvement - Implement incident-driven assistant self-improvement
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90%
> Confidence: 85%
> Progress: 0%
> Complexity: Medium
> Theme: Implementation delivery
> Reminder: Update status/understanding/confidence/progress and linked request/backlog references when you edit this doc.

# Context
- Orchestrate the scaffolded request chain and keep sibling implementation slices linked.

# Plan
- [ ] 1. Read the current improve command, CLI error boundary, journal storage rules, and this request chain.
- [ ] 2. Add sanitized append-only incident capture at the shared CLI failure boundary.
- [ ] 3. Add stable signature grouping and recurring-candidate output to improve.
- [ ] 4. Add explicit idempotent Logics promotion for improve --record.
- [ ] 5. Document the local privacy and human-review boundaries.
- [ ] 6. Run offline checks, CLI help, Logics validation, lint, and audit before closeout.
- [ ] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_005_capture_recurring_cli_incidents_and_promote_reviewed_candidates`

# Definition of Done (DoD)
- [ ] Generated request, product, backlog, and task docs are present.
- [ ] Context-pack handoff is available when requested.
- [ ] Validation passes.

# AC Traceability
- request-AC1 -> This task. Proof: scaffold command generated the request-chain corpus.
- request-AC4 -> This task. Proof: optional context-pack handoff is supported.
- request-AC6 -> This task. Proof: dry-run and collision checks bound file changes.
- request-AC8 -> This task. Proof: CLI help documents the one-pass scaffold workflow.

# Validation
- Run `python3 -m logics_manager lint --require-status`.
- Run scaffold command tests.

# Report
- Implementation complete.

# AI Context
- Summary: Implement incident-driven assistant self-improvement
- Keywords: scaffolded-task, request-chain-scaffold, orchestration
- Use when: Coordinating implementation of a scaffolded request chain.
- Skip when: Working on one isolated sibling slice.

# Links
- Request: `req_002_incident_driven_assistant_self_improvement`
- Product brief(s): `prod_004_melvin_incident_driven_reliability_loop`
- Architecture decision(s): (none yet)
