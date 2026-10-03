## run_002_task_aware_melvor_equipment_and_configuration_audit - Task-aware Melvor equipment and configuration audit
> Status: Active
> Category: validation
> Verified: 2026-10-03 — all 7 characters audited with `brief all`, `audit all`, `config all`, `gear --detail`, and `skilling`.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-08-15 16:56:54

# Trigger

- A character needs task-aware equipment, Agility, Cartography, consumable, or combat configuration recommendations.

# Prerequisites

- Complete the safe save/session runbook first.
- This is recommendation-only work: no equipment, prayer, potion, map, obstacle, pillar, action, or save mutation is authorized.

# Procedure

1. Run `./melvor-report.js source-of-truth`, then `brief all` and `audit all` to prioritize active, idle, stopped, or at-risk characters.
2. For each priority character, run `./melvor-report.js gear <character> --detail` and `./melvor-report.js skilling <character>`. To assess a switch, use `gear <character> --detail --style melee|ranged|magic`; this is read-only and ranks bank gear for that style.
3. Compare equipped items with candidates by stats **and passives**. Read `blocked` candidates too: they state the exact skill level and Abyss Depth completion required, so do not describe them as available upgrades. Reject a raw stat upgrade when it loses task-relevant resistance, defence, reflect, Auto Eat efficiency, or a required passive.
4. Run `./melvor-report.js config <character>` (read-only) for active potions per skill, bank potion stock, active prayers plus every usable prayer for the current damage type, attack spell, auto-eat threshold/efficiency, the Cartography map/hex/POI with its effect, and every discovered POI with its effect (moving costs travel resources, so state the gain). Flag an empty Combat potion slot when the bank holds a matching accuracy, damage, or Slayer potion.
5. For non-combat tasks, check the ring objective (level XP versus mastery XP), summons, consumable, and item runways. Check Agility obstacles/pillars and Cartography map/hex modifiers only against the current task objective.
6. For combat, record dungeon, boss attack type, player attack style, hit chance, food, and consumable/prayer needs. Treat hit chance below 80% as an accuracy problem before adding damage.
7. Return an exact proposed change, expected benefit, prerequisite, and risk. `combat-plan` describes the next uncleared dungeon; do not use it as a build for a dungeon already in progress.

# Verification

- Every recommendation names a real equipped or bank item, its slot, and why its passives and requirements fit the active task.
- No game state changed during the audit.

# Rollback

- No rollback is required because the procedure is read-only. If a later approved change underperforms, restore the previously recorded slot configuration and re-run the audit.

# References

- `melvor-report.js`
- `melvor-helpers.js`
- `run_001_safe_melvor_save_and_session_operations`
