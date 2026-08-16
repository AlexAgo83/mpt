## item_008_build_compatible_loot_and_craft_upgrade_plans - Build compatible loot and craft upgrade plans
> From version: 0.1.0
> Schema version: 1.0
> Status: In progress
> Understanding: 90%
> Confidence: 85%
> Progress: 70%
> Complexity: High
> Theme: Melvor progression planning
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.
> Indicators reviewed: 2026-08-16 12:23:22

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: build, compatible, loot, craft, upgrade, plans
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Problem
- Raw gear scores can recommend an item without proving it works for the current damage type, spellbook, DLC realm, or required completion.
- Players cannot see a concise acquisition path per equipment slot.
- Dungeon strategy and changing Slayer-task context currently share the same generic combat advice.

# Scope
- In:
  - Collect serializable item source, realm, damage type, attack style, spell, and requirement metadata alongside current equipment and candidates.
  - Derive deterministic per-slot loot and craft recommendations plus up to three alternatives from compatible live-game candidates.
  - Represent fixed dungeon and Slayer-task contexts separately and allow only fixed dungeons to carry an official guide reference.
  - Render a dedicated Upgrade plans dashboard view and include the plan in recorded journal data.
  - Document refresh, review, compatibility, and guide-fallback behavior in a reusable runbook.
  - Add focused pure-data and rendered-HTML checks.
- Out:
  - Applying equipment, starting combat, crafting items, or mutating a save.
  - Guessing inaccessible item sources or parsing unverified wiki prose into game requirements.
  - Replacing existing journal history, dashboard filters, or guarded actions.

# Acceptance criteria
- A candidate whose required damage type or usable-spell condition does not match the active combat build is not emitted as an upgrade option.
- A candidate blocked by an unmet skill, Abyssal level, DLC realm, or completion remains visible only as blocked with its exact gate.
- Loot and craft recommendations have independent rank limits and stable ordering.
- A Slayer task names its current monster and a refresh condition; it does not display a fixed-dungeon guide.
- A selected dungeon can display an official guide URL as advisory context while game metadata remains the compatibility authority.
- The rendered dashboard contains the dedicated upgrade-plan view and no untrusted external URLs.
- npm run check passes without a new dependency.

# AC Traceability
- request-Every scanned character has a structured equipment upgrade plan grouped by equipped slot. -> This backlog slice. Proof: A candidate whose required damage type or usable-spell condition does not match the active combat build is not emitted as an upgrade option.
- request-Each slot supplies at most one primary loot target, one primary craft target, and three ranked alternatives per source when compatible candidates exist. -> This backlog slice. Proof: A candidate blocked by an unmet skill, Abyssal level, DLC realm, or completion remains visible only as blocked with its exact gate.
- request-Each recommendation records why it is compatible, its acquisition source, unmet requirements, and whether it is currently actionable or blocked. -> This backlog slice. Proof: Loot and craft recommendations have independent rank limits and stable ordering.
- request-Abyssal recommendations require matching damage type and usable spellbook/weapon rules; candidates from another realm or DLC are excluded unless the live game state proves them usable. -> This backlog slice. Proof: A Slayer task names its current monster and a refresh condition; it does not display a fixed-dungeon guide.
- request-A fixed dungeon run may attach a versioned official-wiki strategy reference, while Slayer-task plans identify the current task target and do not claim a stable dungeon strategy. -> This backlog slice. Proof: A selected dungeon can display an official guide URL as advisory context while game metadata remains the compatibility authority.
- request-The dashboard exposes a dedicated Upgrade plans view with action context, per-slot loot/craft recommendations, alternatives, and blockers. -> This backlog slice. Proof: The rendered dashboard contains the dedicated upgrade-plan view and no untrusted external URLs.
- request-Generated journal data and HTML remain local-first, escaped, dependency-free, and do not execute or save game actions. -> This backlog slice. Proof: npm run check passes without a new dependency.
- request-Focused offline tests cover compatibility filtering, rank limits, dungeon-versus-task context, and rendered plan visibility; project checks pass. -> This backlog slice. Proof: npm run check passes without a new dependency.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_007_melvin_action_aware_upgrade_planning`
- Architecture decision(s): (none yet)
- Request: `req_005_action_aware_equipment_upgrade_plans`
- Primary task(s): `task_006_implement_action_aware_equipment_upgrade_plans`

# Priority
- Priority: High
- Rationale: Set by scaffold input or defaulted for grooming.
