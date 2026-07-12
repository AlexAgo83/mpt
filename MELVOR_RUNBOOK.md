# Melvor runbook

## Read-only audit

```bash
./melvor-report.js slots
./melvor-report.js diff-slots
./melvor-report.js source-of-truth
./melvor-report.js improve
./melvor-report.js improve --record
./melvor-report.js brief all
./melvor-report.js summary all
./melvor-report.js audit all
```

Source of truth is the newest save, local or cloud. If `source-of-truth` points at local,
do not load older cloud unless the user explicitly asks.

Prefer `brief all` for account triage. It is the compact source for current-action status,
standard progression, abyssal progression, save risks, and top recommendations. It also
surfaces stopped/idle characters and rough runways for equipped consumables, ammo, summons,
and Slayer tasks when the game exposes the needed values.

Use `./melvor-report.js improve --record` after sessions with failures or confusing behavior.
Failed CLI runs are appended locally to `journal/incidents.jsonl` with sanitized messages and
stable signatures. `improve` reports signatures seen at least twice; `improve --record` records
the report and creates one Logics request per unpromoted recurring signature. It never changes
implementation code or game state. Review the request before promoting it to backlog work.

## Character journal and dashboard

```bash
./melvor-report.js journal <character>    # dry run: prints Markdown, writes nothing
./melvor-report.js journal all --record    # appends journal/ files + refreshes dashboard
./melvor-report.js journal all --record --save-backup  # also writes private save exports
./melvor-report.js save-backup all         # private save exports only
./melvor-report.js journal-status all      # compact offline account state
./melvor-report.js journal-diff all        # compact offline delta since previous observed scan
./melvor-report.js journal-action <id> dismissed   # offline status change (approved|dismissed|done|blocked)
```

When the user accepts or rejects a proposed action, record it with `journal-action` so the
next scan does not re-propose it. Applied equips are detected automatically and marked `done`.

Start-of-session rule for AI assistants: before recommending anything, read
`journal/latest.json` (per character: `observed` = game state, `previousObserved` =
minimal prior state for diffs, `analysis` = prior assistant interpretation, `decisions` =
user/session decisions) and `journal/actions.jsonl` (latest event per action id wins).
Prefer `journal-status` and `journal-diff` before a full scan when local context is enough.
Respect existing decisions:

- `dismissed`, `done`, `blocked`: do not re-propose unless the context hash changed.
- `proposed`, `approved`: still open; check for `stale` events before acting on them.
- `stale`: the observed state invalidated the recommendation; re-evaluate from scratch.

Open `journal/index.html` in a browser for account triage (works offline from disk).
The first view compares every character by current action, progress/ETA, active concern, and
next decision. Critical and high-priority characters sort first. Use priority, attention,
action, risk, and decision-status filters before opening details. Detail tabs show:

- `Current action`: task-specific recommendations, idle/stopped-task alerts, intervals,
  Slayer ETA, and consumable/ammo/summon runway where available
- `Level ETA`: time to next level, next 10-level milestone, and cap, when two journal
  snapshots provide a measurable standard or abyssal XP rate; abyssal thresholds are read
  from the game `abyssalExp.levelToXP` table
- `Alerts`: suspicious progress states such as active action with no positive XP or current
  XP lower than the previous observed scan
- `Standard plan`: standard-level gaps and standard combat setup direction
- `Abyssal plan`: abyssal-level gaps and abyssal dungeon direction; Cartography and
  Archaeology are excluded because they have no trainable Abyssal Levels
- `Equipment`: the current equipped items by slot
- `History`: recent deduplicated recommendations and progress observations

`analysis.insights` is the dashboard-facing structured source: each item has a stable id,
type, priority, severity, source, label, actionability, and optional ETA/metric fields. Legacy
analysis arrays remain available for CLI reports and older consumers.

Level ETA needs history. If it is empty after a fresh change, run another journal scan later
after the character has gained XP.

Journal generation is read-only and never mutates saves. Save backups are raw Melvor save
exports, so keep them only under git-ignored `journal/saves/`; the dashboard should show
metadata/hash/link, not embed the raw string. `journal/` is private local player data and
stays git-ignored — never stage or commit it. Executing proposed actions is out of scope:
it still requires `source-of-truth` checks and explicit user approval (see "Apply a
user-approved change").

## Propose gear or skilling changes

```bash
./melvor-report.js plan all
./melvor-report.js combat-plan <character>
./melvor-report.js combat-plan <character> --abyssal
./melvor-report.js combat-run <character> "Lair of the Spider Queen"
./melvor-report.js gear <character>
./melvor-report.js skilling <character>
```

Plans are suggestions only. Check whether each item is available and whether the slot makes sense for the current action.
Read commands load the source-of-truth save for each character: local when local is newer, cloud otherwise.
`gear` filters candidates the character cannot currently equip.
`combat-plan` lists accessible uncleared dungeons, capped skills that may need new cap rolls, the saved combat set that best matches the boss attack type, and simple next-setup notes such as prayers, summons, potions, and obvious cape swaps.
`combat-plan --abyssal` filters the readable plan to abyssal dungeons such as `Into the Abyss`.
`combat-run` loads the source-of-truth save, equips the matching saved combat set, starts one dungeon, monitors until completion/timeout/low HP, saves, and reports pending reward buttons.
After an Ancient Relics dungeon clear, stop before clicking `Claim` or any `Increase Level Cap` button unless the user has chosen the target cap; record the pending choice in the journal instead.

## Apply a user-approved change

1. Run `./melvor-report.js source-of-truth` and confirm the user wants to write to that source.
2. Load one character only.
3. Use `mh.equipSlot("Item Name", "Slot")`.
4. Run `await mh.save()`.
5. Reload the character and verify `mh.snapshot().equipment`.
6. Stop if local/cloud timestamps diverge unexpectedly.

## Recover when cloud is old

If local is newer and cloud is old:

1. Do not load the older cloud save unless the user explicitly asks.
2. Ask whether to preserve local as source of truth.
3. If approved, load the local save manually, run `await mh.save()`, then re-check `./melvor-report.js slots`.

## Login/session issues

If the headless profile shows demo/local-only state, open Chrome visibly with the shared profile, let the user log in, then retry.
