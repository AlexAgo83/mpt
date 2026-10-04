## run_010_prepare_and_run_a_standard_dungeon_with_combat_setup_and_combat_run - Prepare and run a standard dungeon with combat-setup and combat-run
> Status: Draft
> Category: support
> Verified: 2026-10-04, live: `combat-run Chap "Frozen Cove" --slot 1` (2 clears) and Kang (1 clear in about 1 min, full HP throughout), saved local + cloud.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-10-04 16:27:18

# Trigger
- `brief` or `combat-plan` names an uncleared standard dungeon (`combat setup: <dungeon> with set N ...`) and the operator wants it cleared.

# Prerequisites
- Explicit operator approval: **both commands write immediately; there is no preview mode and no `--apply` gate.**
- `run_001_safe_melvor_save_and_session_operations` completed.
- The character is not on an Abyssal Slayer task the operator wants to keep: `combat-setup` changes the equipment set and `combat-run` replaces the current combat action.

# Procedure
1. Read the target without writing: `./melvor-report.js combat-plan <character>` and `./melvor-report.js config <character>`. Record the current equipment set, prayers, and combat potion so they can be restored.
2. Check that the target is worth it. On a level 200+ character the standard target is usually a completion leftover, not a progression step; prefer the active Abyssal Slayer task unless the operator asks for completion.
3. `./melvor-report.js combat-setup <character>` switches to the recommended set, the Maximum Skillcape when suggested, summons, and prayers, then saves. Potions are **not** applied: they are not equipment, so the output reports `potion: skipped`; activate the potion in game if needed.
4. `./melvor-report.js combat-run <character> "<dungeon name|id>" --slot N` (N = the set `dungeon-check` validated; without it the set countering the boss style is picked) loads the newest source, equips the recommended set, starts the dungeon, follows it (default timeout 10 min, `MELVOR_COMBAT_RUN_TIMEOUT_MS` to change it), and saves.
5. Below 35% HP the run **flees** (`game.combat.stop()`) and reports `low-hp`; it refuses to start when the game exposes no way to flee. After a clear the game keeps repeating the dungeon: the character stays on it until another action is started.
6. Read the result: pending `Claim` and `Increase Level Cap` buttons are reported, never chosen. Ask the operator before choosing a reward or cap.

# Verification
- The output shows `sourceBefore` and `sourceAfter` on the same newest source.
- `brief <character>` no longer lists the dungeon in `standard.next`.

# Rollback
- Restore the recorded set/prayers/potion and restart the previous Slayer task (`slayer-start`, `run_005`) only with approval. Never load an older cloud save over a newer local one.

# References
- `melvor-report.js combat-setup`, `combat-run`
- `run_001_safe_melvor_save_and_session_operations`
- `run_005_start_abyssal_slayer_task_with_magic`
