#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

loadEnvLocal();

const ACCOUNT = process.env.MELVOR_ACCOUNT || 'main';
const PORT = Number(ACCOUNT === 'test' ? (process.env.MELVOR_TEST_PORT || 9224) : (process.env.MELVOR_PORT || 9223));
const URL = 'https://melvoridle.com/index_game.php';
const AUTH_URL = 'https://melvoridle.com/index.php';
const CHARS = (process.env.MELVOR_CHARACTERS || '').split(',').map(s => s.trim()).filter(Boolean);
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = ACCOUNT === 'test'
  ? (process.env.MELVOR_TEST_PROFILE || `${process.env.HOME}/.cache/mpt-melvor-test-profile`)
  : (process.env.MELVOR_PROFILE || `${process.env.HOME}/.cache/chrome-devtools-mcp/chrome-profile`);
const LOCK = path.join('/tmp', `melvor-report-${PORT}.lock`);
const JOURNAL_DIR = path.join(__dirname, 'journal');
const INCIDENTS = process.env.MELVOR_INCIDENT_FILE || path.join(JOURNAL_DIR, 'incidents.jsonl');
const INCIDENT_PROMOTIONS = process.env.MELVOR_INCIDENT_PROMOTIONS_FILE || path.join(JOURNAL_DIR, 'incident-promotions.jsonl');
const helper = fs.readFileSync(path.join(__dirname, 'melvor-helpers.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const startedAt = Date.now();

function loadEnvLocal() {
  const file = path.join(__dirname, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const argv = process.argv.slice(2);
const record = argv.includes('--record');
const abyssalOnly = argv.includes('--abyssal');
const detail = argv.includes('--detail');
const saveBackup = argv.includes('--save-backup');
const simulate = argv.includes('--sim');
const restore = argv.includes('--restore');
const apply = argv.includes('--apply');
const restoreRanged = argv.includes('--restore-ranged');
const quantityIndex = argv.indexOf('--quantity');
const requestedQuantity = quantityIndex >= 0 ? Number(argv[quantityIndex + 1]) : undefined;
const styleIndex = argv.indexOf('--style');
const gearStyle = styleIndex >= 0 ? argv[styleIndex + 1] : null;
const capeIndex = argv.indexOf('--cape');
const capeName = capeIndex >= 0 ? argv[capeIndex + 1] : null;
const slotIndex = argv.indexOf('--slot');
const requestedSlot = slotIndex >= 0 ? Number(argv[slotIndex + 1]) : 6;
const dashboardPortIndex = argv.indexOf('--port');
const dashboardPort = dashboardPortIndex >= 0 ? Number(argv[dashboardPortIndex + 1]) : Number(process.env.MELVOR_JOURNAL_PORT || 8787);
const [cmd = 'summary', who = 'all', arg3, arg4] = argv.filter((a, i) => !['--record', '--abyssal', '--save-backup', '--sim', '--detail', '--apply', '--restore-ranged', '--restore', '--style', '--slot', '--port', '--quantity', '--cape'].includes(a) && (styleIndex < 0 || i !== styleIndex + 1) && (capeIndex < 0 || i !== capeIndex + 1) && (slotIndex < 0 || i !== slotIndex + 1) && (dashboardPortIndex < 0 || i !== dashboardPortIndex + 1) && (quantityIndex < 0 || i !== quantityIndex + 1));
const usage = `usage:
  ./melvor-report.js slots
  ./melvor-report.js smoke
  ./melvor-report.js login-smoke
  ./melvor-report.js diff-slots
  ./melvor-report.js source-of-truth
  ./melvor-report.js improve [--record]
  ./melvor-report.js brief [all|character]
  ./melvor-report.js summary [all|character]
  ./melvor-report.js combat-plan [all|character] [--abyssal]
  ./melvor-report.js combat-setup <character>
  ./melvor-report.js combat-run <character> <dungeon name|id>
  ./melvor-report.js gear <character> [--detail] [--style melee|ranged|magic]
  ./melvor-report.js magic-setup <character> [--slot 6] [--apply] [--restore-ranged]
  ./melvor-report.js slayer-abyssal <character>
  ./melvor-report.js slayer-start <character> [--slot 6]
  ./melvor-report.js equip <character> <item> <slot> [--quantity n] [--apply]
  ./melvor-report.js skill-start <character> <skill> <recipe> [--apply]
  ./melvor-report.js talent-unlock <character> <skill> <node> [--apply]
  ./melvor-report.js skilling <character>
  ./melvor-report.js agility [all|character]
  ./melvor-report.js config [all|character]
  ./melvor-report.js config-set <character> <potion|prayers|poi|style> <value> [--apply]
  ./melvor-report.js talents <character>
  ./melvor-report.js export-state [all|character]
  ./melvor-report.js save-backup [all|character]
  ./melvor-report.js save-push <character> [--local-source]
  ./melvor-report.js journal [all|character] [--record] [--save-backup] [--sim]
  ./melvor-report.js completion [all|character] [--record]
  ./melvor-report.js dungeon-guide "<dungeon name>"
  ./melvor-report.js dungeon-check <character> "<dungeon name>"
  ./melvor-report.js dungeon-optimize <character> "<dungeon name>" [--style melee|ranged|magic] [--cape "<cape name>"]
  ./melvor-report.js dungeon-setup <character> "<dungeon name>" [--style melee,ranged] [--apply] [--restore --apply]
  ./melvor-report.js dungeon-clear <character> "<dungeon name>"   (one clear, then back to the previous activity)
  ./melvor-report.js journal-serve [--port 8787]
  ./melvor-report.js journal-status [all|character]
  ./melvor-report.js journal-diff [all|character]
  ./melvor-report.js journal-action <id> <approved|dismissed|done|blocked>

Most commands are read-only. combat-setup and combat-run write, save, then verify source-of-truth.
journal prints a Markdown entry; --record appends it under journal/ and
refreshes journal/latest.json, journal/actions.jsonl and journal/index.html.`;
if (require.main === module) {
  if (argv.includes('--help') || argv.includes('-h') || cmd === 'help') {
    console.log(usage);
    process.exit(0);
  }
  if (!['summary', 'brief', 'gear', 'skilling', 'agility', 'config', 'talents', 'slots', 'smoke', 'login-smoke', 'diff-slots', 'source-of-truth', 'improve', 'combat-plan', 'combat-setup', 'combat-run', 'magic-setup', 'slayer-abyssal', 'slayer-start', 'equip', 'skill-start', 'talent-unlock', 'config-set', 'export-state', 'save-backup', 'save-push', 'journal', 'journal-serve', 'journal-status', 'journal-diff', 'journal-action', 'completion', 'dungeon-guide', 'dungeon-check', 'dungeon-optimize', 'dungeon-setup', 'dungeon-clear'].includes(cmd)) {
    console.error(usage);
    process.exit(2);
  }
  // a comma list (melee,ranged) is only meaningful for dungeon-setup
  if (gearStyle && !gearStyle.split(',').every(x => ['melee', 'ranged', 'magic'].includes(x)) || (gearStyle?.includes(',') && cmd !== 'dungeon-setup')) {
    console.error('gear style must be melee, ranged, or magic (dungeon-setup accepts a list: melee,ranged)');
    process.exit(2);
  }
  if (!Number.isInteger(requestedSlot) || requestedSlot < 1) {
    console.error('slot must be a positive equipment-set number');
    process.exit(2);
  }
  if (quantityIndex >= 0 && (!Number.isInteger(requestedQuantity) || requestedQuantity < 1)) {
    console.error('quantity must be a positive integer');
    process.exit(2);
  }
  if (cmd === 'journal-serve' && (!Number.isInteger(dashboardPort) || dashboardPort < 1024 || dashboardPort > 65535)) {
    console.error('journal dashboard port must be an integer from 1024 to 65535');
    process.exit(2);
  }
}

if (require.main === module && who === 'all' && !['slots', 'smoke', 'login-smoke'].includes(cmd) && !CHARS.length) {
  console.error('Set MELVOR_CHARACTERS in .env.local, comma-separated, to use all-character commands.');
  process.exit(2);
}

const names = who === 'all' ? CHARS : [who];
const recordImprovement = cmd === 'improve' && record;

function sanitizeIncident(value) {
  let text = String(value || 'unknown error').split('\n')[0];
  for (const secret of [process.env.HOME, __dirname, PROFILE].filter(Boolean)) text = text.split(secret).join('<path>');
  return text
    .replace(/(?:https?|wss?):\/\/\S+/gi, '<url>')
    .replace(/[A-Za-z0-9+/=_-]{80,}/g, '<redacted>')
    .slice(0, 500);
}

function incidentSignature(command, message) {
  const normalized = sanitizeIncident(message).toLowerCase().replace(/\b\d+(?:\.\d+)?\b/g, '#');
  return crypto.createHash('sha1').update(`${command}|${normalized}`).digest('hex').slice(0, 12);
}

function readIncidents(file = INCIDENTS) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  return text.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}

function incidentCandidates(events, threshold = 2) {
  const grouped = new Map();
  for (const event of events) {
    const item = grouped.get(event.signature) || { ...event, count: 0, firstSeen: event.ts };
    item.count++;
    item.lastSeen = event.ts;
    grouped.set(event.signature, item);
  }
  return [...grouped.values()].filter(item => item.count >= threshold).sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen));
}

function recordIncident(error, file = INCIDENTS) {
  const message = sanitizeIncident(error?.message || error);
  const command = sanitizeIncident(argv.join(' ') || cmd);
  const event = { ts: new Date().toISOString(), command, durationMs: Date.now() - startedAt, message, signature: incidentSignature(cmd, message) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(event) + '\n');
  return event;
}

function promoteIncidentCandidates(candidates, file = INCIDENT_PROMOTIONS, run = execFileSync) {
  const promoted = new Set(readIncidents(file).map(item => item.signature));
  const created = [];
  for (const item of candidates.filter(item => !promoted.has(item.signature))) {
    const title = `Recurring Melvor CLI failure: ${item.message}`.slice(0, 120);
    const result = JSON.parse(run('logics-manager', [
      'flow', 'new', 'request', '--title', title, '--theme', 'Assistant reliability operations',
      '--complexity', 'Medium', '--format', 'json',
    ], { encoding: 'utf8' }));
    const promotion = { ts: new Date().toISOString(), signature: item.signature, ref: result.ref };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(promotion) + '\n');
    created.push(promotion);
  }
  if (created.length) run('logics-manager', ['index'], { encoding: 'utf8' });
  return created;
}

const req = (method, path) => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port: PORT, method, path }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve({ status: res.statusCode, data }));
  });
  r.on('error', reject);
  r.end();
});

async function newTab(url) {
  const r = await req('PUT', '/json/new?' + encodeURIComponent(url));
  if (r.status >= 300) throw Error(`cannot open tab: ${r.status} ${r.data}`);
  return JSON.parse(r.data);
}

async function closeTab(id) {
  try { await req('GET', '/json/close/' + id); } catch {}
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  };
  return new Promise((resolve, reject) => {
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const mid = ++id;
        ws.send(JSON.stringify({ id: mid, method, params }));
        return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
      },
      close: () => ws.close(),
    });
  });
}

async function evalExpr(client, expression, timeout = 30000) {
  const r = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout,
    userGesture: true,
  });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

async function waitFor(client, expression, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await evalExpr(client, expression, 5000);
      if (value) return value;
    } catch {}
    await sleep(1000);
  }
  throw Error(`timeout waiting for ${expression}`);
}

// A document-start script must exist before the game's mods run (puts the combat simulator in debug mode for --sim).
const SIM_DEBUG = `(() => { let v; Object.defineProperty(self, 'mcs', { configurable: true, get() { return v; }, set(x) { if (x && typeof x === 'object') x.isDebug = true; v = x; } }); })();`;
async function preparePage(client, init) {
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  if (!init) return;
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  await client.send('Page.reload', { ignoreCache: false });
  await sleep(1500);
}

async function withCharacter(name, fn, init) {
  const tab = await newTab(URL);
  const client = await cdp(tab.webSocketDebuggerUrl);
  try {
    await preparePage(client, init);
    await waitFor(client, "document.readyState === 'complete'", 90000);
    await sleep(2200);
    await evalExpr(client, helper);
    const load = await evalExpr(client, `mh.loadCharacter(${JSON.stringify(name)})`, 45000);
    if (!String(load).startsWith('loading ')) throw Error(load);
    await waitFor(client, `typeof game !== 'undefined' && game.loopStarted && game.characterName === ${JSON.stringify(name)}`, 150000);
    await sleep(1500);
    return await fn(client);
  } finally {
    client.close();
    await closeTab(tab.id);
  }
}

async function withCharacterSource(name, source, fn, init) {
  if (source !== 'local') return withCharacter(name, fn, init);
  const tab = await newTab(URL);
  const client = await cdp(tab.webSocketDebuggerUrl);
  try {
    await preparePage(client, init);
    await waitFor(client, "document.readyState === 'complete'", 90000);
    await sleep(2200);
    await evalExpr(client, helper);
    const load = await evalExpr(client, `mh.loadLocalCharacter(${JSON.stringify(name)})`, 45000);
    if (!String(load).startsWith('loading local ')) throw Error(load);
    await waitFor(client, `typeof game !== 'undefined' && game.loopStarted && game.characterName === ${JSON.stringify(name)}`, 150000);
    await sleep(1500);
    return await fn(client);
  } finally {
    client.close();
    await closeTab(tab.id);
  }
}

async function withPage(fn) {
  const tab = await newTab(URL);
  const client = await cdp(tab.webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitFor(client, "document.readyState === 'complete'", 90000);
    await sleep(2200);
    return await fn(client);
  } finally {
    client.close();
    await closeTab(tab.id);
  }
}

async function ensureChrome() {
  const version = await req('GET', '/json/version').catch(() => null);
  if (version?.status === 200) return null;

  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });

  for (let i = 0; i < 80; i++) {
    const ready = await req('GET', '/json/version').catch(() => null);
    if (ready?.status === 200) return chrome;
    if (chrome.exitCode !== null) throw Error('Chrome exited before opening the debug port');
    await sleep(250);
  }
  chrome.kill('SIGTERM');
  throw Error(`Chrome debug port ${PORT} unavailable`);
}

const fmtRate = n => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
function fmtNum(n) {
  return Intl.NumberFormat('en-US', { notation: Math.abs(n) >= 1e9 ? 'compact' : 'standard', maximumFractionDigits: 2 }).format(n);
}

const scorePrefixes = attackType => ({
  melee: ['stabAttackBonus', 'slashAttackBonus', 'blockAttackBonus', 'meleeStrengthBonus', 'meleeDefenceBonus', 'resistance'],
  ranged: ['rangedAttackBonus', 'rangedStrengthBonus', 'rangedDefenceBonus', 'resistance'],
  magic: ['magicAttackBonus', 'magicDamageBonus', 'magicDefenceBonus', 'resistance'],
}[attackType] || []);

const scoreItem = (item, prefixes) => prefixes.reduce((sum, p) =>
  sum + Math.max(0, ...Object.entries(item?.stats || {}).filter(([k]) => k.startsWith(p)).map(([, v]) => v)), 0);

function printSummary(r) {
  const low = r.lowSkills.map(s => `${s.name}:${s.level}`).join(', ') || 'none';
  console.log(`${r.name} | ${r.mode} | ${r.action} | total ${r.totalLevel} | max ${r.maxedSkills} | GP ${fmtNum(r.gp)}`);
  console.log(`  combat ${r.combatLevel}, hp ${fmtNum(r.hp)}, food ${r.food} x${fmtNum(r.foodQty)}, bank ${r.bankSlots}`);
  console.log(`  low: ${low}`);
}

function printGear(r) {
  const c = r.combat;
  console.log(`${r.name} | ${r.action}${c ? ` | ${c.area || 'no area'} / ${c.monster || 'no monster'} | hit ${Math.round(c.hitChance || 0)}%` : ''}`);
  if (detail) console.log(`  style: ${r.context?.attackType || 'unknown'}`);
  if (detail && r.equipped.Weapon?.damageType) console.log(`  weapon damage type: ${r.equipped.Weapon.damageType}`);
  for (const [slot, item] of Object.entries(r.equipped)) console.log(`  ${slot}: ${item.name}`);
  const prefixes = scorePrefixes(r.context?.attackType);
  for (const [slot, items] of Object.entries(r.candidates)) {
    for (const best of (detail ? items : items.slice(0, 1))) {
      if (!best || best.name === r.equipped[slot]?.name || scoreItem(best, prefixes) <= scoreItem(r.equipped[slot], prefixes)) continue;
      console.log(`  raw candidate ${slot}: ${best.name}`);
      if (detail) console.log(`    current ${JSON.stringify(r.equipped[slot]?.stats || {})} | passives ${(r.equipped[slot]?.passives || []).join('; ') || 'none'} | candidate ${JSON.stringify(best.stats)} | passives ${(best.passives || []).join('; ') || 'none'}`);
    }
  }
  if (detail) for (const [slot, items] of Object.entries(r.blocked || {}))
    for (const item of items)
      console.log(`  blocked ${slot}: ${item.name} | missing ${(item.missingRequirements || []).join('; ')}`);
}

function printSkilling(r) {
  console.log(`${r.name} | ${r.action}`);
  for (const [slot, item] of Object.entries(r.equipment)) console.log(`  ${slot}: ${item}`);
  for (const note of r.notes) console.log(`  note: ${note}`);
}

function gearCandidates(r) {
  const prefixes = scorePrefixes(r.context?.attackType);
  return Object.entries(r.candidates || {})
    .map(([slot, items]) => [slot, items[0]])
    .filter(([slot, best]) => best && best.name !== r.equipped[slot]?.name && scoreItem(best, prefixes) > scoreItem(r.equipped[slot], prefixes))
    .map(([slot, best]) => `${slot}: ${best.name}`);
}

// Decisions = gear swaps the simulator proves (owned items, more XP/h, no extra deaths) + the first step of the chosen goal.
// Swaps are only judged when this scan simulated (journal --sim); otherwise open swaps keep their status.
function planActions(r, goalStep = null) {
  const eq = r.report.equipment || {};
  const actions = [];
  const sim = r.upgradeSim && !r.upgradeSim.error ? r.upgradeSim : null;
  const base = sim?.baseline;
  for (const [slot, entry] of Object.entries(r.upgradePlan?.slots || {})) {
    const lane = entry.bank; if (!sim || !lane) continue;
    const best = [lane.primary, ...(lane.alternatives || [])]
      .map(item => ({ item, res: sim.results?.[slot]?.[item.name] }))
      .filter(x => x.res && !x.res.failed && base?.xpPerHour && (x.res.deathRate || 0) <= (base.deathRate || 0))
      .map(x => ({ ...x, gain: (x.res.xpPerHour - base.xpPerHour) / base.xpPerHour * 100 }))
      .filter(x => x.gain > 0.5 && eq[slot] !== x.item.name)
      .sort((a, b) => b.gain - a.gain)[0];
    if (best) actions.push({ type: 'equip', slot, item: best.item.name, current: eq[slot] || 'empty', available: best.item.owned || 0,
      reason: `sim +${best.gain.toFixed(1)}% XP/h on ${sim.monster}`, risk: r.report.mode === 'Hardcore Mode' ? 'medium' : 'low' });
  }
  if (goalStep) actions.push({ type: 'goal', slot: goalStep.goal, item: goalStep.line.split('; ')[0], current: '', available: 0, reason: goalStep.line.split('; ').slice(1).join(' · ') || 'next step of the ' + goalStep.goal + ' goal', risk: 'low' });
  return actions;
}

function planLines(r) {
  return planActions(r).filter(a => a.type === 'equip').map(a => `Equip ${a.item} in ${a.slot}; ${a.reason}; replaces ${a.current}`);
}

function talentAdvice(report, talents = []) {
  const activeSkill = report.action === 'Combat'
    ? `${report.combat?.playerAttackType || ''}`.replace(/^./, c => c.toUpperCase())
    : report.action;
  const active = talents.find(talent => talent.skill === activeSkill && talent.candidates.length);
  const next = active || talents.find(talent => talent.candidates.length);
  if (!next) return [];
  const node = next.candidates[0];
  return [`abyssal talent: ${next.skill} has ${next.points} unspent point${next.points === 1 ? '' : 's'}; spend ${node.shortName || node.name} next${next.skill === activeSkill ? ' for the active skill' : ''}`];
}

