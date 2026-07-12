## req_003_journal_cockpit_v2_and_structured_insights - Journal cockpit v2 and structured insights
> From version: 0.1.0
> Schema version: 1.0
> Status: Draft
> Understanding: 90%
> Confidence: 85%
> Complexity: High
> Theme: Journal decision cockpit
> Reminder: Update status/understanding/confidence and linked backlog/task references when you edit this doc.

# Needs
- Make the first dashboard viewport useful for account-wide operational triage instead of hiding all meaningful data inside collapsed cards.
- Replace duplicate free-text recommendations with structured, prioritized insights that can be sorted, filtered, and rendered consistently.
- Expose alerts, idle characters, near-term completions, stale decisions, progress changes, and the next recommended decision at account and character level.
- Make the offline dashboard fit mobile and desktop viewports without horizontal overflow.
- Keep the journal local, dependency-free, read-only, sanitized, and directly openable from disk.

# Context
- The current desktop dashboard leaves most of the viewport empty while showing only character name, action, status, and timestamp.
- Expanded cards repeat Top recommendations and Current action, creating long undifferentiated pages.
- The current 390px rendering clips summary, filters, and character rows horizontally.
- latest.json contains rich observations but most dashboard-facing recommendations and ETAs are opaque strings.
- The existing static HTML generator and pure journal tests are the correct implementation boundary; no framework or build step is needed.

# Acceptance criteria
- Each scanned character has structured insights with type, priority, severity, label, optional metric/unit/ETA, and actionability fields.
- Duplicate recommendation text is removed from the primary presentation while legacy analysis arrays remain available for compatibility.
- The account summary shows alerts, idle characters, near-term completions, stale decisions, save risks, and open decisions.
- The primary character view compares name, mode, current action, progress/ETA, top concern, and next decision without opening details.
- Character details separate Now, Progress, Equipment, Plans, and History content and hide empty sections.
- Alert severity is explicit and source-of-truth warnings are visually distinct from save-risk state.
- The dashboard has no horizontal overflow at 390x844 and remains dense and readable at 1440x1000.
- Search and filters continue to work, including priority and attention filtering.
- Generated HTML stays self-contained, escaped, dependency-free, and free of credentials, save strings, profile paths, and debugging URLs.
- Offline tests and desktop/mobile screenshot checks pass.

# Definition of Ready (DoR)
- [x] Problem statement is explicit and user impact is clear.
- [x] Scope boundaries (in/out) are explicit.
- [x] Acceptance criteria are testable.
- [x] Dependencies and known risks are listed.

# Companion docs
- Product brief(s): `prod_005_melvin_journal_decision_cockpit_v2`
- Architecture decision(s): (none yet)

# References
- README.md
- MELVOR_RUNBOOK.md
- melvor-report.js
- test-journal.js
- logics/product/prod_003_melvin_journal_operating_model_and_dashboard.md
- logics/request/req_001_journal_operating_model_and_interactive_dashboard.md
- journal/latest.json
- journal/index.html

# AI Context
- Summary: Journal cockpit v2 and structured insights
- Keywords: request-chain-scaffold, journal cockpit v2 and structured insights, development-ready
- Use when: You need to implement or review the scaffolded workflow for Journal cockpit v2 and structured insights.
- Skip when: The change is unrelated to this scaffolded request chain.

# Backlog
- `item_006_build_structured_journal_insights_and_responsive_decision_cockpit`
