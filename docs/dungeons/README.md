# Dungeon knowledge

Two sources, read before preparing any dungeon:

- **The live game** (through the CLI): monsters, entry requirements, clears, rewards. Plans > Dungeon path lists
  what to clear next and what blocks the rest.
- **The official wiki**: every dungeon has a page and a community **Guide** subpage (gear per phase, prayers,
  consumables, mechanics, choices). `./melvor-report.js dungeon-guide "<dungeon>"` fetches both through the
  wiki API and keeps a cleaned copy in `journal/guides/`.

Event dungeons do not behave like a monster list and get their own notes here:

- [Into the Mist](into-the-mist.md): 20 Afflicted waves, then a 3-phase boss that only takes damage from its own style.
- [Impending Darkness Event](impending-darkness.md): 5 rounds of 4 Slayer areas, a modifier pick each round,
  Bane in a random style (reroll by fleeing), and the final Bane, Instrument of Fear.

Runbooks: `logics/runbook/run_011` (any dungeon), `run_012` (Impending Darkness), `run_013` (Into the Mist).
