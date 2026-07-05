# Melvor runbook

## Read-only audit

```bash
./melvor-report.js slots
./melvor-report.js diff-slots
./melvor-report.js summary all
./melvor-report.js audit all
```

If `diff-slots` shows local newer than cloud, report it before making recommendations that assume cloud is current.

## Propose gear or skilling changes

```bash
./melvor-report.js plan all
./melvor-report.js gear <character>
./melvor-report.js skilling <character>
```

Plans are suggestions only. Check whether each item is available and whether the slot makes sense for the current action.

## Apply a user-approved change

1. Run `./melvor-report.js slots` and confirm the user wants to write to the save you will load.
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
