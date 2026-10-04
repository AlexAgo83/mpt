# Journal and dashboard

`journal [all|character]` prints a Markdown entry per character (state, save-risk context,
recommendations, current-action plan, standard plan, abyssal plan, proposed actions, history).
`--record` writes into the git-ignored `journal/` directory:

- `journal/<Character>.md`: append-only Markdown journal per character
- `journal/latest.json`: structured snapshot; per character it separates `observed` (game
  state), `previousObserved` (minimal prior snapshot for diffs), `analysis` (assistant
  interpretation, including deduplicated typed `insights`), and `decisions` (user/session
  decisions). Account `operations` counts alerts, idle characters, near-term completions,
  open decisions, and stale decisions.
- `journal/actions.jsonl`: append-only action ledger with stable action ids, status,
  risk, reason, timestamps, and a context hash
- `journal/saves/`: private save-string backups. `*.latest.txt` contains the latest raw
  export per character, dated archives keep recent history, and `manifest.jsonl` stores
  only metadata (timestamp, source, byte size, hash, relative path)
- `journal/completion.jsonl`: one Completion Log row per character and refresh (also written by
  `completion --record`); runs print the delta since the previous row
- `journal/index.html`: offline decision cockpit with account indicators, priority/attention
  filtering, a responsive character comparison view, and Now/Skills/Completion/Equipment/Upgrades/Inventory/Plans/History
  detail tabs, shown as an icon-only switch (hover or screen reader gives the name). It opens directly from disk and links to the full Markdown journals.
  Run `./melvor-report.js journal-serve` and open `http://127.0.0.1:8787` to enable the
  dashboard's read-only refresh button for one character or the whole account. It never
  changes game state; it only runs `journal <character> --record` locally.
- `Upgrades`: per equipped slot, better gear in three lanes: equip from your bank (owned and
  equippable), next loot (monster with the best drop chance, shown in %) and next craft, each with
  up to three alternatives and its first passives. Compatibility comes from live game metadata
  (style, active damage type, requirements). The score weighs attack, strength and defence
  bonuses plus resistance for the realm being fought (normal or abyssal, x10); items whose
  passives slow attacks never count as upgrades. Other passives and game-mode restrictions
  are not scored by that formula: read the passive chips, or run `journal <character> --record --sim`.
  With `--sim`, every candidate is replayed on the current target in [Myth] Combat Simulator
  (all passives, prayers, potions and the Slayer task included): tiles show the XP/h change, kill
  time and deaths, losers are dimmed and the bank lane is reordered by the simulated gain. It needs
  the simulator mod on the account, adds about 30 s per character, and the dashboard Refresh button
  uses it when one character is selected. A Slayer task is refreshed when its target changes.
- `Plans` goals: one per character, picked in the Plans tab and saved in the git-ignored
  `journal/goals.json` (the Next column and To do follow it). Progression (below), Dungeon path
  (dungeons, Abyss depths and strongholds in game order, next to clear and what blocks the rest),
  Completion (items never found that one action makes, monsters never killed, near-max masteries,
  pets), Target item (sources, drop chance and average farm time with `--sim`), Mastery pools
  (closest checkpoint), Profit (GP/h), AFK (no deaths, 12 h+ of materials), Slayer, Hardcore safe
  (fights simulated at 0% deaths; default for Hardcore characters), Capes & pets and Shop. Into the
  Abyss content only appears once the character is in the Abyss (`mh.abyssOpen`).
- Progression plan: for the lowest skills, the best-XP recipe with materials for 8 h or more, and for
  gathering skills (Woodcutting, Fishing, Mining, Thieving, Astrology, Harvesting) the best
  unlocked action; when the ETA mod is installed its XP/h (all modifiers) replaces the base rate,
  marked (ETA). The skill already being trained is skipped. During a Slayer task the plans
  are listed as "After the Slayer task" and stay out of Next and To do.
- `Level ETA`: projected time to next level, next 10-level milestone, and current cap when
  two journal snapshots have enough standard or abyssal XP gain to estimate a rate; abyssal
  thresholds come from the game `abyssalExp.levelToXP` table; otherwise it explains what
  data is still missing

`journal-status` and `journal-diff` are offline, compact views over `journal/latest.json`.
Use them before asking for a full scan: they summarize current actions, ETA lines, alerts,
save risks, backups, XP deltas, and consumed equipment quantities without opening Chrome.

The dashboard highlights stopped/idle characters. If a character was previously doing a
task and is now idle, the next journal refresh records a recommendation such as "current
action stopped after Smithing; check resources/recipe inputs before restarting".
Level ETA is intentionally snapshot-based: the first scan records XP, and later scans show
projections only when enough time and XP changed to produce a useful estimate.

Decisions come from two sources: owned gear the simulator proves better (more XP/h, no extra deaths, only judged on a
`--sim` scan) and the first step of the character's Plans goal. Each open decision has Done, Approve and Dismiss
buttons in the Plans tab (served dashboard; from disk the button copies the `journal-action` command). The To do
pill in the top bar counts one item per character (save risk, alert, goal step, ready farming, finished Slayer
task) and opens the list; an item opens that character on its Plans tab.

Action lifecycle statuses: `proposed` → `approved` → `done`, or `blocked` / `dismissed`;
an open action becomes `done` automatically when the observed equipment matches it, or
`stale` when the observed state no longer produces the recommendation. Change a status
manually with `journal-action <id> <approved|dismissed|done|blocked>` (offline, no browser).
Dismissed/done/blocked actions are not re-proposed unless their context hash changes.
Journal generation is read-only against the game and never writes local profile paths.
Save backups are opt-in with `save-backup` or `journal --save-backup`; the raw save strings
stay under git-ignored `journal/saves/` and are not embedded into `latest.json` or the
dashboard. `journal/` is private local player data and must never be committed. Executing
actions stays out of scope; any future apply-action flow still requires `source-of-truth`
checks and explicit user approval.
