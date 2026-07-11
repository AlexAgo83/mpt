## req_002_incident_driven_assistant_self_improvement - Incident-driven assistant self-improvement
> From version: 0.1.0
> Schema version: 1.0
> Status: Done
> Understanding: 90%
> Confidence: 85%
> Complexity: Medium
> Theme: Assistant reliability operations
> Reminder: Update status/understanding/confidence and linked backlog/task references when you edit this doc.

# Needs
- Capture failed Melvor CLI runs as private structured incidents without manual transcription.
- Normalize and deduplicate failures so repeated pain is visible without logging sensitive data.
- Surface recurring incidents through the existing improve command and require explicit recording before workflow promotion.
- Keep code changes and game mutations outside the automated loop.

# Context
- AI_IMPROVEMENTS.md is useful but currently depends on a person noticing and transcribing failures.
- The existing improve command reports save-source risks but has no durable CLI failure history.
- Generated incident data belongs under the git-ignored journal directory.
- A single transient failure must not create workflow noise or change implementation code.

# Acceptance criteria
- Unexpected melvor-report failures append a sanitized event with timestamp, command, duration, message, and stable signature to a private JSON Lines file.
- Repeated signatures are counted from the append-only history without a database or dependency.
- improve displays recurring incident candidates and a ready-to-review improvement entry.
- Only improve --record may promote recurring unpromoted signatures into Logics, and each signature is promoted at most once.
- Incident capture never stores environment values, save strings, home-directory paths, browser URLs, or credentials.
- The automation never edits implementation code or mutates Melvor game state.
- Offline checks cover sanitization, stable signatures, recurrence counting, and promotion deduplication.

# Definition of Ready (DoR)
- [x] Problem statement is explicit and user impact is clear.
- [x] Scope boundaries (in/out) are explicit.
- [x] Acceptance criteria are testable.
- [x] Dependencies and known risks are listed.

# Companion docs
- Product brief(s): `prod_004_melvin_incident_driven_reliability_loop`
- Architecture decision(s): (none yet)

# References
- README.md
- MELVOR_RUNBOOK.md
- AI_IMPROVEMENTS.md
- melvor-report.js
- test-journal.js
- logics/product/prod_002_melvin_character_journal_and_planning_log.md

# AI Context
- Summary: Incident-driven assistant self-improvement
- Keywords: request-chain-scaffold, incident-driven assistant self-improvement, development-ready
- Use when: You need to implement or review the scaffolded workflow for Incident-driven assistant self-improvement.
- Skip when: The change is unrelated to this scaffolded request chain.

# Backlog
- `item_005_capture_recurring_cli_incidents_and_promote_reviewed_candidates`
