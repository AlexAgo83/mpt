#!/usr/bin/env bash
# Daily 06:00 run on Tower (cron): back up every save (keeps MELVOR_SAVE_KEEP, default 30), record the journal
# and snapshot the day into journal/daily/ (the dashboard's /daily page reads it).
set -euo pipefail
cd "$(dirname "$0")/.."
node --env-file-if-exists=.env.local melvor-report.js journal all --record --save-backup
node --env-file-if-exists=.env.local daily-recap.js
