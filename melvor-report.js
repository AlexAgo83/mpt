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
const apply = argv.includes('--apply');
const restoreRanged = argv.includes('--restore-ranged');
const quantityIndex = argv.indexOf('--quantity');
const requestedQuantity = quantityIndex >= 0 ? Number(argv[quantityIndex + 1]) : undefined;
const styleIndex = argv.indexOf('--style');
const gearStyle = styleIndex >= 0 ? argv[styleIndex + 1] : null;
const slotIndex = argv.indexOf('--slot');
const requestedSlot = slotIndex >= 0 ? Number(argv[slotIndex + 1]) : 6;
const dashboardPortIndex = argv.indexOf('--port');
const dashboardPort = dashboardPortIndex >= 0 ? Number(argv[dashboardPortIndex + 1]) : Number(process.env.MELVOR_JOURNAL_PORT || 8787);
const [cmd = 'summary', who = 'all', arg3, arg4] = argv.filter((a, i) => !['--record', '--abyssal', '--save-backup', '--detail', '--apply', '--restore-ranged', '--style', '--slot', '--port', '--quantity'].includes(a) && (styleIndex < 0 || i !== styleIndex + 1) && (slotIndex < 0 || i !== slotIndex + 1) && (dashboardPortIndex < 0 || i !== dashboardPortIndex + 1) && (quantityIndex < 0 || i !== quantityIndex + 1));
const usage = `usage:
  ./melvor-report.js slots
  ./melvor-report.js smoke
  ./melvor-report.js login-smoke
  ./melvor-report.js diff-slots
  ./melvor-report.js source-of-truth
  ./melvor-report.js improve [--record]
  ./melvor-report.js brief [all|character]
  ./melvor-report.js summary [all|character]
  ./melvor-report.js audit [all|character]
  ./melvor-report.js plan [all|character]
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
  ./melvor-report.js talents <character>
  ./melvor-report.js export-state [all|character]
  ./melvor-report.js save-backup [all|character]
  ./melvor-report.js journal [all|character] [--record] [--save-backup]
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
  if (!['summary', 'brief', 'gear', 'skilling', 'agility', 'talents', 'audit', 'slots', 'smoke', 'login-smoke', 'diff-slots', 'source-of-truth', 'improve', 'plan', 'combat-plan', 'combat-setup', 'combat-run', 'magic-setup', 'slayer-abyssal', 'slayer-start', 'equip', 'skill-start', 'talent-unlock', 'export-state', 'save-backup', 'journal', 'journal-serve', 'journal-status', 'journal-diff', 'journal-action'].includes(cmd)) {
    console.error(usage);
    process.exit(2);
  }
  if (gearStyle && !['melee', 'ranged', 'magic'].includes(gearStyle)) {
    console.error('gear style must be melee, ranged, or magic');
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

async function withCharacter(name, fn) {
  const tab = await newTab(URL);
  const client = await cdp(tab.webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
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

async function withCharacterSource(name, source, fn) {
  if (source !== 'local') return withCharacter(name, fn);
  const tab = await newTab(URL);
  const client = await cdp(tab.webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
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

function printAudit(r) {
  const report = r.report;
  const low = report.lowSkills.filter(s => s.level > 1).slice(0, 6).map(s => `${s.name} ${s.level}`);
  console.log(`${report.name} | ${report.mode} | ${report.action} | total ${report.totalLevel} | max ${report.maxedSkills}`);
  if (low.length) console.log(`  progression: ${low.join(', ')}`);
  if (report.lowSkills.some(s => s.name === 'Harvesting' && s.level === 1)) console.log('  unlock: Harvesting still level 1');
  if (report.lowSkills.some(s => s.name === 'Corruption' && s.level === 1)) console.log('  unlock: Corruption still level 1');

  const skillingNotes = r.skilling.notes || [];
  for (const note of skillingNotes) console.log(`  skilling: ${note}`);

  if (report.action === 'Fishing' && report.equipment.Summon2 !== 'Octopus') console.log('  skilling: consider Octopus summon for Fishing yield');
  if (report.action === 'Agility' && report.equipment.Summon2 !== 'Eagle') console.log('  skilling: consider Eagle summon for Agility interval');
  if (report.action === 'Herblore' && report.equipment.Weapon !== 'Potion Stirrer') console.log('  skilling: consider Potion Stirrer for Herblore');
  if (report.action === 'Astrology' && report.equipment.Consumable !== 'Golden Star') console.log('  skilling: consider Golden Star for Astrology');
  if (report.action === 'Agility' && report.equipment.Amulet === 'Amulet of Fishing') console.log('  skilling: swap Amulet of Fishing off Agility');
  if (report.action === 'Agility' && report.equipment.Summon1 === 'Bear') console.log('  skilling: Bear is Herblore-focused, not Agility');
  if (report.action === 'Agility' && report.equipment.Consumable === 'Golden Star') console.log('  skilling: Golden Star is Astrology-focused, not Agility');
  if (report.action === 'Astrology' && /Quill|Logbook/.test(`${report.equipment.Weapon || ''} ${report.equipment.Shield || ''}`))
    console.log('  skilling: Cartography tools equipped during Astrology');

  const gear = gearCandidates(r.gear);
  if (report.action === 'Combat') {
    for (const item of gear.slice(0, 4)) console.log(`  combat raw candidate: ${item}`);
    if (report.mode === 'Hardcore Mode' && gear.length) console.log('  caution: Hardcore, test survivability before DPS swaps');
  }
}

function planActions(r) {
  const eq = r.report.equipment;
  const bank = r.bank || {};
  const actions = [];
  const add = (slot, item, reason) => {
    if (eq[slot] === item || !bank[item] || actions.some(a => a.slot === slot && a.item === item)) return;
    actions.push({ type: 'equip', slot, item, current: eq[slot] || 'empty', available: bank[item] || 0, reason,
      risk: r.report.mode === 'Hardcore Mode' ? 'medium' : 'low' });
  };
  if (r.report.action !== 'Fishing' && eq.Amulet === 'Amulet of Fishing')
    add('Amulet', 'Jeweled Necklace', 'replace Fishing-only amulet with an owned skilling amulet');
  if (r.report.action === 'Fishing') add('Summon2', 'Octopus', 'Fishing yield');
  if (r.report.action === 'Herblore') {
    add('Weapon', 'Potion Stirrer', 'Herblore interval/potion preserve');
    add('Summon1', 'Bear', 'Herblore resource preserve');
    add('Amulet', 'Jeweled Necklace', 'remove Fishing-only amulet');
  }
  if (r.report.action === 'Astrology') {
    add('Shield', 'Book of Scholars', 'global skill XP');
    add('Ring', 'Ancient Ring of Mastery', 'mastery XP');
    add('Consumable', 'Golden Star', 'Astrology stardust');
  }
  if (r.report.action === 'Agility') {
    add('Amulet', 'Jeweled Necklace', 'remove Fishing-only amulet');
    add('Summon2', 'Eagle', 'Agility interval');
  }
  return actions;
}

function planLines(r) {
  return planActions(r).map(a => `${a.slot}: ${a.current} -> ${a.item} (available x${a.available}; ${a.reason})`);
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
  const notes = (report.actionEstimate?.notes || []).filter(note => !(action === 'Combat' && report.combat?.playerAttackType === 'magic' && /^(Quiver|Consumable Ranged)/.test(note)));
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
  } else if (action && action !== 'idle') {
    add(`current ${action}: verify ring choice, summon synergy, consumable, and mastery-vs-level XP goal`);
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
    .filter(o => Boolean(o.abyssalLevel) === abyssal && o.runwayHours >= 8)
    .sort((a, b) => (b.xpPerHour ?? 0) - (a.xpPerHour ?? 0) || b.runwayHours - a.runwayHours)[0];
  if (!option) return null;
  const inputs = option.inputs.map(i => `${i.item} ${i.owned} (${i.perAction}/action)`).join(', ');
  return `${abyssal ? 'abyssal ' : ''}${skill.name}: ${option.recipe}; ${option.maxActions} actions; ${option.runwayHours.toFixed(1)} h runway; ${inputs}`;
}

function briefFromData(name, data, save, previousEntry, now = new Date().toISOString()) {
  const report = data.report;
  const skills = data.skills || [];
  const goals = report.combatGoals || {};
  const standardOpen = skills
    .filter(s => (s.levelCap ?? 120) > 1 && s.level < (s.levelCap ?? 120))
    .sort(byLevelThenXp);
  const abyssalSkills = skills.filter(hasTrainableAbyssalLevels);
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
    goals.nextSetup ? `combat setup: ${goals.nextSetup.dungeon} with set ${goals.nextSetup.set?.index ?? '?'} ${goals.nextSetup.set?.attackType || 'unknown'} (${goals.nextSetup.set?.weapon || 'no weapon'})` : null,
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

function printPlan(r) {
  const lines = planLines(r);
  console.log(`${r.report.name} | ${r.report.action}`);
  if (!lines.length) console.log('  no obvious skilling swap');
  for (const line of lines) console.log(`  would equip ${line}`);
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
  console.log(`  set ${r.set?.index ?? '?'} ${r.set?.attackType || 'unknown'}: ${r.set?.weapon || 'no weapon'} / ${r.set?.cape || 'no cape'}`);
  for (const s of r.samples) {
    console.log(`  ${s.t} progress ${s.progress} | completed ${s.completed} | ${s.monster || 'none'} hp ${s.enemyHP ?? '-'} | player ${s.hp}/${s.maxHP} | fight ${s.fight}`);
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

const visibleRewardOptions = `(() => [...document.querySelectorAll('button')]
  .map(b => ({ label: b.innerText.trim(), context: (b.closest('.swal2-popup,.modal,.block,.content')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 220) }))
  .filter(o => /^Claim$|^Increase .*Level Cap$/.test(o.label))
)()`;

const potionItemName = s => String(s || '').split(/\s+(?:for|if)\s+/i)[0].trim();

const combatRunScript = (dungeonRef, timeoutMs) => `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const beats = { melee: 'magic', ranged: 'melee', magic: 'ranged' };
  const allDungeons = game.dungeons.allObjects;
  const ref = ${JSON.stringify(dungeonRef)}.toLowerCase();
  const dungeon = allDungeons.find(d => d.id.toLowerCase() === ref)
    ?? allDungeons.find(d => d.name.toLowerCase() === ref)
    ?? allDungeons.find(d => d.name.toLowerCase().includes(ref));
  if (!dungeon) return { status: 'error', error: 'unknown dungeon: ${dungeonRef.replace(/'/g, "\\'")}' };
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
  const set = sets.find(s => style && s.attackType === style) || sets.find(s => s.attackType);
  if (!set) return { status: 'error', dungeon: dungeon.name, error: 'no combat set found' };
  const beforeCompleted = game.combat.getDungeonCompleteCount(dungeon);
  p.changeEquipmentSet(set.index);
  if (game.activeAction?.name !== 'Combat' || game.combat.selectedArea?.id !== dungeon.id)
    game.combat.selectDungeon(dungeon);
  await sleep(5000);
  const samples = [];
  const started = Date.now();
  let status = 'timeout';
  while (Date.now() - started < ${Number(timeoutMs)}) {
    const sample = {
      t: new Date().toISOString(),
      progress: game.combat.areaProgress,
      completed: game.combat.getDungeonCompleteCount(dungeon),
      monster: game.combat.enemy?.monster?.name ?? null,
      enemyHP: game.combat.enemy?.hitpoints ?? null,
      fight: game.combat.fightInProgress,
      hp: p.hitpoints,
      maxHP: p.stats.maxHitpoints,
    };
    samples.push(sample);
    if (sample.completed > beforeCompleted) { status = 'completed'; break; }
    if (sample.hp < sample.maxHP * 0.35) { status = 'low-hp'; break; }
    await sleep(10000);
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

const skillStartScript = (skillName, recipeName, shouldApply) => `(async () => {
  const values = value => value instanceof Map || value instanceof Set ? [...value.values()] : value?.allObjects ?? value ?? [];
  const methodNames = object => { const names = new Set(); for (let value = object; value && value !== Object.prototype; value = Object.getPrototypeOf(value)) for (const name of Object.getOwnPropertyNames(value)) if (typeof object[name] === 'function') names.add(name); return [...names].filter(name => /select|create|start/i.test(name)); };
  const method = (object, names) => names.find(name => typeof object[name] === 'function');
  const skill = values(game.skills).find(skill => skill.name.toLowerCase() === ${JSON.stringify(skillName.toLowerCase())});
  if (!skill) return { error: 'unknown skill: ${skillName.replace(/'/g, "\\'")}' };
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
  if (!skill) return { error: 'unknown skill: ${skillName.replace(/'/g, "\\'")}' };
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
  for (const key of ['item', 'slot', 'current', 'final', 'quantity', 'available', 'skill', 'recipe', 'activeSkill', 'activeRecipe', 'node', 'pointsBefore', 'pointsAfter', 'unlocked']) if (result[key] !== undefined && result[key] !== null) console.log(`  ${key}: ${result[key]}`);
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
  const actions = planActions(data).map(a => ({ ...a, id: actionId(name, a), contextHash: actionContextHash(report, a) }));
  const saveRisk = !save || save.source === 'unknown' ? 'save source of truth unknown' : null;
  return {
    name,
    observed: {
      at: new Date().toISOString(),
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
      upgradePlan: data.upgradePlan || null,
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
      optimizationPlan: activeSlayerTask ? [] : brief.standard.next,
      standardPlan: activeSlayerTask ? [] : brief.standard.next,
      abyssalPlan: activeSlayerTask ? [] : brief.abyssal.next,
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
      const [at] = heading.split(' — ');
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
    `## ${o.at} — ${c.name}`,
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
    ...list(c.analysis.optimizationPlan),
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
      push(applied ? 'done' : 'stale', c.name, prev,
        applied ? 'observed equipment now matches this action' : 'observed state no longer produces this recommendation');
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
  if (sameCloudSnapshot(current, previous)) return ['ETA pending: cloud save has not advanced since the previous scan'];
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
        parts.push(`${s.name}: ${fmtNum(dxp)} XP gained (${fmtNum(dxp * 3600000 / elapsed)}/h)`);
        if (nextLevel > s.level) parts.push(`next level ETA ${fmtDuration((xpForLevel(nextLevel) - s.xp) / xpPerMs)}`);
        if (nextTen > s.level) parts.push(`level ${nextTen} ETA ${fmtDuration((xpForLevel(nextTen) - s.xp) / xpPerMs)}`);
        if (cap > s.level) parts.push(`cap ${cap} ETA ${fmtDuration((xpForLevel(cap) - s.xp) / xpPerMs)}`);
      }
      if (daxp > 0) {
        const axpPerMs = daxp / elapsed;
        parts.push(`${s.name}: ${fmtNum(daxp)} abyssal XP gained (${fmtNum(daxp * 3600000 / elapsed)}/h)`);
        parts.push(`abyssal level ${s.abyssalLevel ?? '?'}/${s.abyssalCap ?? '?'}`);
        if (s.abyssalXPNextLevel) parts.push(`abyssal next level ETA ${fmtDuration((s.abyssalXPNextLevel - s.abyssalXP) / axpPerMs)}`);
        if (s.abyssalXPNextTen) parts.push(`abyssal level ${Math.min(s.abyssalCap ?? 60, Math.ceil(((s.abyssalLevel ?? 0) + 1) / 10) * 10)} ETA ${fmtDuration((s.abyssalXPNextTen - s.abyssalXP) / axpPerMs)}`);
        if (s.abyssalXPCap) parts.push(`abyssal cap ${s.abyssalCap} ETA ${fmtDuration((s.abyssalXPCap - s.abyssalXP) / axpPerMs)}`);
        if (!s.abyssalXPNextLevel && !s.abyssalXPNextTen && !s.abyssalXPCap)
          parts.push('abyssal ETA unavailable until abyssal XP thresholds are mapped');
      }
      return parts.filter(Boolean).join('; ');
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
    const isIdle = /\bidle\b|action stopped/i.test(label);
    const isSave = /save|source-of-truth/i.test(label);
    const isRunway = /quiver|consumable|summon|food equipped|runway/i.test(label);
    const isTask = /slayer task|finish |ETA/i.test(label) && !isRunway;
    const actionable = isSave || / -> .*available x[1-9]\d*/i.test(label) || /; \d+ actions; [\d.]+ h runway;/i.test(label) || /\bfinish\b/i.test(label);
    const priority = isIdle || (isAlert && isSave) ? 'critical'
      : (isAlert || actionable || (etaSeconds !== null && etaSeconds <= 3600)) ? 'high'
        : isRunway || isTask ? 'medium' : 'low';
    insights.push({
      id: sha(`${source}|${key}`),
      type: isIdle ? 'idle' : isSave ? 'source_of_truth' : isRunway ? 'resource_runway' : isTask ? 'progress_eta' : actionable ? 'next_decision' : 'progress',
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
  return insights.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.label.localeCompare(b.label));
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
      decisions[e.status]?.push({ id: e.id, slot: e.slot, item: e.item, risk: e.risk, reason: e.reason, ts: e.ts });
    }
    characters[name] = { ...entry, decisions, history: recentJournalEntries(name) };
  }
  const actionsSummary = Object.fromEntries(ACTION_STATUSES.map(s => [s, 0]));
  for (const e of latest.values()) if (e.status in actionsSummary) actionsSummary[e.status]++;
  const allInsights = Object.values(characters).flatMap(c => c.analysis.insights || []);
  const staleMs = 24 * 3600 * 1000;
  return {
    generatedAt: now,
    account: {
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
function renderDashboard(snap) {
  const json = JSON.stringify(snap).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<title>Melvor CP</title>
<style>
:root {
  color-scheme: dark;
  --bg: #101413; --panel: #171d1b; --ink: #edf1ee; --muted: #9ba7a1;
  --accent: #e2b95f; --teal: #66b5a1; --warning: #e0a34a; --danger: #e06f61; --line: #34403b;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html, body { overflow-x: hidden; }
body {
  margin: 0 auto; max-width: 92rem; padding: 1rem; font-size: 14px; line-height: 1.4;
  color: var(--ink); background: var(--bg);
}
.brand { display: flex; align-items: center; gap: .6rem; }
.brand img { width: 2.4rem; height: 2.4rem; border-radius: .55rem; }
h1 { margin: 0; color: var(--accent); font-size: 1.55rem; letter-spacing: 0; }
.title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: .75rem; }
.title-row p { margin: 0; color: var(--muted); }
#refreshControls { display: flex; align-items: center; gap: .5rem; margin-bottom: .75rem; }
#refreshControls select, #refreshControls button { width: auto; }
#refreshStatus { color: var(--muted); }
#setup { margin-bottom: .75rem; padding: .65rem .8rem; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
#setup summary { cursor: pointer; color: var(--accent); }
#setup ol { margin: .55rem 0 0; padding-left: 1.2rem; color: var(--muted); }
#start { margin-bottom: .75rem; padding: .85rem; border: 1px solid var(--accent); border-radius: 8px; background: #211d14; }
#start h2 { margin: 0 0 .5rem; color: var(--accent); font-size: 1rem; }
.start-item { display: grid; grid-template-columns: 8rem 1fr; gap: .75rem; padding: .35rem 0; border-top: 1px solid #51462e; }
.start-item:first-of-type { border-top: 0; }
.start-item strong { color: var(--ink); }
#summary { display: grid; grid-template-columns: repeat(4, minmax(7rem, 1fr)); border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.stat { min-width: 0; padding: .65rem .75rem; border-right: 1px solid var(--line); }
.stat:last-child { border-right: 0; }
.stat b { display: block; color: var(--accent); font-size: 1.08rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat span { color: var(--muted); font-size: .72rem; text-transform: uppercase; }
#filterBox { margin: .75rem 0; color: var(--muted); }
#filterBox > summary { cursor: pointer; width: fit-content; }
#filters { display: grid; grid-template-columns: minmax(13rem, 2fr) repeat(4, minmax(8rem, 1fr)) auto; gap: .5rem; margin-top: .55rem; align-items: center; }
button, input, select { min-width: 0; width: 100%; font: inherit; color: var(--ink); background: #111614; border: 1px solid var(--line); border-radius: 4px; padding: .45rem .55rem; }
button { cursor: pointer; }
button:hover { border-color: var(--accent); }
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid #e2b95f77; outline-offset: 1px; }
.check { display: flex; align-items: center; gap: .4rem; white-space: nowrap; color: var(--muted); }
.check input { width: auto; }
.column-head, .character-head { display: grid; grid-template-columns: 1fr 1fr 2.5fr; gap: .75rem; min-width: 0; }
.column-head { padding: .35rem .75rem; color: var(--muted); font-size: .72rem; text-transform: uppercase; }
.character { margin-bottom: .45rem; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.character[open] { border-color: #58675f; }
.character-head { cursor: pointer; padding: .68rem .75rem; align-items: center; list-style: none; }
.character-head::-webkit-details-marker { display: none; }
.character-head > * { min-width: 0; }
.identity strong { display: block; font-size: 1rem; }
.identity small { color: var(--muted); }
.identity-title { display: flex; align-items: center; gap: .35rem; min-width: 0; }
.identity-title .badge { margin: 0; }
.cell-value { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-label { display: none; }
.badge { display: inline-block; margin: .18rem .25rem 0 0; border: 1px solid; border-radius: 4px; padding: .05rem .35rem; font-size: .72rem; font-weight: 650; text-transform: uppercase; }
.badge.danger, .badge.risk { color: #ffd8d2; border-color: var(--danger); background: #4b211e; }
.badge.warning, .badge.stale { color: #ffe5b8; border-color: var(--warning); background: #493519; }
.badge.info, .badge.ok { color: #ccefe7; border-color: var(--teal); background: #163c34; }
.priority-critical { border-left: 3px solid var(--danger); }
.priority-high { border-left: 3px solid var(--line); }
.character-body { border-top: 1px solid var(--line); padding: .7rem .8rem .85rem; }
.tabs { display: flex; gap: .35rem; overflow-x: auto; margin-bottom: .7rem; }
.tabs button { width: auto; padding: .35rem .65rem; white-space: nowrap; }
.tabs button[aria-selected="true"] { color: #101413; border-color: var(--accent); background: var(--accent); }
.panel[hidden] { display: none; }
.panel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.group { min-width: 0; }
.group h3 { margin: 0 0 .3rem; color: var(--accent); font-size: .82rem; text-transform: uppercase; }
.insight, .plain-list li { margin: .25rem 0; overflow-wrap: anywhere; }
.insight .badge { margin-right: .45rem; }
.plain-list { margin: 0; padding-left: 1.1rem; }
.equipment-sheet { display: grid; gap: .7rem; }
.equipment-summary { display: flex; flex-wrap: wrap; gap: .35rem; }
.equipment-summary span { border: 1px solid var(--line); border-radius: 999px; padding: .2rem .45rem; color: var(--muted); font-size: .78rem; }
.equipment-summary strong { color: var(--teal); }
.equipment-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .4rem; }
.equipment-slot { min-width: 0; min-height: 4.25rem; padding: .45rem .5rem; border: 1px solid var(--line); border-radius: 5px; background: #111614; overflow-wrap: anywhere; }
.equipment-slot small { display: block; margin-bottom: .18rem; color: var(--muted); font-size: .7rem; text-transform: uppercase; }
.wiki-icon { display: inline-block; width: 1.1em; height: 1.1em; margin: 0 .3em 0 0; vertical-align: -0.2em; object-fit: contain; }
.equipment-slot::after { content: ""; display: block; clear: both; }
.equipment-grid[hidden] { display: none; }
.skills-grid, .inventory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: .45rem; }
.skills-grid { grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: .65rem; }
.inventory-grid { margin-top: .6rem; }
.skill-card, .inventory-item { min-width: 0; min-height: 4.2rem; padding: .45rem; border: 1px solid var(--line); border-radius: 5px; background: #111614; overflow-wrap: anywhere; }
.skill-card { padding: .7rem; border-left: 3px solid var(--skill-color, var(--accent)); }
.skill-card strong { display: flex; align-items: center; gap: .35rem; color: var(--skill-color, var(--accent)); }
.skill-card small, .inventory-item small { display: block; color: var(--muted); }
.skill-stat { margin-top: .5rem; font-size: .76rem; color: var(--muted); }
.skill-stat b { color: var(--text); font-weight: 600; }
.skill-meter { display: grid; grid-template-columns: 1fr auto; gap: .18rem .45rem; align-items: center; margin-top: .2rem; font-size: .68rem; color: var(--muted); }
.skill-meter progress { grid-column: 1 / -1; }
.skill-meter .skill-meter-value { color: var(--text); font-variant-numeric: tabular-nums; }
.skill-meter progress { width: 100%; height: .45rem; accent-color: var(--teal); }
.skill-meter.mastery progress { accent-color: var(--accent); }
.inventory-item { position: relative; min-height: 5rem; }
.inventory-item .wiki-icon { width: 1.1em; height: 1.1em; }
.inventory-qty { position: absolute; right: .35rem; bottom: .3rem; color: var(--accent); font-weight: 700; }
.equipment-slot.weapon, .equipment-slot.offhand { border-color: #706039; }
.equipment-slot.passive, .equipment-slot.consumable { border-color: #2d6255; }
.history-entry { padding: .45rem 0; border-bottom: 1px solid var(--line); }
.history-entry:last-child { border-bottom: 0; }
.history-entry time { color: var(--muted); font-size: .8rem; }
.muted { color: var(--muted); }
a { color: var(--accent); }
@media (max-width: 900px) {
  #summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  #filters { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  body { padding: .7rem; }
  .title-row { align-items: flex-start; flex-direction: column; gap: .15rem; }
  #refreshControls { align-items: stretch; flex-wrap: wrap; }
  #refreshStatus { width: 100%; }
  #summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .start-item { grid-template-columns: 1fr; gap: .1rem; }
  .stat { border-bottom: 1px solid var(--line); }
  .stat:nth-child(even) { border-right: 0; }
  #filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  #q { grid-column: 1 / -1; }
  .column-head { display: none; }
  .character-head { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem .7rem; }
  .identity { grid-column: 1 / -1; }
  .cell-label { display: block; color: var(--muted); font-size: .68rem; text-transform: uppercase; }
  .cell-value { white-space: normal; overflow-wrap: anywhere; }
  .panel-grid, .equipment-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
<body>
<header class="title-row"><div class="brand"><img src="/assets/mpt-crest.png" alt=""><h1>Melvor CP</h1></div><p id="scanTime"></p></header>
<section id="refreshControls" aria-label="Refresh journal"><select id="refreshCharacter"><option value="all">all characters</option></select><button id="refreshButton" type="button">Refresh</button><span id="refreshStatus"></span></section>
<details id="setup"><summary>Account setup</summary><ol><li>Sign in through the official Melvor page in the shared browser profile.</li><li>Set your character roster in <code>.env.local</code>.</li><li>Use Refresh to build the first local journal.</li></ol><p><a href="https://melvoridle.com/" target="_blank" rel="noopener">Open Melvor sign-in</a> · MPT never stores your credentials.</p></details>
<section id="start"><h2>Start here</h2></section>
<div id="summary"></div>
<details id="filterBox"><summary>Advanced filters</summary><div id="filters">
  <input id="q" type="search" placeholder="character, activity, or item">
  <select id="fAction"><option value="">all activities</option></select>
  <select id="fRisk"><option value="">all saves</option><option value="risk">save risk</option><option value="ok">save safe</option></select>
  <select id="fStatus"><option value="">all statuses</option></select>
  <select id="fPriority"><option value="">all priorities</option><option value="critical">critical</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select>
  <label class="check"><input id="fAttention" type="checkbox"> needs attention</label>
</div></details>
<div class="column-head" aria-hidden="true"><span>Character</span><span>Current</span><span>Next</span></div>
<div id="cards"></div>
<script id="data" type="application/json">${json}</script>
<script>
const snap = JSON.parse(document.getElementById('data').textContent);
const STATUSES = ['proposed', 'approved', 'done', 'blocked', 'dismissed', 'stale'];
const RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const isStale = name => snap.account.staleCharacters.includes(name);
const hasRisk = name => snap.account.saveRisks.includes(name);
const insights = c => (c.analysis.insights || []).filter(i => !/^standard level capped;/i.test(i.label));
const priority = c => insights(c)[0]?.priority || 'low';
const score = c => c.observed.totalLevel || 0;
const short = (text, max = 88) => text && text.length > max ? text.slice(0, max - 1) + '…' : text;
const isAutomaticTask = label => /^current combat: finish Slayer task/i.test(label || '');
const nextAction = decision => short((decision?.label || 'Nothing: let it run').replace(/^current [^:]+:\s*/i, '').split(';')[0], 64);
const current = c => {
  const combat = c.observed.combat;
  if (c.observed.action === 'Combat' && combat?.slayerTask) return 'Combat · ' + combat.slayerTask.monster + ' (' + combat.slayerTask.left + ' left)';
  return c.observed.action || 'Idle';
};
const attention = (name, c) => hasRisk(name) || isStale(name) || insights(c).some(i => i.severity === 'danger' || i.severity === 'warning');
const fmtEta = seconds => seconds < 3600 ? Math.round(seconds / 60) + ' min' : seconds < 172800 ? Math.round(seconds / 3600) + ' h' : Math.round(seconds / 86400) + ' d';
const relative = value => { const min = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000)); return min < 1 ? 'just now' : min < 60 ? min + 'm ago' : min < 1440 ? Math.round(min / 60) + 'h ago' : Math.round(min / 1440) + 'd ago'; };
document.getElementById('scanTime').textContent = 'Scanned ' + new Date(snap.generatedAt).toLocaleString('en-GB');
const refreshCharacter = document.getElementById('refreshCharacter');
for (const name of Object.keys(snap.characters).sort()) refreshCharacter.append(new Option(name, name));
const refreshButton = document.getElementById('refreshButton');
const refreshStatus = document.getElementById('refreshStatus');
if (location.protocol !== 'http:' && location.protocol !== 'https:') {
  refreshButton.textContent = 'Copy command';
  refreshStatus.textContent = 'Start journal-serve to refresh from this page.';
}
refreshButton.addEventListener('click', async () => {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    await navigator.clipboard?.writeText('./melvor-report.js journal-serve');
    refreshStatus.textContent = 'Copied: ./melvor-report.js journal-serve';
    return;
  }
  refreshButton.disabled = true;
  refreshStatus.textContent = 'Refreshing…';
  try {
    const response = await fetch('/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ character: refreshCharacter.value }) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'refresh failed');
    location.reload();
  } catch (error) {
    refreshStatus.textContent = error.message;
    refreshButton.disabled = false;
  }
});

const urgent = Object.entries(snap.characters)
  .map(([name, c]) => [name, hasRisk(name)
    ? { priority: 'critical', label: 'Local save is newer than cloud: do not load cloud.' }
    : insights(c).find(i => !isAutomaticTask(i.label) && (i.severity === 'danger' || i.severity === 'warning')) || insights(c).find(i => !isAutomaticTask(i.label) && i.actionable)])
  .filter(([, item]) => item)
  .sort((a, b) => RANK[a[1].priority] - RANK[b[1].priority])
  .slice(0, 3);
const start = document.getElementById('start');
if (!urgent.length) start.append(el('p', 'muted', 'Nothing urgent. Let current activities continue.'));
for (const [name, item] of urgent) { const row = el('div', 'start-item'); row.append(el('strong', '', name), el('span', '', item.label)); start.append(row); }

const summary = document.getElementById('summary');
const operations = snap.account.operations || {};
const stat = (label, value) => { const d = el('div', 'stat'); d.append(el('b', '', String(value)), el('span', '', label)); summary.append(d); };
stat('characters', Object.keys(snap.characters).length);
stat('alerts', Object.values(snap.characters).flatMap(c => insights(c)).filter(i => i.severity === 'danger' || i.severity === 'warning').length);
stat('complete within 1 h', (operations.nearTermCompletions || []).length);
stat('save risks', snap.account.saveRisks.length);

const fAction = document.getElementById('fAction');
for (const a of [...new Set(Object.values(snap.characters).map(c => c.observed.action || 'idle'))].sort()) fAction.append(new Option(a, a));
const fStatus = document.getElementById('fStatus');
for (const s of STATUSES) fStatus.append(new Option(s, s));

const cards = document.getElementById('cards');
const wikiTerms = new Set();
const collectWikiTerms = value => {
  if (Array.isArray(value)) return value.forEach(collectWikiTerms);
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (['name', 'monster', 'boss', 'area', 'dungeon', 'skill', 'recipe', 'loot', 'target'].includes(key) && typeof entry === 'string' && entry.length > 2) wikiTerms.add(entry);
    else collectWikiTerms(entry);
  }
};
Object.values(snap.characters).forEach(collectWikiTerms);
const wikiPattern = new RegExp([...wikiTerms].sort((a, b) => b.length - a.length).map(RegExp.escape).join('|'), 'g');
const wikiText = text => {
  const fragment = document.createDocumentFragment(); const value = String(text || ''); let last = 0;
  for (const match of value.matchAll(wikiPattern)) { fragment.append(document.createTextNode(value.slice(last, match.index)), wiki(match[0])); last = match.index + match[0].length; }
  fragment.append(document.createTextNode(value.slice(last))); return fragment;
};
const list = items => { const ul = el('ul', 'plain-list'); for (const item of [...new Set(items)].filter(Boolean)) { const row = el('li'); row.append(wikiText(item)); ul.append(row); } return ul; };
const group = (title, items) => { if (!items.length) return null; const box = el('section', 'group'); box.append(el('h3', '', title), list(items)); return box; };
const panel = (name, groups) => { const body = el('div', 'panel panel-grid'); body.dataset.panel = name; for (const item of groups.filter(Boolean)) body.append(item); return body.children.length ? body : null; };
const insightPanel = items => {
  if (!items.length) return null;
  const body = el('div', 'panel'); body.dataset.panel = 'now';
  for (const item of items.slice(0, 10)) {
    const row = el('div', 'insight'); row.append(el('span', 'badge ' + item.severity, item.priority), wikiText(item.label)); body.append(row);
  }
  return body;
};
const equipmentSlots = [['Helmet', 'head'], ['Cape', 'cape'], ['Amulet', 'amulet'], ['Weapon', 'weapon'], ['Shield', 'off-hand'], ['Platebody', 'body'], ['Gloves', 'hands'], ['Platelegs', 'legs'], ['Boots', 'feet'], ['Ring', 'ring'], ['Quiver', 'ammo'], ['Passive', 'passive'], ['Consumable', 'consumable'], ['Gem', 'gem'], ['Enhancement1', 'enhancement I'], ['Enhancement2', 'enhancement II'], ['Enhancement3', 'enhancement III']];
const wiki = name => { const wrap = el('span'); wrap.dataset.wikiTitle = name; const link = el('a', '', name); link.href = 'https://wiki.melvoridle.com/w/' + encodeURIComponent(name.replace(/ /g, '_')); link.target = '_blank'; link.rel = 'noopener'; wrap.append(link); return wrap; };
const SKILL_COLORS = { Attack:'#dc3d3d', Strength:'#ef7f32', Defence:'#459eea', Hitpoints:'#e45858', Ranged:'#74bc52', Magic:'#a579e6', Prayer:'#ead760', Slayer:'#9a6c59', Woodcutting:'#6da74a', Fishing:'#4bb0d3', Firemaking:'#e66a32', Cooking:'#e8a74e', Mining:'#a9adb2', Smithing:'#88929c', Thieving:'#8a6b4e', Farming:'#75ad43', Fletching:'#6c9d56', Crafting:'#d795c5', Runecrafting:'#7a91e5', Herblore:'#75ad63', Agility:'#e7b24e', Summoning:'#b478e5', Astrology:'#475fa7', Township:'#b38a5d', Cartography:'#3a9bb6', Archaeology:'#b98452', Harvesting:'#80b55d', Corruption:'#8b507c' };
function equipmentSheet(c) {
  const equipment = el('section', 'panel equipment-sheet'); equipment.dataset.panel = 'equipment';
  const combat = c.observed.combat || {};
  const summary = el('div', 'equipment-summary');
  for (const [label, value] of [['style', combat.playerAttackType], ['damage', combat.playerDamageType], ['accuracy', Number.isFinite(combat.hitChance) ? Math.round(combat.hitChance) + '%' : null]]) {
    if (value) { const stat = el('span'); stat.append(document.createTextNode(label + ' : '), el('strong', '', value)); summary.append(stat); }
  }
  if (summary.children.length) equipment.append(summary);
  const renderSet = (items, key, hidden) => { const grid = el('div', 'equipment-grid'); grid.dataset.equipmentSet = key; grid.hidden = hidden; for (const [slot, label] of equipmentSlots) { const item = items[slot]; if (!item || item === 'Empty' || (slot === 'Shield' && item === items.Weapon)) continue; const row = el('div', 'equipment-slot ' + (slot === 'Weapon' ? 'weapon' : slot === 'Shield' ? 'offhand' : slot.toLowerCase())); row.append(el('small', '', label), wiki(String(item))); grid.append(row); } return grid; };
  const sets = [{ key: 'current', label: 'Current', items: c.observed.equipment || {} }, ...(c.observed.equipmentSets || []).map(set => ({ key: 'set-' + set.index, label: 'Set ' + (set.index + 1), items: set.items }))];
  const selector = el('div', 'tabs equipment-sets');
  for (const [index, set] of sets.entries()) { const button = el('button', '', set.label); button.type = 'button'; button.dataset.equipmentSet = set.key; button.setAttribute('aria-selected', String(index === 0)); selector.append(button); equipment.append(renderSet(set.items, set.key, index !== 0)); }
  equipment.prepend(selector);
  return equipment;
}
function upgradeSheet(c) {
  const plan = c.observed.upgradePlan;
  if (!plan || !Object.keys(plan.slots || {}).length) return null;
  const body = el('section', 'panel panel-grid'); body.dataset.panel = 'upgrades';
  const context = plan.context || {};
  const contextRow = el('section', 'group'); contextRow.append(el('h3', '', 'Context'));
  const contextText = context.kind === 'slayer_task' ? ['Slayer task: ', wiki(context.target || 'unknown'), document.createTextNode('; ' + (context.remaining ?? '?') + ' left; ' + context.refresh)] : context.kind === 'dungeon' ? ['Dungeon: ', wiki(context.target || 'unknown'), document.createTextNode('; strategy guide: '), wiki(context.target || 'unknown')] : ['Activity: ' + (context.target || 'unknown')];
  const contextLine = el('p'); contextLine.append(...contextText); contextRow.append(contextLine, el('p', '', 'Build: ' + (plan.attackType || 'unknown') + (plan.damageType ? ' / ' + plan.damageType : ''))); body.append(contextRow);
  const source = item => item.loot ? [document.createTextNode('loot: '), wiki(item.loot)] : item.craft ? [document.createTextNode('craft: ' + item.craft.skill + ' / '), wiki(item.craft.recipe)] : [document.createTextNode(item.source || 'source unknown')];
  const section = (title, kind) => { const box = el('section', 'group'); box.append(el('h3', '', title)); for (const [slot, entry] of Object.entries(plan.slots || {})) { const choice = entry[kind]; if (!choice) continue; const line = el('p'); line.append(document.createTextNode(slot + ': '), wiki(choice.primary.name), document.createTextNode(' ('), ...source(choice.primary), document.createTextNode(')' + (choice.primary.blocked?.length ? ' — blocked: ' + choice.primary.blocked.join(', ') : ''))); if (choice.alternatives?.length) { line.append(document.createTextNode(' | alternatives: ')); choice.alternatives.forEach((item, index) => { if (index) line.append(document.createTextNode(', ')); line.append(wiki(item.name)); }); } box.append(line); } return box.children.length > 1 ? box : null; };
  body.append(section('Next loot', 'loot'), section('Next craft', 'craft'));
  return body;
}
function skillsSheet(c) {
  const panel = el('section', 'panel'); panel.dataset.panel = 'skills';
  const skills = [...(c.observed.skills || [])].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  if (!skills.length) { panel.append(el('p', 'muted', 'Refresh this character to load skills.')); return panel; }
  const grid = el('div', 'skills-grid');
  const amount = value => Math.floor(value || 0).toLocaleString('en-GB');
  const stat = (label, value) => { const row = el('div', 'skill-stat'); row.append(document.createTextNode(label), el('b', '', value)); return row; };
  const meter = (kind, label, value, start, end) => {
    if (!Number.isFinite(end) || end <= start) return null;
    const row = el('div', 'skill-meter ' + kind); const progress = document.createElement('progress'); progress.max = 100; progress.value = Math.max(0, Math.min(100, (value - start) / (end - start) * 100));
    row.append(el('span', '', label), el('span', 'skill-meter-value', Math.round(progress.value) + '% · ' + amount(value - start) + ' / ' + amount(end - start)), progress); return row;
  };
  for (const skill of skills) {
    const card = el('div', 'skill-card');
    card.style.setProperty('--skill-color', skill.color || SKILL_COLORS[skill.name] || 'var(--accent)');
    const title = el('strong'); title.append(wiki(skill.name));
    card.append(title, stat('Level ', skill.level + '/' + skill.levelCap));
    const levelMeter = meter('xp', 'XP', skill.xp, skill.xpLevelStart, skill.xpNextLevel); if (levelMeter) card.append(levelMeter);
    if (skill.abyssalLevel !== null && skill.abyssalLevel !== undefined) {
      card.append(stat('Abyssal ', skill.abyssalLevel + '/' + skill.abyssalCap));
      const abyssMeter = meter('abyss', 'AXP', skill.abyssalXP, skill.abyssalXPLevelStart, skill.abyssalXPNextLevel); if (abyssMeter) card.append(abyssMeter);
    }
    for (const pool of skill.masteryPools || []) { const masteryMeter = meter('mastery', pool.realm.replace(' Realm', '') + ' M', pool.xp, 0, pool.cap); if (masteryMeter) { masteryMeter.title = amount(pool.xp) + ' / ' + amount(pool.cap) + ' mastery pool XP'; card.append(masteryMeter); } }
    if (!skill.masteryPools?.length) card.append(stat('Mastery ', 'not applicable'));
    grid.append(card);
  }
  panel.append(grid);
  return panel;
}
function inventorySheet(c) {
  const panel = el('section', 'panel'); panel.dataset.panel = 'inventory';
  const inventory = c.observed.inventory || [];
  if (!inventory.length) { panel.append(el('p', 'muted', 'Refresh this character to load inventory.')); return panel; }
  const filter = document.createElement('input'); filter.type = 'search'; filter.placeholder = 'Filter inventory…'; filter.setAttribute('aria-label', 'Filter inventory');
  const sort = document.createElement('select'); sort.setAttribute('aria-label', 'Sort inventory'); sort.append(new Option('Quantity', 'quantity'), new Option('Name', 'name'));
  const grid = el('div', 'inventory-grid');
  const show = () => { grid.replaceChildren(); for (const item of [...inventory].sort(sort.value === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))) { const cell = el('div', 'inventory-item'); cell.dataset.inventoryName = item.name.toLowerCase(); const name = el('small'); name.append(wiki(item.name)); cell.append(name, el('span', 'inventory-qty', '×' + item.quantity)); grid.append(cell); } loadWikiIcons(); };
  show();
  filter.addEventListener('input', () => { const query = filter.value.toLowerCase(); for (const cell of grid.children) cell.hidden = query && !cell.dataset.inventoryName.includes(query); });
  sort.addEventListener('change', show);
  panel.append(filter, sort, grid);
  return panel;
}
function render() {
  const q = document.getElementById('q').value.toLowerCase();
  const wantAction = fAction.value, wantRisk = document.getElementById('fRisk').value, wantStatus = fStatus.value, wantPriority = document.getElementById('fPriority').value;
  const attentionOnly = document.getElementById('fAttention').checked;
  cards.replaceChildren();
  const entries = Object.entries(snap.characters).sort((a, b) => score(b[1]) - score(a[1]) || RANK[priority(a[1])] - RANK[priority(b[1])] || a[0].localeCompare(b[0]));
  for (const [name, c] of entries) {
    const action = c.observed.action || 'idle';
    const haystack = (name + ' ' + action + ' ' + JSON.stringify(insights(c)) + ' ' + JSON.stringify(c.observed.equipment || {}) + ' ' + JSON.stringify(c.decisions)).toLowerCase();
    if (q && !haystack.includes(q)) continue;
    if (wantAction && action !== wantAction) continue;
    if (wantRisk === 'risk' && !hasRisk(name)) continue;
    if (wantRisk === 'ok' && hasRisk(name)) continue;
    if (wantStatus && !(c.decisions[wantStatus] || []).length) continue;
    if (wantPriority && priority(c) !== wantPriority) continue;
    if (attentionOnly && !attention(name, c)) continue;

    const p = priority(c);
    const eta = insights(c).find(i => i.type === 'progress_eta' && i.etaSeconds !== undefined) || insights(c).find(i => i.type === 'progress_eta');
    const concern = insights(c).find(i => i.severity === 'danger' || i.severity === 'warning');
    const decision = (concern && !isAutomaticTask(concern.label) ? concern : null) || insights(c).find(i => !isAutomaticTask(i.label) && i.actionable);
    const progress = eta?.etaSeconds && eta.metric ? fmtEta(eta.etaSeconds) + ' · ' + eta.metric.toLocaleString() + ' ' + eta.unit + ' left' : eta?.label || 'No ETA yet';
    const details = el('details', 'character priority-' + p);
    const head = el('summary', 'character-head');
    const identity = el('div', 'identity');
    const identityTitle = el('div', 'identity-title');
    identityTitle.append(el('strong', '', name), el('span', 'badge info', 'score ' + score(c).toLocaleString('fr-FR')));
    if (p === 'critical') identityTitle.append(el('span', 'badge danger', p));
    identity.append(identityTitle, el('small', '', (c.observed.mode || '') + ' · ' + relative(c.observed.at)));
    if (hasRisk(name)) identity.append(el('span', 'badge risk', 'save risk'));
    const cell = (label, value) => { const n = el('div', 'cell'); const text = el('span', 'cell-value'); text.append(value || '—'); n.append(el('span', 'cell-label', label), text); return n; };
    head.append(identity, cell('Current', wikiText(current(c) + (eta?.etaSeconds ? ' · ' + fmtEta(eta.etaSeconds) : ''))), cell('Next', wikiText(nextAction(decision))));
    details.append(head);

    const body = el('div', 'character-body');
    const equipment = equipmentSheet(c);
    const history = el('div', 'panel'); history.dataset.panel = 'history';
    for (const h of c.history || []) {
      const row = el('div', 'history-entry'); row.append(el('time', '', new Date(h.at).toLocaleString()));
      const lines = [...new Set([...(h.currentActionPlan || []), ...(h.progressEtas || []), ...(h.recommendations || [])])].slice(0, 5);
      if (lines.length) row.append(list(lines)); history.append(row);
    }
    const actions = STATUSES.flatMap(s => (c.decisions[s] || []).map(a => s + ': ' + a.item + ' in ' + a.slot + ' - ' + a.reason));
    const panels = [
      insightPanel(insights(c)),
      panel('progress', [group('Level ETA', c.analysis.progressEtas || []), group('Standard lows', (c.observed.standard?.lowest || []).slice(0, 6).map(s => s.name + ' ' + s.level + '/' + s.cap)), group('Abyssal lows', (c.observed.abyssal?.lowest || []).slice(0, 6).map(s => s.name + ' ' + s.abyssalLevel + '/' + s.abyssalCap))]),
      equipment,
      upgradeSheet(c),
      skillsSheet(c),
      inventorySheet(c),
      panel('plans', [group('Standard plan', c.analysis.standardPlan || []), group('Abyssal plan', c.analysis.abyssalPlan || []), group('Decisions', actions), group('Risk notes', c.analysis.riskNotes || [])]),
      history.children.length ? history : null,
    ].filter(Boolean);
    const tabs = el('div', 'tabs'); tabs.setAttribute('role', 'tablist');
    for (const [index, content] of panels.entries()) {
      const tabName = content.dataset.panel;
      const btn = el('button', '', ({ now: 'Now', progress: 'Progress', equipment: 'Equipment', upgrades: 'Upgrade plans', skills: 'Skills', inventory: 'Inventory', plans: 'Plans', history: 'History' })[tabName] || tabName); btn.type = 'button'; btn.dataset.tab = tabName; btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      content.hidden = index !== 0; tabs.append(btn); body.append(content);
    }
    body.prepend(tabs);
    const footer = el('p', 'muted'); const link = el('a', '', 'Full Markdown journal'); link.href = encodeURIComponent(name) + '.md'; footer.append(link); body.append(footer);
    details.append(body);
    cards.append(details);
  }
  if (!cards.children.length) cards.append(el('p', 'muted', 'No characters match these filters.'));
}
async function loadWikiIcons() {
  const slots = [...document.querySelectorAll('[data-wiki-title]')].filter(slot => !slot.dataset.wikiLoaded);
  for (const slot of slots) slot.dataset.wikiLoaded = '1';
  const byTitle = new Map(slots.map(slot => [slot.dataset.wikiTitle, []]));
  for (const slot of slots) byTitle.get(slot.dataset.wikiTitle).push(slot);
  const titles = [...byTitle.keys()];
  for (let i = 0; i < titles.length; i += 50) {
    const query = new URLSearchParams({ action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '64', format: 'json', origin: '*' });
    try {
      const response = await fetch('https://wiki.melvoridle.com/api.php?' + query);
      const data = await response.json();
      for (const page of Object.values(data.query?.pages || {})) {
        const image = page.thumbnail?.source;
        for (const slot of byTitle.get(page.title) || []) {
          if (!image) continue;
          const icon = el('img', 'wiki-icon'); icon.src = image; icon.alt = ''; icon.loading = 'lazy'; slot.prepend(icon);
        }
      }
    } catch { /* Wiki unavailable: the item name remains visible. */ }
  }
}
for (const id of ['q', 'fAction', 'fRisk', 'fStatus', 'fPriority', 'fAttention']) document.getElementById(id).addEventListener('input', () => { render(); loadWikiIcons(); });
cards.addEventListener('click', e => {
  const set = e.target.closest('[data-equipment-set]');
  if (set) { const sheet = set.closest('.equipment-sheet'); for (const button of sheet.querySelectorAll('[data-equipment-set]')) button.setAttribute('aria-selected', String(button === set)); for (const grid of sheet.querySelectorAll('.equipment-grid')) grid.hidden = grid.dataset.equipmentSet !== set.dataset.equipmentSet; loadWikiIcons(); return; }
  const btn = e.target.closest('[data-tab]'); if (!btn) return;
  const body = btn.closest('.character-body');
  for (const tab of body.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', String(tab === btn));
  for (const panel of body.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== btn.dataset.tab;
});
render();
loadWikiIcons();
</script>
</body>
</html>
`;
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
        ? send(res, 200, renderDashboard(snapshot), 'text/html; charset=utf-8')
        : send(res, 404, JSON.stringify({ error: 'journal missing; run journal --record first' }));
    }
    if (req.method === 'GET' && ['/assets/mpt-crest.png', '/assets/favicon.png'].includes(url.pathname)) {
      try { return send(res, 200, fs.readFileSync(path.join(__dirname, url.pathname)), 'image/png'); } catch { return send(res, 404, JSON.stringify({ error: 'not found' })); }
    }
    if (req.method === 'GET' && /^\/[A-Za-z0-9_-]+\.md$/.test(url.pathname)) {
      const name = path.basename(url.pathname, '.md');
      if (!CHARS.includes(name)) return send(res, 404, JSON.stringify({ error: 'not found' }));
      try { return send(res, 200, fs.readFileSync(path.join(JOURNAL_DIR, `${name}.md`)), 'text/markdown; charset=utf-8'); } catch { return send(res, 404, JSON.stringify({ error: 'not found' })); }
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
      const child = spawn(process.execPath, [__filename, 'journal', character, '--record'], { cwd: __dirname, env: process.env, stdio: 'ignore' });
      child.on('error', error => { refreshing = false; send(res, 500, JSON.stringify({ error: sanitizeIncident(error.message) })); });
      child.on('exit', code => { refreshing = false; send(res, code === 0 ? 200 : 500, JSON.stringify(code === 0 ? { ok: true } : { error: `journal refresh failed (exit ${code})` })); });
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
  return withCharacterSource(name, save?.source, client => evalExpr(client, `(() => {
    const wanted = ${JSON.stringify(JOURNAL_WANTED)};
    const qty = n => { for (const [item, bi] of game.bank.items) if (item.name === n) return bi.quantity; return 0; };
    const skills = mh.skills();
    const targets = [...new Set([
      ...skills.filter(s => s.level < (s.levelCap ?? 120)).sort((a, b) => a.level - b.level).slice(0, 6),
      ...skills.filter(s => (s.abyssalLevel ?? 0) < (s.abyssalCap ?? 0)).sort((a, b) => a.abyssalLevel - b.abyssalLevel).slice(0, 6),
    ].map(s => s.name))];
    const equipmentSets = game.combat.player.equipmentSets.map((set, index) => ({ index, items: Object.fromEntries(set.equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => [slot.slot.localID, slot.item.name])) }));
    const inventory = [...game.bank.items].map(([item, entry]) => ({ name: item.name, quantity: entry.quantity, media: item.media || null })).sort((a, b) => a.name.localeCompare(b.name));
    const values = value => value instanceof Map ? [...value.values()] : value instanceof Set ? [...value] : Array.isArray(value) ? value : value?.allObjects ?? [];
    const talents = game.skills.allObjects.flatMap(skill => values(skill.skillTrees).map(tree => ({ skill: skill.name, points: tree.points || 0, candidates: values(tree.nodes).filter(node => node.canUnlock && tree.canAffordNode(node) && !values(tree.unlockedNodes).includes(node)).map(node => ({ name: node.name, shortName: node.shortName })) }))).filter(tree => tree.points > 0);
    const out = { report: mh.readOnlyReport(), skills, skilling: mh.skillingAudit(), skillingOptions: Object.fromEntries(targets.map(n => [n, mh.skillingOptions(n)])), bank: Object.fromEntries(wanted.map(n => [n, qty(n)])), equipmentSets, inventory, talents, upgradePlan: mh.upgradePlan() };
    if (${JSON.stringify(includeSaveBackup)}) out.saveExport = mh.exportSaveString();
    return out;
  })()`));
}

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
function runJournalAction(id, status) {
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
  console.log(`${id} -> ${status} (${prev.character}: ${prev.item} in ${prev.slot})`);
}

async function runJournal() {
  const { sources } = await readSourcesByName();
  const chars = [];
  const backupEntries = [];
  for (const name of names) {
    const data = await collectJournal(name, sources[name], saveBackup);
    if (saveBackup) backupEntries.push(recordSaveBackup(name, sources[name], data.saveExport));
    chars.push(buildCharacterJournal(name, data, sources[name]));
  }
  for (const b of backupEntries) console.log(`recorded ${b.path} (${b.character}, ${b.source}, ${b.hash})`);
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
    // ponytail: kill(pid, 0) treats EPERM as alive — fine, this tool only locks its own pids
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

module.exports = { planActions, buildCharacterJournal, journalMd, mergeLedger, buildLatest, renderDashboard, sourceOfTruth, potionItemName, readLedger, journalRefreshSummary, sanitizeIncident, incidentSignature, readIncidents, incidentCandidates, promoteIncidentCandidates, structuredInsights, equipmentActionScript, skillStartScript, talentUnlockScript };
if (require.main === module) (async () => {
  if (cmd === 'journal-serve') return runJournalServer();
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

    if (cmd === 'save-backup') {
      await runSaveBackup();
      return;
    }

    if (cmd === 'combat-run') {
      if (who === 'all' || !arg3) throw Error('usage: ./melvor-report.js combat-run <character> <dungeon name|id>');
      const data = await withCharacterWrite(who, client =>
        evalExpr(client, combatRunScript(arg3, process.env.MELVOR_COMBAT_RUN_TIMEOUT_MS || 10 * 60 * 1000), Number(process.env.MELVOR_COMBAT_RUN_TIMEOUT_MS || 10 * 60 * 1000) + 60000));
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

    if (cmd === 'equip' || cmd === 'skill-start' || cmd === 'talent-unlock') {
      if (who === 'all' || !arg3 || !arg4) {
        const usage = cmd === 'equip' ? 'equip <character> <item> <slot>' : `${cmd} <character> <skill> <${cmd === 'skill-start' ? 'recipe' : 'node'}>`;
        throw Error(`usage: ./melvor-report.js ${usage} [--apply]`);
      }
      const script = cmd === 'equip'
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
        if (cmd === 'talents') return evalExpr(client, `(() => {
          const values = value => value instanceof Map ? [...value.values()] : value instanceof Set ? [...value] : Array.isArray(value) ? value : value?.allObjects ?? [];
          const talents = game.skills.allObjects.flatMap(skill => values(skill.skillTrees).map(tree => ({ skill: skill.name, points: tree.points || 0, candidates: values(tree.nodes).filter(node => node.canUnlock && tree.canAffordNode(node) && !values(tree.unlockedNodes).includes(node)).map(node => ({ name: node.name, shortName: node.shortName })) }))).filter(tree => tree.points > 0);
          return { report: mh.readOnlyReport(), talents };
        })()`);
        if (cmd === 'plan') return evalExpr(client, `(() => {
          const wanted = ['Octopus','Potion Stirrer','Bear','Jeweled Necklace','Book of Scholars','Ancient Ring of Mastery','Golden Star','Eagle'];
          const qty = name => { for (const [item, bi] of game.bank.items) if (item.name === name) return bi.quantity; return 0; };
          return { report: mh.readOnlyReport(), bank: Object.fromEntries(wanted.map(name => [name, qty(name)])) };
        })()`);
        if (cmd === 'audit') return evalExpr(client, `(() => {
          const gear = mh.gearAudit(game.combat.player.attackType, 2);
          return { report: mh.readOnlyReport(), skilling: mh.skillingAudit(), gear: {
            context: gear.context,
            equipped: gear.equipped,
            candidates: gear.candidates,
          } };
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
      else if (cmd === 'agility') console.log(JSON.stringify(data));
      else if (cmd === 'talents') {
        console.log(`${data.report.name}: ${data.report.action || 'idle'}`);
        for (const line of talentAdvice(data.report, data.talents)) console.log(`  ${line}`);
        for (const talent of data.talents.filter(talent => talent.candidates.length)) console.log(`  available: ${talent.skill} ${talent.points} point(s) -> ${talent.candidates.map(node => node.shortName || node.name).join(', ')}`);
      }
      else if (cmd === 'audit') printAudit(data);
      else if (cmd === 'plan') printPlan(data);
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
