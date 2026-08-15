## run_004_configure_abyssal_magic_equipment_set - Configure an Abyssal Magic equipment set
> Status: Active
> Category: support
> Verified: 2026-08-15 — GrifhinZ slot 6 configured and re-read with Despair Wand, Abyssal Blast, Damage Reduction Potion IV, Mystic Lore, and Augury.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-08-15 17:24:09

# Trigger

- A character needs the dedicated Abyssal Magic preset in a numbered equipment slot.

# Prerequisites

- Obtain explicit approval: this changes equipment, prayer, potion, spell selection, and saves the game.
- Complete `run_001_safe_melvor_save_and_session_operations`.
- Run the preview first. It validates bank ownership and shows the set's present contents.

# Procedure

1. Inspect without a write: `./melvor-report.js magic-setup <character> --slot 6`.
2. Confirm the preview has no `missing` line. The preset is Infernal Mythical Wizard Hat, Infernal Legendary Wizard Robes, Infernal Mythical Wizard Bottoms/Boots, Blighting Gloves, Fury of the Elemental Zodiacs, Abyss Ring, Superior Max Skillcape, Thorn Defender, Agile Gem, and Despair Wand.
3. Apply it: `./melvor-report.js magic-setup <character> --slot 6 --apply`.
4. The script first removes a shield if needed: Despair Wand is incompatible with the shield slot. It then equips the wand, activates Damage Reduction Potion IV, enables Mystic Lore and Augury, and selects Fire Surge. Despair Wand has Normal Damage, so do not select Abyssal Blast; Melvor rejects that damage-type mismatch.
5. Re-run the preview. It must list `Despair Wand` in `current slot items`. If the wand is absent, do not describe the setup as complete.

# Verification

- The apply command saves via the newest local/cloud source and reports the source before and after internally.
- The final preview contains Despair Wand and does not contain the displaced shield.
- Fire Surge, Mystic Lore, Augury, and Damage Reduction Potion IV are global combat settings; verify them again when changing to a different combat task.

# Rollback

- The prior set is replaced. Use the pre-apply preview to restore its recorded items deliberately, then verify with another preview. Do not blindly load an older cloud save over a newer local save.

# References

- `melvor-report.js magic-setup`
- `run_001_safe_melvor_save_and_session_operations`
- `run_002_task_aware_melvor_equipment_and_configuration_audit`
