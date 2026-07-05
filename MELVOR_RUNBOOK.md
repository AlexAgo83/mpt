# Melvor runbook

## Read-only audit

```bash
./melvor-report.js slots
./melvor-report.js diff-slots
./melvor-report.js source-of-truth
./melvor-report.js improve
./melvor-report.js improve --record
./melvor-report.js summary all
./melvor-report.js audit all
```

Source of truth is the newest save, local or cloud. If `source-of-truth` points at local,
do not load older cloud unless the user explicitly asks.

Use `./melvor-report.js improve --record` after sessions with failures or confusing behavior.

## Character journal and dashboard

```bash
./melvor-report.js journal GrifhinZ        # dry run: prints Markdown, writes nothing
./melvor-report.js journal all --record    # appends journal/ files + refreshes dashboard
./melvor-report.js journal-action <id> dismissed   # offline status change (approved|dismissed|done|blocked)
```

When the user accepts or rejects a proposed action, record it with `journal-action` so the
next scan does not re-propose it. Applied equips are detected automatically and marked `done`.

Start-of-session rule for AI assistants: before recommending anything, read
`journal/latest.json` (per character: `observed` = game state, `analysis` = prior
assistant interpretation, `decisions` = user/session decisions) and `journal/actions.jsonl`
(latest event per action id wins). Respect existing decisions:

- `dismissed`, `done`, `blocked`: do not re-propose unless the context hash changed.
- `proposed`, `approved`: still open; check for `stale` events before acting on them.
- `stale`: the observed state invalidated the recommendation; re-evaluate from scratch.

Open `journal/index.html` in a browser for account triage (works offline from disk).
Journal generation is read-only and never mutates saves. `journal/` is private local
player data and stays git-ignored — never stage or commit it. Executing proposed actions
is out of scope: it still requires `source-of-truth` checks and explicit user approval
(see "Apply a user-approved change").

## Propose gear or skilling changes

```bash
./melvor-report.js plan all
./melvor-report.js combat-plan Edalbraw
./melvor-report.js gear <character>
./melvor-report.js skilling <character>
```

Plans are suggestions only. Check whether each item is available and whether the slot makes sense for the current action.
Read commands load the source-of-truth save for each character: local when local is newer, cloud otherwise.
`gear` filters candidates the character cannot currently equip.
`combat-plan` lists accessible uncleared dungeons, capped skills that may need new cap rolls, and the saved combat set that best matches the boss attack type.
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
