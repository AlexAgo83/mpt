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

### 2026-07-05 - Edalbraw dungeon run dogfood
- Observed: `Lair of the Spider Queen` cleared on Edalbraw with set 0 melee; HP stayed safe, ending at 1135/1175, then combat stopped with `Claim` and many `Increase Level Cap` / `Increase Abyssal Level Cap` buttons visible.
- Impact: The assistant can start and monitor a dungeon, but cannot yet summarize post-clear reward/cap choices or choose a cap safely.
- Root cause: Combat automation is still one-off CDP scripting; `combat-plan` predicts targets but does not execute, monitor, or detect post-clear decisions.
- Fix shipped: Journal refreshed after the clear so future planning sees the new state; `combat-run <character> <dungeon>` now source-loads, equips the recommended set, starts combat, monitors transitions where `fightInProgress=false` between enemies, saves on completion, and reports pending reward/cap buttons without choosing them.
- Follow-up: Add reward/cap-choice inspection so the assistant can explain the pending cap options before asking the user to choose.

### 2026-07-05 - Melvor report lock ergonomics
- Observed: I accidentally ran `source-of-truth` in parallel with `journal --record`; the port lock correctly rejected one command.
- Impact: Harmless, but it wastes time and creates noisy failures during multi-step Melvor sessions.
- Root cause: The CLI has a single DevTools port and lock, while the assistant habitually parallelizes independent shell reads.
- Fix shipped: none.
- Follow-up: Never parallelize `melvor-report.js` commands for the same account; optionally add a small queue/retry wrapper for read-only commands.

### 2026-07-05 - Edalbraw combat setup recommendations
- Observed: Edalbraw's next target is `Cursed Forest`; set 1 ranged is appropriate, but no prayers were active and the cape can improve from `Ancient Infernal Cape` to `Maximum Skillcape`.
- Impact: `combat-plan` needed to surface setup recommendations, not only target dungeon names.
- Root cause: Combat planning separated target choice from pre-run setup.
- Fix shipped: `combatGoals.nextSetup` now records recommended set, simple prayers, and obvious cape swaps; the journal records those recommendations.
- Follow-up: Add an apply command for approved combat setup changes, including prayers, without starting a dungeon.

## Entry template

```markdown
### YYYY-MM-DD - Short title
- Observed:
- Impact:
- Root cause:
- Fix shipped:
- Follow-up:
```
