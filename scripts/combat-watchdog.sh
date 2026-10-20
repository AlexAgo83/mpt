#!/usr/bin/env bash
# Restart combat characters found idle (Slayer task rollover sometimes leaves them doing nothing).
# Rya (Hardcore) is never restarted automatically. Read-only check; writes only when a character is idle.
set -uo pipefail
cd "$(dirname "$0")/.."
# ponytail: fixed character:slot list, update it when a character's combat set changes
for entry in GrifhinZ:6 Dash:6 Edalbraw:5; do
  name=${entry%%:*} slot=${entry##*:}
  line=$(node --env-file-if-exists=.env.local melvor-report.js brief "$name" --short 2>&1 | grep "^$name ·")
  echo "$(date -Is) $line"
  if [[ $line == "$name · idle ·"* ]]; then
    node --env-file-if-exists=.env.local melvor-report.js slayer-start "$name" --slot "$slot" --apply 2>&1 | tail -3
  fi
done
