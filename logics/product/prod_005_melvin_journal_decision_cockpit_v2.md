## prod_005_melvin_journal_decision_cockpit_v2 - Melvin - journal decision cockpit v2
> Date: 2026-07-12
> Status: Proposed
> Related request: `req_003_journal_cockpit_v2_and_structured_insights`
> Related backlog: `item_006_build_structured_journal_insights_and_responsive_decision_cockpit`
> Related task: `task_004_implement_journal_cockpit_v2_and_structured_insights`
> Related architecture: (none yet)
> Reminder: Update status, linked refs, scope, decisions, success signals, and open questions when you edit this doc.

# Overview
Turn the existing journal dashboard into a compact operational cockpit. The first viewport should answer what each character is doing, what will finish soon, what requires attention, and what decision comes next. Structured insights support sorting and consistent presentation while preserving the existing local-first safety model.

# Goals
- Make account triage possible without expanding every character.
- Represent dashboard insights as structured data rather than presentation-only prose.
- Reduce duplicated content and visual scanning cost.
- Provide a usable responsive layout on mobile and desktop.
- Preserve offline operation, privacy, compatibility, and read-only generation.

# Non-goals
- No frontend framework, dependency, build tool, server, hosted dashboard, or external asset.
- No automatic Melvor actions or save mutations.
- No complete replacement of historical Markdown or legacy analysis arrays.
- No speculative charting library or arbitrary dashboard customization system.

# Scope and guardrails
- In: scaffolded request, product, backlog, orchestration task, validation, and handoff context.
- Out: unrelated workflow docs and implementation of generated tasks.

# Key product decisions
- Use structured input as the source of truth for generated docs.
- Keep generated write paths local and repo-bounded.

# Success signals
- Generated docs pass lint and audit without broad manual rewrites.
- Context-pack output can be handed to an implementation agent directly.

# References
- Product back-reference: `req_003_journal_cockpit_v2_and_structured_insights`
- Task back-reference: `task_004_implement_journal_cockpit_v2_and_structured_insights`
