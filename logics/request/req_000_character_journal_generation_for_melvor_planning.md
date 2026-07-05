## req_000_character_journal_generation_for_melvor_planning - Character journal generation for Melvor planning
> From version: 0.1.0
> Schema version: 1.0
> Status: Draft
> Understanding: 90
> Confidence: 85
> Complexity: Medium
> Theme: Melvor assistant reporting
> Reminder: Update status/understanding/confidence and linked backlog/task references when you edit this doc.

# Needs
- Add a read-only journal command that produces and optionally records a per-character logbook.
- Capture recommendations, optimization plans, historical snapshots, and proposed actions per character.
- Provide an interactive local dashboard for browsing the generated journal by character, risk, recommendation, and proposed action.
- Keep the implementation local-first, dependency-free, and aligned with existing CLI/report patterns.

# Context
- The repository is intentionally plain Node.js with no runtime dependencies.
- Existing commands already expose slots, source-of-truth, summary, audit, plan, skilling, gear, improve, and export-state.
- The first implementation should append Markdown files under journal/ and generate a local `journal/index.html` dashboard instead of introducing a database, hosted web app, or persistent service.
- All report generation must remain read-only and must not mutate Melvor saves.

# Acceptance criteria
- A new CLI command `journal [all|character] [--record]` is documented in the help output and README command list.
- Running `journal <character>` prints a Markdown journal entry for exactly that character without writing files.
- Running `journal all --record` creates or appends one Markdown file per configured character under `journal/`.
- Running `journal all --record` also generates or refreshes `journal/index.html` as a local interactive dashboard.
- Each character entry includes state, source-of-truth/save-risk context, recommendations, an optimization plan, proposed actions, and a history note.
- The dashboard shows one compact row/card per character, supports filtering by character/action/risk, exposes top recommendations and proposed actions, and links to the character Markdown file.
- Journal generation reuses existing read-only report/audit/plan data instead of duplicating browser scraping logic.
- No secrets, credentials, save strings, or absolute local profile paths are written into journal files.
- `npm run check` passes after implementation.

# Definition of Ready (DoR)
- [x] Problem statement is explicit and user impact is clear.
- [x] Scope boundaries (in/out) are explicit.
- [x] Acceptance criteria are testable.
- [x] Dependencies and known risks are listed.

# Companion docs
- Product brief(s): `prod_002_melvin_character_journal_and_planning_log`
- Architecture decision(s): (none yet)

# References
- README.md
- MELVOR.md
- MELVOR_RUNBOOK.md
- AI_IMPROVEMENTS.md
- melvor-report.js
- melvor-helpers.js
- logics/product/prod_001_melvin_ai_assistant_for_melvor_idle.md

# AI Context
- Summary: Character journal generation for Melvor planning
- Keywords: request-chain-scaffold, character journal generation for melvor planning, development-ready
- Use when: You need to implement or review the scaffolded workflow for Character journal generation for Melvor planning.
- Skip when: The change is unrelated to this scaffolded request chain.

# Backlog
- `item_001_add_append_only_character_journal_command`
