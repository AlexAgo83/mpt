#!/usr/bin/env bash
# Daily 06:00 run on Tower (cron): back up every save (keeps MELVOR_SAVE_KEEP, default 30), record the journal
# and snapshot the day into journal/daily/ (the dashboard's /daily page reads it).
set -euo pipefail
cd "$(dirname "$0")/.."
# the cloud session expires now and then (2026-10-23): sign in again first, it returns at once when still signed in
node --env-file-if-exists=.env.local melvor-report.js login-smoke >/dev/null 2>&1 || echo "login-smoke failed"
# reads no longer save: push each character once a day so offline progress never piles up past the game's cap
for c in GrifhinZ Rya Dash Edalbraw Opa Chap Kang; do
  node --env-file-if-exists=.env.local melvor-report.js save-push "$c" || echo "save-push $c failed"
done
node --env-file-if-exists=.env.local melvor-report.js journal all --record --save-backup
node --env-file-if-exists=.env.local daily-recap.js
