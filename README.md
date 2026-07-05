# Melvor tooling

Read `MELVOR.md` first. These helpers inspect Melvor Idle through Chrome DevTools using the shared MCP Chrome profile.

Useful commands:

```bash
./melvor-report.js slots
./melvor-report.js diff-slots
./melvor-report.js source-of-truth
./melvor-report.js improve
./melvor-report.js summary all
./melvor-report.js plan all
./melvor-report.js export-state all > /tmp/melvor-state.json
```

Rules:

- Source of truth is the newest save, local or cloud; run `source-of-truth` before writes.
- Treat disagreement between local and cloud as a stop sign until the intended source is clear.
- Do not open the same character in two tabs.
- Use `mh.equipSlot(item, slot)` for manual equipment changes; do not rely on implicit slots.
- After approved writes, save, wait for cloud push, reload, and verify.
- After a messy session, run `./melvor-report.js improve` and update `AI_IMPROVEMENTS.md` if a pattern repeats.
