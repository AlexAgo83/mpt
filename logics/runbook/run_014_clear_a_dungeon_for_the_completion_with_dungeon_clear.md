## run_014_clear_a_dungeon_for_the_completion_with_dungeon_clear - Clear a dungeon for the completion with dungeon-clear
> Status: Draft
> Category: support
> Verified: 2026-10-04, live: Opa (Underground Lava Lake, S2 plan, back to Woodcutting) and Dash (Bandit Base); the return to the Slayer task was fixed after these runs (Dash and Edalbraw came back off task) and is re-tested on Edalbraw.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-10-04 17:39:57

# Trigger
- A character's next dungeon (Plans > Dungeon path) is Ready, or Ready with its plan, and the operator wants the completion without leaving the character's daily activity for long.

# Prerequisites
- `run_001_safe_melvor_save_and_session_operations`: newest save known; no other client drives the browser.
- `dungeon-check <character> "<dungeon>"` done; `dungeon-optimize` too when the check is not ready as is.
- Not a Hardcore character: `dungeon-clear` refuses them (simulations must first show 0% over 1000 trials, then a supervised run).

# Procedure
1. `./melvor-report.js dungeon-clear <character> "<dungeon>"`. In one game session it records the previous activity (Slayer task, combat target, Woodcutting trees or any skill), equips the plan when needed (`dungeon-setup --apply`), activates the plan potion, runs one clear, puts the gear and the potion back, restarts the previous activity and saves.
2. Read the last line: `previous activity ... -> now ... on S<n> (was S<n>): resumed`. Anything else is a failure.

# Verification
- `brief <character>`: same action, same set and, on a Slayer task, the task monster with the same kills left.
- `journal/<character>.md` gets a `dungeon-clear` entry (status, set, lowest HP, return).

# Rollback
- Gear: `dungeon-setup <character> "<dungeon>" --restore --apply` (the replaced gear is recorded in `journal/dungeons/<character>-<dungeon>-before.json`).
- Task: `slayer-start <character> --slot <n>`; it stops a dungeon in progress first, then jumps to the task and selects the task monster directly when the jump does nothing.

# Gotchas
- The game repeats a dungeon after each clear: a run left alone keeps farming it.
- `jumpToTaskOnClick` does not leave a dungeon in progress and did nothing at all for Dash (Adventure Mode).
- `resumed` used to compare only the action name ("Combat"): it now also requires the same set and the task monster.
- Abyss depths are long: 60 min run limit (Depths of Woe did not finish in 20); dungeons 20 min (`MELVOR_COMBAT_RUN_TIMEOUT_MS`).
- The combat potion is shared by every set: the plan potion is only active during the run.

# References
- `run_010` (combat-run), `run_011` (prepare a dungeon), `docs/dungeons/README.md`
