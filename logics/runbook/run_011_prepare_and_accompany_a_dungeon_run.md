## run_011_prepare_and_accompany_a_dungeon_run - Prepare a character for a dungeon and accompany the run
> Status: Draft
> Category: support
> Verified: (not yet verified). Written 2026-10-04 from the wiki guides and the simulator probes; no live dungeon run yet.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger
- The operator wants a character to clear a dungeon, Abyss depth or stronghold (Plans goal "Dungeon path", or a named target).

# Prerequisites
- `run_001_safe_melvor_save_and_session_operations`: newest save known.
- The dungeon's knowledge is read: `./melvor-report.js dungeon-guide "<dungeon>"` (wiki page + community Guide, cached in `journal/guides/`), plus `docs/dungeons/<dungeon>.md` when it exists (event dungeons: Into the Mist, Impending Darkness).
- Into the Abyss content is only for characters already in the Abyss (`mh.abyssOpen`).
- Equipment set roles (default for this account): S1 melee, S2 ranged, S3 magic, S4 skilling, S5 abyssal melee, S6 abyssal ranged, S7 abyssal magic. Dungeon sets go into the role matching their style; never overwrite S4.
- Death threshold: 0% simulated deaths for Hardcore, at most 1% for Standard, unless the operator sets another.

# Procedure
1. **Read the target** (read-only): requirements still missing (`Plans > Dungeon path`), monsters and mechanics from the guide, recommended sets, prayers, potions, familiars, Agility obstacles, Astrology and Cartography point of interest.
2. **Simulate** with `journal <character> --record --sim` and the dungeon probes: per monster or per phase, in the style the fight imposes. A dungeon the simulator cannot run (event dungeons) is simulated boss by boss in the required style.
3. **Close the gap** until every fight is at or under the threshold: owned gear first (Upgrades > Equip from your bank), then gear to loot or craft, then prayers/potion/food, then Agility, Cartography and Astrology modifiers. Re-simulate after each change.
4. **Set up** with guarded commands, one at a time, preview then `--apply`: `equip` per slot into the role's set, `config-set <character> potion|prayers|poi|style`, `combat-setup`. Agility course changes are not automated yet: do them in game or by hand through MCP, then re-read with `config`.
5. **Run**: `combat-run <character> "<dungeon>"` starts and follows the dungeon (10 min default timeout). Pending reward or level-cap choices are reported, never taken blindly: decide them from the guide and the character's goal, then click.
6. **Record**: `journal <character> --record` and note the result (clear, death, loot) in the character journal.

# Verification
- `brief <character>` no longer lists the dungeon as next; Plans > Dungeon path moves on.
- No unexpected item loss (compare equipment before and after).

# Rollback
- Restore the previous set, prayers, potion and Slayer task with the guarded commands. Never load an older save over a newer one.

# References
- `docs/dungeons/`, `dungeon-guide`, `combat-setup`, `combat-run`, `config-set`, `equip`
- `run_010_prepare_and_run_a_standard_dungeon_with_combat_setup_and_combat_run`
- `run_012_impending_darkness_event`, `run_013_into_the_mist`
