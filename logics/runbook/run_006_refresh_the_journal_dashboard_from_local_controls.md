## run_006_refresh_the_journal_dashboard_from_local_controls - Refresh the journal dashboard from local controls
> Status: Active
> Category: support
> Verified: 2026-08-15 — offline checks and local HTTP rendering passed
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: `task_004_implement_journal_cockpit_v2_and_structured_insights`
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger
- A fresh character journal is wanted from the dashboard instead of the terminal.

# Prerequisites
- A prior `journal --record` has created `journal/index.html`.
- The shared Melvor browser profile is not being used by another `melvor-report` command.

# Procedure
1. Start the local-only dashboard server:
   ```bash
   ./melvor-report.js journal-serve
   ```
2. Open `http://127.0.0.1:8787`.
3. Choose one character or `tous les personnages`, then select `Rafraîchir`.
4. Wait for the page to reload. This runs `journal <character> --record` only; it does not change game state.

# Verification
- The timestamp headed `Relevé du` updates.
- The selected character's Markdown journal receives a new entry and `journal/latest.json` is refreshed.

# Rollback
- Stop the terminal process with Ctrl-C. The generated journal remains available offline.

# References
- Related request: (none yet)
- Related backlog: (none yet)
- Related task: `task_004_implement_journal_cockpit_v2_and_structured_insights`
