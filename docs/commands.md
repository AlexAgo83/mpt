# Commands

```bash
npm run slots
npm run source
./melvor-report.js smoke
./melvor-report.js login-smoke
./melvor-report.js slots
./melvor-report.js diff-slots
./melvor-report.js source-of-truth
./melvor-report.js improve
./melvor-report.js improve --record
./melvor-report.js brief all
./melvor-report.js brief <character>
./melvor-report.js summary all
./melvor-report.js audit all
./melvor-report.js plan all
./melvor-report.js combat-plan all
./melvor-report.js combat-plan <character> --abyssal
./melvor-report.js gear <character>
./melvor-report.js skilling <character>
./melvor-report.js config [all|character]
./melvor-report.js agility [all|character]
./melvor-report.js talents <character>
./melvor-report.js combat-setup <character>
./melvor-report.js combat-run <character> <dungeon>
./melvor-report.js magic-setup <character> [--slot 6] [--apply]
./melvor-report.js slayer-abyssal <character>
./melvor-report.js slayer-start <character> [--slot 6]
./melvor-report.js save-push <character> [--local-source]
./melvor-report.js equip <character> <item> <slot>
./melvor-report.js skill-start <character> <skill> <recipe>
./melvor-report.js talent-unlock <character> <skill> <node>
./melvor-report.js config-set <character> <potion|prayers|poi|style> <value>
./melvor-report.js completion [all|character] [--record]
./melvor-report.js export-state all > /tmp/melvor-state.json
./melvor-report.js save-backup all
./melvor-report.js journal <character>
./melvor-report.js journal all --record --save-backup
./melvor-report.js journal-serve
./melvor-report.js journal-status all
./melvor-report.js journal-diff all
./melvor-report.js journal-action <id> dismissed
```

Report commands, including `config`, are read-only. `combat-setup`, `combat-run`, `slayer-start`,
`save-push`, and `magic-setup --apply` write immediately and need explicit approval first. `equip`, `skill-start`, `talent-unlock`, and `config-set` are
preview-only until the same command is repeated with `--apply`; they accept one character
only, load the newest save source, save, and verify the requested result. There is no bulk
or apply-all command.

`brief` is the preferred command for AI account triage. It returns one compact JSON object
per character with:

- `source`: newest-save source and write-block risk
- `currentAction`: current task, action-specific recommendations, rough intervals, Slayer
  ETA, equipped food, and ammo/scroll/summon/consumable runway when the game exposes enough
  data; `estimate.runways` exposes structured slot/item/quantity/unit/ETA entries for
  cheaper downstream reporting; when `journal/latest.json` exists it also includes
  `levelEtas` with either ready ETA lines or the pending reason
- `standard`: standard-level gaps, accessible standard dungeons, and standard next steps
- `abyssal`: abyssal-level gaps, abyssal dungeons such as `Into the Abyss`, and abyssal next
  steps; Cartography and Archaeology are intentionally excluded because they do not have
  trainable Abyssal Levels
- `risks` and `next`: short top-level prompts for the assistant/user
