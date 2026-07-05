# Security Policy

## Supported Versions

MPT is local-first tooling in active development. Security fixes target the latest commit on
the default branch.

| Version | Supported |
| --- | --- |
| `main` (latest) | Yes |
| older commits | No |

## Reporting a Vulnerability

Please do not open public issues for suspected vulnerabilities.

Use GitHub private vulnerability reporting or create a private security advisory draft for
this repository:

https://github.com/AlexAgo83/mpt/security/advisories/new

Include:

- affected commit;
- operating system and Chrome version;
- reproduction steps with the smallest safe example;
- expected impact, especially account access, save loss, or unintended writes;
- whether the issue requires local machine access, browser-profile access, or a running
  debug port.

Do not include real Melvor credentials, exported save strings, browser cookies, bearer
tokens, or unredacted account data.

## Security Model

MPT is a local assistant toolkit. It is not a hosted service and has no backend.

The sensitive surfaces are:

- the persistent Chrome profile at `~/.cache/chrome-devtools-mcp/chrome-profile`;
- Chrome DevTools access to a logged-in Melvor Cloud session;
- local and cloud save selection;
- helper functions that can mutate game state when called manually;
- exported state files written outside the repo for analysis.

## Operating Rules

- Only one assistant/browser driver should use the Chrome profile at a time.
- Do not expose the Chrome DevTools port to untrusted networks.
- Keep exported saves, browser profiles, and account backups out of git.
- Keep `.env.local` local; commit only `.env.example`.
- Keep test-account credentials in GitHub Actions secrets only; never in workflow files.
- Check `./melvor-report.js source-of-truth` before writes.
- Treat save-source disagreement as a data-loss risk, not a normal warning.
- Prefer read-only reports unless the user has explicitly approved a write.

## Response Expectations

Reports are triaged on a best-effort basis. Confirmed issues are fixed on `main` and
disclosed once a fix is available.
