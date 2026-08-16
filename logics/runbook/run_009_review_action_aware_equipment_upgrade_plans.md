## run_009_review_action_aware_equipment_upgrade_plans - Review action-aware equipment upgrade plans
> Status: Active
> Category: support
> Verified: 2026-08-16 - GrifhinZ read-only journal refresh produced live loot and craft options with a Slayer-task context
> Related request: `req_005_action_aware_equipment_upgrade_plans`
> Related backlog: `item_008_build_compatible_loot_and_craft_upgrade_plans`
> Related task: `task_006_implement_action_aware_equipment_upgrade_plans`
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger
- A character needs its next compatible equipment improvements reviewed.

# Prerequisites
- The shared Melvor profile is not used by another report command.
- The dashboard or CLI has a fresh read-only journal snapshot.

# Procedure
1. Compare saves with `./melvor-report.js source-of-truth`.
2. Run `./melvor-report.js journal <character> --record`, or refresh through `journal-serve`.
3. Open the character's `Upgrade plans` tab.
4. Read the action context first:
   - A fixed dungeon may use its official guide URL as advisory context.
   - A Slayer task is target-specific; refresh after the task changes before acting on its plan.
5. For each slot, prefer the primary compatible loot or craft option. Treat displayed blockers as prerequisites, not an equip instruction.

# Verification
- The plan lists only the active combat damage type for weapon upgrades.
- Each candidate has a source and no more than three alternatives.
- A Slayer task has no fixed-dungeon guide and names its refresh condition.

# Rollback
- The journal is read-only. Stop `journal-serve` with Ctrl-C; no Melvor save is changed.

# References
- Related request: `req_005_action_aware_equipment_upgrade_plans`
- Related backlog: `item_008_build_compatible_loot_and_craft_upgrade_plans`
- Related task: `task_006_implement_action_aware_equipment_upgrade_plans`
