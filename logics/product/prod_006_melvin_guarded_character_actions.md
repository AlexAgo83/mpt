## prod_006_melvin_guarded_character_actions - Melvin - guarded character actions
> Date: 2026-08-16
> Status: Proposed
> Related request: `req_004_guarded_melvor_equipment_skilling_and_talent_actions`
> Related backlog: `item_007_implement_preview_first_equipment_skilling_and_talent_actions`
> Related task: `task_005_implement_guarded_melvor_character_actions`
> Related architecture: (none yet)
> Reminder: Update status, linked refs, scope, decisions, success signals, and open questions when you edit this doc.

# Overview
Add the smallest supported mutation surface for applying one reviewed equipment swap, artisan recipe, or Abyssal talent node. Every action is deliberately scoped to one character and preserves MPT's local-first save safety model.

# Goals
- Turn verified recommendations into explicit, reversible single-character actions.
- Require a preview and explicit apply flag before changing game state.
- Save and verify every supported action using the authoritative source.
- Document one reusable operation for future sessions.

# Non-goals
- No apply-all, queue, scheduler, background worker, or autonomous decision engine.
- No change to game content, cloud-save conflict resolution policy, or account roster.
- No generic browser-console escape hatch or unverified action API.

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
- Product back-reference: `req_004_guarded_melvor_equipment_skilling_and_talent_actions`
- Task back-reference: `task_005_implement_guarded_melvor_character_actions`
