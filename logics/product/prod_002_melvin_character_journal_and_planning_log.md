## prod_002_melvin_character_journal_and_planning_log - Melvin - character journal and planning log
> Date: 2026-07-05
> Status: Settled
> Related request: `req_000_character_journal_generation_for_melvor_planning`
> Related backlog: `item_001_add_append_only_character_journal_command`
> Related task: `task_001_implement_and_validate_character_journal_generation`
> Related architecture: (none yet)
> Reminder: Update status, linked refs, scope, decisions, success signals, and open questions when you edit this doc.
> Confidence: 90
> Non-semantic edit: closeout tooling refreshed the product back-reference on 2026-07-05.

# Overview
Extend the Melvin local assistant with a lightweight, append-only journal and local interactive dashboard that turn current Melvor account readings into per-character planning notes. The journal is a durable handoff surface for future AI sessions: what each character is doing, what the assistant recommends next, what actions are proposed, and what safety checks matter before writes. The dashboard is the player's fast visual entrypoint for scanning all characters.

```mermaid
%% logics-kind: product
%% logics-signature: product|melvin_character_journal_and_planning_log|generated
flowchart TD
    Read[Read-only Melvor reports] --> Entry[Journal entry]
    Entry --> Character[Per-character Markdown]
    Entry --> Dashboard[Interactive local dashboard]
    Entry --> Account[Account safety notes]
    Character --> Handoff[Future AI handoff]
    Dashboard --> Player[Player review]
```

# Goals
- Make each character's current state and next optimization steps reviewable without rerunning a full browser session.
- Provide a visual dashboard where the player can scan and filter all characters quickly.
- Give future AI sessions a concise historical trail per character.
- Keep the journal human-readable and git-friendly.
- Preserve the existing read-only safety model for report commands.

# Non-goals
- No database, hosted dashboard, server, frontend framework, or build step.
- No automatic execution of proposed actions.
- No Markdown parser or task-state engine in the first iteration.
- No account secrets or save backups in generated journal files.

# Scope and guardrails
- In: `melvor-report.js` journal command, Markdown rendering, optional append-only writes under `journal/`, generated `journal/index.html`, README and runbook documentation.
- Out: database storage, hosted dashboard, dev server, frontend framework, Markdown task-state parser, automatic action execution, and save mutation.
- Guardrail: journal generation is read-only and must not call equip, save, sell, buy, open, claim, or other mutation helpers.
- Guardrail: generated files must not contain credentials, save strings, environment variables, or local Chrome profile paths.

# Key product decisions
- Store the first journal as Markdown files because the repo is local-first and dependency-free.
- Generate the dashboard as one static HTML file with embedded CSS/JS so the player opens it directly in a browser.
- Append entries instead of rewriting historical notes; history should be simple to audit in git.
- Reuse existing `summary`, `audit`, `plan`, `slots`, and `source-of-truth` data instead of adding a second browser scrape path.
- Defer structured action tracking until simple append-only Markdown is too hard to review manually.

# Success signals
- `journal <character>` prints a complete Markdown entry without writing files.
- `journal all --record` appends one file per configured character and refreshes `journal/index.html`.
- The dashboard supports text search, action/risk filters, compact character comparison, and links to Markdown detail files.
- A future AI session can read the latest character file and understand current state, recommendations, proposed actions, and save-risk notes.
- Existing validation stays green with no new runtime dependencies.

# References
- Product back-reference: `item_001_add_append_only_character_journal_command`
- Task back-reference: `task_001_implement_and_validate_character_journal_generation`
