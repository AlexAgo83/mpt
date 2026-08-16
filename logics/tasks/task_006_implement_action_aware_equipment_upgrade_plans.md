## task_006_implement_action_aware_equipment_upgrade_plans - Implement action-aware equipment upgrade plans
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
> Indicators reviewed: 2026-08-16 12:23:22

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: implement, action, aware, equipment, upgrade, plans
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Context
- Orchestrate the scaffolded request chain and keep sibling implementation slices linked.

# Plan
- [ ] 1. Inspect the existing live gear audit, journal collection, dashboard renderer, tests, and game item metadata before changing recommendation logic.
- [ ] 2. Collect source and compatibility metadata from the live game registry and classify dungeon and Slayer-task contexts.
- [ ] 3. Derive deterministic loot and craft recommendations with rank limits, alternatives, and explicit blockers.
- [ ] 4. Render the dedicated upgrade-plan view while retaining the existing Plans content.
- [ ] 5. Add focused offline coverage and a runbook for refresh, review, wiki guidance, and fallback behavior.
- [ ] 6. Run project checks, a live read-only journal refresh, and Logics validation before closeout.
- [ ] ADR 009 checkpoint: update affected Logics docs during each meaningful wave and leave the repo commit-ready.
- [ ] Keep commit creation under operator control; do not force one commit per micro-step.
- [ ] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_008_build_compatible_loot_and_craft_upgrade_plans`

# Definition of Done (DoD)
- [ ] Generated request, product, backlog, and task docs are present.
- [ ] Context-pack handoff is available when requested.
- [ ] Validation passes.
- [ ] Meaningful waves followed ADR 009: affected docs updated and the repo left commit-ready without automatic commits.

# AC Traceability
- request-Every scanned character has a structured equipment upgrade plan grouped by equipped slot. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.
- request-Each slot supplies at most one primary loot target, one primary craft target, and three ranked alternatives per source when compatible candidates exist. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.
- request-Each recommendation records why it is compatible, its acquisition source, unmet requirements, and whether it is currently actionable or blocked. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.
- request-Abyssal recommendations require matching damage type and usable spellbook/weapon rules; candidates from another realm or DLC are excluded unless the live game state proves them usable. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.
- request-A fixed dungeon run may attach a versioned official-wiki strategy reference, while Slayer-task plans identify the current task target and do not claim a stable dungeon strategy. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.
- request-The dashboard exposes a dedicated Upgrade plans view with action context, per-slot loot/craft recommendations, alternatives, and blockers. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.
- request-Generated journal data and HTML remain local-first, escaped, dependency-free, and do not execute or save game actions. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.
- request-Focused offline tests cover compatibility filtering, rank limits, dungeon-versus-task context, and rendered plan visibility; project checks pass. -> `item_008_build_compatible_loot_and_craft_upgrade_plans`. Proof deferred to slice closeout.

# Validation
- (no validation recorded yet)

# Report
- Not started.

# Links
- Request: `req_005_action_aware_equipment_upgrade_plans`
- Product brief(s): `prod_007_melvin_action_aware_upgrade_planning`
- Architecture decision(s): (none yet)
