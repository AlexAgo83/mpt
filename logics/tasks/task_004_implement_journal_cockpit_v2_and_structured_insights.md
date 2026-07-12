## task_004_implement_journal_cockpit_v2_and_structured_insights - Implement journal cockpit v2 and structured insights
> From version: 0.1.0
> Schema version: 1.0
> Status: In progress
> Understanding: 90%
> Confidence: 85%
> Progress: 0%
> Complexity: Medium
> Theme: Implementation delivery
> Reminder: Update status/understanding/confidence/progress and linked request/backlog references when you edit this doc.
> Owner: codex

# Context
- Orchestrate the scaffolded request chain and keep sibling implementation slices linked.

# Plan
- [ ] 1. Read the existing journal model, dashboard renderer, tests, generated latest snapshot, and visual review findings.
- [ ] 2. Add structured deduplicated insights and account-level operational indicators without removing legacy fields.
- [ ] 3. Replace the dashboard card list with a responsive comparison surface and compact detail views.
- [ ] 4. Add priority and attention filtering plus explicit alert severity.
- [ ] 5. Regenerate a live journal and inspect desktop and mobile screenshots plus overflow dimensions.
- [ ] 6. Run npm checks, CLI help, Logics validation, lint, and audit before closeout.
- [ ] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_006_build_structured_journal_insights_and_responsive_decision_cockpit`

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
- Summary: Implement journal cockpit v2 and structured insights
- Keywords: scaffolded-task, request-chain-scaffold, orchestration
- Use when: Coordinating implementation of a scaffolded request chain.
- Skip when: Working on one isolated sibling slice.

# Links
- Request: `req_003_journal_cockpit_v2_and_structured_insights`
- Product brief(s): `prod_005_melvin_journal_decision_cockpit_v2`
- Architecture decision(s): (none yet)
