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
const usage = `usage:
  ./melvor-report.js slots
  ./melvor-report.js diff-slots
  ./melvor-report.js source-of-truth
  ./melvor-report.js improve [--record]
  ./melvor-report.js summary [all|character]
  ./melvor-report.js audit [all|character]
  ./melvor-report.js plan [all|character]
  ./melvor-report.js gear <character>
  ./melvor-report.js skilling <character>
  ./melvor-report.js export-state [all|character]

Read-only commands. Check slots/diff-slots before any manual write.`;
if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
  console.log(usage);
  process.exit(0);
}
if (!['summary', 'gear', 'skilling', 'audit', 'slots', 'diff-slots', 'source-of-truth', 'improve', 'plan', 'export-state'].includes(cmd)) {
  console.error(usage);
  process.exit(2);
}

const names = who === 'all' ? CHARS : [who];
const recordImprovement = cmd === 'improve' && who === '--record';
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

function planLines(r) {
  const eq = r.report.equipment;
  const bank = r.bank || {};
  const lines = [];
  const add = (slot, item, reason) => {
    if (eq[slot] === item) return;
    lines.push(`${slot}: ${eq[slot] || 'empty'} -> ${item} (${bank[item] > 0 ? `available x${bank[item]}` : 'not in bank'}; ${reason})`);
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
  return lines;
}

function printPlan(r) {
  const lines = planLines(r);
  console.log(`${r.report.name} | ${r.report.action}`);
  if (!lines.length) console.log('  no obvious skilling swap');
  for (const line of lines) console.log(`  would equip ${line}`);
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
      return { local, cloud };
    })()`, 30000);
  });
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
    if (cmd === 'slots' || cmd === 'diff-slots' || cmd === 'source-of-truth' || cmd === 'improve') {
      const data = await readSlots();
      if (cmd === 'diff-slots') printSlotDiffs(data);
      else if (cmd === 'source-of-truth') printSourceOfTruth(data);
      else if (cmd === 'improve') printImprovementReport(data);
      else printSlots(data);
      return;
    }

    if (cmd === 'export-state') {
      const slots = await readSlots();
      const characters = {};
      for (const name of names) {
        characters[name] = await withCharacter(name, client => evalExpr(client, `(() => {
          const report = mh.readOnlyReport();
          return {
            mode: report.mode,
            action: report.action,
            gp: report.gp,
            combatLevel: report.combatLevel,
            totalLevel: report.totalLevel,
            maxedSkills: report.maxedSkills,
            lowSkills: report.lowSkills,
            food: report.food,
            foodQty: report.foodQty,
            equipment: report.equipment,
            combat: report.combat,
          };
        })()`));
      }
      console.log(JSON.stringify({ collectedAt: new Date().toISOString(), slots, characters }, null, 2));
      return;
    }

    for (const name of names) {
      const data = await withCharacter(name, client => {
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
        return evalExpr(client, `(() => {
          const audit = mh.gearAudit(game.combat.player.attackType, 2);
          return { name: game.characterName, action: game.activeAction?.name ?? null, combat: mh.combatInfo(), context: audit.context, equipped: audit.equipped, candidates: audit.candidates };
        })()`);
      });
      if (cmd === 'summary') printSummary(data);
      else if (cmd === 'skilling') printSkilling({ name, ...data });
      else if (cmd === 'audit') printAudit(data);
      else if (cmd === 'plan') printPlan(data);
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
