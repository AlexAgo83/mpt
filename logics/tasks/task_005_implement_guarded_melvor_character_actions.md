## task_005_implement_guarded_melvor_character_actions - Implement guarded Melvor character actions
> From version: 0.1.0
> Schema version: 1.0
> Status: Done
> Understanding: 90%
> Confidence: 85%
> Progress: 100%
> Complexity: Medium
> Theme: Implementation delivery
> Reminder: Update status/understanding/confidence/progress and linked request/backlog references when you edit this doc.
> Owner: codex
> Indicators reviewed: 2026-08-16 12:22:37

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: implement, guarded, melvor, character, actions
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Context
- Orchestrate the scaffolded request chain and keep sibling implementation slices linked.

# Plan
- [x] 1. Inspect current helper APIs and read-only recipe and talent data before choosing one validated write path per action.
- [x] 2. Add preview-first, explicit-character command parsing and shared script guards without a bulk executor.
- [x] 3. Add equipment, artisan-recipe, and talent-node application with source-aware save and post-action verification.
- [x] 4. Add focused offline tests and validate the live API only through a non-destructive preview before applying any game state.
- [x] 5. Document the operation in README, MELVOR instructions, and a reusable runbook, then run project and Logics checks.
- [x] ADR 009 checkpoint: update affected Logics docs during each meaningful wave and leave the repo commit-ready.
- [x] Keep commit creation under operator control; do not force one commit per micro-step.
- [x] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_007_implement_preview_first_equipment_skilling_and_talent_actions`

# Definition of Done (DoD)
- [x] Generated request, product, backlog, and task docs are present.
- [x] Context-pack handoff is available when requested.
- [x] Validation passes.
- [x] Meaningful waves followed ADR 009: affected docs updated and the repo left commit-ready without automatic commits.

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
- command: `npm run check` | result: passed | date: 2026-08-16
- Finish workflow executed on 2026-08-16.
- Linked backlog/request close verification passed.

# Report
- Not started.
- Finished on 2026-08-16.
- Linked backlog item(s): `item_007_implement_preview_first_equipment_skilling_and_talent_actions`
- Related request(s): `req_004_guarded_melvor_equipment_skilling_and_talent_actions`

# Links
- Request: `req_004_guarded_melvor_equipment_skilling_and_talent_actions`
- Product brief(s): `prod_006_melvin_guarded_character_actions`
- Architecture decision(s): (none yet)
