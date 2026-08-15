## run_007_launch_the_local_melvor_dashboard_and_verify_account_connection - Launch the local Melvor dashboard and verify account connection
> Status: Active
> Category: support
> Verified: 2026-08-15 — local dashboard launch and HTTP check passed
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: `task_004_implement_journal_cockpit_v2_and_structured_insights`
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger
- A local dashboard is wanted, or its Melvor connection needs checking.

# Prerequisites
- The shared Chrome profile is logged into Melvor.
- No other `melvor-report` browser command is running.

# Procedure
1. Start `./melvor-report.js journal-serve`.
2. Open `http://127.0.0.1:8787` and select Refresh.
3. If Melvor is not connected, sign in on the official Melvor page using the shared browser profile. Do not enter credentials into MPT.

# Verification
- The dashboard loads with its crest and a refreshed timestamp.
- A journal refresh completes without a source-of-truth warning.

# Rollback
- Stop the local dashboard with Ctrl-C. It does not alter game state.

# References
- Related request: (none yet)
- Related backlog: (none yet)
- Related task: `task_004_implement_journal_cockpit_v2_and_structured_insights`
