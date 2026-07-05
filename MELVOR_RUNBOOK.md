# Melvor runbook

## Read-only audit

```bash
./melvor-report.js slots
./melvor-report.js diff-slots
./melvor-report.js source-of-truth
./melvor-report.js improve
./melvor-report.js summary all
./melvor-report.js audit all
```

Source of truth is the newest save, local or cloud. If `source-of-truth` points at local,
do not load older cloud unless the user explicitly asks.

Use `./melvor-report.js improve` after sessions with failures or confusing behavior. Record repeated patterns in `AI_IMPROVEMENTS.md`.

## Propose gear or skilling changes

```bash
./melvor-report.js plan all
./melvor-report.js gear <character>
./melvor-report.js skilling <character>
```

Plans are suggestions only. Check whether each item is available and whether the slot makes sense for the current action.

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
