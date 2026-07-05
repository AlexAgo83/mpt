## req_001_journal_operating_model_and_interactive_dashboard - Journal operating model and interactive dashboard
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90%
> Confidence: 85%
> Complexity: High
> Theme: Melvor assistant journal system
> Reminder: Update status/understanding/confidence and linked backlog/task references when you edit this doc.

# Needs
- Define a durable journal operating model that separates observed game state, assistant analysis, and user decisions.
- Generate structured local data files that future AI sessions and the dashboard can trust without reparsing Markdown.
- Track proposed, approved, completed, blocked, dismissed, and stale actions per character without executing them automatically.
- Provide an offline interactive dashboard for scanning all characters, save risks, stale observations, recommendations, and pending actions.
- Keep the system local-first, dependency-free, read-only during journal generation, and safe around Melvor save state.

# Context
- The existing journal corpus covers an initial `journal [all|character] [--record]` command with per-character Markdown and a static dashboard target.
- The product now needs a stronger data model: `journal/latest.json` for the newest sanitized snapshot and `journal/actions.jsonl` for action history and user decisions.
- Markdown remains the human-readable log, but it must not be the only source the dashboard or future AI agents rely on.
- The dashboard should be generated as `journal/index.html` with embedded CSS/JS and no dev server, framework, build step, or external assets.
- Journal generation and dashboard creation must not mutate game state, equip items, save, sell, buy, open, claim, or overwrite cloud/local saves.

# Acceptance criteria
- `journal all --record` writes sanitized per-character Markdown, `journal/latest.json`, and `journal/index.html` from one read-only collection pass.
- `journal/latest.json` explicitly separates `observed`, `analysis`, and `decisions` fields per character.
- `journal/actions.jsonl` stores append-only action events with stable ids, character, status, type, reason, risk, timestamps, and enough metadata to avoid duplicate recommendations.
- Generated recommendations become structured proposed actions where practical, without applying them.
- The dashboard reads embedded or adjacent sanitized data and supports search, character filter, current-action filter, save-risk filter, action-status filter, stale-data highlighting, and per-character detail expansion.
- The dashboard surfaces account-level indicators: last scan time, save risks, stale characters, pending approved actions, blocked actions, and top-priority recommendations.
- Rejected or dismissed actions are not repeatedly re-proposed unless the observed context materially changes.
- Stale actions are detectable when the observed state no longer matches the original recommendation context.
- No generated file contains credentials, environment variables, save strings, absolute Chrome profile paths, or raw browser debugging URLs.
- Implementation keeps the repository dependency-free and validates with `npm run check`, CLI help, a dry-run journal command, and recorded dashboard generation.

# Definition of Ready (DoR)
- [x] Problem statement is explicit and user impact is clear.
- [x] Scope boundaries (in/out) are explicit.
- [x] Acceptance criteria are testable.
- [x] Dependencies and known risks are listed.

# Companion docs
- Product brief(s): `prod_003_melvin_journal_operating_model_and_dashboard`
- Architecture decision(s): (none yet)

# References
- README.md
- MELVOR.md
- MELVOR_RUNBOOK.md
- AI_IMPROVEMENTS.md
- melvor-report.js
- melvor-helpers.js
- logics/request/req_000_character_journal_generation_for_melvor_planning.md
- logics/backlog/item_001_add_append_only_character_journal_command.md
- logics/product/prod_002_melvin_character_journal_and_planning_log.md
- logics/tasks/task_001_implement_and_validate_character_journal_generation.md

# AI Context
- Summary: Journal operating model and interactive dashboard
- Keywords: request-chain-scaffold, journal operating model and interactive dashboard, development-ready
- Use when: You need to implement or review the scaffolded workflow for Journal operating model and interactive dashboard.
- Skip when: The change is unrelated to this scaffolded request chain.

# Backlog
- `item_002_create_structured_journal_snapshot_and_action_ledger`
- `item_003_generate_interactive_offline_journal_dashboard`
- `item_004_document_journal_lifecycle_and_ai_handoff_rules`
