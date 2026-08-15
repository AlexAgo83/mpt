## run_001_safe_melvor_save_and_session_operations - Safe Melvor save and session operations
> Status: Active
> Category: support
> Verified: 2026-08-15 — validated with `source-of-truth`, `slots`, and the shared Chrome profile workflow.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger

- Before any Melvor session, especially before an equipment, prayer, potion, configuration, or combat change.
- When local and cloud saves disagree, the account is logged out, or a character must be switched.

# Prerequisites

- Run from the repository root with the logged-in shared Chrome profile available.
- `MELVOR_CHARACTERS` is configured in `.env.local`.
- Only one driver uses the shared Chrome profile; never load one character in two tabs.

# Procedure

1. Run `./melvor-report.js slots` and `./melvor-report.js source-of-truth`.
2. Treat the newest local or cloud save as authoritative. If local is newer, do not load the older cloud save.
3. For inspection, use read-only reports such as `brief`, `summary`, `gear`, `skilling`, and `audit`.
4. Before an approved write, name the exact character, slot/configuration, and intended source of truth. Load one character only, use `mh.equipSlot(item, slot)`, save, then reload and verify.
5. If login or session state is invalid, restart the shared profile visibly, let the operator authenticate, then return to headless use.

# Verification

- `source-of-truth` identifies the intended source for every character.
- After an approved write, `slots` shows the expected cloud/local convergence and a reload shows the intended equipment or configuration.

# Rollback

- Stop immediately on unexpected timestamp divergence. Do not overwrite a newer source; preserve it and ask the operator which save to retain.

# References

- `MELVOR.md`
- `melvor-report.js`
