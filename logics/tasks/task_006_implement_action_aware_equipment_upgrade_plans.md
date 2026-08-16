## task_006_implement_action_aware_equipment_upgrade_plans - Implement action-aware equipment upgrade plans
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
> Indicators reviewed: 2026-08-16 12:27:52

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: implement, action, aware, equipment, upgrade, plans
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Context
- Orchestrate the scaffolded request chain and keep sibling implementation slices linked.

# Plan
- [x] 1. Inspect the existing live gear audit, journal collection, dashboard renderer, tests, and game item metadata before changing recommendation logic.
- [x] 2. Collect source and compatibility metadata from the live game registry and classify dungeon and Slayer-task contexts.
- [x] 3. Derive deterministic loot and craft recommendations with rank limits, alternatives, and explicit blockers.
- [x] 4. Render the dedicated upgrade-plan view while retaining the existing Plans content.
- [x] 5. Add focused offline coverage and a runbook for refresh, review, wiki guidance, and fallback behavior.
- [x] 6. Run project checks, a live read-only journal refresh, and Logics validation before closeout.
- [x] ADR 009 checkpoint: update affected Logics docs during each meaningful wave and leave the repo commit-ready.
- [x] Keep commit creation under operator control; do not force one commit per micro-step.
- [x] GATE: do not close until lint, audit, and scaffold validation pass.

# Backlog
- `item_008_build_compatible_loot_and_craft_upgrade_plans`

# Definition of Done (DoD)
- [x] Generated request, product, backlog, and task docs are present.
- [x] Context-pack handoff is available when requested.
- [x] Validation passes.
- [x] Meaningful waves followed ADR 009: affected docs updated and the repo left commit-ready without automatic commits.

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
- command: `npm run check` | result: passed | date: 2026-08-16
- Finish workflow executed on 2026-08-16.
- Linked backlog/request close verification passed.

# Report
- Not started.
- Finished on 2026-08-16.
- Linked backlog item(s): `item_008_build_compatible_loot_and_craft_upgrade_plans`
- Related request(s): `req_005_action_aware_equipment_upgrade_plans`

# Links
- Request: `req_005_action_aware_equipment_upgrade_plans`
- Product brief(s): `prod_007_melvin_action_aware_upgrade_planning`
- Architecture decision(s): (none yet)
