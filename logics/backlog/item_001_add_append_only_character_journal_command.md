## item_001_add_append_only_character_journal_command - Add append-only character journal command
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90
> Confidence: 85
> Progress: 0
> Complexity: Medium
> Theme: Melvor assistant reporting
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.

# Problem
- Recommendations and plans are currently transient CLI output.
- A new AI session has to rediscover each character's context unless the user summarizes it manually.
- There is no durable per-character place to track proposed actions and optimization history.
- Markdown alone is useful for handoff, but the player wants an interactive overview to scan all characters quickly.

# Scope
- In:
  - Add `journal` to the accepted command list and usage text in `melvor-report.js`.
  - Generate Markdown entries from existing report, audit, skilling, gear, plan, and source-of-truth data.
  - When `--record` is passed, append entries to `journal/<Character>.md` and create `journal/account.md` only if account-level source-of-truth notes are useful.
  - Generate or refresh a dependency-free `journal/index.html` dashboard from the same collected data.
  - Dashboard interactions: search/filter characters, filter by save-risk/action, expand recommendations/actions, and link to per-character Markdown files.
  - Document the command in README and MELVOR_RUNBOOK.
  - Add a minimal self-check if non-trivial formatting helpers are introduced.
- Out:
  - Parsing or updating checkbox state from old journal entries.
  - Any write/apply-plan automation.
  - A hosted dashboard, database, server, frontend framework, or new dependency.
  - Recording raw save strings, credentials, or local profile paths.

# Acceptance criteria
- `./melvor-report.js journal GrifhinZ` prints Markdown with headings for State, Recommendations, Optimization plan, Proposed actions, and History.
- `./melvor-report.js journal all --record` appends per-character files in `journal/` with deterministic filenames based on configured character names.
- `./melvor-report.js journal all --record` writes `journal/index.html` with embedded CSS/JS and enough embedded sanitized data to browse the latest generated state offline.
- The dashboard shows all configured characters with current action, source-of-truth/save-risk status, top recommendations, and proposed actions.
- The dashboard supports at least text search and risk/action filters without requiring a dev server.
- The command refuses unknown character names the same way other single-character commands do, or clearly reports the load failure without partial writes for that character.
- Entries include save-source risk text derived from the same slot/source-of-truth logic used by `source-of-truth`.
- Recommendations and proposed actions are derived from existing `planLines`, skilling notes, and audit candidates where available.
- Generated Markdown and dashboard data do not include environment variables, Chrome profile paths, remote debugging ports unless already part of normal smoke output, or save strings.
- `npm run check`, `./melvor-report.js --help`, a single-character dry run, and a recorded all-character dashboard generation are executed and documented at closeout.

# AC Traceability
- request-A new CLI command `journal [all|character] [--record]` is documented in the help output and README command list. -> This backlog slice. Proof: `./melvor-report.js journal GrifhinZ` prints Markdown with headings for State, Recommendations, Optimization plan, Proposed actions, and History.
- request-Running `journal <character>` prints a Markdown journal entry for exactly that character without writing files. -> This backlog slice. Proof: `./melvor-report.js journal all --record` appends per-character files in `journal/` with deterministic filenames based on configured character names.
- request-Running `journal all --record` creates or appends one Markdown file per configured character under `journal/`. -> This backlog slice. Proof: `journal/index.html` is refreshed with offline dashboard data.
- request-Running `journal all --record` also generates or refreshes `journal/index.html` as a local interactive dashboard. -> This backlog slice. Proof: The dashboard shows current action, save-risk status, top recommendations, and proposed actions.
- request-The dashboard shows one compact row/card per character, supports filtering by character/action/risk, exposes top recommendations and proposed actions, and links to the character Markdown file. -> This backlog slice. Proof: Dashboard search and filter controls work without a dev server.
- request-Each character entry includes state, source-of-truth/save-risk context, recommendations, an optimization plan, proposed actions, and a history note. -> This backlog slice. Proof: Entries include save-source risk text derived from the same slot/source-of-truth logic used by `source-of-truth`.
- request-Journal generation reuses existing read-only report/audit/plan data instead of duplicating browser scraping logic. -> This backlog slice. Proof: Recommendations and proposed actions are derived from existing `planLines`, skilling notes, and audit candidates where available.
- request-No secrets, credentials, save strings, or absolute local profile paths are written into journal files. -> This backlog slice. Proof: Generated Markdown does not include environment variables, Chrome profile paths, remote debugging ports unless already part of normal smoke output, or save strings.
- request-`npm run check` passes after implementation. -> This backlog slice. Proof: `npm run check`, `./melvor-report.js --help`, and a single-character dry run are executed and documented at closeout.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_002_melvin_character_journal_and_planning_log`
- Architecture decision(s): (none yet)
- Request: `req_000_character_journal_generation_for_melvor_planning`
- Primary task(s): `task_001_implement_and_validate_character_journal_generation`

# AI Context
- Summary: Add append-only character journal command
- Keywords: scaffolded-backlog, add append-only character journal command, implementation-ready
- Use when: Implementing the scaffolded slice for Add append-only character journal command.
- Skip when: The change belongs to another backlog slice.

# Priority
- Priority: High
- Rationale: Set by scaffold input or defaulted for grooming.
