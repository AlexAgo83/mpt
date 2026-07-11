#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

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
const helper = fs.readFileSync(path.join(__dirname, 'melvor-helpers.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
const saveBackup = argv.includes('--save-backup');
const [cmd = 'summary', who = 'all', arg3] = argv.filter(a => !['--record', '--abyssal', '--save-backup'].includes(a));
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
  ./melvor-report.js gear <character>
  ./melvor-report.js skilling <character>
  ./melvor-report.js export-state [all|character]
  ./melvor-report.js save-backup [all|character]
  ./melvor-report.js journal [all|character] [--record] [--save-backup]
  ./melvor-report.js journal-status [all|character]
  ./melvor-report.js journal-diff [all|character]
  ./melvor-report.js journal-action <id> <approved|dismissed|done|blocked>

Most commands are read-only. combat-setup and combat-run write, save, then verify source-of-truth.
journal prints a Markdown entry; --record appends it under journal/ and
refreshes journal/latest.json, journal/actions.jsonl and journal/index.html.`;
if (require.main === module) {
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(usage);
    process.exit(0);
  }
  if (!['summary', 'brief', 'gear', 'skilling', 'audit', 'slots', 'smoke', 'login-smoke', 'diff-slots', 'source-of-truth', 'improve', 'plan', 'combat-plan', 'combat-setup', 'combat-run', 'export-state', 'save-backup', 'journal', 'journal-status', 'journal-diff', 'journal-action'].includes(cmd)) {
    console.error(usage);
    process.exit(2);
  }
}

if (require.main === module && who === 'all' && !['slots', 'smoke', 'login-smoke'].includes(cmd) && !CHARS.length) {
  console.error('Set MELVOR_CHARACTERS in .env.local, comma-separated, to use all-character commands.');
  process.exit(2);
}

const names = who === 'all' ? CHARS : [who];
const recordImprovement = cmd === 'improve' && record;
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
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails));
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
  for (const [slot, item] of Object.entries(r.equipped)) console.log(`  ${slot}: ${item.name}`);
  const prefixes = scorePrefixes(r.context?.attackType);
  for (const [slot, items] of Object.entries(r.candidates)) {
    const best = items[0];
    if (best && best.name !== r.equipped[slot]?.name && scoreItem(best, prefixes) > scoreItem(r.equipped[slot], prefixes))
      console.log(`  raw candidate ${slot}: ${best.name}`);
  }
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
    if (eq[slot] === item) return;
    actions.push({ type: 'equip', slot, item, current: eq[slot] || 'empty', available: bank[item] || 0, reason,
      risk: r.report.mode === 'Hardcore Mode' ? 'medium' : 'low' });
  };
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
  return planActions(r).map(a => `${a.slot}: ${a.current} -> ${a.item} (${a.available > 0 ? `available x${a.available}` : 'not in bank'}; ${a.reason})`);
}

function currentActionPlan(r) {
  const report = r.report;
  const eq = report.equipment || {};
  const lines = [...(report.actionEstimate?.notes || []), ...(r.skilling?.notes || []), ...planLines(r)];
  const add = note => { if (!lines.includes(note)) lines.push(note); };
  const action = report.action || 'idle';
  if (action === 'idle') {
    add('current action: idle, no task is running');
    add('current action: choose a new task or restart the previous one after checking resources');
  } else if (action === 'Combat') {
    const c = report.combat || {};
    if (c.hitChance !== null && c.hitChance !== undefined && c.hitChance < 80)
      add(`current combat: low hit chance ${Math.round(c.hitChance)}%, prefer accuracy/prayer/potion before DPS`);
    if (!report.food || !report.foodQty) add('current combat: no food equipped');
    if (report.mode === 'Hardcore Mode') add('current combat: Hardcore, verify max hit and resistance before gear swaps');
    if (c.slayerTask?.monster) add(`current combat: finish Slayer task ${c.slayerTask.monster} (${c.slayerTask.left} left)`);
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
  return lines.slice(0, 8);
}

function combatGoalLines(report) {
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
const isAbyssalDungeon = d => /melvorItA/.test(d.id || '') || /Abyss/i.test(d.name || '');
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
  const saveRisk = !save || save.source === 'unknown'
    ? 'save source of truth unknown'
    : save.source === 'local' && save.diffMs > 5 * 60000
      ? `local save newer than cloud by ${Math.round(save.diffMs / 60000)} min`
      : null;
  const abyssalNext = [
    abyssalDungeons[0] ? `clear abyssal dungeon: ${abyssalDungeons[0].name}` : null,
    ...abyssalOpen.slice(0, 3).map(s => `raise abyssal ${s.name} (${s.abyssalLevel ?? 0}/${s.abyssalCap})`),
  ].filter(Boolean);
  const currentNext = currentActionPlan(data);
  const standardNext = [
    ...standardOpen.slice(0, 3).map(s => `raise standard ${s.name} (${s.level}/${s.levelCap ?? 120})`),
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
  }
}

const JOURNAL_DIR = path.join(__dirname, 'journal');
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
  const actions = planActions(data).map(a => ({ ...a, id: actionId(name, a), contextHash: actionContextHash(report, a) }));
  const saveRisk = !save || save.source === 'unknown'
    ? 'save source of truth unknown'
    : save.source === 'local' && save.diffMs > 5 * 60000
      ? `local save newer than cloud by ${Math.round(save.diffMs / 60000)} min`
      : null;
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
      skills: data.skills || [],
      lowSkills: report.lowSkills.slice(0, 6),
      combatGoals: report.combatGoals || null,
      currentAction: brief.currentAction,
      standard: brief.standard,
      abyssal: brief.abyssal,
      saveSource: save ? { source: save.source, diffMinutes: save.diffMs === null ? null : Math.round(save.diffMs / 60000) } : null,
    },
    analysis: {
      recommendations: brief.next,
      currentActionPlan: brief.currentAction.next,
      optimizationPlan: brief.standard.next,
      standardPlan: brief.standard.next,
      abyssalPlan: brief.abyssal.next,
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
    ...list(combatGoalLines({ combatGoals: o.combatGoals })),
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
  const negativeXP = skills.some(s => {
    const p = prevSkills[s.name];
    return p && ((s.xp || 0) < (p.xp || 0) || (s.abyssalXP || 0) < (p.abyssalXP || 0));
  });
  const standardCapped = skills.length && skills.every(s => (s.levelCap ?? 120) <= s.level);
  const abyssalProgress = lines.some(l => /abyssal XP gained/.test(l));
  const noProgress = lines.some(l => /no XP gain detected/.test(l));
  return [
    negativeXP ? 'current XP is lower than previous scan; verify source-of-truth before acting' : null,
    noProgress ? 'action active but no positive standard or abyssal XP was detected since the previous scan' : null,
    standardCapped && abyssalProgress ? 'standard level capped; current progress is abyssal XP' : null,
    standardCapped && !abyssalProgress && !noProgress ? 'standard level capped; standard ETA has no remaining target' : null,
  ].filter(Boolean);
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
    },
    characters,
    actionsSummary,
  };
}

function readLatestSnapshot() {
  try { return JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR, 'latest.json'), 'utf8')); } catch { return null; }
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
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Melvor Journal</title>
<style>
:root {
  color-scheme: dark;
  --bg: #111814;
  --panel: #1b261f;
  --panel2: #243226;
  --ink: #f2ead2;
  --muted: #b8aa83;
  --gold: #d8aa46;
  --green: #6ea36a;
  --red: #c9634b;
  --line: #5b4a2b;
  font-family: Georgia, "Times New Roman", serif;
}
body {
  margin: 0 auto;
  max-width: 76rem;
  padding: 1.2rem;
  font-size: 15px;
  line-height: 1.45;
  color: var(--ink);
  background: radial-gradient(circle at top, #273323 0, var(--bg) 34rem);
}
h1 { margin: 0 0 .9rem; color: var(--gold); font-size: 1.7rem; letter-spacing: 0; }
#summary { display: flex; flex-wrap: wrap; gap: .7rem 1.5rem; padding: .8rem 1rem; border: 1px solid var(--line); border-radius: 6px; background: #171f19d9; box-shadow: inset 0 0 0 1px #0008; }
#summary b { color: var(--gold); font-size: 1.12rem; }
#filters { display: flex; flex-wrap: wrap; gap: .55rem; margin: .9rem 0; align-items: center; }
button, input, select { font: inherit; color: var(--ink); background: #101711; border: 1px solid var(--line); border-radius: 4px; padding: .34rem .48rem; }
button { cursor: pointer; }
button:hover { border-color: var(--gold); }
button:focus, input:focus, select:focus { outline: 2px solid #d8aa4666; outline-offset: 1px; }
.card { border: 1px solid var(--line); border-radius: 6px; margin: .65rem 0; background: linear-gradient(180deg, var(--panel), #151d18); box-shadow: 0 10px 24px #0005; }
.card summary { cursor: pointer; padding: .7rem .9rem; display: flex; flex-wrap: wrap; gap: .45rem .85rem; align-items: baseline; border-bottom: 1px solid #0000; }
.card[open] summary { border-bottom-color: #0008; }
.card summary::-webkit-details-marker { display: none; }
.card .body { padding: .2rem .95rem .95rem; }
.badge { border: 1px solid; border-radius: 4px; padding: .02rem .4rem; font-size: .82em; font-family: ui-monospace, Menlo, monospace; }
.badge.risk { color: #ffd0c6; border-color: var(--red); background: #5d1f1688; font-weight: bold; }
.badge.stale { color: #ffe1a1; border-color: var(--gold); background: #4a351188; font-weight: bold; }
.badge.ok { color: #d9ffd5; border-color: var(--green); background: #193d2088; }
.muted { color: var(--muted); }
ul { margin: .2rem 0 .6rem; padding-left: 1.2rem; }
a { color: var(--gold); }
h3 { color: var(--gold); font-size: 1rem; margin: .75rem 0 .25rem; }
.history-link { margin-top: .45rem; }
#historyShade { position: fixed; inset: 0; background: #0009; opacity: 0; pointer-events: none; transition: opacity .16s ease; }
#historyDrawer { position: fixed; top: 0; right: 0; width: min(34rem, 92vw); height: 100vh; box-sizing: border-box; padding: 1rem; overflow: auto; background: #141d17; border-left: 1px solid var(--line); box-shadow: -18px 0 42px #0008; transform: translateX(100%); transition: transform .16s ease; }
body.history-open #historyShade { opacity: 1; pointer-events: auto; }
body.history-open #historyDrawer { transform: translateX(0); }
#historyHead { display: flex; gap: .7rem; align-items: center; justify-content: space-between; margin-bottom: .65rem; }
#historyHead h2 { margin: 0; color: var(--gold); font-size: 1.15rem; }
.history-entry { margin: .45rem 0; padding: .55rem .65rem; border-left: 3px solid var(--gold); background: #0f1712; border-radius: 0 4px 4px 0; }
.history-entry h4 { margin: 0 0 .25rem; color: var(--muted); font-size: .9rem; }
</style>
<body>
<h1>Melvor Journal</h1>
<div id="summary"></div>
<div id="filters">
  <input id="q" type="search" placeholder="search character / action / item">
  <select id="fAction"><option value="">any action</option></select>
  <select id="fRisk"><option value="">any risk</option><option value="risk">save risk</option><option value="ok">no save risk</option></select>
  <select id="fStatus"><option value="">any action status</option></select>
  <label><input id="fStale" type="checkbox"> stale only</label>
  <button id="historyToggle" type="button">history</button>
</div>
<div id="cards"></div>
<div id="historyShade"></div>
<aside id="historyDrawer" aria-hidden="true">
  <div id="historyHead"><h2>Journal history</h2><button id="historyClose" type="button">close</button></div>
  <div id="historyBody"></div>
</aside>
<script id="data" type="application/json">${json}</script>
<script>
const snap = JSON.parse(document.getElementById('data').textContent);
const STATUSES = ['proposed', 'approved', 'done', 'blocked', 'dismissed', 'stale'];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const isStale = name => snap.account.staleCharacters.includes(name);
const hasRisk = name => snap.account.saveRisks.includes(name);

const summary = document.getElementById('summary');
const stat = (label, value) => { const d = el('div'); d.append(el('b', '', String(value)), ' ', el('span', 'muted', label)); summary.append(d); };
stat('last scan', new Date(snap.generatedAt).toLocaleString());
stat('characters', Object.keys(snap.characters).length);
stat('save risks', snap.account.saveRisks.length);
stat('stale', snap.account.staleCharacters.length);
stat('proposed', snap.actionsSummary.proposed);
stat('approved', snap.actionsSummary.approved);
stat('blocked', snap.actionsSummary.blocked);

const fAction = document.getElementById('fAction');
for (const a of [...new Set(Object.values(snap.characters).map(c => c.observed.action || 'idle'))].sort()) fAction.append(new Option(a, a));
const fStatus = document.getElementById('fStatus');
for (const s of STATUSES) fStatus.append(new Option(s, s));

const cards = document.getElementById('cards');
const historyDrawer = document.getElementById('historyDrawer');
const historyBody = document.getElementById('historyBody');
function openHistory(onlyName) {
  historyBody.replaceChildren();
  const entries = Object.entries(snap.characters).filter(([name, c]) => (!onlyName || name === onlyName) && (c.history || []).length);
  if (!entries.length) historyBody.append(el('p', 'muted', 'no journal history'));
  for (const [name, c] of entries) {
    historyBody.append(el('h3', '', name));
    for (const h of c.history) {
      const box = el('div', 'history-entry');
      box.append(el('h4', '', new Date(h.at).toLocaleString()));
      const lines = [...(h.currentActionPlan || []).slice(0, 3), ...(h.progressEtas || []).slice(0, 2), ...(h.recommendations || []).slice(0, 3), ...(h.abyssalPlan || []).slice(0, 2)];
      const ul = el('ul');
      if (!lines.length) ul.append(el('li', 'muted', 'none'));
      for (const line of lines) ul.append(el('li', '', line));
      box.append(ul);
      historyBody.append(box);
    }
  }
  historyDrawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('history-open');
}
function closeHistory() {
  document.body.classList.remove('history-open');
  historyDrawer.setAttribute('aria-hidden', 'true');
}
function render() {
  const q = document.getElementById('q').value.toLowerCase();
  const wantAction = fAction.value, wantRisk = document.getElementById('fRisk').value, wantStatus = fStatus.value;
  const staleOnly = document.getElementById('fStale').checked;
  cards.replaceChildren();
  for (const [name, c] of Object.entries(snap.characters)) {
    const action = c.observed.action || 'idle';
    const haystack = (name + ' ' + action + ' ' + JSON.stringify(c.analysis.recommendations) + ' ' + JSON.stringify(c.analysis.currentActionPlan || []) + ' ' + JSON.stringify(c.analysis.progressEtas || []) + ' ' + JSON.stringify(c.analysis.standardPlan || []) + ' ' + JSON.stringify(c.analysis.abyssalPlan || []) + ' ' + JSON.stringify(c.decisions)).toLowerCase();
    if (q && !haystack.includes(q)) continue;
    if (wantAction && action !== wantAction) continue;
    if (wantRisk === 'risk' && !hasRisk(name)) continue;
    if (wantRisk === 'ok' && hasRisk(name)) continue;
    if (wantStatus && !(c.decisions[wantStatus] || []).length) continue;
    if (staleOnly && !isStale(name)) continue;

    const details = el('details', 'card');
    const head = el('summary');
    head.append(el('b', '', name), el('span', 'muted', action));
    if (hasRisk(name)) head.append(el('span', 'badge risk', 'SAVE RISK'));
    if (isStale(name)) head.append(el('span', 'badge stale', 'STALE'));
    if (!hasRisk(name) && !isStale(name)) head.append(el('span', 'badge ok', 'ok'));
    head.append(el('span', 'muted', 'seen ' + new Date(c.observed.at).toLocaleString()));
    details.append(head);

    const body = el('div', 'body');
    const abyssalMaxed = c.observed.abyssal?.maxed ? ' | abyssal ' + c.observed.abyssal.maxed : '';
    body.append(el('div', 'muted', 'total ' + c.observed.totalLevel + ' | maxed ' + c.observed.maxedSkills + abyssalMaxed + ' | GP ' + c.observed.gp.toLocaleString() + ' | ' + (c.observed.mode || '')));
    if (c.observed.saveBackup) {
      const b = c.observed.saveBackup;
      const p = el('p', 'muted');
      const link = el('a', '', 'save backup');
      link.href = b.path;
      p.append(link, ' ', new Date(b.ts).toLocaleString(), ' | ', b.source, ' | ', b.bytes.toLocaleString(), ' bytes | ', b.hash);
      body.append(p);
    }
    const section = (title, items, fmt) => {
      body.append(el('h3', '', title));
      const ul = el('ul');
      if (!items.length) ul.append(el('li', 'muted', 'none'));
      for (const it of items) ul.append(el('li', '', fmt ? fmt(it) : it));
      body.append(ul);
    };
    section('Top recommendations', c.analysis.recommendations.slice(0, 5));
    if (c.analysis.alerts?.length) section('Alerts', c.analysis.alerts.slice(0, 5));
    section('Current action', (c.analysis.currentActionPlan || c.observed.currentAction?.next || []).slice(0, 6));
    section('Level ETA', (c.analysis.progressEtas || []).slice(0, 6));
    section('Standard plan', (c.analysis.standardPlan || c.analysis.optimizationPlan || []).slice(0, 6));
    section('Abyssal plan', (c.analysis.abyssalPlan || []).slice(0, 6));
    if (c.observed.abyssal?.lowest?.length)
      section('Abyssal lows', c.observed.abyssal.lowest.slice(0, 6), s => s.name + ' ' + s.abyssalLevel + '/' + s.abyssalCap);
    if ((c.history || []).length) {
      const btn = el('button', 'history-link', 'history ' + c.history.length);
      btn.type = 'button';
      btn.dataset.historyName = name;
      body.append(btn);
    }
    for (const s of STATUSES) {
      const xs = c.decisions[s] || [];
      if (xs.length) section(s + ' actions', xs, a => '[' + a.id + '] equip ' + a.item + ' in ' + a.slot + ' (risk ' + a.risk + '; ' + a.reason + ')');
    }
    if (c.analysis.riskNotes.length) section('Risk notes', c.analysis.riskNotes);
    const p = el('p');
    const link = el('a', '', name + '.md');
    link.href = encodeURIComponent(name) + '.md';
    p.append('Journal: ', link);
    body.append(p);
    details.append(body);
    cards.append(details);
  }
  if (!cards.children.length) cards.append(el('p', 'muted', 'no character matches the filters'));
}
for (const id of ['q', 'fAction', 'fRisk', 'fStatus', 'fStale']) document.getElementById(id).addEventListener('input', render);
document.getElementById('historyToggle').addEventListener('click', () => openHistory());
document.getElementById('historyClose').addEventListener('click', closeHistory);
document.getElementById('historyShade').addEventListener('click', closeHistory);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHistory(); });
cards.addEventListener('click', e => {
  const btn = e.target.closest('[data-history-name]');
  if (btn) openHistory(btn.dataset.historyName);
});
render();
</script>
</body>
</html>
`;
}

async function collectJournal(name, save, includeSaveBackup = false) {
  return withCharacterSource(name, save?.source, client => evalExpr(client, `(() => {
    const wanted = ${JSON.stringify(JOURNAL_WANTED)};
    const qty = n => { for (const [item, bi] of game.bank.items) if (item.name === n) return bi.quantity; return 0; };
    const out = { report: mh.readOnlyReport(), skills: mh.skills(), skilling: mh.skillingAudit(), bank: Object.fromEntries(wanted.map(n => [n, qty(n)])) };
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
    let holderAlive = false;
    try { process.kill(Number(fs.readFileSync(LOCK, 'utf8').trim()), 0); holderAlive = true; } catch {}
    if (!holderAlive && retry) {
      try { fs.unlinkSync(LOCK); } catch {}
      return lock(false);
    }
    throw Error(`another melvor-report is already using port ${PORT}`);
  }
}

module.exports = { planActions, buildCharacterJournal, journalMd, mergeLedger, buildLatest, renderDashboard, sourceOfTruth, potionItemName, readLedger };
if (require.main === module) (async () => {
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
          const audit = mh.gearAudit(game.combat.player.attackType, 2);
          return { name: game.characterName, action: game.activeAction?.name ?? null, combat: mh.combatInfo(), context: audit.context, equipped: audit.equipped, candidates: audit.candidates };
        })()`);
      });
      if (cmd === 'summary') printSummary(data);
      else if (cmd === 'skilling') printSkilling({ name, ...data });
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
  console.error(e.message || e);
  process.exit(1);
});
