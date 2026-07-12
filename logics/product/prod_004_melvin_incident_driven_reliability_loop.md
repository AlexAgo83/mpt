## prod_004_melvin_incident_driven_reliability_loop - Melvin - incident-driven reliability loop
> Date: 2026-07-12
> Status: Settled
> Related request: `req_002_incident_driven_assistant_self_improvement`
> Related backlog: `item_005_capture_recurring_cli_incidents_and_promote_reviewed_candidates`
> Related task: `task_003_implement_incident_driven_assistant_self_improvement`
> Related architecture: (none yet)
> Reminder: Update status, linked refs, scope, decisions, success signals, and open questions when you edit this doc.
> Confidence: 95
> Non-semantic edit: closeout tooling refreshed the product back-reference on 2026-07-12.
> Understanding: 100
> Theme: Assistant reliability operations
> Complexity: Medium

# Overview
Add a small private feedback loop around the existing Melvor CLI: failures become sanitized local evidence, repeated signatures become reviewable candidates, and explicit recording can create one traceable Logics request. Human review remains the boundary before implementation changes.

# Goals
- Reduce manual incident transcription.
- Prioritize repeated failures over one-off noise.
- Connect proven recurring pain to traceable Logics work.
- Preserve the local-first, dependency-free safety model.

# Non-goals
- No autonomous code changes, commits, game actions, background daemon, scheduler, telemetry service, or external database.
- No workflow request for a first occurrence.
- No capture of raw stack traces, environment variables, save strings, or browser payloads.

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
- Product back-reference: `item_005_capture_recurring_cli_incidents_and_promote_reviewed_candidates`
- Task back-reference: `task_003_implement_incident_driven_assistant_self_improvement`