function currentActionPlan(r) {
  const report = r.report;
  const eq = report.equipment || {};
  const action = report.action || 'idle';
  const notes = (report.actionEstimate?.notes || []).filter(note => !(action === 'Combat' && report.combat?.playerAttackType === 'magic' && /^(Ammo:|Consumable: Ranged)/.test(note)));
  const lines = [...notes, ...(r.skilling?.notes || []), ...planLines(r)];
  const add = note => { if (!lines.includes(note)) lines.push(note); };
  if (action === 'idle') {
    add('current action: idle, no task is running');
    add('current action: choose a new task or restart the previous one after checking resources');
  } else if (action === 'Combat') {
    const c = report.combat || {};
    if (c.playerAttackType === 'magic') {
      add(`current combat: Magic with ${eq.Weapon || 'unknown weapon'}${c.playerDamageType ? ` (${c.playerDamageType})` : ''}`);
      if (eq.Weapon === 'Abyssal Staff') add('current Magic goal: reach abyssal Magic 5, then equip Abyssal Wand');
    }
    if (c.dungeonBoss?.name === 'Felth, the Toxic Martyr') {
      if (eq.Helmet !== 'Toxic Protection Mask') add('current Felth: equip Toxic Protection Mask before changing damage gear');
      else add('current Felth: Toxin protection active; confirm boss HP falls across two samples before changing a working build');
      if (c.hitChance !== null && c.hitChance !== undefined && c.hitChance < 80)
        add('current Felth: low accuracy; use the Depths of Decay magic route only if boss HP is not falling');
    }
    if (c.hitChance !== null && c.hitChance !== undefined && c.hitChance < 80)
      add(`current combat: low hit chance ${Math.round(c.hitChance)}%, prefer accuracy/prayer/potion before DPS`);
    if (!report.food || !report.foodQty) add('current combat: no food equipped');
    if (report.mode === 'Hardcore Mode') add('current combat: Hardcore, verify max hit and resistance before gear swaps');
  } else if (action === 'Agility') {
    if (eq.Summon2 !== 'Eagle') add('current Agility: use Eagle summon for interval');
    if (eq.Summon1 === 'Bear') add('current Agility: Bear is Herblore-focused, replace if another useful synergy is available');
    if (eq.Consumable === 'Golden Star') add('current Agility: Golden Star is Astrology-focused, remove unless intentionally burning stock');
  } else if (action === 'Astrology') {
    if (eq.Consumable !== 'Golden Star') add('current Astrology: use Golden Star if available');
    if (/Quill|Logbook/.test(`${eq.Weapon || ''} ${eq.Shield || ''}`)) add('current Astrology: Cartography tools equipped, swap to skilling XP/mastery gear');
  } else if (action === 'Fishing') {
    if (eq.Summon2 !== 'Octopus') add('current Fishing: use Octopus summon for yield');
    if (eq.Amulet !== 'Amulet of Fishing') add('current Fishing: use Amulet of Fishing if available');
  } else if (action === 'Herblore') {
    if (eq.Weapon !== 'Potion Stirrer') add('current Herblore: use Potion Stirrer if available');
    if (eq.Summon1 !== 'Bear') add('current Herblore: use Bear summon for preserve');
  }
  for (const advice of talentAdvice(report, r.talents)) add(advice);
  return lines.slice(0, 8);
}

function combatGoalLines(report) {
  const task = report.combat?.slayerTask;
  if (task?.monster) return [`active Slayer task: ${task.monster} (${task.left} left)`];
  const goals = report.combatGoals;
  if (!goals) return [];
  const capped = (goals.cappedSkills || [])
    .filter(s => s.level >= s.cap)
    .slice(0, 6)
    .map(s => `${s.name} ${s.level}/${s.cap}`);
  const dungeons = (goals.unclearedDungeons || [])
    .slice(0, 3)
    .map(d => `${d.name} (boss ${d.boss || 'unknown'}, CL ${d.maxCombatLevel})`);
  return [
    capped.length ? `capped standard skills: ${capped.join(', ')}` : null,
    dungeons.length ? `uncleared accessible candidates: ${dungeons.join('; ')}` : null,
    goals.nextSetup ? `next combat setup: ${goals.nextSetup.dungeon} with set ${goals.nextSetup.set?.index ?? '?'} ${goals.nextSetup.set?.attackType || 'unknown'} (${goals.nextSetup.set?.weapon || 'no weapon'}); prayers ${goals.nextSetup.prayers.join(' + ') || 'none'}` : null,
    goals.nextSetup?.summons?.length ? `next summons: ${goals.nextSetup.summons.join(' + ')}` : null,
    goals.nextSetup?.potions?.length ? `next potions: ${goals.nextSetup.potions.join('; ')}` : null,
    ...(goals.nextSetup?.gearNotes || []),
  ].filter(Boolean);
}

const byLevelThenXp = (a, b) => a.level - b.level || a.xp - b.xp;
const byAbyssalLevelThenXp = (a, b) => (a.abyssalLevel ?? 0) - (b.abyssalLevel ?? 0) || (a.abyssalXP ?? 0) - (b.abyssalXP ?? 0);
const skillView = s => ({
  name: s.name,
  id: s.id ?? null,
  level: s.level,
  cap: s.levelCap ?? s.cap ?? null,
  abyssalLevel: s.abyssalLevel ?? null,
  abyssalCap: s.abyssalCap ?? null,
});
const isAbyssalDungeon = d => d.kind === 'abyssal' || /^melvorItA:/.test(d.id || '');
const hasTrainableAbyssalLevels = s =>
  (s.abyssalCap ?? 0) > 1
  && !['melvorAoD:Cartography', 'melvorAoD:Archaeology'].includes(s.id);
const xpForLevel = level => {
  let points = 0;
  for (let l = 1; l < level; l++) points += Math.floor(l + 300 * Math.pow(2, l / 7));
  return Math.floor(points / 4);
};
const fmtDuration = ms => {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = Math.round(ms / 60000);
  if (min < 90) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
};

function verifiedSkillPlan(data, skill, abyssal) {
  const option = (data.skillingOptions?.[skill.name] || [])
    .filter(o => Boolean(o.abyssalLevel) === abyssal && (o.gathering || o.runwayHours >= 8))
    .sort((a, b) => (b.xpPerHour ?? 0) - (a.xpPerHour ?? 0) || (b.runwayHours ?? Infinity) - (a.runwayHours ?? Infinity))[0];
  if (!option) return null;
  if (option.gathering) return `${abyssal ? 'abyssal ' : ''}${skill.name}: ${option.recipe}; no materials needed; ${option.xpPerHour ? fmtRate(option.xpPerHour) + ' XP/h' + (option.rateSource === 'ETA' ? ' (ETA)' : '') : 'XP rate unknown'}`;
  const inputs = option.inputs.map(i => `${i.item} ${i.owned} (${i.perAction}/action)`).join(', ');
  return `${abyssal ? 'abyssal ' : ''}${skill.name}: ${option.recipe}; ${option.maxActions} actions; ${option.runwayHours.toFixed(1)} h runway; ${inputs}`;
}

function briefFromData(name, data, save, previousEntry, now = new Date().toISOString()) {
  const report = data.report;
  const skills = data.skills || [];
  const goals = report.combatGoals || {};
  const standardOpen = skills
    .filter(s => (s.levelCap ?? 120) > 1 && s.level < (s.levelCap ?? 120) && s.name !== report.action)
    .sort(byLevelThenXp);
  // Into the Abyss content waits until the character is in the Abyss (data.abyss from mh.abyssOpen)
  const abyssalSkills = data.abyss === false ? [] : skills.filter(hasTrainableAbyssalLevels);
  const abyssalOpen = abyssalSkills
    .filter(s => (s.abyssalLevel ?? 0) < s.abyssalCap)
    .sort(byAbyssalLevelThenXp);
  const dungeons = goals.unclearedDungeons || [];
  const abyssalDungeons = dungeons.filter(isAbyssalDungeon);
  const standardDungeons = dungeons.filter(d => !isAbyssalDungeon(d));
  const saveRisk = !save || save.source === 'unknown' ? 'save source of truth unknown' : null;
  const abyssalNext = [
    abyssalDungeons[0] ? `clear abyssal dungeon: ${abyssalDungeons[0].name}` : null,
    ...abyssalOpen.slice(0, 3).map(s => verifiedSkillPlan(data, s, true)),
  ].filter(Boolean);
  const currentNext = currentActionPlan(data);
  const standardNext = [
    ...standardOpen.slice(0, 3).map(s => verifiedSkillPlan(data, s, false)),
    // ponytail: abyssal Slayer > 1 means the character left the standard realm; a leftover standard dungeon is completion, not progression
    goals.nextSetup && !skills.some(s => s.name === 'Slayer' && (s.abyssalLevel ?? 0) > 1) ? `combat setup: ${goals.nextSetup.dungeon} with set ${goals.nextSetup.set?.index ?? '?'} ${goals.nextSetup.set?.attackType || 'unknown'} (${goals.nextSetup.set?.weapon || 'no weapon'})` : null,
  ].filter(Boolean);
  return {
    name,
    mode: report.mode,
    action: report.action,
    source: save ? {
      current: save.source,
      diffMinutes: save.diffMs === null ? null : Math.round(save.diffMs / 60000),
      writeBlocked: save.source === 'local' && save.diffMs > 5 * 60000,
    } : { current: 'unknown', diffMinutes: null, writeBlocked: true },
    gp: report.gp,
    combat: {
      level: report.combatLevel,
      hp: report.hp,
      food: report.food,
      foodQty: report.foodQty,
      current: report.combat,
    },
    currentAction: {
      name: report.action || 'idle',
      next: currentNext,
      estimate: report.actionEstimate || null,
      ...(previousEntry !== undefined ? {
        levelEtas: levelEtaStatus(progressEtas({ observed: { at: now, action: report.action, skills } }, previousEntry)),
      } : {}),
    },
    standard: {
      total: report.totalLevel,
      maxed: report.maxedSkills,
      lowest: standardOpen.slice(0, 8).map(skillView),
      dungeons: standardDungeons.slice(0, 5).map(d => ({
        name: d.name,
        id: d.id,
        boss: d.boss,
        bossAttackType: d.bossAttackType,
        maxCombatLevel: d.maxCombatLevel,
      })),
      next: standardNext.slice(0, 6),
    },
    abyssal: {
      maxed: `${abyssalSkills.filter(s => (s.abyssalLevel ?? 0) >= s.abyssalCap).length}/${abyssalSkills.length}`,
      top: [...abyssalSkills].sort((a, b) => -byAbyssalLevelThenXp(a, b)).slice(0, 8).map(skillView),
      lowest: abyssalOpen.slice(0, 8).map(skillView),
      dungeons: abyssalDungeons.slice(0, 5).map(d => ({
        name: d.name,
        id: d.id,
        boss: d.boss,
        bossAttackType: d.bossAttackType,
        maxCombatLevel: d.maxCombatLevel,
      })),
      next: abyssalNext.slice(0, 6),
    },
    risks: [
      saveRisk,
      report.mode === 'Hardcore Mode' ? 'Hardcore: verify survivability before combat changes' : null,
    ].filter(Boolean),
    next: [
      ...currentNext,
      ...standardNext,
      ...abyssalNext,
    ].filter(Boolean).slice(0, 8),
  };
}

function printCombatPlan(r, options = {}) {
  const goals = r.report.combatGoals || {};
  const capped = (goals.cappedSkills || []).filter(s => s.level >= s.cap).slice(0, 8);
  const beats = { melee: 'magic', ranged: 'melee', magic: 'ranged' };
  console.log(`${r.report.name} | combat plan | ${r.report.mode} | combat ${r.report.combatLevel} | HP ${fmtNum(r.report.hp)}`);
  console.log(`  food: ${r.report.food || 'none'} x${fmtNum(r.report.foodQty || 0)}`);
  if (capped.length) console.log(`  capped: ${capped.map(s => `${s.name} ${s.level}/${s.cap}`).join(', ')}`);
  const dungeons = (goals.unclearedDungeons || [])
    .filter(d => !options.abyssalOnly || isAbyssalDungeon(d))
    .slice(0, 5);
  if (!dungeons.length) console.log(`  no accessible uncleared ${options.abyssalOnly ? 'abyssal ' : ''}dungeon found`);
  const completed = (goals.completedDungeons || []).filter(d => !options.abyssalOnly || isAbyssalDungeon(d));
  if (completed.length) console.log(`  completed ${options.abyssalOnly ? 'abyssal ' : ''}dungeons: ${completed.map(d => `${d.name} x${d.completeCount}`).join(', ')}`);
  if (options.abyssalOnly) {
    const depths = goals.abyssalDepths || [];
    console.log(`  Abyssal Depths: ${depths.length ? depths.map(depth => depth.name).join(', ') : 'unavailable from this game build'} (completion state not exposed by this game API)`);
  }
  for (const d of dungeons) {
    const style = beats[d.bossAttackType] || null;
    const set = r.sets.find(s => style && s.attackType === style) || r.sets.find(s => s.attackType) || {};
    const reqs = d.requirements.length ? d.requirements.map(req => req.dungeon || req.skill || req.purchase || req.type).join(', ') : 'none';
    console.log(`  dungeon: ${d.name} | boss ${d.boss || 'unknown'} (${d.bossAttackType || 'unknown'}, CL ${d.maxCombatLevel})`);
    console.log(`    use set ${set.index ?? '?'} ${set.attackType || 'unknown'}: ${set.weapon || 'no weapon'} / ${set.cape || 'no cape'} | reqs ${reqs}`);
  }
  if (goals.nextSetup && (!options.abyssalOnly || isAbyssalDungeon({ name: goals.nextSetup.dungeon, id: '' }))) {
    console.log(`  next setup: prayers ${goals.nextSetup.prayers.join(' + ') || 'none'}`);
    if (goals.nextSetup.summons?.length) console.log(`  next setup: summons ${goals.nextSetup.summons.join(' + ')}`);
    if (goals.nextSetup.potions?.length) console.log(`  next setup: potions ${goals.nextSetup.potions.join('; ')}`);
    for (const note of goals.nextSetup.gearNotes || []) console.log(`  next setup: ${note}`);
  }
}

function printCombatRun(r) {
  console.log(`${r.name} | combat-run | ${r.dungeon} | ${r.status}`);
  console.log(`  set S${r.set ? r.set.index + 1 : '?'} ${r.set?.attackType || 'unknown'}: ${r.set?.weapon || 'no weapon'} / ${r.set?.cape || 'no cape'}`);
  for (const s of r.samples) {
    console.log(`  ${s.t} progress ${s.progress} | completed ${s.completed} | ${s.monster || 'none'} hp ${s.enemyHP ?? '-'} | player ${s.hp}/${s.maxHP} | food ${s.food ?? '?'}${s.stoppedCombat !== undefined ? ' | fled ' + s.stoppedCombat : ''}`);
  }
  for (const o of r.rewardOptions || []) console.log(`  pending option: ${o.label}${o.context ? ` | ${o.context}` : ''}`);
  console.log(`  saved: ${r.saved} | source ${r.sourceBefore} -> ${r.sourceAfter}`);
}

function recordCombatRewardOptions(r) {
  if (!r.rewardOptions?.length) return;
  fs.mkdirSync(JOURNAL_DIR, { recursive: true });
  fs.appendFileSync(path.join(JOURNAL_DIR, `${r.name}.md`), [
    `## ${new Date().toISOString()} - ${r.name} combat rewards`,
    '',
    `- Dungeon: ${r.dungeon}`,
    `- Status: ${r.status}`,
    ...r.rewardOptions.map(o => `- Pending option: ${o.label}${o.context ? ` - ${o.context}` : ''}`),
    '',
  ].join('\n') + '\n');
  console.log(`recorded journal/${r.name}.md`);
}

function printCombatSetup(r) {
  console.log(`${r.name} | combat-setup | ${r.dungeon} | ${r.status}`);
  console.log(`  source ${r.sourceBefore} -> ${r.sourceAfter}`);
  for (const x of r.actions) console.log(`  ${x}`);
  console.log(`  saved: ${r.saved}`);
}

// only buttons on screen: every skill page keeps hidden 'Increase Level Cap' buttons in the DOM
const visibleRewardOptions = `(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null)
  .map(b => ({ label: b.innerText.trim(), context: (b.closest('.swal2-popup,.modal,.block,.content')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 220) }))
  .filter(o => /^Claim$|^Increase .*Level Cap$/.test(o.label))
)()`;

const potionItemName = s => String(s || '').split(/\s+(?:for|if)\s+/i)[0].trim();

const combatRunScript = (dungeonRef, timeoutMs, setNumber = null) => `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const beats = { melee: 'magic', ranged: 'melee', magic: 'ranged' };
  // dungeons and Abyss depths (strongholds need a tier choice: not handled)
  const depths = game.abyssDepths?.allObjects ?? [];
  const allDungeons = [...game.dungeons.allObjects, ...depths];
  const ref = ${JSON.stringify(dungeonRef)}.toLowerCase();
  const dungeon = allDungeons.find(d => d.id.toLowerCase() === ref)
    ?? allDungeons.find(d => d.name.toLowerCase() === ref)
    ?? allDungeons.find(d => d.name.toLowerCase().includes(ref));
  if (!dungeon) return { status: 'error', error: ${JSON.stringify('unknown dungeon: ' + dungeonRef)} };
  const monsters = dungeon.monsters ?? [];
  const boss = monsters[monsters.length - 1];
  const style = beats[boss?.attackType] || null;
  const p = game.combat.player;
  const setInfo = (set, index) => {
    const equipped = set.equipment.equippedArray.filter(s => !s.isEmpty);
    const item = slot => equipped.find(s => s.slot.localID === slot)?.item;
    return { index, attackType: item('Weapon')?.attackType ?? null, weapon: item('Weapon')?.name ?? null, cape: item('Cape')?.name ?? null };
  };
  const sets = p.equipmentSets.map(setInfo);
  // --slot: the set dungeon-check measured; otherwise the style that beats the boss
  const set = ${setNumber ? `sets[${Number(setNumber) - 1}]` : 'null'} || sets.find(s => style && s.attackType === style) || sets.find(s => s.attackType);
  if (!set) return { status: 'error', dungeon: dungeon.name, error: 'no combat set found' };
  // never start a run that could not flee on low HP
  if (typeof game.combat.stop !== 'function' || !('isActive' in game.combat)) return { status: 'error', dungeon: dungeon.name, error: 'cannot flee (game.combat.stop/isActive missing): not starting' };
  const isDepth = depths.includes(dungeon);
  const completedCount = () => isDepth ? (dungeon.timesCompleted ?? 0) : game.combat.getDungeonCompleteCount(dungeon);
  if (isDepth && typeof game.combat.selectAbyssDepth !== 'function') return { status: 'error', dungeon: dungeon.name, error: 'cannot select an Abyss depth: not starting' };
  const beforeCompleted = completedCount();
  p.changeEquipmentSet(set.index);
  if (game.activeAction?.name !== 'Combat' || game.combat.selectedArea?.id !== dungeon.id)
    isDepth ? game.combat.selectAbyssDepth(dungeon) : game.combat.selectDungeon(dungeon);
  await sleep(5000);
  const samples = [];
  const started = Date.now();
  let status = 'timeout';
  // checked every second (a big hit lands between two 10 s checks); one sample in ten is kept for the report
  const hpFloor = /Hardcore/i.test(game.currentGamemode?.name || '') ? 0.5 : 0.35;
  const foodLeft = () => { try { return p.food.slots.reduce((n, s) => n + (s.item !== game.emptyFoodItem ? s.quantity : 0), 0); } catch { return null; } };
  for (let tick = 0; Date.now() - started < ${Number(timeoutMs)}; tick++) {
    const sample = {
      t: new Date().toISOString(),
      progress: game.combat.areaProgress,
      completed: completedCount(),
      monster: game.combat.enemy?.monster?.name ?? null,
      enemyHP: game.combat.enemy?.hitpoints ?? null,
      fight: game.combat.fightInProgress,
      hp: p.hitpoints,
      maxHP: p.stats.maxHitpoints,
      food: foodLeft(),
    };
    if (tick % 10 === 0) samples.push(sample);
    if (sample.completed > beforeCompleted) { samples.push(sample); status = 'completed'; break; }
    if (sample.food !== null && sample.food < 10) { status = 'low-food'; game.combat.stop(); await sleep(1000); sample.stoppedCombat = !game.combat.isActive; samples.push(sample); break; }
    // leaving the loop is not enough: the fight goes on unwatched and a Standard death loses an item, so flee
    if (sample.hp < sample.maxHP * hpFloor) { status = 'low-hp'; game.combat.stop(); await sleep(1000); sample.stoppedCombat = !game.combat.isActive; samples.push(sample); break; }
    await sleep(1000);
  }
  const rewardOptions = ${visibleRewardOptions};
  return { name: game.characterName, dungeon: dungeon.name, status, set, samples, rewardOptions };
})()`;

const combatSetupScript = `(() => {
  const goals = mh.combatGoals();
  const setup = goals.nextSetup;
  if (!setup) return { status: 'error', error: 'no next combat setup found' };
  const p = game.combat.player;
  const actions = [];
  if (setup.set?.index !== undefined) {
    p.changeEquipmentSet(setup.set.index);
    actions.push('set: ' + setup.set.index + ' ' + (setup.set.attackType || 'unknown'));
  }
  if (setup.gearNotes?.some(n => /Maximum Skillcape/.test(n)))
    actions.push('cape: ' + mh.equipSlot('Maximum Skillcape', 'Cape'));
  for (const [i, name] of (setup.summons || []).slice(0, 2).entries())
    actions.push('summon' + (i + 1) + ': ' + mh.equipSlot(name, 'Summon' + (i + 1)));
  for (const raw of setup.potions || []) {
    const name = (${potionItemName.toString()})(raw);
    const result = mh.equipSlot(name, 'Consumable');
    actions.push('potion: ' + (/not equipment|invalid slot/.test(result) ? 'skipped ' + name + ' (' + result + ')' : result));
  }
  for (const name of setup.prayers || []) {
    const prayer = game.prayers?.allObjects?.find(p => p.name === name);
    const toggle = p.togglePrayer || game.combat.player.togglePrayer;
    const active = p.activePrayers;
    const already = active?.has?.(prayer) || active?.includes?.(prayer) || active?.some?.(x => x === prayer || x.name === name);
    if (already) { actions.push('prayer: already active ' + name); continue; }
    if (prayer && toggle) {
      try { toggle.call(p, prayer); actions.push('prayer: toggled ' + name); }
      catch (e) { actions.push('prayer: skipped ' + name + ' (' + e.message + ')'); }
    } else actions.push('prayer: skipped ' + name + ' (API not found)');
  }
  return { name: game.characterName, dungeon: setup.dungeon, status: 'prepared', actions };
})()`;

