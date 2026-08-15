## run_003_defeat_felth_in_depths_of_decay - Defeat Felth in Depths of Decay
> Status: Active
> Category: support
> Verified: 2026-08-15 — Dash live audit identified Felth, Toxin protection, melee hit chance, and equipped-item passives.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger

- A character cannot defeat Felth, the Toxic Martyr, in the Abyssal dungeon Depths of Decay.

# Prerequisites

- Complete the safe save/session runbook first.
- Confirm with `./melvor-report.js brief <character>` that `combat.area` is `Depths of Decay` and `combat.dungeonBoss` is Felth.
- Use `./melvor-report.js gear <character> --detail` before proposing changes.

# Procedure

1. Confirm the equipped helmet is **Toxic Protection Mask**. Its Toxin and Blight protection is the primary gate: Felth can heal through Toxin. Do not replace it with a higher-stat Slayer helmet during the encounter.
2. Record current player style and hit chance. A melee hit chance around 35% is not a viable Felth build; do not try to solve it only with raw melee upgrades.
3. Prefer the Depths of Decay guide's magic route: appropriate magic set, Brume Eruption (Gloom Eruption when available), Despair, Surge II, Ravage plus Instability, then Devastation when eligible.
4. Use Critical Strike Potion IV when owned. Do not substitute a generic Dungeon plan's prayer or potion recommendation without checking it against Felth.
5. Check the guide's global configuration: Academia Arcanum point of interest and the relevant Agility accuracy/boss-damage choices. State the exact missing configuration and benefit before requesting approval to change it.
6. Preserve survival: Tormented Ring's accuracy costs 50 defence, and many melee candidates remove Abyssal resistance. Make a swap only if it remains safe for Felth's ranged damage.
7. After user-approved changes, re-run `brief` and `gear --detail`; report Felth hit chance, attack style, mask status, food, and save source.

# Verification

- Toxic Protection Mask remains equipped, the active style is the intended one, hit chance and survival are acceptable, and Felth no longer out-heals damage.

# Rollback

- Re-equip the recorded prior set only after stopping the dungeon and confirming the latest save source. Do not overwrite a newer local save with cloud data.

# References

- [Depths of Decay guide](https://wiki.melvoridle.com/w/Depths_of_Decay/Guide)
- `run_001_safe_melvor_save_and_session_operations`
- `run_002_task_aware_melvor_equipment_and_configuration_audit`
