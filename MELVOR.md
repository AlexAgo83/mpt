# Melvor Idle — driving the game via chrome-devtools MCP

Project: read/modify the game state at https://melvoridle.com/index_game.php through the browser console.

## Setup

Everything goes through the **chrome-devtools** MCP server (`npx -y chrome-devtools-mcp@latest --headless`).
Its tools (`new_page`, `evaluate_script`, `list_pages`, `select_page`, `navigate_page`,
`take_screenshot`…) have the same names regardless of the AI client.

- **Claude Code** (already configured on this machine, check with `claude mcp list`):
  `claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --headless`
- **Codex CLI**: in `~/.codex/config.toml`:
  ```toml
  [mcp_servers.chrome-devtools]
  command = "npx"
  args = ["-y", "chrome-devtools-mcp@latest", "--headless"]
  ```
- **Any other MCP client**: same stdio command.

Persistent Chrome profile: `~/.cache/chrome-devtools-mcp/chrome-profile` — the Melvor cloud
session is already logged in there (shared by every AI client on this machine). Chrome locks
the profile: only one AI client can drive the browser at a time — never run two simultaneously.
Never launch
in isolated mode, it loses the login. If the login expires or a captcha blocks: restart the
server **without** `--headless`, let the user log in through the visible window, then re-add
`--headless`. Same procedure for the first login on a new machine.

## Session flow

1. `new_page` → `https://melvoridle.com/index_game.php` (lands on the character selection screen, already logged in).
2. Inject `melvor-helpers.js` (paste its content into an `evaluate_script` call) → exposes `window.mh`.
3. `mh.loadCharacter("GrifhinZ")` → clicks the slot + confirms the popup. Wait ~4s then check `game.characterName`.

Cloud characters on this account: GrifhinZ, Rya, Dash, Edalbraw, Opa, Chap, Kang.

## Character switching (3 calls, tested)

1. `evaluate_script`: `saveData(); cloudManager.forceUpdatePlayFabSave();`
2. `navigate_page` type=reload with `initScript` = `window.__autoLoadChar = '<Name>';` followed by
   the content of `melvor-helpers.js` (the file contains the auto-load block: it waits for the
   selection screen, switches to cloud saves, clicks the character and confirms the popup on its own).
3. Verification `evaluate_script`: loop until `game.characterName === '<Name>'`
   (~15-30s load time).

Reloading kills `window.mh` — the initScript re-injects it, do not re-inject manually.

## Multi-tab (validated, one character per tab)

Several characters can run in parallel: one tab per character (`new_page` then
`mh.loadCharacter`), navigate between them with `select_page`. Tested with no save conflicts
(separate slots, cloud push per slot).

Rules:
- **Never the same character in two tabs** (save corruption). Built-in guard: tabs announce
  themselves on the `mh-active-chars` BroadcastChannel; `mh.loadCharacter` refuses if the
  character responds from another tab. `mh.activeCharacters()` lists open characters.
- Save (`mh.save()`) before closing a tab.
- 7 game instances is heavy; only open what is needed.

## Helpers (`window.mh`, tested on v1.3.1)

- `mh.loadCharacter(name)` — from the selection screen (switches to cloud saves if needed, waits for the async list)
- `mh.save()` — local save + cloud push (`saveData()` + `cloudManager.forceUpdatePlayFabSave()`)
- `mh.dismissModal(accept?)` — closes swal2 popups
- `mh.snapshot()` — character, GP, HP, current action, equipment, food
- `mh.bankFind("dragon")` — bank search by regex
- `mh.skillInfo("Fishing")` / `mh.skills()` — skill state
- `mh.gearAudit()` — full audit: equipped gear + top 5 bank candidates per slot, stats and
  passives included, filtered by attackType. Large output: read it in chunks if needed.
- `mh.equip("Item Name")` or `mh.equip([...names])` — equips from the bank, global stat diff
- `mh.combatInfo()` — area, monster, hit chance, slayer task
- `mh.itemPassives("Item Name")` — an item's modifiers/passives (bank, equipped or registry);
  always check passives before drawing conclusions from raw stats

## `game` object — useful paths (v1.3.1)

- `game.characterName`, `game.gp.amount`, `game.activeAction.name`
- `game.bank.items` — `Map<Item, BankItem>`; `bankItem.quantity`, `item.id` (e.g. `melvorD:Dragon_Bones`)
- `game.skills` — registry; `game.skills.find(s => s.name === 'Fishing')`, `.allObjects` for the list
- `game.combat.player` — `.hitpoints`, `.prayerPoints`, `.food.currentSlot`, `.equipment.equippedArray`
- `game.items.getObjectByID('melvorD:...')` — item lookup by id
- `game.loopStarted` — true only when a character is actually loaded (false on the selection screen)

## Pitfalls

- UI actions (loading a character, some buttons) open swal2 popups: always check
  `.swal2-popup` after a click, confirm via `mh.dismissModal()`.
- `evaluate_script` only returns JSON-serializable values — never return a raw game object
  (circular references), always map to primitives.
- The `game` object is huge: go through the helpers rather than exploring blindly.
