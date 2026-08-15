## task_005_implement_guarded_melvor_character_actions - Implement guarded Melvor character actions
> From version: 0.1.0
> Schema version: 1.0
> Status: In progress
> Understanding: 90%
> Confidence: 85%
> Progress: 70%
> Complexity: Medium
> Theme: Implementation delivery
> Reminder: Update status/understanding/confidence/progress and linked request/backlog references when you edit this doc.
> Owner: codex
> Indicators reviewed: 2026-08-16 00:33:04

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: implement, guarded, melvor, character, actions
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Context
- Orchestrate the scaffolded request chain and keep sibling implementation slices linked.

# Plan
- [ ] 1. Inspect current helper APIs and read-only recipe and talent data before choosing one validated write path per action.
- [ ] 2. Add preview-first, explicit-character command parsing and shared script guards without a bulk executor.
- [ ] 3. Add equipment, artisan-recipe, and talent-node application with source-aware save and post-action verification.
- [ ] 4. Add focused offline tests and validate the live API only through a non-destructive preview before applying any game state.
- [ ] 5. Document the operation in README, MELVOR instructions, and a reusable runbook, then run project and Logics checks.
- [ ] ADR 009 checkpoint: update affected Logics docs during each meaningful wave and leave the repo commit-ready.
- [ ] Keep commit creation under operator control; do not force one commit per micro-step.
- [ ] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_007_implement_preview_first_equipment_skilling_and_talent_actions`

# Definition of Done (DoD)
- [ ] Generated request, product, backlog, and task docs are present.
- [ ] Context-pack handoff is available when requested.
- [ ] Validation passes.
- [ ] Meaningful waves followed ADR 009: affected docs updated and the repo left commit-ready without automatic commits.

# AC Traceability
- request-A generic equipment command previews the exact slot, item, available quantity, and current item; application requires --apply and verifies the final slot. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.
- request-A skilling command previews an unlocked named recipe, its required materials, and a positive runway; application requires --apply, starts only that recipe, saves, and verifies the active skill and selected action. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.
- request-A talent command previews one affordable, unlockable named node; application requires --apply, saves, and verifies the node is unlocked and points decreased. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.
- request-Every mutation is restricted to one explicit character and uses the newest local or cloud source through the existing write wrapper. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.
- request-Failures leave a clear error and do not continue to a later mutation. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.
- request-No bulk or apply-all command is added. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.
- request-CLI help, README, MELVOR instructions, and a reusable runbook document the preview, approval, verification, and rollback path. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.
- request-Focused offline checks cover command argument validation and generated action-script guards; npm run check passes. -> `item_007_implement_preview_first_equipment_skilling_and_talent_actions`. Proof deferred to slice closeout.

# Validation
- (no validation recorded yet)

# Report
- Not started.

# Links
- Request: `req_004_guarded_melvor_equipment_skilling_and_talent_actions`
- Product brief(s): `prod_006_melvin_guarded_character_actions`
- Architecture decision(s): (none yet)
