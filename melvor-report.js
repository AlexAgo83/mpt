#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.MELVOR_PORT || 9223);
const URL = 'https://melvoridle.com/index_game.php';
const CHARS = ['GrifhinZ', 'Rya', 'Dash', 'Edalbraw', 'Opa', 'Chap', 'Kang'];
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = process.env.MELVOR_PROFILE || `${process.env.HOME}/.cache/chrome-devtools-mcp/chrome-profile`;
const LOCK = path.join('/tmp', `melvor-report-${PORT}.lock`);
const helper = fs.readFileSync(path.join(__dirname, 'melvor-helpers.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const [cmd = 'summary', who = 'all'] = process.argv.slice(2);
if (!['summary', 'gear', 'skilling', 'audit'].includes(cmd)) {
  console.error('usage: node melvor-report.js summary|gear|skilling|audit [all|character]');
  process.exit(2);
}

const names = who === 'all' ? CHARS : [who];
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
    if (String(load).startsWith('refused:')) throw Error(load);
    await waitFor(client, `typeof game !== 'undefined' && game.loopStarted && game.characterName === ${JSON.stringify(name)}`, 150000);
    await sleep(1500);
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
  const prefixes = {
    melee: ['stabAttackBonus', 'slashAttackBonus', 'blockAttackBonus', 'meleeStrengthBonus', 'meleeDefenceBonus', 'resistance'],
    ranged: ['rangedAttackBonus', 'rangedStrengthBonus', 'rangedDefenceBonus', 'resistance'],
    magic: ['magicAttackBonus', 'magicDamageBonus', 'magicDefenceBonus', 'resistance'],
  }[r.context?.attackType] || [];
  const score = item => prefixes.reduce((sum, p) =>
    sum + Math.max(0, ...Object.entries(item?.stats || {}).filter(([k]) => k.startsWith(p)).map(([, v]) => v)), 0);
  for (const [slot, items] of Object.entries(r.candidates)) {
    const best = items[0];
    if (best && best.name !== r.equipped[slot]?.name && score(best) > score(r.equipped[slot]))
      console.log(`  raw candidate ${slot}: ${best.name}`);
  }
}

function printSkilling(r) {
  console.log(`${r.name} | ${r.action}`);
  for (const [slot, item] of Object.entries(r.equipment)) console.log(`  ${slot}: ${item}`);
  for (const note of r.notes) console.log(`  note: ${note}`);
}

function gearCandidates(r) {
  const prefixes = {
    melee: ['stabAttackBonus', 'slashAttackBonus', 'blockAttackBonus', 'meleeStrengthBonus', 'meleeDefenceBonus', 'resistance'],
    ranged: ['rangedAttackBonus', 'rangedStrengthBonus', 'rangedDefenceBonus', 'resistance'],
    magic: ['magicAttackBonus', 'magicDamageBonus', 'magicDefenceBonus', 'resistance'],
  }[r.context?.attackType] || [];
  const score = item => prefixes.reduce((sum, p) =>
    sum + Math.max(0, ...Object.entries(item?.stats || {}).filter(([k]) => k.startsWith(p)).map(([, v]) => v)), 0);
  return Object.entries(r.candidates || {})
    .map(([slot, items]) => [slot, items[0]])
    .filter(([slot, best]) => best && best.name !== r.equipped[slot]?.name && score(best) > score(r.equipped[slot]))
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

function lock() {
  try {
    const fd = fs.openSync(LOCK, 'wx');
    fs.writeFileSync(fd, String(process.pid));
    const unlock = () => { try { fs.closeSync(fd); fs.unlinkSync(LOCK); } catch {} };
    process.once('SIGINT', () => { unlock(); process.exit(130); });
    process.once('SIGTERM', () => { unlock(); process.exit(143); });
    return unlock;
  } catch {
    throw Error(`another melvor-report is already using port ${PORT}`);
  }
}

(async () => {
  const unlock = lock();
  const chrome = await ensureChrome();
  try {
    for (const name of names) {
      const data = await withCharacter(name, client => {
        if (cmd === 'summary') return evalExpr(client, 'mh.readOnlyReport()');
        if (cmd === 'skilling') return evalExpr(client, 'mh.skillingAudit()');
        if (cmd === 'audit') return evalExpr(client, `(() => {
          const gear = mh.gearAudit(game.combat.player.attackType, 2);
          return { report: mh.readOnlyReport(), skilling: mh.skillingAudit(), gear: {
            context: gear.context,
            equipped: gear.equipped,
            candidates: gear.candidates,
          } };
        })()`);
        return evalExpr(client, `(() => {
          const audit = mh.gearAudit(game.combat.player.attackType, 2);
          return { name: game.characterName, action: game.activeAction?.name ?? null, combat: mh.combatInfo(), context: audit.context, equipped: audit.equipped, candidates: audit.candidates };
        })()`);
      });
      if (cmd === 'summary') printSummary(data);
      else if (cmd === 'skilling') printSkilling({ name, ...data });
      else if (cmd === 'audit') printAudit(data);
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
