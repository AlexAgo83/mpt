## req_004_guarded_melvor_equipment_skilling_and_talent_actions - Guarded Melvor equipment, skilling, and talent actions
> From version: 0.1.0
> Schema version: 1.0
> Status: Draft
> Understanding: 90%
> Confidence: 85%
> Complexity: Medium
> Theme: Guarded character actions
> Reminder: Update status/understanding/confidence and linked backlog/task references when you edit this doc.

# AI Context
- Summary: (unfilled: replace before this doc is used)
- Keywords: guarded, melvor, equipment, skilling, talent, actions
- Use when: (unfilled: replace before this doc is used)
- Skip when: (unfilled: replace before this doc is used)

# Needs
- Apply a reviewed equipment swap, artisan recipe, or Abyssal talent unlock without hand-written browser-console commands.
- Keep every game mutation single-character, preview-first, source-of-truth-aware, saved, and re-read after application.
- Retain the existing read-only planning surface and do not introduce bulk execution.

# Context
- MPT can inspect inventory, recipes, talents, combat sets, and save sources, but only exposes write commands for selected combat workflows.
- The helper already exposes slot-aware equipment changes and reports unlocked artisan recipes with material runways.
- Local saves may be newer than cloud saves; writes must load the authoritative source before saving and verification.
- Hardcore characters require explicit, deliberate changes rather than account-wide automation.

# Acceptance criteria
- A generic equipment command previews the exact slot, item, available quantity, and current item; application requires --apply and verifies the final slot.
- A skilling command previews an unlocked named recipe, its required materials, and a positive runway; application requires --apply, starts only that recipe, saves, and verifies the active skill and selected action.
- A talent command previews one affordable, unlockable named node; application requires --apply, saves, and verifies the node is unlocked and points decreased.
- Every mutation is restricted to one explicit character and uses the newest local or cloud source through the existing write wrapper.
- Failures leave a clear error and do not continue to a later mutation.
- No bulk or apply-all command is added.
- CLI help, README, MELVOR instructions, and a reusable runbook document the preview, approval, verification, and rollback path.
- Focused offline checks cover command argument validation and generated action-script guards; npm run check passes.

# Definition of Ready (DoR)
- [x] Problem statement is explicit and user impact is clear.
- [x] Scope boundaries (in/out) are explicit.
- [x] Acceptance criteria are testable.
- [x] Dependencies and known risks are listed.

# Companion docs
- Product brief(s): `prod_006_melvin_guarded_character_actions`
- Architecture decision(s): (none yet)

# References
- README.md
- MELVOR.md
- melvor-report.js
- melvor-helpers.js
- test-journal.js
- logics/runbook/run_001_safe_melvor_save_and_session_operations.md
- logics/runbook/run_002_task_aware_melvor_equipment_and_configuration_audit.md

# Backlog
- `item_007_implement_preview_first_equipment_skilling_and_talent_actions`