const magicSetupScript = (slotNumber, shouldApply) => `(async () => {
  const p = game.combat.player;
  const slotIndex = ${Number(slotNumber) - 1};
  const gear = {
    Helmet: 'Infernal Mythical Wizard Hat',
    Platebody: 'Infernal Legendary Wizard Robes', Platelegs: 'Infernal Mythical Wizard Bottoms',
    Boots: 'Infernal Mythical Wizard Boots', Gloves: 'Blighting Gloves',
    Amulet: 'Fury of the Elemental Zodiacs', Ring: 'Abyss Ring', Cape: 'Superior Max Skillcape',
    Passive: 'Thorn Defender', Gem: 'Agile Gem', Weapon: 'Abyssal Staff',
  };
  const potionName = 'Damage Reduction Potion IV';
  const owned = name => { for (const [item, bankItem] of game.bank.items) if (item.name === name) return bankItem.quantity; return 0; };
  const targetSet = p.equipmentSets?.[slotIndex];
  const targetNames = new Set(targetSet?.equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => slot.item.name) ?? []);
  const targetWeapon = targetSet?.equipment.equippedArray.find(slot => slot.slot.localID === 'Weapon' && !slot.isEmpty)?.item;
  const missing = Object.entries(gear).filter(([, name]) => !owned(name) && !targetNames.has(name)).map(([slot, name]) => slot + ': ' + name);
  if (!owned(potionName)) missing.push('Potion: ' + potionName);
  const attackSpells = [...(game.attackSpellbooks?.allObjects ?? [])].flatMap(book => [...(book.spells?.allObjects ?? book.spells ?? [])]);
  const magicSpell = attackSpells.find(spell => spell.name === 'Abyssal Blast' && p.canUseCombatSpell(spell));
  const result = { name: game.characterName, slot: slotIndex + 1, preset: gear, potion: potionName, missing, targetEquipment: [...targetNames], damageType: targetWeapon?.damageType?.name ?? null, spell: magicSpell?.name ?? null, applied: false, actions: [] };
  if (!${JSON.stringify(shouldApply)}) return result;
  if (!p.equipmentSets?.[slotIndex]) return { ...result, error: 'equipment set ' + (slotIndex + 1) + ' does not exist' };
  if (missing.length) return { ...result, error: 'missing required bank items' };
  const previousSet = p.selectedEquipmentSet;
  p.changeEquipmentSet(slotIndex);
  for (const [slot, name] of Object.entries(gear)) {
    if (targetNames.has(name)) { result.actions.push(slot + ': already equipped ' + name); continue; }
    if (slot === 'Weapon') {
      const shield = p.equipment.equippedArray.find(entry => entry.slot.localID === 'Shield' && !entry.isEmpty);
      if (shield) {
        for (const attempt of [
          () => p.unequipItem(p.selectedEquipmentSet, shield.slot),
          () => p.unequipItem(shield.slot, p.selectedEquipmentSet),
          () => p.unequipItem(shield.slot),
        ]) {
          try { attempt(); } catch {}
          if (p.equipment.equippedArray.find(entry => entry.slot.localID === 'Shield')?.isEmpty) break;
        }
        if (!p.equipment.equippedArray.find(entry => entry.slot.localID === 'Shield')?.isEmpty)
          return { ...result, error: 'Melvor did not unequip the shield' };
        result.actions.push('Shield: unequipped ' + shield.item.name);
      }
    }
    const action = mh.equipSlot(name, slot);
    result.actions.push(slot + ': ' + action);
    if (/not in bank|invalid|unknown|did not equip/.test(action)) return { ...result, error: action };
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  const potion = [...game.bank.items.keys()].find(item => item.name === potionName);
  if (potion) { game.potions.usePotion(potion); result.actions.push('potion: activated ' + potionName); }
  else result.actions.push('potion: unavailable ' + potionName);
  for (const name of ['Mystic Lore', 'Augury']) {
    const prayer = game.prayers?.allObjects?.find(prayer => prayer.name === name);
    const active = p.activePrayers;
    const already = active?.has?.(prayer) || active?.includes?.(prayer) || active?.some?.(value => value === prayer || value.name === name);
    if (!prayer) result.actions.push('prayer: unavailable ' + name);
    else if (already) result.actions.push('prayer: already active ' + name);
    else { p.togglePrayer(prayer); result.actions.push('prayer: enabled ' + name); }
  }
  if (magicSpell) { p.selectAttackSpell(magicSpell); result.actions.push('spell: selected ' + magicSpell.name); }
  else result.actions.push('spell: Abyssal Blast unavailable');
  result.finalTargetEquipment = p.equipmentSets[slotIndex].equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => slot.item.name);
  if (previousSet !== slotIndex) p.changeEquipmentSet(previousSet);
  result.applied = true;
  return result;
})()`;

const restoreAbyssalRangedScript = (slotNumber, shouldApply) => `(async () => {
  const p = game.combat.player;
  const slotIndex = ${Number(slotNumber) - 1};
  const gear = {
    Helmet: 'Toxic Protection Mask', Platebody: 'Bundled Protection Body', Platelegs: 'Thorn Legs',
    Boots: 'Abyssal Leather Boots', Weapon: 'Blighted Feather Bow', Amulet: 'Amulet of Distance',
    Ring: 'Abyss Ring', Gloves: 'Woeful Gloves', Quiver: 'Abyssium Arrows',
    Cape: 'Superior Max Skillcape', Passive: 'Thorn Defender', Consumable: 'Ranged Hinder Scroll', Gem: 'Agile Gem',
  };
  const owned = name => { for (const [item, bankItem] of game.bank.items) if (item.name === name) return bankItem.quantity; return 0; };
  const targetSet = p.equipmentSets?.[slotIndex];
  const targetNames = new Set(targetSet?.equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => slot.item.name) ?? []);
  const missing = Object.entries(gear).filter(([, name]) => !owned(name) && !targetNames.has(name)).map(([slot, name]) => slot + ': ' + name);
  const result = { name: game.characterName, slot: slotIndex + 1, preset: gear, missing, targetEquipment: [...targetNames], applied: false, actions: [] };
  if (!${JSON.stringify(shouldApply)}) return result;
  if (!targetSet) return { ...result, error: 'equipment set ' + (slotIndex + 1) + ' does not exist' };
  if (missing.length) return { ...result, error: 'missing required bank items' };
  const previousSet = p.selectedEquipmentSet;
  p.changeEquipmentSet(slotIndex);
  for (const [slot, name] of Object.entries(gear)) {
    if (targetNames.has(name)) { result.actions.push(slot + ': already equipped ' + name); continue; }
    const action = mh.equipSlot(name, slot);
    result.actions.push(slot + ': ' + action);
    if (/not in bank|invalid|unknown|did not equip/.test(action)) return { ...result, error: action };
  }
  result.finalTargetEquipment = p.equipmentSets[slotIndex].equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => slot.item.name);
  if (previousSet !== slotIndex) p.changeEquipmentSet(previousSet);
  result.applied = true;
  return result;
})()`;

const equipmentActionScript = (itemName, slotName, quantity, shouldApply) => `(() => {
  const item = [...game.bank.items.keys()].find(item => item.name === ${JSON.stringify(itemName)});
  const player = game.combat.player;
  const slot = player.equipment.equippedArray.find(entry => entry.slot.localID === ${JSON.stringify(slotName)})?.slot;
  const current = player.equipment.equippedArray.find(entry => entry.slot.localID === ${JSON.stringify(slotName)})?.item?.name ?? null;
  const available = item ? game.bank.items.get(item)?.quantity ?? 0 : 0;
  const result = { name: game.characterName, item: ${JSON.stringify(itemName)}, slot: ${JSON.stringify(slotName)}, current, available, applied: false };
  if (!item) return { ...result, error: 'item is not in bank' };
  if (!slot || !item.validSlots?.some(value => value.localID === ${JSON.stringify(slotName)})) return { ...result, error: 'item cannot be equipped in this slot' };
  const stack = /^(Summon[12]|Quiver|Consumable)$/.test(${JSON.stringify(slotName)});
  const amount = ${quantity === undefined ? 'undefined' : Number(quantity)} ?? (stack ? available : 1);
  if (amount < 1 || amount > available) return { ...result, error: 'requested quantity is unavailable' };
  result.quantity = amount;
  if (!${JSON.stringify(shouldApply)}) return result;
  result.action = mh.equipSlot(${JSON.stringify(itemName)}, ${JSON.stringify(slotName)}, amount);
  result.final = player.equipment.equippedArray.find(entry => entry.slot.localID === ${JSON.stringify(slotName)})?.item?.name ?? null;
  if (result.final !== ${JSON.stringify(itemName)}) return { ...result, error: 'Melvor did not equip the requested item' };
  result.applied = true;
  return result;
})()`;

// Completion log percentages: total, per expansion, and per category over the whole game.
const COMPLETION_LOG = path.join(JOURNAL_DIR, 'completion.jsonl');
const completionScript = `(() => {
  const c = game.completion, all = 'melvorTrue'; // not c.visibleCompletion: that is a per-character UI toggle
  const pct = v => Math.round(v * 100) / 100;
  return {
    total: pct(c.totalProgressTrue),
    expansions: { base: pct(c.totalProgressBaseGame), toth: pct(c.totalProgressTotH), aod: pct(c.totalProgressAoD), ita: pct(c.totalProgressItA) },
    categories: { skills: pct(c.skillProgress.getPercent(all)), mastery: pct(c.masteryProgress.getPercent(all)), items: pct(c.itemProgress.getPercent(all)),
      monsters: pct(c.monsterProgress.getPercent(all)), pets: pct(c.petProgress.getPercent(all)) },
  };
})()`;
const completionRows = name => !fs.existsSync(COMPLETION_LOG) ? [] :
  fs.readFileSync(COMPLETION_LOG, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.name === name);
const lastCompletion = name => completionRows(name).at(-1) || null;
const completionLine = (row, prev) => {
  const delta = (v, p) => p == null || v === p ? '' : ` (${v > p ? '+' : ''}${(v - p).toFixed(2)})`;
  const e = row.expansions, c = row.categories, pe = prev?.expansions || {}, pc = prev?.categories || {};
  return `${row.name} | completion ${row.total.toFixed(2)}%${delta(row.total, prev?.total)}\n` +
    `  base ${e.base.toFixed(1)}%${delta(e.base, pe.base)} | TotH ${e.toth.toFixed(1)}%${delta(e.toth, pe.toth)} | AoD ${e.aod.toFixed(1)}%${delta(e.aod, pe.aod)} | ItA ${e.ita.toFixed(1)}%${delta(e.ita, pe.ita)}\n` +
    `  skills ${c.skills.toFixed(1)}% | mastery ${c.mastery.toFixed(1)}% | items ${c.items.toFixed(1)}% | monsters ${c.monsters.toFixed(1)}% | pets ${c.pets.toFixed(1)}%` +
    (prev ? `\n  vs ${prev.at.slice(0, 10)}` : '');
};

// Guarded combat configuration change: kind is potion | prayers | poi | style.
const configSetScript = (kind, value, shouldApply) => `(async () => {
  const kind = ${JSON.stringify(kind)}, value = ${JSON.stringify(value)}, apply = ${JSON.stringify(shouldApply)};
  const player = game.combat.player;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const result = { name: game.characterName, kind, target: value, applied: false };
  if (kind === 'potion') {
    const item = [...game.bank.items.keys()].find(item => item.name === value);
    if (!item?.action) return { ...result, error: 'potion is not in bank' };
    // ponytail: getActivePotionForAction(item.action) misses combat potions; match the activePotions key by name
    const active = () => [...game.potions.activePotions].find(([action]) => action === item.action || action.name === item.action.name)?.[1];
    result.current = active()?.item?.name ?? 'none';
    result.available = game.bank.items.get(item)?.quantity ?? 0;
    if (!apply) return result;
    game.potions.usePotion(item);
    await sleep(300);
    result.final = active()?.item?.name ?? 'none';
    if (result.final !== value) return { ...result, error: 'Melvor did not activate the potion' };
  } else if (kind === 'prayers') {
    const wanted = value.split(',').map(name => name.trim()).filter(Boolean).map(name => game.prayers.allObjects.find(prayer => prayer.name === name) || name);
    const missing = wanted.filter(prayer => typeof prayer === 'string');
    const names = set => [...set].map(prayer => prayer.name).join(' + ') || 'none';
    result.current = names(player.activePrayers);
    if (missing.length) return { ...result, error: 'unknown prayer: ' + missing.join(', ') };
    const unusable = wanted.filter(prayer => !player.canEnablePrayer?.(prayer) && !player.activePrayers.has(prayer));
    if (unusable.length) return { ...result, error: 'prayer not usable now: ' + unusable.map(prayer => prayer.name).join(', ') };
    if (!apply) return result;
    for (const prayer of [...player.activePrayers]) if (!wanted.includes(prayer)) player.togglePrayer(prayer);
    for (const prayer of wanted) if (!player.activePrayers.has(prayer)) player.togglePrayer(prayer);
    await sleep(300);
    result.final = names(player.activePrayers);
    if (wanted.some(prayer => !player.activePrayers.has(prayer)) || player.activePrayers.size !== wanted.length) return { ...result, error: 'Melvor did not set the requested prayers' };
  } else if (kind === 'poi') {
    const map = game.cartography.activeMap;
    const poi = map?.pointsOfInterest.allObjects.find(poi => poi.name === value);
    result.current = map?.playerPosition?.pointOfInterest?.name ?? 'none';
    if (!poi?.isDiscovered) return { ...result, error: 'point of interest is not discovered on the active map' };
    if (map.playerPosition === poi.hex) return { ...result, error: 'already at this point of interest' };
    map.selectHex(poi.hex);
    const path = map.selectedHexPath;
    if (!path?.length) return { ...result, error: 'no travel path to this point of interest' };
    const costs = game.cartography.getTravelCosts(path);
    result.cost = [...(costs._items ?? new Map())].map(([item, qty]) => item.name + ' x' + qty).concat([...(costs._currencies ?? new Map())].map(([currency, qty]) => currency.name + ' ' + qty)).join(', ') || 'free';
    result.affordable = costs.checkIfOwned ? costs.checkIfOwned() : null;
    if (!apply) { map.deselectHex(); return result; }
    if (result.affordable === false) return { ...result, error: 'travel cost is not affordable' };
    game.cartography.travelOnClick();
    await sleep(800);
    if (typeof mh !== 'undefined') mh.dismissModal?.(true);
    result.final = map.playerPosition?.pointOfInterest?.name ?? 'none';
    if (map.playerPosition !== poi.hex) return { ...result, error: 'Melvor did not move to the point of interest' };
  } else if (kind === 'style') {
    // The preview lists the styles of the current attack type; melee Block sends combat XP to Defence.
    const type = player.attackType;
    const styles = game.attackStyles.allObjects.filter(style => style.attackType === type);
    result.current = player.attackStyles?.[type]?.name ?? 'unknown';
    result.available = styles.map(style => style.name).join(', ');
    const style = styles.find(style => style.name === value);
    if (!style) return { ...result, error: 'unknown ' + type + ' attack style' };
    if (!apply) return result;
    player.setAttackStyle(type, style);
    await sleep(300);
    result.final = player.attackStyles?.[type]?.name ?? 'unknown';
    if (result.final !== value) return { ...result, error: 'Melvor did not set the attack style' };
  } else return { ...result, error: 'kind must be potion, prayers, poi, or style' };
  result.hitChance = player.stats.hitChance;
  result.applied = true;
  return result;
})()`;

const skillStartScript = (skillName, recipeName, shouldApply) => `(async () => {
  const values = value => value instanceof Map || value instanceof Set ? [...value.values()] : value?.allObjects ?? value ?? [];
  const methodNames = object => { const names = new Set(); for (let value = object; value && value !== Object.prototype; value = Object.getPrototypeOf(value)) for (const name of Object.getOwnPropertyNames(value)) if (typeof object[name] === 'function') names.add(name); return [...names].filter(name => /select|create|start/i.test(name)); };
  const method = (object, names) => names.find(name => typeof object[name] === 'function');
  const skill = values(game.skills).find(skill => skill.name.toLowerCase() === ${JSON.stringify(skillName.toLowerCase())});
  if (!skill) return { error: ${JSON.stringify('unknown skill: ' + skillName)} };
  const actions = values(skill.actions).length ? values(skill.actions) : values(skill.recipes);
  const action = actions.find(action => (action.name ?? action.product?.name ?? '').toLowerCase() === ${JSON.stringify(recipeName.toLowerCase())});
  const result = { name: game.characterName, skill: skill.name, recipe: ${JSON.stringify(recipeName)}, applied: false };
  if (!action) return { ...result, error: 'unknown recipe for this skill' };
  const costs = action.itemCosts ?? action.costs?.items ?? [];
  result.inputs = costs.map(cost => ({ item: cost.item?.name, required: cost.quantity ?? cost.qty ?? 0, available: game.bank.items.get(cost.item)?.quantity ?? 0 })).filter(cost => cost.item && cost.required > 0);
  if ((skill.level ?? 0) < (action.level ?? 1) || (skill.abyssalLevel ?? 0) < (action.abyssalLevel ?? 0)) return { ...result, error: 'recipe is not unlocked' };
  if (!result.inputs.length || result.inputs.some(cost => cost.available < cost.required)) return { ...result, error: 'insufficient recipe materials' };
  result.methods = methodNames(skill);
  if (!${JSON.stringify(shouldApply)}) return result;
  const select = method(skill, ['selectRecipeOnClick', 'selectRecipe']);
  const start = method(skill, ['createButtonOnClick', 'start', 'startAction']);
  if (!select || !start) return { ...result, error: 'unsupported Melvor artisan action API' };
  skill[select](action);
  skill[start]();
  await new Promise(resolve => setTimeout(resolve, 500));
  const selected = skill.selectedRecipe ?? skill.selectedAction ?? skill.activeRecipe ?? null;
  result.activeSkill = game.activeAction?.name ?? null;
  result.activeRecipe = selected?.name ?? selected?.product?.name ?? null;
  if (result.activeSkill !== skill.name || selected !== action) return { ...result, error: 'Melvor did not start the requested recipe' };
  result.applied = true;
  return result;
})()`;

const talentUnlockScript = (skillName, nodeName, shouldApply) => `(async () => {
  const values = value => value instanceof Map || value instanceof Set ? [...value.values()] : value?.allObjects ?? value ?? [];
  const skill = values(game.skills).find(skill => skill.name.toLowerCase() === ${JSON.stringify(skillName.toLowerCase())});
  if (!skill) return { error: ${JSON.stringify('unknown skill: ' + skillName)} };
  const tree = values(skill.skillTrees).find(tree => values(tree.nodes).some(node => node.name?.toLowerCase() === ${JSON.stringify(nodeName.toLowerCase())} || node.shortName?.toLowerCase() === ${JSON.stringify(nodeName.toLowerCase())}));
  const node = tree && values(tree.nodes).find(node => node.name?.toLowerCase() === ${JSON.stringify(nodeName.toLowerCase())} || node.shortName?.toLowerCase() === ${JSON.stringify(nodeName.toLowerCase())});
  const result = { name: game.characterName, skill: skill.name, node: ${JSON.stringify(nodeName)}, pointsBefore: tree?.points ?? null, applied: false };
  if (!node || !tree) return { ...result, error: 'unknown talent node for this skill' };
  if (!node.canUnlock || !tree.canAffordNode?.(node)) return { ...result, error: 'talent node is not affordable or unlockable' };
  result.methods = Object.getOwnPropertyNames(Object.getPrototypeOf(tree)).filter(name => /unlock/i.test(name));
  if (!${JSON.stringify(shouldApply)}) return result;
  const unlock = tree.unlockNodeOnClick ?? tree.unlockNode;
  if (typeof unlock !== 'function') return { ...result, error: 'unsupported Melvor talent API' };
  unlock.call(tree, node);
  await new Promise(resolve => setTimeout(resolve, 500));
  result.pointsAfter = tree.points ?? null;
  result.unlocked = values(tree.unlockedNodes).includes(node);
  if (!result.unlocked || result.pointsAfter >= result.pointsBefore) return { ...result, error: 'Melvor did not unlock the requested talent' };
  result.applied = true;
  return result;
})()`;

