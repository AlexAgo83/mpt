# Contributing

## Scope

MPT is local-first tooling for operating one Melvor Idle account through an AI assistant.
Changes should stay traceable to the helper surface, CLI reports, or Logics context in
[`logics/`](./logics/).

## Getting Started

Use a recent Node.js runtime. The CLI has no install step and no package dependencies.

```bash
./melvor-report.js --help
```

The browser workflow depends on the shared Chrome profile documented in
[`MELVOR.md`](./MELVOR.md).

## Development Workflow

- Keep changes focused and small.
- Read [`MELVOR.md`](./MELVOR.md) before changing browser or save behavior.
- Use `logics-manager status` before workflow-document changes.
- Do not hand-edit Logics status fields, lineage links, Mermaid signatures, or done status.
- Update docs when commands, guardrails, or assistant workflows change.

## Validation

Run the smallest useful checks for your change:

```bash
node --check melvor-report.js
node -e "const fs=require('fs'); new Function(fs.readFileSync('melvor-helpers.js','utf8')); console.log('helper syntax ok')"
./melvor-report.js --help
```

For Logics changes:

```bash
logics-manager lint --require-status
logics-manager audit --group-by-doc
```

For live Melvor reads, start with read-only commands:

```bash
./melvor-report.js slots
./melvor-report.js source-of-truth
```

## Safety Rules

- Source of truth is the newest save, local or cloud.
- Treat local/cloud disagreement as a stop sign.
- Never load the same character in two tabs.
- Never overwrite a newer local save with an older cloud save unless the user explicitly asks.
- Prefer read-only reports before any manual write.
- Record repeated assistant failures with `./melvor-report.js improve --record`.

## Pull Requests

Include:

- what changed and why
- the validation commands you ran
- any save/cloud risk or follow-up work

## Secrets

Do not commit Melvor credentials, exported save strings, browser profile data, tokens, or
real account backups. Keep local browser/profile artifacts outside the repository.
