## item_006_build_structured_journal_insights_and_responsive_decision_cockpit - Build structured journal insights and responsive decision cockpit
> From version: 0.1.0
> Schema version: 1.0
> Status: Ready
> Understanding: 90%
> Confidence: 85%
> Progress: 0%
> Complexity: High
> Theme: Journal decision cockpit
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.

# Problem
- The collapsed dashboard hides the information needed for account triage.
- Expanded cards duplicate text and consume excessive vertical space.
- Opaque recommendation strings prevent reliable sorting, severity display, and comparison.
- The current controls and rows overflow narrow screens.

# Scope
- In:
  - Derive a small structured insight list from existing journal observations and analysis.
  - Add account-level operational counts derived from current character state.
  - Replace collapsed cards with a responsive comparison table/list.
  - Add compact character details with Now, Progress, Equipment, Plans, and History views.
  - Add priority and attention filters while preserving search and existing decision filters.
  - Add focused pure-data and rendered-HTML checks.
  - Verify desktop and mobile screenshots and overflow dimensions.
- Out:
  - New game collection APIs when existing observations already contain the needed facts.
  - Charts that require a library or long-term time-series storage.
  - Dashboard state persistence, editing, or action execution.
  - Removing legacy fields consumed by CLI reports or historical journals.

# Acceptance criteria
- Structured insights are deterministic, deduplicated by semantic label, and sorted by priority.
- An idle character or critical alert sorts ahead of normal long-run activity.
- Near-term ETA and shortest resource runway are visible from the primary character row when available.
- Stale decision totals are visible in the account summary and on affected characters.
- Top recommendations are not rendered again unchanged under Current action.
- Detail views omit empty groups and remain keyboard accessible.
- At 390px viewport width, document scrollWidth does not exceed clientWidth.
- At 1440px, all seven characters fit into a dense scan-friendly first view or require only modest vertical scrolling.
- npm run check passes without a new dependency.

# AC Traceability
- request-Each scanned character has structured insights with type, priority, severity, label, optional metric/unit/ETA, and actionability fields. -> This backlog slice. Proof: Structured insights are deterministic, deduplicated by semantic label, and sorted by priority.
- request-Duplicate recommendation text is removed from the primary presentation while legacy analysis arrays remain available for compatibility. -> This backlog slice. Proof: An idle character or critical alert sorts ahead of normal long-run activity.
- request-The account summary shows alerts, idle characters, near-term completions, stale decisions, save risks, and open decisions. -> This backlog slice. Proof: Near-term ETA and shortest resource runway are visible from the primary character row when available.
- request-The primary character view compares name, mode, current action, progress/ETA, top concern, and next decision without opening details. -> This backlog slice. Proof: Stale decision totals are visible in the account summary and on affected characters.
- request-Character details separate Now, Progress, Equipment, Plans, and History content and hide empty sections. -> This backlog slice. Proof: Top recommendations are not rendered again unchanged under Current action.
- request-Alert severity is explicit and source-of-truth warnings are visually distinct from save-risk state. -> This backlog slice. Proof: Detail views omit empty groups and remain keyboard accessible.
- request-The dashboard has no horizontal overflow at 390x844 and remains dense and readable at 1440x1000. -> This backlog slice. Proof: At 390px viewport width, document scrollWidth does not exceed clientWidth.
- request-Search and filters continue to work, including priority and attention filtering. -> This backlog slice. Proof: At 1440px, all seven characters fit into a dense scan-friendly first view or require only modest vertical scrolling.
- request-Generated HTML stays self-contained, escaped, dependency-free, and free of credentials, save strings, profile paths, and debugging URLs. -> This backlog slice. Proof: npm run check passes without a new dependency.
- request-Offline tests and desktop/mobile screenshot checks pass. -> This backlog slice. Proof: npm run check passes without a new dependency.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_005_melvin_journal_decision_cockpit_v2`
- Architecture decision(s): (none yet)
- Request: `req_003_journal_cockpit_v2_and_structured_insights`
- Primary task(s): `task_004_implement_journal_cockpit_v2_and_structured_insights`

# AI Context
- Summary: Build structured journal insights and responsive decision cockpit
- Keywords: scaffolded-backlog, build structured journal insights and responsive decision cockpit, implementation-ready
- Use when: Implementing the scaffolded slice for Build structured journal insights and responsive decision cockpit.
- Skip when: The change belongs to another backlog slice.

# Priority
- Priority: High
- Rationale: Set by scaffold input or defaulted for grooming.
