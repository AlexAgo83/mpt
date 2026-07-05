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
- Combat recommendations must check equip requirements and source-of-truth before proposing or applying an item.
- Avoid parallel `melvor-report.js` calls on the same account; the debug-port lock is intentional.

### 2026-07-05 - GrifhinZ ranged recommendation miss
- Observed: I proposed `Blighted Feather Bow` from raw ranged stats, then the equip failed because GrifhinZ had Abyssal Ranged 16 and the bow requires 18.
- Impact: Wasted an apply attempt and only the cape swap succeeded.
- Root cause: `gear` ranks raw candidates without checking equip requirements.
- Fix shipped: `mh.gearAudit` now filters candidates that fail static equip requirements.
- Follow-up: Add readable locked-item reasons if we need to explain why a candidate is absent.

### 2026-07-05 - Local-first journal gap
- Observed: Several characters, including Edalbraw, had newer local saves while journal collection loaded cloud by default.
- Impact: Journal entries could describe stale gear/caps for local-first characters.
- Root cause: `collectJournal` reused the cloud-oriented character loader.
- Fix shipped: journal, summary, gear, audit, plan, combat-plan, and export-state now load the source-of-truth save.
- Follow-up: Reuse the source-aware loader in future write/apply workflows.

## Entry template

```markdown
### YYYY-MM-DD - Short title
- Observed:
- Impact:
- Root cause:
- Fix shipped:
- Follow-up:
```
