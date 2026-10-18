#!/usr/bin/env bash
# Daily 06:00 run on Tower (cron): back up every save (keeps MELVOR_SAVE_KEEP, default 30), record the journal,
# snapshot the day and write the recap page into MELVOR_RECAP_DIR, then refresh the fleet reports index if present.
set -euo pipefail
cd "$(dirname "$0")/.."
node --env-file-if-exists=.env.local melvor-report.js journal all --record --save-backup
node --env-file-if-exists=.env.local daily-recap.js
if [ -n "${MELVOR_RECAP_DIR:-}" ] && [ -f "${REMOTE_OPS_DIR:-$HOME/jarvis/remote-ops}/scripts/report_html.py" ]; then
  PYTHONPATH="${REMOTE_OPS_DIR:-$HOME/jarvis/remote-ops}/scripts" python3 -c "import report_html, pathlib; report_html.write_index(pathlib.Path('$MELVOR_RECAP_DIR'))"
fi