function printGuardedAction(result) {
  console.log(`${result.name || 'unknown'} | ${result.applied ? 'applied' : 'preview'}`);
  for (const key of ['kind', 'target', 'item', 'slot', 'current', 'cost', 'affordable', 'final', 'quantity', 'available', 'skill', 'recipe', 'activeSkill', 'activeRecipe', 'node', 'pointsBefore', 'pointsAfter', 'unlocked', 'hitChance']) if (result[key] !== undefined && result[key] !== null) console.log(`  ${key}: ${result[key]}`);
  for (const input of result.inputs || []) console.log(`  input: ${input.item} ${input.available}/${input.required}`);
  if (result.methods?.length) console.log(`  supported methods: ${result.methods.join(', ')}`);
  if (result.error) console.log(`  error: ${result.error}`);
}

function printMagicSetup(result) {
  console.log(`${result.name} | magic slot ${result.slot} | ${result.applied ? 'applied' : 'preview'}`);
  for (const [slot, item] of Object.entries(result.preset || {})) console.log(`  ${slot}: ${item}`);
  if (result.potion) console.log(`  Potion: ${result.potion}`);
  console.log(`  current slot items: ${(result.targetEquipment || []).join(', ') || 'empty'}`);
  if (result.finalTargetEquipment) console.log(`  final slot items: ${result.finalTargetEquipment.join(', ')}`);
  if (result.missing?.length) console.log(`  missing: ${result.missing.join('; ')}`);
  if (result.spell !== undefined) console.log(`  Spell: ${result.spell || 'unavailable'}`);
  for (const action of result.actions || []) console.log(`  ${action}`);
  if (result.error) console.log(`  error: ${result.error}`);
}

function printAbyssalSlayer(result) {
  console.log(`${result.name} | Abyssal Slayer task inspection`);
  console.log(`  active: ${result.active || 'none'} | remaining: ${result.remaining ?? 'n/a'}`);
  console.log(`  combat APIs: ${(result.combatMethods || []).join(', ') || 'none'}`);
  console.log(`  task APIs: ${(result.taskMethods || []).join(', ') || 'none'}`);
  console.log(`  slayer APIs: ${(result.slayerMethods || []).join(', ') || 'none'}`);
}

function printSlayerStart(result) {
  console.log(`${result.name} | Slayer started | ${result.task}`);
  console.log(`  set ${result.slot} | ${result.style} | ${result.area || 'no area'} / ${result.monster || 'no monster'}`);
  console.log(`  remaining ${result.remaining} | hit ${Math.round(result.hitChance || 0)}% | food ${result.food || 'none'}`);
}

function printSlots(r) {
  for (const mode of ['local', 'cloud']) {
    console.log(`${mode.toUpperCase()}`);
    if (!r[mode]?.length) console.log('  no slots found');
    for (const s of r[mode] || [])
      console.log(`  #${s.slot} ${s.name || s.state} | ${s.total || '-'} | ${s.gp || '-'} | ${s.lastSave || '-'} | ${s.status || '-'}`);
  }
}

async function readSlots() {
  return withPage(async client => {
    await waitFor(client, "/Select your Character|Sign In|DEMO VERSION/.test(document.body?.innerText || '')", 90000);
    return evalExpr(client, `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const click = async (re) => {
        const btn = [...document.querySelectorAll('button')].find(b => re.test(b.innerText));
        if (btn) { btn.click(); await sleep(5000); return true; }
        return false;
      };
      const scrape = (kind) => [...document.querySelectorAll('button')]
        .map(button => button.innerText)
        .filter(text => new RegExp(kind + ' Save').test(text) || /empty/i.test(text))
        .map((text, i) => {
          if (!new RegExp(kind + ' Save').test(text) && !/empty/i.test(text)) return null;
          const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);
          const at = lines.findIndex(line => line === kind + ' Save');
          return {
            slot: String(i + 1),
            state: /empty/i.test(text) ? 'empty' : kind,
            name: at >= 0 ? lines[at + 1] : null,
            total: (text.match(/([\\d,]+ Total Level)/) || [])[1] || null,
            gp: (text.match(/\\n\\s*([^\\n]+ GP)\\n/) || [])[1]?.trim() || null,
            lastSave: (text.match(/Last Save: ([^\\n]+)/) || [])[1] || null,
            status: (text.match(/(Most recent save|Old save)/) || [])[1] || null,
          };
        }).filter(Boolean);
      if (/Show Local Saves/i.test(document.body.innerText)) await click(/Show Local Saves/i);
      const local = scrape('Local');
      if (/Show Cloud Saves/i.test(document.body.innerText)) await click(/Show Cloud Saves/i);
      const cloud = scrape('Cloud');
      const text = document.body.innerText || '';
      return {
        local,
        cloud,
        signedIn: (typeof cloudManager !== 'undefined' && Boolean(cloudManager.isAuthenticated)) || (!/DEMO VERSION/.test(text) && /Select your Character/.test(text)),
      };
    })()`, 30000);
  });
}

async function smoke() {
  const slots = await readSlots();
  const count = (slots.local?.length || 0) + (slots.cloud?.length || 0);
  if (!slots.signedIn) throw Error('Melvor smoke failed: not signed in to Melvor Cloud');
  if (!count) throw Error('Melvor smoke failed: no local or cloud save buttons found');
  console.log(`smoke ok | account ${ACCOUNT} | port ${PORT} | slots ${count}`);
}

async function loginSmoke() {
  const username = ACCOUNT === 'test' ? process.env.MELVOR_TEST_EMAIL : process.env.MELVOR_MAIN_EMAIL;
  const password = ACCOUNT === 'test' ? process.env.MELVOR_TEST_PASSWORD : process.env.MELVOR_MAIN_PASSWORD;
  if (!username || !password) throw Error(`missing ${ACCOUNT} Melvor credentials`);
  const tab = await newTab(AUTH_URL);
  const client = await cdp(tab.webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitFor(client, "document.readyState === 'complete'", 90000);
    await sleep(2200);
    await waitFor(client, "document.querySelector('#formElements-signIn-username') || (!/DEMO VERSION/.test(document.body.innerText || '') && /Select your Character/.test(document.body.innerText || ''))", 60000);
    const alreadySignedIn = await evalExpr(client, "!/DEMO VERSION/.test(document.body.innerText || '') && /Select your Character/.test(document.body.innerText || '')");
    if (alreadySignedIn) return;
    try {
      await evalExpr(client, `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      if (typeof cloudManager !== 'undefined') { cloudManager.showSignInContainer(); await sleep(500); }
      const user = document.querySelector('#formElements-signIn-username');
      const pass = document.querySelector('#formElements-signIn-password');
      if (!user || !pass) throw Error('sign-in form not found');
      for (const [el, value] of [[user, ${JSON.stringify(username)}], [pass, ${JSON.stringify(password)}]]) {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      document.querySelector('#formElements-signIn-submit').click();
      return true;
    })()`, 10000);
    } catch (e) {
      if (!/navigated|closed/i.test(String(e.message || e))) throw e;
    }
    try {
      await waitFor(client, "!/DEMO VERSION/.test(document.body?.innerText || '') && /Select your Character/.test(document.body?.innerText || '')", 45000);
    } catch {
      throw Error('login did not reach character selection (wrong credentials, captcha, or slow load)');
    }
  } finally {
    client.close();
    await closeTab(tab.id);
  }
  await smoke();
}

function parseSaveTime(value) {
  return Date.parse(String(value || '').replace(' Europe/Paris', ''));
}

function printSlotDiffs(r) {
  const byName = xs => Object.fromEntries((xs || []).filter(s => s.name).map(s => [s.name, s]));
  const local = byName(r.local);
  const cloud = byName(r.cloud);
  for (const name of CHARS) {
    const l = local[name], c = cloud[name];
    if (!l || !c) {
      console.log(`${name}: missing ${!l ? 'local' : 'cloud'} slot`);
      continue;
    }
    const diffMs = parseSaveTime(l.lastSave) - parseSaveTime(c.lastSave);
    const mins = Math.round(Math.abs(diffMs) / 60000);
    if (!Number.isFinite(diffMs)) console.log(`${name}: cannot compare timestamps`);
    else if (Math.abs(diffMs) < 60000) console.log(`${name}: local and cloud roughly aligned`);
    else console.log(`${name}: ${diffMs > 0 ? 'local newer' : 'cloud newer'} by ${mins} min`);
  }
}

function sourceOfTruth(r) {
  const byName = xs => Object.fromEntries((xs || []).filter(s => s.name).map(s => [s.name, s]));
  const local = byName(r.local);
  const cloud = byName(r.cloud);
  return CHARS.map(name => {
    const l = local[name], c = cloud[name];
    const localTime = parseSaveTime(l?.lastSave);
    const cloudTime = parseSaveTime(c?.lastSave);
    const diffMs = localTime - cloudTime;
    let source = 'unknown';
    if (l && !c) source = 'local';
    else if (!l && c) source = 'cloud';
    else if (Number.isFinite(diffMs)) source = diffMs > 0 ? 'local' : 'cloud';
    return { name, source, local: l || null, cloud: c || null, diffMs: Number.isFinite(diffMs) ? diffMs : null };
  });
}

function printSourceOfTruth(r) {
  for (const s of sourceOfTruth(r)) {
    const delta = s.diffMs === null ? 'unknown delta' : Math.abs(s.diffMs) < 60000 ? '<1 min' : `${Math.round(Math.abs(s.diffMs) / 60000)} min`;
    const reason = s.diffMs === null
      ? `missing ${s.local ? 'cloud' : 'local'}`
      : s.diffMs === 0
        ? 'timestamps aligned, cloud default'
        : `${s.source} newer by ${delta}`;
    console.log(`${s.name}: ${s.source} (${reason})`);
  }
}

function improvementReport(slots) {
  const sources = sourceOfTruth(slots);
  const risks = [];
  const ideas = [];
  const recurring = incidentCandidates(readIncidents());

  for (const s of sources) {
    if (s.source === 'unknown') risks.push(`${s.name}: source of truth unknown`);
    if (s.source === 'local' && s.diffMs > 5 * 60000)
      risks.push(`${s.name}: local is newer than cloud by ${Math.round(s.diffMs / 60000)} min`);
  }

  if (sources.some(s => s.source === 'local'))
    ideas.push('Add an approved local-first write workflow before any apply-plan command.');
  if (sources.some(s => s.diffMs !== null && Math.abs(s.diffMs) > 60 * 60000))
    ideas.push('After writes, verify cloud catch-up with slots/source-of-truth before closing the session.');
  if (!risks.length)
    ideas.push('No state-risk automation needed right now; keep using plan/export-state before writes.');

  const lines = [
    '# Melvor AI improvement report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Risks observed',
    ...(risks.length ? risks : ['No immediate save-source risk detected.']).map(risk => `- ${risk}`),
    '',
    '## Improvement candidates',
    ...ideas.map(idea => `- ${idea}`),
    '',
    '## Recurring CLI incidents',
    ...(recurring.length ? recurring.flatMap(item => [
      `### ${item.signature} - ${item.message}`,
      `- Occurrences: ${item.count}`,
      `- Command: \`${item.command}\``,
      `- First seen: ${item.firstSeen}`,
      `- Last seen: ${item.lastSeen}`,
    ]) : ['No recurring CLI incident detected.']),
    '',
    '## Next command',
    '- Run `./melvor-report.js export-state all > /tmp/melvor-state.json` before deep recommendations.',
  ];
  return lines.join('\n');
}

function printImprovementReport(slots) {
  const report = improvementReport(slots);
  console.log(report);
  if (recordImprovement) {
    fs.appendFileSync(path.join(__dirname, 'AI_IMPROVEMENTS.md'), `\n\n${report}\n`);
    console.log('\nRecorded in AI_IMPROVEMENTS.md');
    for (const promotion of promoteIncidentCandidates(incidentCandidates(readIncidents())))
      console.log(`Promoted ${promotion.signature} to ${promotion.ref}`);
  }
}

const SAVE_DIR = path.join(JOURNAL_DIR, 'saves');
const SAVE_MANIFEST = path.join(SAVE_DIR, 'manifest.jsonl');
const JOURNAL_WANTED = ['Octopus', 'Potion Stirrer', 'Bear', 'Jeweled Necklace', 'Book of Scholars', 'Ancient Ring of Mastery', 'Golden Star', 'Eagle'];
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
// ponytail: id = char+slot+item, contextHash = activity+currently equipped item; refine if dedup proves too coarse
const actionId = (name, a) => sha(`${name}|${a.type}|${a.slot}|${a.item}`);
const actionContextHash = (report, a) => sha(`${report.action}|${report.equipment[a.slot] || 'empty'}`);
const safeFilePart = s => String(s).replace(/[^A-Za-z0-9_.-]/g, '_');
const rel = p => path.relative(JOURNAL_DIR, p).split(path.sep).join('/');

function readSaveBackups(file = SAVE_MANIFEST) {
  const latest = new Map();
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return latest; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.character) latest.set(e.character, e);
    } catch {}
  }
  return latest;
}

function recordSaveBackup(name, source, saveString, now = new Date().toISOString()) {
  if (typeof saveString !== 'string' || saveString.length < 1000) throw Error(`invalid save export for ${name}`);
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  const base = safeFilePart(name);
  const stamp = now.replace(/[:.]/g, '-');
  const archive = path.join(SAVE_DIR, `${base}.${stamp}.txt`);
  const latest = path.join(SAVE_DIR, `${base}.latest.txt`);
  fs.writeFileSync(archive, saveString);
  fs.writeFileSync(latest, saveString);
  const entry = {
    ts: now,
    character: name,
    source: source?.source || 'unknown',
    diffMinutes: source?.diffMs === null || source?.diffMs === undefined ? null : Math.round(source.diffMs / 60000),
    bytes: Buffer.byteLength(saveString, 'utf8'),
    hash: sha(saveString),
    path: rel(latest),
    archive: rel(archive),
  };
  fs.appendFileSync(SAVE_MANIFEST, JSON.stringify(entry) + '\n');
  const archives = fs.readdirSync(SAVE_DIR)
    .filter(f => f.startsWith(`${base}.`) && f.endsWith('.txt') && f !== `${base}.latest.txt`)
    .sort();
  for (const f of archives.slice(0, Math.max(0, archives.length - 5))) {
    try { fs.unlinkSync(path.join(SAVE_DIR, f)); } catch {}
  }
  return entry;
}

function buildCharacterJournal(name, data, save) {
  const report = data.report;
  const brief = briefFromData(name, data, save);
  const activeSlayerTask = report.action === 'Combat' && Boolean(report.combat?.slayerTask?.monster);
  const goalStep = (() => {
    const goal = readGoals()[name]?.goal || (report.mode === 'Hardcore Mode' ? 'safe' : 'progression');
    const lines = goal === 'progression' ? (activeSlayerTask ? [] : brief.standard.next) : buildGoals(data, {}, {})?.[goal] || [];
    const line = lines.find(l => /^(Switch|Clear|Kill|Craft|Fish|Cut|Mine|Grow|Steal|Harvest|Dig up|Buy|Farm|Unlock|Safe:|[A-Z][a-z]+: )/.test(l) && !/^(Task|Slayer coins|Pets missing):/.test(l));
    return line ? { goal, line } : null;
  })();
  const improvements = planActions(data, goalStep);
  const actions = improvements.map(a => ({ ...a, id: actionId(name, a), contextHash: actionContextHash(report, a) }));
  const upgradePlan = data.upgradePlan ? { ...data.upgradePlan, ...(data.upgradeSim ? { sim: data.upgradeSim } : {}) } : null;
  const saveRisk = !save || save.source === 'unknown' ? 'save source of truth unknown' : null;
  return {
    name,
    simulated: Boolean(data.upgradeSim && !data.upgradeSim.error),
    observed: {
      at: new Date().toISOString(),
      abyss: data.abyss ?? null,
      createdAt: data.createdAt ?? null,
      skillRates: data.skillRates || {},
      action: report.action,
      mode: report.mode,
      gp: report.gp,
      combatLevel: report.combatLevel,
      totalLevel: report.totalLevel,
      maxedSkills: report.maxedSkills,
      hp: report.hp,
      food: report.food,
      foodQty: report.foodQty,
      equipment: report.equipment,
      equipmentQuantities: report.equipmentQuantities || {},
      equipmentSets: data.equipmentSets || [],
      inventory: data.inventory || [],
      upgradePlan,
      skillingOptions: data.skillingOptions || {},
      skills: data.skills || [],
      lowSkills: report.lowSkills.slice(0, 6),
      combatGoals: report.combatGoals || null,
      combat: report.combat || null,
      currentAction: brief.currentAction,
      standard: brief.standard,
      abyssal: brief.abyssal,
      saveSource: save ? { source: save.source, diffMinutes: save.diffMs === null ? null : Math.round(save.diffMs / 60000) } : null,
    },
    analysis: {
      recommendations: activeSlayerTask ? brief.currentAction.next : brief.next,
      currentActionPlan: brief.currentAction.next,
      standardPlan: activeSlayerTask ? [] : brief.standard.next,
      abyssalPlan: activeSlayerTask ? [] : brief.abyssal.next,
      // kept out of Next/To do so the Slayer task is not interrupted; Plans shows it as "After the Slayer task"
      afterTaskPlan: activeSlayerTask ? [...brief.standard.next, ...brief.abyssal.next] : [],
      goals: buildGoals(data, { standardPlan: activeSlayerTask ? [] : brief.standard.next, afterTaskPlan: activeSlayerTask ? [...brief.standard.next, ...brief.abyssal.next] : [] }, { foodQty: report.foodQty }),
      riskNotes: [
        saveRisk,
        report.mode === 'Hardcore Mode' ? 'Hardcore character: verify survivability before any combat change' : null,
      ].filter(Boolean),
      saveRisk,
      stale: false,
    },
    actions,
  };
}

