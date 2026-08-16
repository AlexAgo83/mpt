## req_005_action_aware_equipment_upgrade_plans - Action-aware equipment upgrade plans
> From version: 0.1.0
> Schema version: 1.0
> Status: Draft
> Understanding: 90%
> Confidence: 85%
> Complexity: High
> Theme: Melvor progression planning
> Reminder: Update status/understanding/confidence and linked backlog/task references when you edit this doc.

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: action, aware, equipment, upgrade, plans
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Needs
- Give each character an actionable per-slot equipment progression plan derived from its current activity.
- Show the first loot target and first craft target plus up to three compatible alternatives for each equipped slot.
- Prevent recommendations that cross damage types, spell requirements, owned DLC realms, equipment requirements, or dungeon-completion gates.
- Use dungeon strategy guidance only for a fixed dungeon run; distinguish it from a Slayer task whose target can change.
- Make the plan visible in a dedicated dashboard surface without enabling automatic game actions.

# Context
- The journal already captures current combat state, equipment, skills, bank inventory, and source-of-truth context through the live game API.
- The current gear audit ranks raw stats and can therefore surface incompatible candidates if its richer compatibility facts are not used.
- A character in a dungeon has a stable boss and can benefit from a linked strategy guide, while an active Slayer task must be planned against the task target and refreshed after it completes.
- The dashboard is generated as sanitized, dependency-free local HTML and already has a character Plans tab.

# Acceptance criteria
- Every scanned character has a structured equipment upgrade plan grouped by equipped slot.
- Each slot supplies at most one primary loot target, one primary craft target, and three ranked alternatives per source when compatible candidates exist.
- Each recommendation records why it is compatible, its acquisition source, unmet requirements, and whether it is currently actionable or blocked.
- Abyssal recommendations require matching damage type and usable spellbook/weapon rules; candidates from another realm or DLC are excluded unless the live game state proves them usable.
- A fixed dungeon run may attach a versioned official-wiki strategy reference, while Slayer-task plans identify the current task target and do not claim a stable dungeon strategy.
- The dashboard exposes a dedicated Upgrade plans view with action context, per-slot loot/craft recommendations, alternatives, and blockers.
- Generated journal data and HTML remain local-first, escaped, dependency-free, and do not execute or save game actions.
- Focused offline tests cover compatibility filtering, rank limits, dungeon-versus-task context, and rendered plan visibility; project checks pass.

# Definition of Ready (DoR)
- [x] Problem statement is explicit and user impact is clear.
- [x] Scope boundaries (in/out) are explicit.
- [x] Acceptance criteria are testable.
- [x] Dependencies and known risks are listed.

# Companion docs
- Product brief(s): `prod_007_melvin_action_aware_upgrade_planning`
- Architecture decision(s): (none yet)

# References
- README.md
- MELVOR.md
- MELVOR_RUNBOOK.md
- melvor-report.js
- melvor-helpers.js
- test-journal.js
- journal/latest.json

# Backlog
- `item_008_build_compatible_loot_and_craft_upgrade_plans`
