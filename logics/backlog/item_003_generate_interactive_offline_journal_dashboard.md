## item_003_generate_interactive_offline_journal_dashboard - Generate interactive offline journal dashboard
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90%
> Confidence: 85%
> Progress: 0%
> Complexity: Medium
> Theme: Melvor assistant dashboard
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.

# Problem
- The player needs a fast visual entrypoint for all characters, not seven separate files.
- A dashboard that only looks good but cannot filter risks/actions will not help account triage.
- A framework app would add build/runtime cost that the repository has deliberately avoided.

# Scope
- In:
  - Generate `journal/index.html` with embedded CSS and JavaScript.
  - Use `journal/latest.json` data embedded into the HTML or loaded from a sibling file with a clear browser-open fallback.
  - Show compact cards or rows for every configured character.
  - Add search plus filters for character, current action, save risk, action status, and stale observations.
  - Show account-level summary indicators and per-character detail expansion.
  - Link each character to its Markdown file.
  - Use a restrained, tool-like layout optimized for scanning and repeated use.
- Out:
  - React/Vite/Next or any frontend framework.
  - Server-side rendering, local API server, hosting, or authentication.
  - Persisting checkbox changes from the dashboard UI back to disk.
  - Decorative landing pages or marketing-style hero sections.

# Acceptance criteria
- `journal/index.html` opens directly from disk and renders without external network assets.
- Dashboard text fits at desktop and mobile widths without overlapping.
- Search and all filters update the visible character list without reloading.
- Save-risk and stale-data states are visually prominent and not color-only.
- Each character exposes top recommendations, proposed/approved/blocked actions, current action, last observed time, and a Markdown link.
- The generated HTML escapes data safely before injecting it into the page.
- `npm run check` passes after implementation.

# AC Traceability
- request-`journal all --record` writes sanitized per-character Markdown, `journal/latest.json`, and `journal/index.html` from one read-only collection pass. -> This backlog slice. Proof: `journal/index.html` opens directly from disk and renders without external network assets.
- request-The dashboard reads embedded or adjacent sanitized data and supports search, character filter, current-action filter, save-risk filter, action-status filter, stale-data highlighting, and per-character detail expansion. -> This backlog slice. Proof: Dashboard text fits at desktop and mobile widths without overlapping.
- request-The dashboard surfaces account-level indicators: last scan time, save risks, stale characters, pending approved actions, blocked actions, and top-priority recommendations. -> This backlog slice. Proof: Search and all filters update the visible character list without reloading.
- request-No generated file contains credentials, environment variables, save strings, absolute Chrome profile paths, or raw browser debugging URLs. -> This backlog slice. Proof: Save-risk and stale-data states are visually prominent and not color-only.
- request-Implementation keeps the repository dependency-free and validates with `npm run check`, CLI help, a dry-run journal command, and recorded dashboard generation. -> This backlog slice. Proof: Each character exposes top recommendations, proposed/approved/blocked actions, current action, last observed time, and a Markdown link.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_003_melvin_journal_operating_model_and_dashboard`
- Architecture decision(s): (none yet)
- Request: `req_001_journal_operating_model_and_interactive_dashboard`
- Primary task(s): `task_002_implement_journal_data_model_ledger_dashboard_and_lifecycle_docs`

# AI Context
- Summary: Generate interactive offline journal dashboard
- Keywords: scaffolded-backlog, generate interactive offline journal dashboard, implementation-ready
- Use when: Implementing the scaffolded slice for Generate interactive offline journal dashboard.
- Skip when: The change belongs to another backlog slice.

# Priority
- Priority: High
- Rationale: Set by scaffold input or defaulted for grooming.
