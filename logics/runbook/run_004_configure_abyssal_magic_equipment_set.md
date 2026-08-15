## run_004_configure_abyssal_magic_equipment_set - Configure Abyssal Magic and restore Abyssal Ranged
> Status: Active
> Category: support
> Verified: 2026-08-15 — GrifhinZ slot 6 configured and re-read with Abyssal Staff, Abyssal Blast, Damage Reduction Potion IV, Mystic Lore, and Augury.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-08-15 17:35:52

# Trigger

- A character needs the dedicated Abyssal Magic preset in a numbered equipment slot.
- A Normal-Damage magic build is attempted in an Abyssal area and Melvor reports `Damage Type not allowed`.

# Prerequisites

- Obtain explicit approval: this changes equipment, prayer, potion, spell selection, and saves the game.
- Complete `run_001_safe_melvor_save_and_session_operations`.
- Run the preview first. It validates bank ownership and shows the set's present contents.

# Procedure

1. Inspect without a write: `./melvor-report.js magic-setup <character> --slot 6`.
2. Confirm the preview has no `missing` line. The preset is Infernal Mythical Wizard Hat, Infernal Legendary Wizard Robes, Infernal Mythical Wizard Bottoms/Boots, Blighting Gloves, Fury of the Elemental Zodiacs, Abyss Ring, Superior Max Skillcape, Thorn Defender, Agile Gem, and Abyssal Staff.
3. Apply it: `./melvor-report.js magic-setup <character> --slot 6 --apply`.
4. The script first removes a shield if needed: Abyssal Staff is two-handed. It then equips the staff, activates Damage Reduction Potion IV, enables Mystic Lore and Augury, and selects Abyssal Blast.
5. Re-run the preview. It must list `Abyssal Staff` in `current slot items`. If the staff is absent, do not describe the setup as complete.
6. Train Magic abyssale from 1 to 5 with this set, then equip the owned Abyssal Wand. Despair Wand has Normal Damage and cannot run an Abyssal area. Restore the Ranged set with `./melvor-report.js magic-setup <character> --slot 6 --restore-ranged --apply` only when Magic combat is not the immediate objective.

# Verification

- The apply command saves via the newest local/cloud source and reports the source before and after internally.
- The final preview contains Despair Wand and does not contain the displaced shield.
- Abyssal Blast, Mystic Lore, Augury, and Damage Reduction Potion IV are global combat settings; verify them again when changing to a different combat task.
- The restored Ranged set contains Blighted Feather Bow, Abyssium Arrows, Toxic Protection Mask, Bundled Protection Body, Thorn Legs, Abyssal Leather Boots, Amulet of Distance, Woeful Gloves, Ranged Hinder Scroll, and the retained Abyss Ring/cape/passive/gem.

# Rollback

- The prior set is replaced. Use the pre-apply preview to restore its recorded items deliberately, then verify with another preview. Do not blindly load an older cloud save over a newer local save.

# References

- `melvor-report.js magic-setup`
- `run_001_safe_melvor_save_and_session_operations`
- `run_002_task_aware_melvor_equipment_and_configuration_audit`
