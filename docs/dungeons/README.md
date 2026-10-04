# Dungeon knowledge

Two sources, read before preparing any dungeon:

- **The live game** (through the CLI): monsters, entry requirements, clears, rewards. Plans > Dungeon path lists
  what to clear next and what blocks the rest.
- **The official wiki**: every dungeon has a page and a community **Guide** subpage (gear per phase, prayers,
  consumables, mechanics, choices). `./melvor-report.js dungeon-guide "<dungeon>"` fetches both through the
  wiki API and keeps a cleaned copy in `journal/guides/`.

## From check to run

1. `dungeon-check <character> "<dungeon>"`: entry requirements and the hardest fights simulated with each
   combat set (S1-S3, or S5-S7 in the Abyss), against the death threshold (0% Hardcore, 1% otherwise,
   `MELVOR_DEATH_THRESHOLD`). The verdict also shows in Plans > Dungeon path.
2. `dungeon-optimize <character> "<dungeon>"`: owned gear, potion and prayers that bring the hardest fight
   under the threshold, per style. Read-only.
3. `dungeon-setup <character> "<dungeon>" [--style melee,ranged]`: the plan against each set it targets and
   the items several sets would need at once; `--apply` equips it (refused on any shortage) and records the
   replaced gear. The combat potion is shared by every set: it is not changed.
4. `combat-run <character> "<dungeon>" --slot N`: runs the dungeon with the checked set and flees on low HP.
   The game repeats the dungeon afterwards: `dungeon-setup ... --restore --apply` puts the daily gear back,
   then `slayer-start --slot N` puts the character back on its task.

Event dungeons do not behave like a monster list and get their own notes here:

- [Into the Mist](into-the-mist.md): 20 Afflicted waves, then a 3-phase boss that only takes damage from its own style.
- [Impending Darkness Event](impending-darkness.md): 5 rounds of 4 Slayer areas, a modifier pick each round,
  Bane in a random style (reroll by fleeing), and the final Bane, Instrument of Fear.

Runbooks: `logics/runbook/run_011` (any dungeon), `run_012` (Impending Darkness), `run_013` (Into the Mist).
