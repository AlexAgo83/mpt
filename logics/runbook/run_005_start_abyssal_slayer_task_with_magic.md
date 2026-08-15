## run_005_start_abyssal_slayer_task_with_magic - Start an active Abyssal Slayer task with Magic
> Status: Active
> Category: support
> Verified: 2026-08-15 — GrifhinZ started Tangled Thorns in Tangled Grove using set 6 Magic; follow-up observed Magic, 89.7% hit chance, and task progress from 89 to 87 kills remaining.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-08-15 17:49:54

# Trigger

- An Abyssal Slayer task is active and should run with the dedicated Magic equipment set.

# Prerequisites

- Complete `run_004_configure_abyssal_magic_equipment_set` first.
- Obtain explicit approval: starting combat changes the active action and saves the game.
- Do not request a new task when an acceptable task is already active.

# Procedure

1. Inspect the active task without a write: `./melvor-report.js slayer-abyssal <character>`.
2. Start it with the Magic set: `./melvor-report.js slayer-start <character> --slot 6`.
3. Wait for the in-progress enemy to change, then run `./melvor-report.js brief <character>`.
4. Confirm the selected area, current monster, task target, Magic attack type, Abyssal Damage weapon, positive hit chance, food, and remaining kills. The brief is authoritative after the transition; the immediate start response can still show the prior enemy.
5. For a recorded recap, use `./melvor-report.js journal <character> --record`. During an active Magic Slayer task, it reports the task and Magic 5 -> Abyssal Wand goal, not ranged-only ammunition/scroll runways or unrelated standard-dungeon goals.
6. Record again after at least five minutes on the same weapon before trusting Magic XP/hour or its level ETA.

# Verification

- `currentAction.name` is `Combat`.
- The current monster is the active Slayer task target and remaining kills decrease.
- Magic hit chance is above zero; a zero immediately after set selection is a transition state, not proof of a working task.

# Rollback

- Select the prior equipment set and stop or change the combat selection only with explicit approval. Preserve the active Slayer task unless the user asks to discard it.

# References

- `melvor-report.js slayer-abyssal`
- `melvor-report.js slayer-start`
- `run_004_configure_abyssal_magic_equipment_set`
