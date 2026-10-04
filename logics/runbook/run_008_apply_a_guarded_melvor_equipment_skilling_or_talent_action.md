## run_008_apply_a_guarded_melvor_equipment_skilling_or_talent_action - Apply a guarded Melvor equipment, skilling, or talent action
> Status: Active
> Category: other
> Verified: 2026-10-03. `config-set` applied potions on GrifhinZ/Rya/Dash, prayers on Dash/Edalbraw/Kang, POIs on Dash/Edalbraw/Kang/Chap; re-read with `config all` and `brief all`. 2026-10-04, `config-set Kang style Block` preview listed `Stab, Slash, Block` (apply not yet exercised).
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: `task_005_implement_guarded_melvor_character_actions`
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-10-03 16:24:21

# Trigger
- A reviewed item swap, unlocked artisan recipe, or affordable Abyssal talent should be applied for one named character.

# Prerequisites
- Explicit operator approval for the exact character and action.
- `run_001_safe_melvor_save_and_session_operations` completed; no other browser driver uses the shared profile.
- A successful preview that shows no missing item/material/unlock prerequisite.

# Procedure
1. Inspect source safety and the target: `./melvor-report.js source-of-truth`, then use `brief`, `gear --detail`, `skilling`, or `talents` as applicable.
2. Preview exactly one action, without `--apply`:
   - `./melvor-report.js equip <character> <item> <slot> [--quantity n]`
   - `./melvor-report.js skill-start <character> <skill> <recipe>`
   - `./melvor-report.js talent-unlock <character> <skill> <node>`
   - `./melvor-report.js config-set <character> potion "<potion>"` | `prayers "<A>,<B>"` | `poi "<point of interest>"` | `style <name>` (current attack type only; the preview lists the available styles, e.g. melee `Stab, Slash, Block`, and `Block` trains Defence)
3. Confirm the preview's target and prerequisites with the operator. Do not substitute a similarly named item, recipe, or node.
4. Repeat the same command with `--apply`. It loads the authoritative local/cloud source, applies one change, saves, and re-reads the resulting state.
5. Run `brief <character>` or `journal <character> --record` to retain the observed result.

# Verification
- Equipment output shows `applied` and the final slot contains the requested item.
- Skilling output shows `applied`, the named active skill, and the selected recipe.
- Config output shows `applied`, the `final` potion/prayers/POI, and the new `hitChance` (an enemy change between samples moves it; confirm with `brief`). POI preview shows the travel `cost`.
- Talent output shows `applied`, the requested node unlocked, and fewer available points.
- A later `brief` uses the intended newest save source.

# Rollback
- Equipment: preview and apply the recorded prior item in the same slot.
- Skilling: stop or choose another task only with a new explicit approval.
- Config: re-run `config-set` with the previous potion, prayers, POI, or attack style recorded by the preview (POI travel costs GP again).
- Talent nodes cannot be refunded by this tool; do not apply a previewed node unless it is the intended choice.
- Stop on save-source divergence; never overwrite a newer local save with cloud data.

# References
- Related request: (none yet)
- Related backlog: (none yet)
- Related task: `task_005_implement_guarded_melvor_character_actions`