function journalHistoryCount(name) {
  try {
    return (fs.readFileSync(path.join(JOURNAL_DIR, `${name}.md`), 'utf8').match(/^## /gm) || []).length;
  } catch {
    return 0;
  }
}

function sectionLines(block, title) {
  const re = new RegExp(`(?:^|\\n)### ${title}\\n([\\s\\S]*?)(?=\\n### |$)`);
  const text = block.match(re)?.[1] || '';
  return text.split('\n').map(s => s.trim()).filter(s => s.startsWith('- ')).map(s => s.slice(2));
}

function recentJournalEntries(name, limit = 5) {
  let text = '';
  try { text = fs.readFileSync(path.join(JOURNAL_DIR, `${name}.md`), 'utf8'); } catch { return []; }
  return text.split(/^## /m)
    .filter(Boolean)
    .map(block => {
      const [heading] = block.split('\n', 1);
      const [at] = heading.split(/ \u2014 | · /); // older entries separate with an em dash
      return {
        at,
        state: sectionLines(block, 'State'),
        recommendations: sectionLines(block, 'Recommendations').filter(x => x !== 'none'),
        currentActionPlan: sectionLines(block, 'Current action plan').filter(x => x !== 'none'),
        progressEtas: sectionLines(block, 'Level ETA').filter(x => x !== 'none'),
        standardPlan: sectionLines(block, 'Optimization plan').filter(x => x !== 'none'),
        abyssalPlan: sectionLines(block, 'Abyssal plan').filter(x => x !== 'none'),
      };
    })
    .slice(-limit)
    .reverse();
}

function journalMd(c) {
  const history = journalHistoryCount(c.name);
  const o = c.observed;
  const list = xs => xs.length ? xs.map(x => `- ${x}`) : ['- none'];
  return [
    `## ${o.at} · ${c.name}`,
    '',
    '### State',
    `- Action: ${o.action || 'idle'} (${o.mode || 'unknown mode'})`,
    `- Total level ${o.totalLevel}, maxed ${o.maxedSkills}, combat ${o.combatLevel}`,
    `- GP ${fmtNum(o.gp)}, HP ${fmtNum(o.hp)}, food ${o.food || 'none'} x${fmtNum(o.foodQty || 0)}`,
    `- Save source: ${o.saveSource ? `${o.saveSource.source}${o.saveSource.diffMinutes === null ? '' : ` (delta ${o.saveSource.diffMinutes} min)`}` : 'unknown'}`,
    ...(c.analysis.saveRisk ? [`- Save risk: ${c.analysis.saveRisk}`] : []),
    '',
    '### Recommendations',
    ...list(c.analysis.recommendations),
    '',
    '### Current action plan',
    ...list(c.analysis.currentActionPlan || []),
    '',
    '### Level ETA',
    ...list(c.analysis.progressEtas || []),
    '',
    '### Optimization plan',
    ...list(c.analysis.standardPlan || []),
    '',
    '### Abyssal plan',
    ...list(c.analysis.abyssalPlan || []),
    '',
    '### Abyssal status',
    `- Maxed ${o.abyssal?.maxed || 'unknown'}`,
    ...list((o.abyssal?.lowest || []).slice(0, 5).map(s => `${s.name} ${s.abyssalLevel}/${s.abyssalCap}`)),
    '',
    '### Combat goals',
    ...list(combatGoalLines({ combatGoals: o.combatGoals, combat: o.combat })),
    '',
    '### Proposed actions',
    ...list(c.actions.map(a => `[${a.id}] equip ${a.item} in ${a.slot} (now: ${a.current}; risk ${a.risk}; ${a.reason})`)),
    '',
    '### History',
    `- ${history} prior ${history === 1 ? 'entry' : 'entries'} in journal/${c.name}.md`,
  ].join('\n');
}

const LEDGER = path.join(JOURNAL_DIR, 'actions.jsonl');
// Plans goal per character ({ goal, target }), chosen in the dashboard; private like the rest of journal/.
const GOALS_FILE = path.join(JOURNAL_DIR, 'goals.json');
const GOAL_IDS = ['progression', 'dungeons', 'completion', 'target', 'mastery', 'profit', 'afk', 'slayer', 'safe', 'capes', 'shop'];
const readGoals = () => { try { return JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8')); } catch { return {}; } };
const writeGoal = (name, patch) => { const all = readGoals(); all[name] = { ...(all[name] || {}), ...patch }; fs.mkdirSync(JOURNAL_DIR, { recursive: true }); fs.writeFileSync(GOALS_FILE, JSON.stringify(all, null, 2)); return all[name]; };

// One list of "headline; chip; chip" lines per goal, from mh.goalData and the optional simulations.
function buildGoals(data, analysis, observed) {
  const g = data.goals; if (!g) return null;
  const sim = data.goalSim && !data.goalSim.error ? data.goalSim : {};
  const simChip = r => !r ? null : r.failed ? 'sim failed' : 'sim deaths ' + ((r.deathRate || 0) * 100).toFixed(1) + '% · kill ' + (r.killTimeS || 0).toFixed(1) + ' s';
  const join = (...parts) => parts.filter(Boolean).join('; ');
  const pct = n => (n >= 1 ? n.toFixed(1) : n.toPrecision(2)) + '%';
  const areas = (g.dungeons || []).filter(d => d.name !== '???');
  const cleared = areas.filter(d => d.clears > 0), next = areas.filter(d => !d.clears && d.unlocked), locked = areas.filter(d => !d.clears && !d.unlocked);
  const dungeonLines = [
    ...next.slice(0, 3).map(d => join('Clear ' + d.name, d.kind + (d.bossName ? ', boss ' + d.bossName : ''), simChip(sim['area:' + d.id]))),
    ...locked.slice(0, 4).map(d => join('Unlock ' + d.name, 'needs ' + (d.missing.join(', ') || 'unknown requirement'))),
    join(cleared.length + ' of ' + areas.length + ' dungeons, depths and strongholds cleared', cleared.at(-1) ? 'last: ' + cleared.at(-1).name : null),
  ];
  const c = g.completion || {};
  const completionLines = [
    ...(c.unfoundCraftable || []).slice(0, 5).map(i => join(({ Fishing: 'Fish', Woodcutting: 'Cut', Mining: 'Mine', Farming: 'Grow', Thieving: 'Steal', Harvesting: 'Harvest', Archaeology: 'Dig up' }[i.skill] || 'Craft') + ' ' + i.name, i.skill, 'never found')),
    ...(c.unkilled || []).slice(0, 5).map(m => join('Kill ' + m.name, m.area, 'never killed', simChip(sim['mon:' + m.id]))),
    ...(c.nearMastery || []).slice(0, 4).map(m => join(m.skill + ': ' + m.action, 'mastery ' + m.level + '/' + m.cap)),
    c.petsMissingCount ? join('Pets missing: ' + c.petsMissingCount, ...(c.petsMissing || []).slice(0, 3).map(p => p.name + ' (' + (p.how || p.skill || '?') + ')')) : null,
  ].filter(Boolean);
  const t = g.target;
  const targetLines = !t ? ['Pick a target item above: the plan is built at the next refresh of this character.'] : t.error ? [join(t.name, t.error)] : [
    t.needsAbyss ? join(t.name + ' is Into the Abyss content', 'enter the Abyss first (clear Into the Abyss)') : null,
    t.owned || t.equipped ? join(t.name + ': already yours', t.owned ? 'in bank x' + t.owned : 'equipped') : null,
    t.equipMissing?.length ? join('To wear ' + t.name, 'needs ' + t.equipMissing.join(', ')) : null,
    ...(t.monsters || []).map(m => { const r = sim['mon:' + m.monsterId]; const hours = r && !r.failed && r.killsPerHour ? 100 / (m.chance * r.killsPerHour) : null; return join('Farm ' + m.monster, m.area, pct(m.chance) + ' per kill', m.unlocked === false ? 'area locked' : null, hours ? 'about ' + (hours < 1 ? Math.round(hours * 60) + ' min' : hours.toFixed(1) + ' h') + ' on average' : null, r && !r.failed ? 'deaths ' + ((r.deathRate || 0) * 100).toFixed(1) + '%' : null); }),
    t.craft ? join('Craft ' + t.name, t.craft.skill, t.craft.unlocked ? (t.craft.affordable ? 'materials in bank' : 'materials missing') : 'recipe locked') : null,
    t.shop ? join('Buy ' + t.shop.name, t.shop.missing.length ? 'needs ' + t.shop.missing.join(', ') : 'available') : null,
  ].filter(Boolean);
  const masteryLines = (g.pools || []).filter(p => p.xp > 0).length ? [] : ['Every unlocked mastery pool is past its last checkpoint (95%).'];
  masteryLines.push(...(g.pools || []).filter(p => p.xp > 0).slice(0, 6).map(p => join(p.skill + ' pool (' + p.realm.replace(' Realm', '') + ')', p.pct.toFixed(1) + '% → ' + p.next + '%', fmtRate(p.missing) + ' XP to go')));
  const combatSim = data.upgradeSim && !data.upgradeSim.error ? data.upgradeSim.baseline : null;
  const profitLines = [
    combatSim?.gpPerHour ? join('Current combat', fmtRate(combatSim.gpPerHour) + ' GP/h (sim)') : null,
    ...(g.profit || []).slice(0, 6).map(p => join(p.skill + ': ' + p.recipe, fmtRate(p.gpPerHour) + ' GP/h', p.runwayHours ? p.runwayHours.toFixed(1) + ' h of materials' : 'no materials needed')),
  ].filter(Boolean);
  const foodHours = combatSim?.atePerHour ? (observed.foodQty || 0) / combatSim.atePerHour : null;
  const afkLines = [
    combatSim && !combatSim.failed ? join('Stay on the current fight', 'deaths ' + ((combatSim.deathRate || 0) * 100).toFixed(1) + '%', foodHours ? 'food lasts ' + (foodHours > 48 ? Math.round(foodHours / 24) + ' d' : foodHours.toFixed(1) + ' h') : 'no food eaten') : null,
    ...(g.profit || []).filter(p => p.gathering || p.runwayHours >= 12).slice(0, 5).map(p => join(p.skill + ': ' + p.recipe, p.gathering ? 'runs unattended, no materials' : 'runs ' + p.runwayHours.toFixed(0) + ' h unattended')),
  ].filter(Boolean);
  const sl = g.slayer || {};
  const slayerLines = [
    sl.active ? join('Task: ' + sl.monster, sl.killsLeft + ' kills left') : 'No Slayer task: start one',
    join('Slayer coins: ' + fmtRate(sl.coins || 0) + ' SC', sl.abyssalCoins ? fmtRate(sl.abyssalCoins) + ' abyssal SC' : null),
    ...(sl.locked || []).slice(0, 5).map(a => join('Unlock ' + a.name, 'needs ' + (a.missing.join(', ') || 'Slayer ' + a.slayerLevel))),
  ];
  const simmed = [...next.slice(0, 2).map(d => ({ label: 'Clear ' + d.name, r: sim['area:' + d.id] })), ...(c.unkilled || []).slice(0, 3).map(m => ({ label: 'Kill ' + m.name, r: sim['mon:' + m.id] }))];
  const safeLines = [
    combatSim ? join((combatSim.deathRate ? 'Risky: ' : 'Safe: ') + 'current fight', 'deaths ' + ((combatSim.deathRate || 0) * 100).toFixed(1) + '%') : null,
    ...simmed.filter(x => x.r && !x.r.failed).map(x => join((x.r.deathRate ? 'Risky: ' : 'Safe: ') + x.label, 'deaths ' + ((x.r.deathRate || 0) * 100).toFixed(1) + '%')),
    ...(analysis.standardPlan || []).filter(l => !/^combat|dungeon/i.test(l)).slice(0, 3),
    simmed.some(x => x.r) ? null : 'Refresh this character alone (it simulates) to check deaths before any fight.',
  ].filter(Boolean);
  const capeLines = [
    ...(g.capes || []).slice(0, 8).map(cp => join(cp.missing.length ? cp.name : 'Buy ' + cp.name, cp.missing.length ? 'needs ' + cp.missing.join(', ') : 'requirements met')),
    ...(c.petsMissing || []).slice(0, 4).map(p => join('Pet ' + p.name, p.how || p.skill)),
  ];
  const shopLines = (g.shop || []).map(p => join('Buy ' + p.name, p.gp ? fmtRate(p.gp) + ' GP' : p.items.length ? p.items.join(', ') : 'price varies'));
  return { progression: null, dungeons: dungeonLines, completion: completionLines, target: targetLines, mastery: masteryLines, profit: profitLines, afk: afkLines, slayer: slayerLines, safe: safeLines, capes: capeLines, shop: shopLines, quick: g.quick || {}, targetName: t?.name ?? null };
}
const ACTION_STATUSES = ['proposed', 'approved', 'done', 'blocked', 'dismissed', 'stale'];

function readLedger(file = LEDGER) {
  const latest = new Map();
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return latest; }
  for (const [i, line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.id) latest.set(e.id, e);
    } catch {
      console.error(`warning: skipping malformed actions.jsonl line ${i + 1}`);
    }
  }
  return latest;
}

// Pure merge: current recommendations vs latest ledger state -> events to append.
// Dedup on unchanged contextHash; dismissed/done/blocked are respected until context changes;
// open actions no longer recommended go stale.
function mergeLedger(chars, latest, now) {
  const events = [];
  const push = (status, character, a, reason) => events.push({
    ts: now, id: a.id, character, status, type: a.type, slot: a.slot, item: a.item,
    risk: a.risk, reason: reason || a.reason, contextHash: a.contextHash,
  });
  for (const c of chars) {
    for (const a of c.actions) {
      const prev = latest.get(a.id);
      if (!prev || prev.contextHash !== a.contextHash) push('proposed', c.name, a);
    }
    for (const prev of latest.values()) {
      if (prev.character !== c.name || !['proposed', 'approved'].includes(prev.status)) continue;
      if (c.actions.some(a => a.id === prev.id)) continue;
      const applied = prev.type === 'equip' && c.observed.equipment[prev.slot] === prev.item;
      if (prev.type === 'equip' && !applied && c.simulated === false) continue; // not judged without a simulation
      push(applied ? 'done' : 'stale', c.name, prev,
        applied ? 'observed equipment now matches this action' : prev.type === 'goal' ? 'the goal plan moved on (done, or another goal was picked)' : 'observed state no longer produces this recommendation');
    }
  }
  const merged = new Map(latest);
  for (const e of events) merged.set(e.id, e);
  return { events, latest: merged };
}

function progressEtas(current, previous) {
  if (!(current.observed.skills || []).length) return ['ETA pending: run a fresh journal scan to record skill XP'];
  if (!(previous?.observed?.skills || []).length) return ['ETA pending: previous journal snapshot has no skill XP; scan again after XP gain'];
  const prevAt = Date.parse(previous?.observed?.at);
  const curAt = Date.parse(current.observed.at);
  const elapsed = curAt - prevAt;
  if (!Number.isFinite(elapsed) || elapsed < 5 * 60000) return ['ETA pending: needs at least 5 minutes between comparable journal scans'];
  if (sameCloudSnapshot(current, previous)) return ['ETA pending: no progress since the last scan (the cloud save only moves when you play)'];
  if (current.observed.action === 'Combat' && current.observed.equipment?.Weapon !== previous?.observed?.equipment?.Weapon)
    return ['ETA pending: combat weapon changed; rescan after 5 minutes of the same build'];
  const prevSkills = Object.fromEntries((previous?.observed?.skills || []).map(s => [s.name, s]));
  const action = current.observed.action;
  const etas = (current.observed.skills || [])
    .filter(s => !action || s.name === action || (action === 'Combat' && ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Slayer'].includes(s.name)))
    .map(s => {
      const prev = prevSkills[s.name];
      const dxp = s.xp - (prev?.xp ?? s.xp);
      const daxp = (s.abyssalXP ?? 0) - (prev?.abyssalXP ?? s.abyssalXP ?? 0);
      if (dxp <= 0 && daxp <= 0) return null;
      const parts = [];
      if (dxp > 0) {
        const xpPerMs = dxp / elapsed;
        const nextLevel = Math.min((s.levelCap ?? 120), s.level + 1);
        const nextTen = Math.min((s.levelCap ?? 120), Math.ceil((s.level + 1) / 10) * 10);
        const cap = s.levelCap ?? 120;
        parts.push(`${s.name}: ${fmtNum(dxp)} XP gained (${fmtRate(dxp * 3600000 / elapsed)}/h)`);
        // one chip per distinct target: next level, next ten, cap can coincide
        if (nextLevel > s.level && nextLevel < nextTen) parts.push(`next level ETA ${fmtDuration((xpForLevel(nextLevel) - s.xp) / xpPerMs)}`);
        if (nextTen > s.level && nextTen < cap) parts.push(`level ${nextTen} ETA ${fmtDuration((xpForLevel(nextTen) - s.xp) / xpPerMs)}`);
        if (cap > s.level) parts.push(`level ${cap} (cap) ETA ${fmtDuration((xpForLevel(cap) - s.xp) / xpPerMs)}`);
      }
      if (daxp > 0) {
        const axpPerMs = daxp / elapsed;
        parts.push(`${s.name}: ${fmtNum(daxp)} abyssal XP gained (${fmtRate(daxp * 3600000 / elapsed)}/h)`);
        parts.push(`abyssal level ${s.abyssalLevel ?? '?'}/${s.abyssalCap ?? '?'}`);
        const aTen = Math.min(s.abyssalCap ?? 60, Math.ceil(((s.abyssalLevel ?? 0) + 1) / 10) * 10);
        if (s.abyssalXPNextLevel && s.abyssalXPNextLevel < (s.abyssalXPNextTen || Infinity)) parts.push(`abyssal next level ETA ${fmtDuration((s.abyssalXPNextLevel - s.abyssalXP) / axpPerMs)}`);
        if (s.abyssalXPNextTen && s.abyssalXPNextTen < (s.abyssalXPCap || Infinity)) parts.push(`abyssal level ${aTen} ETA ${fmtDuration((s.abyssalXPNextTen - s.abyssalXP) / axpPerMs)}`);
        if (s.abyssalXPCap) parts.push(`abyssal level ${s.abyssalCap} (cap) ETA ${fmtDuration((s.abyssalXPCap - s.abyssalXP) / axpPerMs)}`);
        if (!s.abyssalXPNextLevel && !s.abyssalXPNextTen && !s.abyssalXPCap)
          parts.push('abyssal ETA unavailable until abyssal XP thresholds are mapped');
      }
      return parts.filter(part => part && !/ETA null$/.test(part)).join('; ');
    })
    .filter(Boolean)
    .slice(0, 5);
  return etas.length ? etas : ['ETA pending: no XP gain detected for the current action since the previous scan'];
}

const sameCloudSnapshot = (current, previous) =>
  current.observed.saveSource?.source === 'cloud' &&
  previous?.observed?.saveSource?.source === 'cloud' &&
  current.observed.saveSource.diffMinutes === previous.observed.saveSource.diffMinutes;

function levelEtaStatus(lines) {
  return { status: lines.some(l => !/^ETA pending:/.test(l)) ? 'ready' : 'pending', lines };
}

function compactObserved(o) {
  if (!o) return null;
  return {
    at: o.at,
    action: o.action || 'idle',
    saveSource: o.saveSource || null,
    equipmentQuantities: o.equipmentQuantities || {},
    skills: (o.skills || []).map(s => ({
      name: s.name, level: s.level, xp: s.xp, levelCap: s.levelCap,
      abyssalLevel: s.abyssalLevel, abyssalXP: s.abyssalXP, abyssalCap: s.abyssalCap,
      abyssalXPNextLevel: s.abyssalXPNextLevel,
      abyssalXPNextTen: s.abyssalXPNextTen,
      abyssalXPCap: s.abyssalXPCap,
    })),
  };
}

const actionSkillNames = action =>
  action === 'Combat' ? ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Slayer'] : [action].filter(Boolean);

function progressAlerts(entry) {
  const lines = entry.analysis.progressEtas || [];
  const action = entry.observed.action;
  if (!action) return [];
  const watched = new Set(actionSkillNames(action));
  const skills = (entry.observed.skills || []).filter(s => watched.has(s.name));
  const prevSkills = Object.fromEntries((entry.previousObserved?.skills || []).map(s => [s.name, s]));
  const negativeXP = !sameCloudSnapshot(entry, { observed: entry.previousObserved }) && skills.some(s => {
    const p = prevSkills[s.name];
    return p && ((s.xp || 0) < (p.xp || 0) || (s.abyssalXP || 0) < (p.abyssalXP || 0));
  });
  const noProgress = lines.some(l => /no XP gain detected/.test(l));
  return [
    negativeXP ? 'current XP is lower than previous scan; verify source-of-truth before acting' : null,
    noProgress ? 'action active but no positive standard or abyssal XP was detected since the previous scan' : null,
  ].filter(Boolean);
}

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function structuredInsights(entry) {
  const seen = new Set();
  const insights = [];
  const add = (label, source) => {
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const duration = label.match(/\b(?:ETA(?: about)?|about)\s+([\d.]+)\s*(min|h|d)\b/i);
    const amount = label.match(/\(([\d,]+)\s+(kills?|attacks?|charges?)\s+(?:left|if|at)\b/i);
    const etaSeconds = duration ? Math.round(Number(duration[1]) * ({ min: 60, h: 3600, d: 86400 }[duration[2].toLowerCase()])) : null;
    const isAlert = source === 'alert';
    const isPending = /^ETA pending/i.test(label);
    const isIdle = /\bidle\b|action stopped/i.test(label);
    const isSave = !isPending && /save|source-of-truth/i.test(label);
    const isRunway = /^(ammo|consumable|familiar|food):|quiver|summon|runway/i.test(label);
    const isTask = /slayer task|finish |ETA/i.test(label) && !isRunway;
    const actionable = !isPending && (isSave || /^Equip .+ in \w+; sim /i.test(label) || /; (\d+ actions; [\d.]+ h runway|no materials needed);/i.test(label) || /\bfinish\b/i.test(label));
    const priority = isPending ? 'low' : isIdle || (isAlert && isSave) ? 'critical'
      : (isAlert || actionable || (etaSeconds !== null && etaSeconds <= 3600)) ? 'high'
        : isRunway || isTask ? 'medium' : 'low';
    insights.push({
      id: sha(`${source}|${key}`),
      type: isPending ? 'status' : isIdle ? 'idle' : isSave ? 'source_of_truth' : isRunway ? 'resource_runway' : isTask ? 'progress_eta' : actionable ? 'next_decision' : 'progress',
      priority,
      severity: isIdle || (isAlert && isSave) ? 'danger' : isAlert ? 'warning' : 'info',
      label,
      source,
      actionable,
      ...(etaSeconds === null ? {} : { etaSeconds }),
      ...(amount ? { metric: Number(amount[1].replace(/,/g, '')), unit: amount[2].toLowerCase() } : {}),
    });
  };
  for (const label of entry.analysis.alerts || []) add(label, 'alert');
  if (!entry.observed.action) add('Current action is idle; choose or restart a task after checking resources', 'current_action');
  for (const label of entry.analysis.currentActionPlan || []) add(label, 'current_action');
  for (const label of entry.analysis.recommendations || []) add(label, 'recommendation');
  for (const label of entry.analysis.progressEtas || []) add(label, 'progress_eta');
  for (const label of entry.analysis.standardPlan || []) add(label, 'standard_plan');
  for (const label of entry.analysis.abyssalPlan || []) add(label, 'abyssal_plan');
  // stable sort: within a priority, plan order (lowest skill first) is kept
  return insights.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

// dungeon-check / dungeon-optimize results (journal/dungeons/), by character then dungeon name, for Plans > Dungeon path
function readDungeonChecks() {
  const dir = path.join(JOURNAL_DIR, 'dungeons'), out = {};
  let files = []; try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('-plan.json')); } catch { return out; }
  for (const f of files) {
    try {
      const check = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const planFile = path.join(dir, f.replace(/\.json$/, '-plan.json'));
      const plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : null;
      const v = dungeonVerdict(check);
      (out[check.character] ||= {})[check.dungeon] = {
        at: check.at, checks: check.checks, threshold: v.threshold, ready: v.ready,
        fights: v.fights.map(f => ({ label: f.label, ready: f.ready, best: f.best && { set: f.best.set, role: f.best.role, death: f.best.deathRate, kill: f.best.killTimeS } })),
        plan: plan && { at: plan.at, results: [...plan.results].sort((a, b) => a.setIndex - b.setIndex).map(r => ({ style: r.style, label: r.label, setIndex: r.setIndex, start: r.start, best: r.best, potion: r.potion, prayers: r.prayers,
          // final choice per slot, from the original item (the greedy search may improve a slot twice)
          changes: Object.values(r.changes.reduce((m, c) => ({ ...m, [c.slot]: { ...c, from: m[c.slot]?.from ?? c.from } }), {})).filter(c => c.slot !== 'Prayers') })) },
      };
    } catch {}
  }
  return out;
}

function buildLatest(chars, latest, previous, now) {
  const characters = { ...(previous?.characters || {}) };
  const scannedNames = new Set(chars.map(c => c.name));
  const backups = readSaveBackups();
  for (const c of chars) characters[c.name] = { observed: c.observed, analysis: c.analysis };
  // decisions always derive from the ledger, for scanned and carried-over characters alike
  for (const [name, entry] of Object.entries(characters)) {
    const previousEntry = previous?.characters?.[name] || null;
    const prevAction = previous?.characters?.[name]?.observed?.action || null;
    if (!entry.observed.action && prevAction) {
      const note = `current action stopped after ${prevAction}; check resources/recipe inputs before restarting`;
      entry.analysis.currentActionPlan ??= [];
      entry.analysis.recommendations ??= [];
      if (!entry.analysis.currentActionPlan.includes(note)) entry.analysis.currentActionPlan.unshift(note);
        if (!entry.analysis.recommendations.includes(note)) entry.analysis.recommendations.unshift(note);
    }
    if (scannedNames.has(name)) entry.analysis.progressEtas = progressEtas(entry, previousEntry);
    else entry.analysis.progressEtas ??= previousEntry?.analysis?.progressEtas || [];
    entry.previousObserved = scannedNames.has(name) ? compactObserved(previousEntry?.observed) : previousEntry?.previousObserved || null;
    entry.analysis.alerts = progressAlerts(entry);
    entry.analysis.insights = structuredInsights(entry);
    if (backups.has(name)) entry.observed.saveBackup = backups.get(name);
    const decisions = Object.fromEntries(ACTION_STATUSES.map(s => [s, []]));
    for (const e of latest.values()) {
      if (e.character !== name) continue;
      decisions[e.status]?.push({ id: e.id, type: e.type, slot: e.slot, item: e.item, risk: e.risk, reason: e.reason, ts: e.ts });
    }
    characters[name] = { ...entry, decisions, history: recentJournalEntries(name, 6) };
  }
  const actionsSummary = Object.fromEntries(ACTION_STATUSES.map(s => [s, 0]));
  for (const e of latest.values()) if (e.status in actionsSummary) actionsSummary[e.status]++;
  const allInsights = Object.values(characters).flatMap(c => c.analysis.insights || []);
  const staleMs = 24 * 3600 * 1000;
  return {
    generatedAt: now,
    goals: readGoals(),
    dungeonChecks: readDungeonChecks(),
    account: {
      roster: CHARS, // save order, for the natural sort
      name: ACCOUNT,
      scannedNow: chars.length ? chars.map(c => c.name) : previous?.account?.scannedNow || [],
      // ponytail: riskNotes regex fallback covers pre-saveRisk snapshots; drop after the next full scan everywhere
      saveRisks: Object.entries(characters)
        .filter(([, v]) => v.analysis.saveRisk ?? v.analysis.riskNotes.some(n => /save/.test(n)))
        .map(([k]) => k),
      staleCharacters: Object.entries(characters).filter(([, v]) => Date.parse(now) - Date.parse(v.observed.at) > staleMs).map(([k]) => k),
      operations: {
        alerts: allInsights.filter(i => i.source === 'alert').length,
        idleCharacters: Object.entries(characters).filter(([, c]) => !c.observed.action).map(([name]) => name),
        nearTermCompletions: Object.entries(characters).filter(([, c]) => (c.analysis.insights || []).some(i => i.type === 'progress_eta' && i.etaSeconds <= 3600)).map(([name]) => name),
        staleDecisions: actionsSummary.stale,
        openDecisions: actionsSummary.proposed + actionsSummary.approved + actionsSummary.blocked,
      },
    },
    characters,
    actionsSummary,
  };
}

function readLatestSnapshot() {
  try { return JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR, 'latest.json'), 'utf8')); } catch { return null; }
}

function journalRefreshSummary(snap, previous, expectedAt) {
  if (!snap || snap.generatedAt !== expectedAt || (previous && Date.parse(snap.generatedAt) <= Date.parse(previous.generatedAt)))
    throw Error('journal/latest.json was not refreshed');
  const oldAlerts = new Set(Object.entries(previous?.characters || {}).flatMap(([name, c]) =>
    (c.analysis?.alerts || []).map(alert => `${name}: ${alert}`)));
  const newAlerts = Object.entries(snap.characters || {}).flatMap(([name, c]) =>
    (c.analysis?.alerts || []).map(alert => `${name}: ${alert}`).filter(alert => !oldAlerts.has(alert)));
  const lines = [`Journal refreshed ${new Date(snap.generatedAt).toLocaleString()} | characters ${snap.account.scannedNow.length} | save risks ${snap.account.saveRisks.length} | new alerts ${newAlerts.length}`];
  lines.push(...newAlerts.slice(0, 5).map(alert => `  alert: ${alert}`));
  if (newAlerts.length > 5) lines.push(`  alert: +${newAlerts.length - 5} more`);
  return lines;
}

function selectedEntries(snap) {
  return names
    .map(name => [name, snap.characters?.[name]])
    .filter(([, c]) => c);
}

function runJournalStatus() {
  const snap = readLatestSnapshot();
  if (!snap) throw Error('journal/latest.json not found; run journal --record first');
  console.log(`Journal ${new Date(snap.generatedAt).toLocaleString()} | save risks ${snap.account.saveRisks.length} | stale ${snap.account.staleCharacters.length}`);
  for (const [name, c] of selectedEntries(snap)) {
    const flags = [
      snap.account.saveRisks.includes(name) ? 'SAVE RISK' : null,
      snap.account.staleCharacters.includes(name) ? 'STALE' : null,
      c.observed.saveBackup ? `backup ${c.observed.saveBackup.hash}` : 'no backup',
    ].filter(Boolean).join(', ');
    console.log(`\n${name}: ${c.observed.action || 'idle'} | ${c.observed.mode || ''} | ${flags || 'ok'}`);
    for (const line of (c.analysis.alerts || []).slice(0, 3)) console.log(`  alert: ${line}`);
    for (const line of (c.analysis.progressEtas || []).slice(0, 3)) console.log(`  eta: ${line}`);
    for (const line of (c.analysis.currentActionPlan || c.analysis.recommendations || []).slice(0, 3)) console.log(`  now: ${line}`);
    for (const line of (c.analysis.abyssalPlan || []).slice(0, 2)) console.log(`  abyssal: ${line}`);
  }
}

function runJournalDiff() {
  const snap = readLatestSnapshot();
  if (!snap) throw Error('journal/latest.json not found; run journal --record first');
  for (const [name, c] of selectedEntries(snap)) {
    const prev = c.previousObserved;
    console.log(`\n${name}: ${prev?.at || 'no previous observed'} -> ${c.observed.at}`);
    if (!prev) continue;
    if ((prev.action || 'idle') !== (c.observed.action || 'idle'))
      console.log(`  action: ${prev.action || 'idle'} -> ${c.observed.action || 'idle'}`);
    const prevSkills = Object.fromEntries((prev.skills || []).map(s => [s.name, s]));
    const watched = new Set(actionSkillNames(c.observed.action));
    for (const s of (c.observed.skills || []).filter(s => watched.has(s.name))) {
      const p = prevSkills[s.name];
      if (!p) continue;
      const dxp = (s.xp || 0) - (p.xp || 0);
      const daxp = (s.abyssalXP || 0) - (p.abyssalXP || 0);
      if (dxp || daxp) {
        const part = (n, label) => n ? `${n > 0 ? '+' : '-'}${fmtNum(Math.abs(n))} ${label}` : '';
        console.log(`  ${s.name}: ${[part(dxp, 'XP'), part(daxp, 'abyssal XP')].filter(Boolean).join(' ')}`);
      }
    }
    const prevQty = prev.equipmentQuantities || {};
    const curQty = c.observed.equipmentQuantities || {};
    for (const slot of Object.keys({ ...prevQty, ...curQty }).sort()) {
      const delta = (curQty[slot] ?? 0) - (prevQty[slot] ?? 0);
      if (delta) console.log(`  ${slot}: ${delta > 0 ? '+' : ''}${fmtNum(delta)} quantity`);
    }
    for (const line of (c.analysis.alerts || [])) console.log(`  alert: ${line}`);
  }
}

// Offline dashboard: data embedded as JSON (script tag, `<` escaped), rendered with
// textContent-only DOM building so no journal value is ever parsed as HTML.
// Dashboard client code lives in dashboard/ as plain files and is inlined at render time (one self-contained page).
const DASHBOARD_CSS = fs.readFileSync(path.join(__dirname, 'dashboard', 'app.css'), 'utf8');
const DASHBOARD_JS = fs.readFileSync(path.join(__dirname, 'dashboard', 'app.js'), 'utf8');
function renderDashboard(snap) {
  const json = JSON.stringify(snap).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="/assets/mpt-mark.svg">
<title>MelvorPT</title>
<style>
${DASHBOARD_CSS}
</style>
<body>
<header class="topbar"><div class="brand"><img src="/assets/mpt-mark.svg" alt=""><h1>MelvorPT</h1></div>
<div class="top-actions"><span id="scanTime" class="muted"></span>
<div class="split" aria-label="Refresh journal"><button id="refreshCharacter" type="button" class="split-pick" aria-haspopup="menu" aria-label="Character to refresh"><span>All</span><svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button><button id="refreshButton" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg><span>Refresh</span></button></div>
<button id="todoButton" class="todo-pill" type="button" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><b id="todoCount">0</b><span class="tab-label">To do</span></button>
<button id="setupButton" class="icon-button" type="button" title="Account setup" aria-label="Account setup"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button></div></header>
<p id="refreshStatus" class="muted"></p>
<dialog id="setup"><h2>Account setup</h2><ol><li>Sign in through the official Melvor page in the shared browser profile.</li><li>Set your character roster in <code>.env.local</code>.</li><li>Use Refresh to build the first local journal.</li></ol><p><a href="https://melvoridle.com/" target="_blank" rel="noopener">Open Melvor sign-in</a> · MPT never stores your credentials.</p><form method="dialog"><button>Close</button></form></dialog>
<p id="pageError" hidden></p>
<dialog id="todo"><h2>To do</h2><div id="todoList" class="stack"></div><form method="dialog"><button>Close</button></form></dialog>
<div id="summary" class="kpis"></div>
<div class="toolbar">
  <input id="q" type="search" placeholder="Search character, activity or item" aria-label="Search">
  <div class="seg" id="quick" role="group" aria-label="Quick filter"><button type="button" data-quick="all" aria-pressed="true">All</button><button type="button" data-quick="attention" aria-pressed="false">Needs attention</button><button type="button" data-quick="combat" aria-pressed="false">Combat</button><button type="button" data-quick="skilling" aria-pressed="false">Skilling</button></div>
  <select id="sort" aria-label="Sort characters"><option value="score">Sort: total level</option><option value="roster">Sort: save order</option><option value="age">Sort: oldest first</option><option value="completion">Sort: completion</option><option value="name">Sort: name</option></select>
  <details id="filterBox"><summary>Filters</summary><div id="filters">
  <select id="fAction"><option value="">all activities</option></select>
  <select id="fRisk"><option value="">all saves</option><option value="risk">save risk</option><option value="ok">save safe</option></select>
  <select id="fStatus"><option value="">all statuses</option></select>
  <select id="fPriority"><option value="">all priorities</option><option value="critical">critical</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select>
  <label class="check"><input id="fAttention" type="checkbox"> needs attention</label>
</div></details>
</div>
<div class="column-head" aria-hidden="true"><span>Character</span><span>Current</span><span>Next</span><span>Completion</span></div>
<div id="cards"></div>
<script id="data" type="application/json">${json}</script>
<script>
${DASHBOARD_JS}
</script>
</body>
</html>
`;
}

// Every dungeon has a page and a community Guide subpage on the official wiki: fetch both through the MediaWiki API
// (the HTML pages refuse scripted readers), keep a cleaned copy in journal/guides/ and print it.
async function runDungeonGuide(name) {
  if (!name || name === 'all') throw Error('usage: ./melvor-report.js dungeon-guide "<dungeon name>"');
  const title = name.trim().replace(/ /g, '_');
  const fetchPage = async page => {
    const url = 'https://wiki.melvoridle.com/api.php?' + new URLSearchParams({ action: 'parse', page, prop: 'wikitext', format: 'json', redirects: '1' });
    const response = await fetch(url, { headers: { 'user-agent': 'MelvorPT/1.0 (personal Melvor Idle tooling)' } });
    const data = await response.json();
    return data.parse?.wikitext?.['*'] || null;
  };
  const clean = text => text
    .replace(/\{\|[\s\S]*?\|\}/g, '[table: see the wiki page]')
    .replace(/\{\{(?:ItemIcon|MonsterIcon|ZoneIcon|SkillReq|Skill|PetIcon|UpgradeIcon|Icon|SpellIcon|PrayerIcon|AgilityIcon|POIIcon|EffectIcon|ZoneTypeIcon)\|([^}|]+)[^}]*\}\}/g, '$1')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/<\/?div[^>]*>|<br ?\/?>/g, '')
    .replace(/\n{3,}/g, '\n\n');
  const [main, guide] = await Promise.all([fetchPage(title), fetchPage(title + '/Guide')]);
  if (!main && !guide) throw Error(`no wiki page found for "${name}"`);
  const body = [`# ${name}`, '', `Source: https://wiki.melvoridle.com/w/${title} and /Guide (CC BY-NC-SA; community content).`, '',
    main ? clean(main) : '(no main page)', '', '---', '', guide ? clean(guide) : '(no Guide page)'].join('\n');
  const dir = path.join(JOURNAL_DIR, 'guides'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, title.replace(/[^A-Za-z0-9_-]/g, '_') + '.md');
  fs.writeFileSync(file, body);
  console.log(body);
  console.error(`saved ${path.relative(__dirname, file)}`);
}

// Verdict per fight: the best set's simulated death rate against the threshold (0% Hardcore, 1% otherwise).
function dungeonVerdict(r, threshold = r.hardcore ? 0 : Number(process.env.MELVOR_DEATH_THRESHOLD ?? 0.01)) {
  const best = {};
  for (const s of r.sims) if (s.ok && (best[s.fight] === undefined || s.deathRate < best[s.fight].deathRate)) best[s.fight] = s;
  const fights = r.fights.map(f => ({ ...f, best: best[f.key] || null, ready: best[f.key] ? best[f.key].deathRate <= threshold : false }));
  const blockers = r.checks.filter(c => !c.ok).map(c => c.label);
  return { threshold, fights, blockers, ready: r.simulated && !blockers.length && fights.every(f => f.ready) };
}

function printDungeonCheck(name, r) {
  const v = dungeonVerdict(r);
  console.log(`${name} | ${r.dungeon} | clears ${r.clears ?? '?'} | ${v.ready ? 'READY' : 'NOT READY'} (death threshold ${(v.threshold * 100).toFixed(0)}%)`);
  for (const c of r.checks) console.log(`  ${c.ok ? 'ok ' : 'NO '} ${c.label}${c.detail ? ' (' + c.detail + ')' : ''}`);
  if (!r.simulated) console.log(`  simulator not available: fights not checked${r.simMissing ? ' (' + r.simMissing + ')' : ''}`);
  if (r.cape) console.log(`  simulated with ${r.cape} in the cape slot (required in every area)`);
  for (const f of v.fights) {
    const b = f.best;
    console.log(`  ${f.ready ? 'ok ' : 'NO '} ${f.label}: ${b ? `best S${b.set} ${b.role} (${b.weapon?.split(':').pop() || '?'}) deaths ${(b.deathRate * 100).toFixed(1)}%${b.killTimeS ? `, kill ${b.killTimeS.toFixed(1)} s` : ''}` : 'no successful simulation'}`);
  }
}

function runJournalServer() {
  let refreshing = false;
  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };
  const server = http.createServer((req, res) => {
    const url = new globalThis.URL(req.url, 'http://localhost');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const snapshot = readLatestSnapshot();
      return snapshot
        ? send(res, 200, renderDashboard({ ...snapshot, goals: readGoals() }), 'text/html; charset=utf-8')
        : send(res, 404, JSON.stringify({ error: 'journal missing; run journal --record first' }));
    }
    if (req.method === 'GET' && url.pathname === '/assets/mpt-mark.svg') {
      try { return send(res, 200, fs.readFileSync(path.join(__dirname, url.pathname)), 'image/svg+xml'); } catch { return send(res, 404, JSON.stringify({ error: 'not found' })); }
    }
    if (req.method === 'GET' && /^\/[A-Za-z0-9_-]+\.md$/.test(url.pathname)) {
      const name = path.basename(url.pathname, '.md');
      if (!CHARS.includes(name)) return send(res, 404, JSON.stringify({ error: 'not found' }));
      try { return send(res, 200, fs.readFileSync(path.join(JOURNAL_DIR, `${name}.md`)), 'text/markdown; charset=utf-8'); } catch { return send(res, 404, JSON.stringify({ error: 'not found' })); }
    }
    if (req.method === 'POST' && url.pathname === '/action') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
      req.on('end', () => {
        try { const { id, status } = JSON.parse(body); const { event } = setActionStatus(String(id), String(status)); return send(res, 200, JSON.stringify({ ok: true, status: event.status })); }
        catch (error) { return send(res, 400, JSON.stringify({ error: sanitizeIncident(error.message) })); }
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/goal') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
      req.on('end', () => {
        let input; try { input = JSON.parse(body); } catch { return send(res, 400, JSON.stringify({ error: 'invalid request' })); }
        if (!CHARS.includes(input.character)) return send(res, 400, JSON.stringify({ error: 'unknown character' }));
        const patch = {};
        if (input.goal !== undefined) { if (!GOAL_IDS.includes(input.goal)) return send(res, 400, JSON.stringify({ error: 'unknown goal' })); patch.goal = input.goal; }
        if (input.target !== undefined) patch.target = String(input.target).slice(0, 80) || null;
        return send(res, 200, JSON.stringify(writeGoal(input.character, patch)));
      });
      return;
    }
    if (req.method !== 'POST' || url.pathname !== '/refresh') return send(res, 404, JSON.stringify({ error: 'not found' }));
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      let character;
      try { character = JSON.parse(body).character; } catch { return send(res, 400, JSON.stringify({ error: 'invalid request' })); }
      if (character !== 'all' && !CHARS.includes(character)) return send(res, 400, JSON.stringify({ error: 'unknown character' }));
      if (refreshing) return send(res, 409, JSON.stringify({ error: 'a journal refresh is already running' }));
      refreshing = true;
      const child = spawn(process.execPath, [__filename, 'journal', character, '--record', ...(character === 'all' ? [] : ['--sim'])], { cwd: __dirname, env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = ''; child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
      child.on('error', error => { refreshing = false; send(res, 500, JSON.stringify({ error: sanitizeIncident(error.message) })); });
      child.on('exit', code => {
        refreshing = false;
        // say why: the usual cause is another scan (CLI or assistant) holding the browser
        const last = stderr.trim().split('\n').pop() || '';
        const reason = /already using port/.test(last) ? 'another scan is running (CLI or assistant); try again in a minute' : sanitizeIncident(last) || `exit ${code}`;
        send(res, code === 0 ? 200 : 500, JSON.stringify(code === 0 ? { ok: true } : { error: 'Refresh failed: ' + reason }));
      });
    });
  });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') console.error(`Journal dashboard port ${dashboardPort} is already in use. Try: ./melvor-report.js journal-serve --port ${dashboardPort + 1}`);
    else console.error(`Journal dashboard failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(dashboardPort, '127.0.0.1', () => console.log(`Journal dashboard: http://127.0.0.1:${dashboardPort}`));
}

async function collectJournal(name, save, includeSaveBackup = false) {
  return withCharacterSource(name, save?.source, async client => {
    const target = readGoals()[name]?.target || null;
    // the ETA mod registers its API a moment after the game loads; give it a few seconds (XP/h estimates use it)
    await waitFor(client, "typeof mod !== 'undefined' && mod.api.ETA !== undefined", 5000).catch(() => null);
    const data = await evalExpr(client, journalScript(includeSaveBackup, target));
    // --sim: replay the current target with each upgrade candidate in [Myth] Combat Simulator
    if (simulate && data.report?.action === 'Combat' && data.upgradePlan?.slots) data.upgradeSim = await evalExpr(client, `mh.simUpgrades(${JSON.stringify(data.upgradePlan)})`, 240000);
    // --sim: next dungeon bosses, never-killed monsters and the target item's best monster, for the Plans goals
    if (simulate && data.goals) {
      const areas = (data.goals.dungeons || []).filter(d => d.name !== '???' && !d.clears && d.unlocked && d.boss).slice(0, 2).map(d => ({ key: 'area:' + d.id, monsterId: d.boss, entityId: d.id }));
      const monsters = (data.goals.completion?.unkilled || []).slice(0, 3).map(m => ({ key: 'mon:' + m.id, monsterId: m.id }));
      const farm = (data.goals.target?.monsters || []).filter(m => m.unlocked !== false).slice(0, 1).map(m => ({ key: 'mon:' + m.monsterId, monsterId: m.monsterId }));
      data.goalSim = await evalExpr(client, `mh.simTargets(${JSON.stringify([...areas, ...monsters, ...farm])})`, 240000);
    }
    return data;
  }, simulate ? SIM_DEBUG : undefined);
}

const journalScript = (includeSaveBackup, target) => `(() => {
    const wanted = ${JSON.stringify(JOURNAL_WANTED)};
    const qty = n => { for (const [item, bi] of game.bank.items) if (item.name === n) return bi.quantity; return 0; };
    const skills = mh.skills();
    const targets = [...new Set([
      ...skills.filter(s => s.level < (s.levelCap ?? 120)).sort((a, b) => a.level - b.level).slice(0, 6),
      ...skills.filter(s => (s.abyssalLevel ?? 0) < (s.abyssalCap ?? 0)).sort((a, b) => a.abyssalLevel - b.abyssalLevel).slice(0, 6),
    ].map(s => s.name))];
    const equipmentSets = game.combat.player.equipmentSets.map((set, index) => ({ index, items: Object.fromEntries(set.equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => [slot.slot.localID, slot.item.name])) }));
    const inventory = [...game.bank.items].map(([item, entry]) => ({ name: item.name, quantity: entry.quantity, media: item.media || null, type: item.type || item.category || 'Other', kind: item.constructor?.name ?? null, slot: item.validSlots?.[0]?.localID ?? null, sell: item.sellsFor?.quantity ?? 0, currency: item.sellsFor?.currency?.id === 'melvorD:GP' ? 'GP' : item.sellsFor?.currency?.id === 'melvorItA:AbyssalPieces' ? 'AP' : null })).sort((a, b) => a.name.localeCompare(b.name));
    const values = value => value instanceof Map ? [...value.values()] : value instanceof Set ? [...value] : Array.isArray(value) ? value : value?.allObjects ?? [];
    const talents = game.skills.allObjects.flatMap(skill => values(skill.skillTrees).map(tree => ({ skill: skill.name, points: tree.points || 0, candidates: values(tree.nodes).filter(node => node.canUnlock && tree.canAffordNode(node) && !values(tree.unlockedNodes).includes(node)).map(node => ({ name: node.name, shortName: node.shortName })) }))).filter(tree => tree.points > 0);
    const out = { report: mh.readOnlyReport(), skills, skilling: mh.skillingAudit(), skillingOptions: Object.fromEntries(targets.map(n => [n, mh.skillingOptions(n)])), bank: Object.fromEntries(wanted.map(n => [n, qty(n)])), equipmentSets, inventory, talents, createdAt: (() => { try { return game.stats.General.get(GeneralStats.AccountCreationDate) || null; } catch { return null; } })(), abyss: mh.abyssOpen(), skillRates: mh.skillRates(), upgradePlan: mh.upgradePlan(), goals: mh.goalData(${JSON.stringify(target)}), completion: ${completionScript} };
    if (${JSON.stringify(includeSaveBackup)}) out.saveExport = mh.exportSaveString();
    return out;
  })()`;

async function collectSaveBackup(name, source) {
  return withCharacterSource(name, source?.source, client => evalExpr(client, 'mh.exportSaveString()', 60000));
}

async function readSourcesByName() {
  const slots = await readSlots();
  return { slots, sources: Object.fromEntries(sourceOfTruth(slots).map(s => [s.name, s])) };
}

async function withCharacterWrite(name, fn) {
  const { sources } = await readSourcesByName();
  const before = sources[name] || null;
  const result = await withCharacterSource(name, before?.source, async client => {
    const result = await fn(client);
    const saved = await evalExpr(client, 'mh.save()', 60000);
    return { ...result, saved };
  });
  const afterSlots = await readSlots();
  const after = sourceOfTruth(afterSlots).find(s => s.name === name) || null;
  return { ...result, sourceBefore: before?.source || 'unknown', sourceAfter: after?.source || 'unknown' };
}

// Offline status change: appends a ledger event and refreshes latest.json + dashboard.
// Change one decision's status: CLI journal-action and the dashboard buttons share this.
function setActionStatus(id, status) {
  const allowed = ['approved', 'dismissed', 'done', 'blocked'];
  if (!id || !allowed.includes(status)) throw Error(`usage: journal-action <id> <${allowed.join('|')}>`);
  const latest = readLedger();
  const prev = latest.get(id);
  if (!prev) throw Error(`unknown action id ${id} (see journal/actions.jsonl)`);
  const now = new Date().toISOString();
  const event = { ...prev, ts: now, status, reason: `manually marked ${status}` };
  fs.appendFileSync(LEDGER, JSON.stringify(event) + '\n');
  latest.set(id, event);
  const previous = readLatestSnapshot();
  if (previous) {
    const snapshot = buildLatest([], latest, previous, now);
    fs.writeFileSync(path.join(JOURNAL_DIR, 'latest.json'), JSON.stringify(snapshot, null, 2));
    fs.writeFileSync(path.join(JOURNAL_DIR, 'index.html'), renderDashboard(snapshot));
  }
  return { prev, event };
}

function runJournalAction(id, status) {
  const { prev } = setActionStatus(id, status);
  console.log(`${id} -> ${status} (${prev.character}: ${prev.item}${prev.slot ? ' in ' + prev.slot : ''})`);
}

async function runJournal() {
  const { sources } = await readSourcesByName();
  const chars = [];
  const backupEntries = [];
  const completions = [];
  for (const name of names) {
    const data = await collectJournal(name, sources[name], saveBackup);
    completions.push({ at: new Date().toISOString(), name, ...data.completion });
    if (saveBackup) backupEntries.push(recordSaveBackup(name, sources[name], data.saveExport));
    chars.push(buildCharacterJournal(name, data, sources[name]));
  }
  for (const b of backupEntries) console.log(`recorded ${b.path} (${b.character}, ${b.source}, ${b.hash})`);
  for (const [i, c] of chars.entries()) {
    c.observed.completion = completions[i];
    c.analysis.completionPrevious = lastCompletion(c.name);
    c.analysis.completionHistory = [...completionRows(c.name).slice(-8), completions[i]].map(row => ({ at: row.at, total: row.total }));
  }
  const previous = readLatestSnapshot();
  const now = new Date().toISOString();
  for (const c of chars) c.analysis.progressEtas = progressEtas(c, previous?.characters?.[c.name] || null);
  if (!record) {
    for (const c of chars) console.log(journalMd(c) + '\n');
    return;
  }
  fs.mkdirSync(JOURNAL_DIR, { recursive: true });
  for (const c of chars) {
    fs.appendFileSync(path.join(JOURNAL_DIR, `${c.name}.md`), journalMd(c) + '\n\n');
    console.log(`recorded journal/${c.name}.md`);
  }
  for (const row of completions) console.log(completionLine(row, lastCompletion(row.name)));
  fs.appendFileSync(COMPLETION_LOG, completions.map(row => JSON.stringify(row)).join('\n') + '\n');
  console.log(`recorded ${completions.length} completion row(s) in journal/completion.jsonl`);
  const { events, latest } = mergeLedger(chars, readLedger(), now);
  if (events.length) {
    fs.appendFileSync(LEDGER, events.map(e => JSON.stringify(e)).join('\n') + '\n');
    console.log(`recorded ${events.length} action event(s) in journal/actions.jsonl`);
  }
  const snapshot = buildLatest(chars, latest, previous, now);
  fs.writeFileSync(path.join(JOURNAL_DIR, 'latest.json'), JSON.stringify(snapshot, null, 2));
  console.log('recorded journal/latest.json');
  fs.writeFileSync(path.join(JOURNAL_DIR, 'index.html'), renderDashboard(snapshot));
  console.log('recorded journal/index.html');
  console.log(journalRefreshSummary(readLatestSnapshot(), previous, now).join('\n'));
}

async function runSaveBackup() {
  const { sources } = await readSourcesByName();
  for (const name of names) {
    const entry = recordSaveBackup(name, sources[name], await collectSaveBackup(name, sources[name]));
    console.log(`recorded ${entry.path} (${entry.character}, ${entry.source}, ${entry.bytes} bytes, ${entry.hash})`);
  }
  const previous = readLatestSnapshot();
  if (previous) {
    const snapshot = buildLatest([], readLedger(), previous, new Date().toISOString());
    fs.writeFileSync(path.join(JOURNAL_DIR, 'latest.json'), JSON.stringify(snapshot, null, 2));
    fs.writeFileSync(path.join(JOURNAL_DIR, 'index.html'), renderDashboard(snapshot));
    console.log('refreshed journal/latest.json and journal/index.html');
  }
}

function lock(retry = true) {
  try {
    const fd = fs.openSync(LOCK, 'wx');
    fs.writeFileSync(fd, String(process.pid));
    const unlock = () => { try { fs.closeSync(fd); fs.unlinkSync(LOCK); } catch {} };
    process.once('SIGINT', () => { unlock(); process.exit(130); });
    process.once('SIGTERM', () => { unlock(); process.exit(143); });
    return unlock;
  } catch {
    // ponytail: kill(pid, 0) treats EPERM as alive; fine, this tool only locks its own pids
    const holder = Number(fs.readFileSync(LOCK, 'utf8').trim());
    let holderAlive = false;
    try { process.kill(holder, 0); holderAlive = true; } catch {}
    if (!holderAlive && retry) {
      try { fs.unlinkSync(LOCK); } catch {}
      return lock(false);
    }
    let details = `PID ${holder}`;
    try { details = execFileSync('ps', ['-p', String(holder), '-o', 'pid=,etime=,command='], { encoding: 'utf8' }).trim() || details; } catch {}
    throw Error(`another melvor-report is already using port ${PORT}: ${details}`);
  }
}

module.exports = { planActions, buildCharacterJournal, journalMd, mergeLedger, buildLatest, renderDashboard, sourceOfTruth, potionItemName, readLedger, journalRefreshSummary, sanitizeIncident, incidentSignature, readIncidents, incidentCandidates, promoteIncidentCandidates, structuredInsights, equipmentActionScript, skillStartScript, talentUnlockScript, configSetScript, briefFromData, completionLine, verifiedSkillPlan, buildGoals, dungeonVerdict };
if (require.main === module) (async () => {
  if (cmd === 'journal-serve') return runJournalServer();
  if (cmd === 'dungeon-guide') return runDungeonGuide(who);
  if (cmd === 'journal-action') return runJournalAction(who, arg3);
  if (cmd === 'journal-status') return runJournalStatus();
  if (cmd === 'journal-diff') return runJournalDiff();
  const unlock = lock();
  let chrome = null;
  try {
    chrome = await ensureChrome();
    if (cmd === 'smoke') {
      await smoke();
      return;
    }

    if (cmd === 'login-smoke') {
      await loginSmoke();
      return;
    }

    if (cmd === 'slots' || cmd === 'diff-slots' || cmd === 'source-of-truth' || cmd === 'improve') {
      const data = await readSlots();
      if (cmd === 'diff-slots') printSlotDiffs(data);
      else if (cmd === 'source-of-truth') printSourceOfTruth(data);
      else if (cmd === 'improve') printImprovementReport(data);
      else printSlots(data);
      return;
    }

    if (cmd === 'journal') {
      await runJournal();
      return;
    }

    if (cmd === 'completion') {
      const { sources } = await readSourcesByName();
      const at = new Date().toISOString();
      for (const name of names) {
        const row = { at, name, ...await withCharacterSource(name, sources[name]?.source, client => evalExpr(client, completionScript)) };
        console.log(completionLine(row, lastCompletion(name)));
        if (record) fs.appendFileSync(COMPLETION_LOG, JSON.stringify(row) + '\n');
      }
      return;
    }

    if (cmd === 'dungeon-clear') {
      // one clear for the completion, then back to what the character was doing: check verdict -> plan (if needed)
      // -> potion -> run -> gear and potion back -> previous activity, in one game session saved at the end
      if (who === 'all' || !arg3) throw Error('usage: ./melvor-report.js dungeon-clear <character> "<dungeon name>"');
      const dir = path.join(JOURNAL_DIR, 'dungeons');
      const checkFile = path.join(dir, `${safeFilePart(who)}-${safeFilePart(arg3)}.json`);
      if (!fs.existsSync(checkFile)) throw Error(`run dungeon-check ${who} "${arg3}" first`);
      const check = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
      if (check.hardcore) throw Error('Hardcore character: not run automatically until the simulations are made stronger');
      const verdict = dungeonVerdict(check);
      let setNumber, plans = [], potion = null;
      if (verdict.ready) {
        // the set whose worst fight is the safest
        const worst = set => Math.max(...verdict.fights.map(f => check.sims.find(s => s.fight === f.key && s.set === set && s.ok)?.deathRate ?? 1));
        setNumber = [...new Set(check.sims.map(s => s.set))].sort((a, b) => worst(a) - worst(b))[0];
      } else {
        const planFile = path.join(dir, `${safeFilePart(who)}-${safeFilePart(arg3)}-plan.json`);
        const best = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')).results.filter(r => r.best.death <= verdict.threshold).sort((a, b) => a.best.death - b.best.death || a.best.kill - b.best.kill)[0] : null;
        if (!best) throw Error(`${who} is not ready for ${check.dungeon}, with or without a plan: nothing was changed`);
        setNumber = best.setIndex; potion = best.potion;
        plans = [{ setIndex: best.setIndex, style: best.style, equipment: best.equipment, prayers: best.prayers, best: best.best }];
      }
      const timeout = Number(process.env.MELVOR_COMBAT_RUN_TIMEOUT_MS || 20 * 60 * 1000);
      const r = await withCharacterWrite(who, async client => {
        const out = {};
        out.prev = await evalExpr(client, `(() => {
          const p = game.combat.player, a = game.activeAction, task = game.combat.slayerTask;
          const active = [...game.potions.activePotions].find(([action]) => action === game.combat || action?.name === 'Combat')?.[1]?.item?.name ?? null;
          self.__mptPrev = { action: a, name: a?.name ?? null, set: p.selectedEquipmentSet, onTask: a === game.combat && task?.active && game.combat.selectedMonster === task.monster,
            monster: game.combat.selectedMonster, area: game.combat.selectedArea, potion: active, trees: a === game.woodcutting ? [...game.woodcutting.activeTrees] : null };
          return { name: self.__mptPrev.name, set: p.selectedEquipmentSet + 1, onTask: self.__mptPrev.onTask, potion: active, trees: self.__mptPrev.trees?.map(t => t.name) ?? null };
        })()`);
        try {
          if (plans.length) {
            out.setup = await evalExpr(client, `mh.dungeonSetupApply(${JSON.stringify(plans)})`, 120000);
            if (out.setup.error) { out.status = 'setup failed: ' + out.setup.error; return out; }
          }
          if (potion && potion !== out.prev.potion) out.potion = await evalExpr(client, configSetScript('potion', potion, true), 60000);
          out.run = await evalExpr(client, combatRunScript(arg3, timeout, setNumber), timeout + 60000);
          out.status = out.run.status;
        } finally {
          if (out.setup?.before) out.restore = await evalExpr(client, `mh.dungeonSetupApply(${JSON.stringify(out.setup.before.map(b => ({ ...b, best: { death: 0 } })))})`, 120000);
          if (out.potion && out.prev.potion) out.potionBack = await evalExpr(client, configSetScript('potion', out.prev.potion, true), 60000);
          out.resume = await evalExpr(client, `(async () => {
            const s = self.__mptPrev, p = game.combat.player, sleep = ms => new Promise(r => setTimeout(r, ms));
            p.changeEquipmentSet(s.set);
            if (s.onTask) game.combat.slayerTask.jumpToTaskOnClick();
            else if (s.action === game.combat && s.monster) game.combat.selectMonster(s.monster, s.area);
            else if (s.trees?.length) { if (game.activeAction) game.activeAction.stop(); for (const t of s.trees) if (!game.woodcutting.activeTrees.has(t)) game.woodcutting.selectTree(t); }
            else if (s.action) s.action.start();
            else if (game.activeAction) game.activeAction.stop();
            await sleep(1500);
            return { wanted: s.name, now: game.activeAction?.name ?? null, set: p.selectedEquipmentSet + 1, ok: (game.activeAction?.name ?? null) === s.name,
              trees: game.activeAction === game.woodcutting ? [...game.woodcutting.activeTrees].map(t => t.name) : null };
          })()`, 60000);
        }
        return out;
      });
      const run = r.run || {};
      console.log(`${who} | dungeon-clear | ${check.dungeon} | ${r.status} | S${setNumber}${plans.length ? ' with the plan' : ''}${r.potion ? ' | potion ' + potion : ''}`);
      for (const s of run.samples || []) console.log(`  ${s.t.slice(11, 19)} progress ${s.progress} | ${s.monster || '-'} | player ${s.hp}/${s.maxHP} | food ${s.food ?? '?'}${s.stoppedCombat !== undefined ? ' | fled ' + s.stoppedCombat : ''}`);
      for (const o of run.rewardOptions || []) console.log(`  pending option: ${o.label}`);
      if (r.restore) console.log(`  gear back: ${r.restore.applied ? 'yes' : 'NO: ' + (r.restore.left || []).join('; ')}`);
      if (r.potionBack) console.log(`  potion back: ${r.potionBack.final ?? r.potionBack.error}`);
      console.log(`  previous activity: ${r.prev.name}${r.prev.trees ? ' (' + r.prev.trees.join(', ') + ')' : ''}${r.prev.onTask ? ' (Slayer task)' : ''} -> now ${r.resume.now}${r.resume.trees ? ' (' + r.resume.trees.join(', ') + ')' : ''} on S${r.resume.set}: ${r.resume.ok ? 'resumed' : 'NOT resumed'}`);
      console.log(`  saved: ${r.saved} | source ${r.sourceBefore} -> ${r.sourceAfter}`);
      fs.appendFileSync(path.join(JOURNAL_DIR, `${who}.md`), `## ${new Date().toISOString()} - ${who} dungeon-clear\n\n- Dungeon: ${check.dungeon}\n- Status: ${r.status}, set S${setNumber}${plans.length ? ' with the plan' : ''}\n- Lowest HP: ${Math.min(...(run.samples || []).map(s => s.hp))}\n- Back to: ${r.resume.now} (${r.resume.ok ? 'resumed' : 'not resumed'})\n\n`);
      if (!r.resume.ok || (r.restore && !r.restore.applied)) throw Error('dungeon-clear did not put everything back: see above');
      return;
    }

    if (cmd === 'dungeon-setup') {
      if (who === 'all' || !arg3) throw Error('usage: ./melvor-report.js dungeon-setup <character> "<dungeon name>"');
      // --restore: the gear the last --apply replaced (journal/dungeons/<char>-<dungeon>-before.json)
      const beforeFile = path.join(JOURNAL_DIR, 'dungeons', `${safeFilePart(who)}-${safeFilePart(arg3)}-before.json`);
      const planFile = restore ? beforeFile : path.join(JOURNAL_DIR, 'dungeons', `${safeFilePart(who)}-${safeFilePart(arg3)}-plan.json`);
      if (!fs.existsSync(planFile)) throw Error(restore ? `nothing to restore: no dungeon-setup --apply recorded for ${who}` : `run dungeon-optimize ${who} "${arg3}" first`);
      const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
      // --style melee,ranged: only these sets (e.g. Impending Darkness without the magic plan)
      const styles = gearStyle ? gearStyle.split(',').map(x => x.trim()) : null;
      const plans = [...plan.results].filter(r => !styles || styles.includes(r.style)).sort((a, b) => a.setIndex - b.setIndex).map(r => ({ setIndex: r.setIndex, style: r.style, equipment: r.equipment, potion: r.potion, prayers: r.prayers, best: r.best }));
      if (!plans.length) throw Error('no plan for ' + (styles || []).join(', '));
      if (apply) {
        const r = await withCharacterWrite(who, client => evalExpr(client, `mh.dungeonSetupApply(${JSON.stringify(plans)})`, 120000));
        // keep the first record: a second --apply must not overwrite the daily gear with the dungeon gear
        if (!restore && r.before && !fs.existsSync(beforeFile)) fs.writeFileSync(beforeFile, JSON.stringify({ at: new Date().toISOString(), character: who, dungeon: plan.dungeon, results: r.before.map(b => ({ ...b, best: { death: 0 } })) }, null, 2));
        if (restore && r.applied) fs.unlinkSync(beforeFile);
        console.log(`${r.name} | ${plan.dungeon} | ${restore ? 'restore' : 'setup'} ${r.applied ? 'applied' : 'NOT fully applied'} | back on S${r.backTo ?? '?'} | saved: ${r.saved} | source ${r.sourceBefore} -> ${r.sourceAfter}`);
        for (const line of r.log || []) console.log('  ' + line);
        for (const line of r.left || []) console.log('  LEFT: ' + line);
        for (const x of r.shortages || []) console.log(`  SHORT: ${x.name} needed in ${x.need} sets, ${x.have} available`);
        if (r.error) throw Error(r.error);
        console.log('  potion not changed (shared by every set): activate it before the run');
        return;
      }
      const { sources } = await readSourcesByName();
      const r = await withCharacterSource(who, sources[who]?.source, client => evalExpr(client, `mh.dungeonSetupPreview(${JSON.stringify(plans)})`, 60000));
      if (r.error) throw Error(r.error);
      console.log(`${r.name} | ${plan.dungeon} | setup preview (plans from ${new Date(plan.at).toLocaleString()}); nothing changed`);
      for (const s of r.sets) {
        const p = plans.find(x => x.setIndex === s.setIndex);
        console.log(`  S${s.setIndex} ${s.style} (target deaths ${(p.best.death * 100).toFixed(1)}%)${s.error ? ': ' + s.error : ''}`);
        for (const w of s.swaps || []) console.log(`    ${w.slot}: ${w.from || 'empty'} -> ${w.to}`);
        if (s.prayers?.length && s.prayers.join() !== s.prayersNow.join()) console.log(`    Prayers: ${s.prayersNow.join(' + ') || 'none'} -> ${s.prayers.join(' + ')}`);
        if (s.potion) console.log(`    Potion: ${s.potion} (${r.potionOwned[s.potion]} in bank)`);
      }
      for (const x of r.shortages) console.log(`  SHORT: ${x.name} needed in ${x.need} sets, ${x.have} available`);
      if (!r.shortages.length) console.log('  every planned item is available for every set');
      return;
    }

    if (cmd === 'dungeon-optimize') {
      // optimize the hardest fight of the last dungeon-check for each style (or --style): Bane IoF for Impending Darkness
      if (who === 'all' || !arg3) throw Error('usage: ./melvor-report.js dungeon-optimize <character> "<dungeon name>" [--style melee|ranged|magic]');
      const checkFile = path.join(JOURNAL_DIR, 'dungeons', `${safeFilePart(who)}-${safeFilePart(arg3)}.json`);
      if (!fs.existsSync(checkFile)) throw Error(`run dungeon-check ${who} "${arg3}" first`);
      const check = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
      const roles = (process.env.MELVOR_SET_ROLES || 'melee,ranged,magic,skill,melee,ranged,magic').split(',').map(x => x.trim());
      const styles = gearStyle ? [gearStyle] : ['melee', 'ranged', 'magic'];
      const verdict = dungeonVerdict(check);
      const targets = styles.map(style => {
        const styled = verdict.fights.filter(f => f.style === style);
        const fight = (styled.length ? styled : verdict.fights).sort((a, b) => (b.best?.deathRate ?? 1) - (a.best?.deathRate ?? 1))[0];
        const sim = check.sims.find(x => x.fight === fight.key && x.role === style) || fight.best;
        const setIndex = roles.findIndex((r, i) => r === style && (i >= 4) === Boolean(check.abyssal)) + 1;
        const monsterId = check.id === 'melvorF:Impending_Darkness' ? `melvorF:${fight.key.startsWith('Bane IoF') ? 'BaneInstrumentOfFear' : 'Bane'}_${style}` : null;
        return { style, fight: fight.key, label: fight.label, setIndex, monsterId, entityId: check.id, before: sim?.deathRate ?? null };
      }).filter(t => t.setIndex > 0);
      const { sources } = await readSourcesByName();
      // --cape: another required cape than the check's best one (one Maximum Skillcape cannot sit in every set)
      const cape = capeName || check.cape;
      const capeId = cape ? `(() => game.items.allObjects.find(i => i.name === ${JSON.stringify(cape)})?.id)()` : 'null';
      const results = await withCharacterSource(who, sources[who]?.source, async client => {
        const out = [];
        for (const t of targets) {
          const monsterExpr = t.monsterId ? JSON.stringify(t.monsterId) : `(() => { const a = [...game.dungeons.allObjects, ...game.abyssDepths.allObjects, ...game.strongholds.allObjects].find(x => x.id === ${JSON.stringify(t.entityId)}); return [...a.monsters].sort((x, y) => (y.combatLevel ?? 0) - (x.combatLevel ?? 0))[0].id; })()`;
          out.push({ ...t, ...(await evalExpr(client, `mh.optimizeFight({ monsterId: ${monsterExpr}, entityId: ${JSON.stringify(t.entityId)}, setIndex: ${t.setIndex}, style: ${JSON.stringify(t.style)}, cape: ${capeId} })`, 900000)) });
        }
        return out;
      }, SIM_DEBUG);
      for (const r of results) {
        if (r.error) { console.log(`${r.style}: ${r.error}`); continue; }
        console.log(`${who} | ${check.dungeon} | ${r.label} | S${r.setIndex} ${r.style}: deaths ${(r.start.death * 100).toFixed(1)}% -> ${(r.best.death * 100).toFixed(1)}%, kill ${r.start.kill.toFixed(1)} -> ${r.best.kill.toFixed(1)} s (${r.sims} sims)`);
        // keep the final choice per slot (the greedy search may improve a slot twice); "from" is the original item
        const finalBySlot = new Map(); for (const c of r.changes) finalBySlot.set(c.slot, { ...c, from: finalBySlot.get(c.slot)?.from ?? c.from });
        for (const c of finalBySlot.values()) console.log(`  ${c.slot}: ${c.from ? c.from + ' -> ' : ''}${c.to}`);
        if (!r.changes.length) console.log('  no owned change improves this fight');
      }
      // a --style run replaces that style only and keeps the others
      const planFile = path.join(JOURNAL_DIR, 'dungeons', `${safeFilePart(who)}-${safeFilePart(check.dungeon)}-plan.json`);
      const kept = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')).results.filter(old => !results.some(r => r.style === old.style)) : [];
      fs.writeFileSync(planFile, JSON.stringify({ at: new Date().toISOString(), character: who, dungeon: check.dungeon, results: [...kept, ...results] }, null, 2));
      return;
    }

    if (cmd === 'dungeon-check') {
      if (who === 'all' || !arg3) throw Error('usage: ./melvor-report.js dungeon-check <character> "<dungeon name>"');
      const { sources } = await readSourcesByName();
      const roles = (process.env.MELVOR_SET_ROLES || 'melee,ranged,magic,skill,melee,ranged,magic').split(',').map(x => x.trim());
      const r = await withCharacterSource(who, sources[who]?.source, client => evalExpr(client, `mh.dungeonCheck(${JSON.stringify(arg3)}, ${JSON.stringify(roles)})`, 600000), SIM_DEBUG);
      if (r.error) throw Error(r.error);
      printDungeonCheck(who, r);
      const dir = path.join(JOURNAL_DIR, 'dungeons'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${safeFilePart(who)}-${safeFilePart(r.dungeon)}.json`), JSON.stringify({ at: new Date().toISOString(), character: who, ...r }, null, 2));
      return;
    }

    if (cmd === 'save-backup') {
      await runSaveBackup();
      return;
    }

    if (cmd === 'save-push') {
      if (who === 'all') throw Error('usage: ./melvor-report.js save-push <character>');
      const forceLocal = argv.includes('--local-source');
      const { sources } = await readSourcesByName();
      const before = sources[who] || null;
      const data = await withCharacterSource(who, forceLocal ? 'local' : before?.source, async client => {
        const result = await evalExpr(client, `(() => {
        const report = mh.readOnlyReport();
        return { name: report.name, action: report.action, gp: report.gp };
      })()`);
        const saved = await evalExpr(client, 'mh.save()', 60000);
        return { ...result, saved };
      });
      const afterSlots = await readSlots();
      const after = sourceOfTruth(afterSlots).find(s => s.name === who) || null;
      console.log(`${data.name} | save-push | ${data.action || 'idle'} | GP ${fmtNum(data.gp)}`);
      console.log(`  saved: ${data.saved} | source ${forceLocal ? 'local (forced)' : before?.source || 'unknown'} -> ${after?.source || 'unknown'}`);
      return;
    }

    if (cmd === 'combat-run') {
      if (who === 'all' || !arg3) throw Error('usage: ./melvor-report.js combat-run <character> <dungeon name|id> [--slot N]');
      const data = await withCharacterWrite(who, client =>
        evalExpr(client, combatRunScript(arg3, process.env.MELVOR_COMBAT_RUN_TIMEOUT_MS || 10 * 60 * 1000, slotIndex >= 0 ? requestedSlot : null), Number(process.env.MELVOR_COMBAT_RUN_TIMEOUT_MS || 10 * 60 * 1000) + 60000));
      if (data.status === 'error') throw Error(data.error);
      printCombatRun(data);
      recordCombatRewardOptions(data);
      return;
    }

    if (cmd === 'combat-setup') {
      if (who === 'all') throw Error('usage: ./melvor-report.js combat-setup <character>');
      const data = await withCharacterWrite(who, client => evalExpr(client, combatSetupScript, 60000));
      if (data.status === 'error') throw Error(data.error);
      printCombatSetup(data);
      return;
    }

    if (cmd === 'magic-setup') {
      if (who === 'all') throw Error('usage: ./melvor-report.js magic-setup <character> [--slot 6] [--apply] [--restore-ranged]');
      const script = restoreRanged ? restoreAbyssalRangedScript : magicSetupScript;
      const run = client => evalExpr(client, script(requestedSlot, apply), 60000);
      const data = apply ? await withCharacterWrite(who, run) : await readSourcesByName().then(({ sources }) => withCharacterSource(who, sources[who]?.source, run));
      printMagicSetup(data);
      if (data.error) throw Error(data.error);
      return;
    }

    if (cmd === 'slayer-abyssal') {
      if (who === 'all') throw Error('usage: ./melvor-report.js slayer-abyssal <character>');
      const { sources } = await readSourcesByName();
      const data = await withCharacterSource(who, sources[who]?.source, client => evalExpr(client, `(() => {
        const combat = game.combat;
        const task = combat.slayerTask;
        const names = object => Object.getOwnPropertyNames(Object.getPrototypeOf(object ?? {})).filter(name => /slayer|task|select|assign|new/i.test(name));
        return {
          name: game.characterName,
          active: task?.monster?.name ?? null,
          remaining: task?.killsLeft ?? null,
          combatMethods: names(combat), taskMethods: names(task), slayerMethods: names(game.slayer),
        };
      })()`));
      printAbyssalSlayer(data);
      return;
    }

    if (cmd === 'slayer-start') {
      if (who === 'all') throw Error('usage: ./melvor-report.js slayer-start <character> [--slot 6]');
      const data = await withCharacterWrite(who, client => evalExpr(client, `(async () => {
        const player = game.combat.player;
        const task = game.combat.slayerTask;
        if (!task?.active || !task.monster) return { error: 'no active Slayer task' };
        const slot = ${requestedSlot - 1};
        if (!player.equipmentSets?.[slot]) return { error: 'equipment set ${requestedSlot} does not exist' };
        player.changeEquipmentSet(slot);
        task.jumpToTaskOnClick();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          name: game.characterName, task: task.monster.name, remaining: task.killsLeft,
          slot: slot + 1, style: player.attackType, area: game.combat.selectedArea?.name ?? null,
          monster: game.combat.enemy?.monster?.name ?? null, hitChance: player.stats.hitChance,
          food: player.food.currentSlot?.item?.name ?? null,
        };
      })()`, 60000));
      if (data.error) throw Error(data.error);
      printSlayerStart(data);
      return;
    }

    if (cmd === 'equip' || cmd === 'skill-start' || cmd === 'talent-unlock' || cmd === 'config-set') {
      if (who === 'all' || !arg3 || !arg4) {
        const usage = cmd === 'equip' ? 'equip <character> <item> <slot>' : cmd === 'config-set' ? 'config-set <character> <potion|prayers|poi|style> <value>' : `${cmd} <character> <skill> <${cmd === 'skill-start' ? 'recipe' : 'node'}>`;
        throw Error(`usage: ./melvor-report.js ${usage} [--apply]`);
      }
      const script = cmd === 'config-set'
        ? configSetScript(arg3, arg4, apply)
        : cmd === 'equip'
        ? equipmentActionScript(arg3, arg4, requestedQuantity, apply)
        : cmd === 'skill-start'
          ? skillStartScript(arg3, arg4, apply)
          : talentUnlockScript(arg3, arg4, apply);
      const run = client => evalExpr(client, script, 60000);
      const data = apply
        ? await withCharacterWrite(who, run)
        : await readSourcesByName().then(({ sources }) => withCharacterSource(who, sources[who]?.source, run));
      printGuardedAction(data);
      if (data.error) throw Error(data.error);
      return;
    }

    if (cmd === 'export-state') {
      const { slots, sources } = await readSourcesByName();
      const characters = {};
      for (const name of names) {
        characters[name] = await withCharacterSource(name, sources[name]?.source, client => evalExpr(client, `(() => {
          const report = mh.readOnlyReport();
          return {
            mode: report.mode,
            action: report.action,
            gp: report.gp,
            combatLevel: report.combatLevel,
            totalLevel: report.totalLevel,
            maxedSkills: report.maxedSkills,
            skills: mh.skills(),
            lowSkills: report.lowSkills,
            food: report.food,
            foodQty: report.foodQty,
            equipment: report.equipment,
            equipmentQuantities: report.equipmentQuantities,
            actionEstimate: report.actionEstimate,
            combat: report.combat,
            combatGoals: report.combatGoals,
          };
        })()`));
        characters[name].source = sources[name] || null;
      }
      console.log(JSON.stringify({ collectedAt: new Date().toISOString(), slots, characters }, null, 2));
      return;
    }

    const { sources } = await readSourcesByName();
    if (cmd === 'brief') {
      const characters = {};
      const previous = readLatestSnapshot();
      const now = new Date().toISOString();
      for (const name of names) {
        const data = await withCharacterSource(name, sources[name]?.source, client => evalExpr(client, `(() => {
          const wanted = ['Octopus','Potion Stirrer','Bear','Jeweled Necklace','Book of Scholars','Ancient Ring of Mastery','Golden Star','Eagle'];
          const qty = name => { for (const [item, bi] of game.bank.items) if (item.name === name) return bi.quantity; return 0; };
          return {
            report: mh.readOnlyReport(),
            skills: mh.skills(),
            skilling: mh.skillingAudit(),
            bank: Object.fromEntries(wanted.map(name => [name, qty(name)])),
          };
        })()`));
        characters[name] = briefFromData(name, data, sources[name], previous?.characters?.[name] || null, now);
      }
      console.log(JSON.stringify({ collectedAt: now, characters }, null, 2));
      return;
    }

    for (const name of names) {
      const data = await withCharacterSource(name, sources[name]?.source, client => {
        if (cmd === 'summary') return evalExpr(client, 'mh.readOnlyReport()');
        if (cmd === 'skilling') return evalExpr(client, 'mh.skillingAudit()');
        if (cmd === 'agility') return evalExpr(client, `(() => {
          const agility = game.agility;
          const name = value => value?.item?.name ?? value?.name ?? value?.id ?? null;
          const show = value => value instanceof Map ? [...value.entries()].map(([key, item]) => ({ slot: name(key) || String(key), value: name(item) ?? item })) : Array.isArray(value) ? value.map(item => name(item) ?? item) : name(value) ?? value;
          const activeObstacles = [];
          try { agility.forEachActiveObstacle(obstacle => {
            const modifiers = obstacle.modifiers;
            const modifier = value => ({ key: value.modifier?._localID ?? value.modifier?.localID ?? null, value: value.value });
            activeObstacles.push({ name: name(obstacle), modifiers: Array.isArray(modifiers) ? modifiers.map(modifier) : [] });
          }); } catch {}
          const activePillars = Object.fromEntries(['activePillar', 'builtPillar', 'pillar', 'elitePillar', 'selectedPillar', 'selectedElitePillar'].flatMap(key => {
            try { const value = agility[key]; return value ? [[key, name(value) ?? show(value)]] : []; } catch { return []; }
          }));
          return { name: game.characterName, action: game.activeAction?.name ?? null, activeObstacles, activePillars };
        })()`);
        // ponytail: probes several property names because Melvor renames internals between patches
        if (cmd === 'config') return evalExpr(client, `(() => {
          const name = value => value?.name ?? value?.localID ?? null;
          const list = value => value instanceof Map ? [...value.entries()] : value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
          const tryGet = fn => { try { return fn(); } catch { return null; } };
          const player = game.combat.player;
          const potions = list(game.potions?.activePotions).map(([action, active]) => ({ action: name(action), potion: name(active.item), charges: active.charges }));
          const bankPotions = [...game.bank.items].filter(([item]) => item.constructor?.name === 'PotionItem' || /Potion/.test(item.name)).map(([item, bank]) => ({ potion: item.name, action: name(item.action), qty: bank.quantity }));
          const spells = tryGet(() => Object.fromEntries(Object.entries(player.spellSelection || {}).map(([key, spell]) => [key, name(spell)]).filter(([, value]) => value)));
          const map = tryGet(() => game.cartography.activeMap);
          const position = tryGet(() => map.playerPosition);
          return {
            name: game.characterName,
            action: game.activeAction?.name ?? null,
            equipmentSet: tryGet(() => player.selectedEquipmentSet),
            prayers: list(player.activePrayers).map(prayer => ({ name: prayer.name, effect: tryGet(() => prayer.stats.describePlain()) })),
            usablePrayers: game.prayers.allObjects.filter(prayer => tryGet(() => prayer.canUseWithDamageType(player.damageType)) && (prayer.isAbyssal ? game.prayer.abyssalLevel >= prayer.abyssalLevel : game.prayer.level >= prayer.level)).map(prayer => ({ name: prayer.name, unholy: prayer.isUnholy, effect: tryGet(() => prayer.stats.describePlain()) })),
            spells,
            autoEat: { threshold: player.autoEatThreshold, hpLimit: tryGet(() => player.autoEatHPLimit), efficiency: player.autoEatEfficiency },
            potions,
            bankPotions,
            cartography: map ? { map: name(map), hex: position ? position._q + ',' + position._r : null, poi: tryGet(() => position.pointOfInterest.name), poiEffect: tryGet(() => position.pointOfInterest.activeStats.describePlain()), discoveredPois: tryGet(() => map.pointsOfInterest.allObjects.filter(poi => poi.isDiscovered && poi.activeStats?.hasStats).map(poi => ({ name: poi.name, effect: poi.activeStats.describePlain() }))) } : null,
          };
        })()`);
        if (cmd === 'talents') return evalExpr(client, `(() => {
          const values = value => value instanceof Map ? [...value.values()] : value instanceof Set ? [...value] : Array.isArray(value) ? value : value?.allObjects ?? [];
          const talents = game.skills.allObjects.flatMap(skill => values(skill.skillTrees).map(tree => ({ skill: skill.name, points: tree.points || 0, candidates: values(tree.nodes).filter(node => node.canUnlock && tree.canAffordNode(node) && !values(tree.unlockedNodes).includes(node)).map(node => ({ name: node.name, shortName: node.shortName })) }))).filter(tree => tree.points > 0);
          return { report: mh.readOnlyReport(), talents };
        })()`);
        if (cmd === 'combat-plan') return evalExpr(client, `(() => {
          const report = mh.readOnlyReport();
          const sets = game.combat.player.equipmentSets.map((set, index) => {
            const equipped = set.equipment.equippedArray.filter(s => !s.isEmpty);
            const item = slot => equipped.find(s => s.slot.localID === slot)?.item;
            return {
              index,
              attackType: item('Weapon')?.attackType ?? null,
              weapon: item('Weapon')?.name ?? null,
              cape: item('Cape')?.name ?? null,
              passive: item('Passive')?.name ?? null,
            };
          });
          return { report, sets };
        })()`);
        return evalExpr(client, `(() => {
          const audit = mh.gearAudit(${JSON.stringify(gearStyle)} || game.combat.player.attackType, ${detail ? 5 : 2});
          return { name: game.characterName, action: game.activeAction?.name ?? null, combat: mh.combatInfo(), context: audit.context, equipped: audit.equipped, candidates: audit.candidates, blocked: audit.blocked };
        })()`);
      });
      if (cmd === 'summary') printSummary(data);
      else if (cmd === 'skilling') printSkilling({ name, ...data });
      else if (cmd === 'agility' || cmd === 'config') console.log(JSON.stringify(data));
      else if (cmd === 'talents') {
        console.log(`${data.report.name}: ${data.report.action || 'idle'}`);
        for (const line of talentAdvice(data.report, data.talents)) console.log(`  ${line}`);
        for (const talent of data.talents.filter(talent => talent.candidates.length)) console.log(`  available: ${talent.skill} ${talent.points} point(s) -> ${talent.candidates.map(node => node.shortName || node.name).join(', ')}`);
      }
      else if (cmd === 'combat-plan') printCombatPlan(data, { abyssalOnly });
      else printGear(data);
    }
  } finally {
    if (chrome) chrome.kill('SIGTERM');
    unlock();
  }
})().catch(e => {
  try { recordIncident(e); } catch {}
  console.error(e.message || e);
  process.exit(1);
});
