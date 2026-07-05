# Melvor tooling

Read `MELVOR.md` first. These helpers inspect Melvor Idle through Chrome DevTools using the shared MCP Chrome profile.

Useful commands:

```bash
./melvor-report.js slots
./melvor-report.js diff-slots
./melvor-report.js summary all
./melvor-report.js plan all
./melvor-report.js export-state all > /tmp/melvor-state.json
```

Rules:

- Treat `Local Save / Most recent` plus `Cloud Save / Old save` as a stop sign before writes.
- Do not open the same character in two tabs.
- Use `mh.equipSlot(item, slot)` for manual equipment changes; do not rely on implicit slots.
- After approved writes, save, wait for cloud push, reload, and verify.
