## run_015_build_abyssal_equipment_sets_and_pick_a_training_target - Build Abyssal equipment sets and pick a training target
> Status: Active
> Category: support
> Verified: 2026-10-07, live: Dash S7 magic and Rya S6 ranged / S7 magic built (plan apply, spell per set, Rya Abyssal Staff crafted then Harvesting resumed), GrifhinZ S5/S6/S7 upgraded then S6/S7 swapped with `set-swap` (exact before/after match); `train-targets` simulated Rya S6, Rya S7 and Dash S7; `fight-start` applied on Dash (Toxic Serpent) and Rya (Toxic Swarm, after the SEMI Auto Slayer fix), checked by reload with `brief`; `craft`, `set-candidates`, `set-plan` previews checked.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-10-07 01:05:00

# Trigger

- A character needs an Abyssal melee, ranged or magic set, or better gear in one.
- A character wants to raise an Abyssal combat level (ranged, magic) and needs a safe, fast target.
- Two sets hold each other's role and must be put back in the project order.

# Set roles

The project expects S1 melee, S2 ranged, S3 magic, S4 skilling, **S5 Abyssal melee, S6 Abyssal ranged, S7 Abyssal
magic** (`mh.dungeonCheck`, `MELVOR_SET_ROLES`). Keep new sets in that order; `set-swap` fixes a character that drifted.

# Prerequisites

- Complete `run_001_safe_melvor_save_and_session_operations` (newest source, one client on the Chrome profile).
- Every write below is a preview until `--apply`; get the operator's approval on the preview, one character at a time.
- Hardcore: a simulated death rate above 0 is a stop sign. Standard: a death loses an equipped item.

# Procedure

1. Read the sets and the attack styles: `./melvor-report.js sets <character>` (items with quantities, spell and prayers per set).
2. Read the Abyssal levels: `./melvor-report.js export-state <character>` (`combatGoals.cappedSkills`, `abyssalLevel`). Gear,
   weapons and spells are locked by Abyssal level (e.g. Twisted Shortbow / Abyssal Staff at A1, Abyssal Wand A5, Shadow Wand
   A25, Witherbind Wand A35, Witherslinger Crossbow A37); a Normal-damage weapon cannot fight in the Abyss.
3. List the bank candidates per slot: `./melvor-report.js set-candidates <character> --style ranged|magic|melee`.
   It is a stat score (accuracy, strength or magic damage %, Abyssal resistance), not a simulation: read the passives line,
   check copies (an item used in another set needs a second copy) and two-handed weapons (no shield).
4. Missing an entry weapon (Rya had no Abyssal Staff): `./melvor-report.js craft <character> Runecrafting "Abyssal Staff"`
   previews inputs and the activity to resume; `--apply` crafts, then resumes the previous artisan recipe, Woodcutting
   trees, Harvesting vein or Mining rock. It refuses during combat.
5. Write a plan file (JSON list) and preview it:
   ```json
   [{ "setIndex": 7, "style": "magic", "spell": "Abyssal Eruption", "prayers": ["Augury"],
      "equipment": [["Weapon", "Toxic Fumes Wand"], ["Shield", "Abyssal Shield"], ["Summon1", "Imp"]] }]
   ```
   `./melvor-report.js set-plan <character> plan.json` shows each swap, the spell and prayer changes, and shortages.
   Weapon before Shield; stack slots (Summon, Quiver, Consumable) take the whole bank stack (split if several sets want it).
6. Apply: `./melvor-report.js set-plan <character> plan.json --apply`. It leaves a fight first (the game refuses set
   changes in some areas), equips into each target set, selects the spell in that set, goes back to the set in use, saves,
   and lists any `LEFT:` slot. Restart combat afterwards (`slayer-start <character> --slot N` or step 9).
7. Swap two sets: `./melvor-report.js set-swap <character> 6 7` (preview) then `--apply`. Both sets are emptied into the bank
   and refilled with the other's items, quantities, spell and prayers; `applied` means the after state matches exactly.
   **Never run it twice**: a second `--apply` swaps back.
8. Pick a training target: `./melvor-report.js train-targets <character> --slot N` simulates set N ([Myth] Combat Simulator,
   read-only) against every reachable Abyssal combat and slayer-area monster, best XP/h first with death rate and kill time.
9. Start it: `./melvor-report.js fight-start <character> "<monster>" --slot N` (preview) then `--apply`. The Slayer task is
   kept; resume it later with `slayer-start <character> --slot N`. Two things send a fight back to the task monster and
   are turned off when the target is not the task monster: the game's Auto Slayer setting and the **SEMI Auto Slayer** mod
   (its own checkbox, saved with the character; Rya had it on). `fight-start` records what it turned off in
   `journal/auto-slayer-off.json` and `slayer-start` turns only those back on. It also eats up to 80% HP first (a set with
   more max HP keeps the current HP) and refuses below 50%, and it waits for the new monster to spawn before saving: the
   save keeps the enemy in progress, so saving earlier resumes the old fight on the next load. Set the attack style for the XP wanted with
   `config-set <character> style <name>` (ranged Rapid/Accurate, not Longrange; magic Magic, not Defensive).

# Verification

- `sets <character>` after each apply: the target sets hold the plan, the selected set is the one in use before.
- `brief <character>`: action, monster and hit chance once the fight runs (the `hit 0%` printed by `slayer-start`/`fight-start`
  right after the start is read before the first attack).
- `source-of-truth`: the character's newest source is the one just saved.

# Rollback

- `set-plan` returns replaced items to the bank: write the reverse plan from the preview's `from` values and apply it.
- `set-swap` is its own inverse (apply it once more).
- A wrong fight: `slayer-start <character> --slot N` or `fight-start` on the previous monster.

# References

- `melvor-report.js` commands `sets`, `set-candidates`, `set-plan`, `set-swap`, `craft`, `train-targets`, `fight-start`
- `melvor-helpers.js` `mh.setsView`, `mh.setCandidates`, `mh.dungeonSetupApply` (spell per set), `mh.setSwap`, `mh.craft`, `mh.trainTargets`, `mh.fightStart`
- `run_001_safe_melvor_save_and_session_operations`, `run_008_apply_a_guarded_melvor_equipment_skilling_or_talent_action`
- Supersedes the fixed presets of `run_004_configure_abyssal_magic_equipment_set` (`magic-setup`).
