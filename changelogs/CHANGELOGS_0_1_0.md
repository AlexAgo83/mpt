# Changelog (`0.0.0 -> 0.1.0`)

Release date: 2026-07-11

## Major Highlights

- MPT 0.1.0 is the first public release of the local-first Melvor Idle assistant toolkit.
- It provides dependency-free Node.js commands for inspecting a logged-in Melvor Cloud account through Chrome DevTools.
- It adds a durable character journal, structured action ledger, offline dashboard, and compact status/diff views for assistant handoff.

## At a glance

- Added Chrome DevTools driven Melvor account inspection through `melvor-report.js` and `melvor-helpers.js`.
- Added source-of-truth checks for local versus cloud saves before risky work.
- Added read-only reports for slots, summaries, audits, gear, skilling, combat plans, and compact AI briefs.
- Added append-only character journal generation with `latest.json`, `actions.jsonl`, Markdown entries, and an offline dashboard.
- Added `journal-status` and `journal-diff` for compact offline triage without opening Chrome.
- Added snapshot-based standard and abyssal level ETA reporting.
- Added private save backup support under the git-ignored `journal/` directory.
- Added offline action lifecycle tracking with proposed, approved, done, blocked, dismissed, and stale states.
- Added Melvor runbook, assistant handoff docs, security notes, contribution guide, and Logics workflow corpus.
- Added GitHub Actions CI for dependency-free syntax and journal self-check validation.

## Security and privacy

- Generated journal artifacts, raw saves, credentials, local Chrome profile paths, and account-specific character rosters stay out of version control.
- The public repository keeps private account roster configuration in `.env.local` via `MELVOR_CHARACTERS`.

## Validation and Regression Evidence

```bash
npm run check
logics-manager lint --require-status
logics-manager audit --group-by-doc
```

## Notes

- This is the first release changelog; it summarizes the bootstrap from empty project through the 0.1.0 foundation.
- `package.json` is marked `private`; this is local account tooling, not a published package.
