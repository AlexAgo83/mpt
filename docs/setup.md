# Setup and safety

## Browser setup

The tooling uses Chrome DevTools against the shared profile:

```text
~/.cache/chrome-devtools-mcp/chrome-profile
```

That profile must stay logged into Melvor Cloud. Chrome locks the profile, so only one assistant/browser driver should use it at a time.

If login expires, open the same profile visibly, let the user log in, then return to headless operation.

Local account settings can live in `.env.local`, copied from [`.env.example`](../.env.example).
That file is git-ignored. Put the private character roster there as
`MELVOR_CHARACTERS=Main,Alt1,Alt2`. It supports both the main profile and a separate test profile:

```bash
cp .env.example .env.local
npm run slots
npm run test:slots
```

## Safety model

Source of truth is the newest save, local or cloud.

Before any write:

```bash
./melvor-report.js slots
./melvor-report.js source-of-truth
```

Rules:

- Treat local/cloud disagreement as a stop sign until the intended source is clear.
- Never open the same character in two tabs.
- Do not load an older cloud save over a newer local save unless explicitly requested.
- Use `mh.equipSlot(item, slot)` for manual equipment changes.
- After approved writes, save, wait for cloud push, reload, and verify.
- After confusing behavior, run `./melvor-report.js improve --record`.
- CLI failures are sanitized into private `journal/incidents.jsonl` events. `improve` groups
  repeated signatures; only explicit `improve --record` creates an idempotent Logics request.
  The loop never changes code or game state automatically.
