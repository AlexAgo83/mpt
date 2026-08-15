## item_007_implement_preview_first_equipment_skilling_and_talent_actions - Implement preview-first equipment, skilling, and talent actions
> From version: 0.1.0
> Schema version: 1.0
> Status: In progress
> Understanding: 90%
> Confidence: 85%
> Progress: 70%
> Complexity: Medium
> Theme: Guarded character actions
> Reminder: Update status/understanding/confidence/progress and linked request/task references when you edit this doc.
> Indicators reviewed: 2026-08-16 00:33:04

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: implement, preview, first, equipment, skilling, talent, actions
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Problem
- Planning output names safe actions, but an operator must translate them into fragile console calls.
- Existing mutation commands cover only specific combat configurations.
- A broad executor would bypass per-character save and risk review.

# Scope
- In:
  - Preview-first single-character CLI commands for equipment, artisan recipes, and talent nodes.
  - Exact ownership, unlock, material, and node-affordability guards.
  - Authoritative-source write, save, and post-action verification reuse.
  - Minimal tests, documentation, and one new reusable runbook.
- Out:
  - Bulk execution or apply-all.
  - Automatic dungeon, recipe, or talent selection.
  - New dependencies, a database, or a background service.
  - Actions outside equipment, artisan skilling, and talent nodes.

# Acceptance criteria
- The commands reject all-character targets and omit application unless --apply is present.
- Preview and apply use the same validated target and surface missing prerequisites before mutation.
- Post-action data proves the requested equipment, recipe, or talent state.
- Unsupported game APIs fail closed with an actionable error.
- Documentation does not authorize bulk mutation and retains explicit operator approval.
- npm run check and Logics validation pass.

# AC Traceability
- request-A generic equipment command previews the exact slot, item, available quantity, and current item; application requires --apply and verifies the final slot. -> This backlog slice. Proof: The commands reject all-character targets and omit application unless --apply is present.
- request-A skilling command previews an unlocked named recipe, its required materials, and a positive runway; application requires --apply, starts only that recipe, saves, and verifies the active skill and selected action. -> This backlog slice. Proof: Preview and apply use the same validated target and surface missing prerequisites before mutation.
- request-A talent command previews one affordable, unlockable named node; application requires --apply, saves, and verifies the node is unlocked and points decreased. -> This backlog slice. Proof: Post-action data proves the requested equipment, recipe, or talent state.
- request-Every mutation is restricted to one explicit character and uses the newest local or cloud source through the existing write wrapper. -> This backlog slice. Proof: Unsupported game APIs fail closed with an actionable error.
- request-Failures leave a clear error and do not continue to a later mutation. -> This backlog slice. Proof: Documentation does not authorize bulk mutation and retains explicit operator approval.
- request-No bulk or apply-all command is added. -> This backlog slice. Proof: npm run check and Logics validation pass.
- request-CLI help, README, MELVOR instructions, and a reusable runbook document the preview, approval, verification, and rollback path. -> This backlog slice. Proof: npm run check and Logics validation pass.
- request-Focused offline checks cover command argument validation and generated action-script guards; npm run check passes. -> This backlog slice. Proof: npm run check and Logics validation pass.

# Decision framing
- Product framing: Not needed
- Architecture framing: Not needed

# Links
- Product brief(s): `prod_006_melvin_guarded_character_actions`
- Architecture decision(s): (none yet)
- Request: `req_004_guarded_melvor_equipment_skilling_and_talent_actions`
- Primary task(s): `task_005_implement_guarded_melvor_character_actions`

# Priority
- Priority: High
- Rationale: Set by scaffold input or defaulted for grooming.
