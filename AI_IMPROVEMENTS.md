# AI improvement ledger

Run after meaningful sessions:

```bash
./melvor-report.js improve
```

Purpose: capture what made the assistant less reliable, then promote only repeated pain into code or cookbook changes.

## Current known opportunities

- Build an approved local-first write workflow before any automatic apply command. Source of truth is often local, not cloud.
- After any write, verify cloud/local catch-up with `./melvor-report.js slots` or `source-of-truth`.
- Promote repeated one-off browser scripts into `melvor-report.js`; do not keep copy-pasting mutation scripts.

## Entry template

```markdown
### YYYY-MM-DD - Short title
- Observed:
- Impact:
- Root cause:
- Fix shipped:
- Follow-up:
```
