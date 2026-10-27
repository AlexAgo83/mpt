#!/usr/bin/env node
// Daily recap, like the game's "Welcome back" screen: levels, XP, items gained and used, GP, kills, deaths.
// scripts/daily.sh snapshots journal/latest.json into journal/daily/<date>.json every morning; journal-serve renders
// /daily (the last snapshot against the one before) and /daily?live=1 (the latest journal refresh against the last snapshot).
const fs = require('fs');
const path = require('path');

const JOURNAL_DIR = path.join(__dirname, 'journal');
const DAILY_DIR = path.join(JOURNAL_DIR, 'daily');
const MEDIA_FILE = path.join(DAILY_DIR, 'media.json'); // item name -> icon URL, shared by every snapshot
const HISTORY_DAYS = 30;

const snapshot = latest => ({
  at: latest.generatedAt,
  characters: Object.fromEntries(Object.entries(latest.characters).map(([name, c]) => {
    const o = c.observed;
    return [name, {
      action: o.action, mode: o.mode, gp: o.gp, totalLevel: o.totalLevel, combatLevel: o.combatLevel,
      area: o.combat?.area ?? null, monster: o.combat?.monster ?? null, slayerTask: o.combat?.slayerTask ?? null,
      completion: o.completion?.total ?? null, stats: o.stats ?? null, saveHash: o.saveBackup?.hash ?? null,
      skills: (o.skills || []).map(s => ({ name: s.name, level: s.level, xp: s.xp, abyssalLevel: s.abyssalLevel ?? 0, abyssalXP: s.abyssalXP ?? 0 })),
      bank: Object.fromEntries((o.inventory || []).map(i => [i.name, i.quantity])),
    }];
  })),
});
const mediaOf = latest => Object.fromEntries(Object.values(latest.characters).flatMap(c => (c.observed.inventory || []).filter(i => i.media).map(i => [i.name, i.media])));

const esc = v => String(v ?? '-').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const num = n => !Number.isFinite(n) ? '-' : Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n * 100) / 100);
const signed = n => (n > 0 ? '+' : '') + num(n);
const doing = c => c.action === 'Combat' ? `Combat · ${c.monster || '?'}${c.area ? ' (' + c.area + ')' : ''}${c.slayerTask ? ` · task ${c.slayerTask.monster}, ${c.slayerTask.left} left` : ''}` : c.action || 'Idle';
const span = (a, b) => { const h = (Date.parse(a) - Date.parse(b)) / 3600000; return h >= 48 ? `${Math.round(h / 24)} d` : `${Math.round(h)} h`; };

function skillGains(now, before) {
  const prev = Object.fromEntries((before?.skills || []).map(s => [s.name, s]));
  return now.skills.map(s => {
    const p = prev[s.name];
    if (!p) return null;
    const xp = (s.xp - p.xp) + (s.abyssalXP - p.abyssalXP);
    const levels = [s.level > p.level ? `${p.level}→${s.level}` : null, s.abyssalLevel > p.abyssalLevel ? `A${p.abyssalLevel}→A${s.abyssalLevel}` : null].filter(Boolean).join(' ');
    return xp > 0 ? { name: s.name, xp, levels } : null;
  }).filter(Boolean).sort((a, b) => b.xp - a.xp);
}

// bank deltas, biggest first; an item that left the bank counts as used (food, ammo, runes, potions, crafting inputs)
function itemChanges(now, before) {
  if (!now.bank || !before?.bank) return null;
  const names = new Set([...Object.keys(now.bank), ...Object.keys(before.bank)]);
  const all = [...names].map(name => ({ name, delta: (now.bank[name] || 0) - (before.bank[name] || 0) })).filter(x => x.delta);
  return { gained: all.filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta), used: all.filter(x => x.delta < 0).sort((a, b) => a.delta - b.delta) };
}

const itemGrid = (list, media, limit) => `<div class="items">${list.slice(0, limit).map(x => `<span class="item" title="${esc(x.name)}">${media[x.name] ? `<img src="${esc(media[x.name])}" alt="" loading="lazy">` : ''}<b class="${x.delta > 0 ? 'up' : 'down'}">${signed(x.delta)}</b><small>${esc(x.name)}</small></span>`).join('')}${list.length > limit ? `<span class="more">+${list.length - limit} more</span>` : ''}</div>`;

function card(name, c, b, media) {
  if (!b) return `<section class="card"><h2>${esc(name)} <small>${esc(c.mode)}</small></h2><p class="now">${esc(doing(c))}</p><p><small>first snapshot: the recap starts with the next one</small></p></section>`;
  const gains = skillGains(c, b), items = itemChanges(c, b), lv = gains.filter(g => g.levels);
  const stat = (label, now, before) => Number.isFinite(now) && Number.isFinite(before) && now !== before ? `<span class="stat"><small>${label}</small> <b class="${(now > before) === (label !== 'Deaths') ? 'up' : 'down'}">${signed(now - before)}</b></span>` : '';
  const stats = [stat('GP', c.gp, b.gp), stat('Kills', c.stats?.kills, b.stats?.kills), stat('Deaths', c.stats?.deaths, b.stats?.deaths), stat('Dungeons', c.stats?.dungeonClears, b.stats?.dungeonClears), stat('Completion %', c.completion, b.completion)].join('');
  return `<section class="card"><h2>${esc(name)} <small>${esc(c.mode)}</small></h2>
<p class="now">${esc(doing(c))}${doing(b) !== doing(c) ? `<br><small>was: ${esc(doing(b))}</small>` : ''}</p>
${stats ? `<div class="stats">${stats}</div>` : ''}
${lv.length ? `<h3>Levels gained</h3><div class="chips">${lv.map(g => `<span class="chip">${esc(g.name)} <b class="up">${esc(g.levels)}</b></span>`).join('')}</div>` : ''}
${gains.length ? `<h3>XP gained</h3><ul class="xp">${gains.slice(0, 8).map(g => `<li><span>${esc(g.name)}</span><b>+${num(g.xp)}</b></li>`).join('')}</ul>` : '<p><small>no XP gained</small></p>'}
${items ? `${items.gained.length ? `<h3>Items gained</h3>${itemGrid(items.gained, media, 18)}` : ''}${items.used.length ? `<h3>Items used</h3>${itemGrid(items.used, media, 12)}` : ''}` : '<p><small>items start with the next snapshot</small></p>'}
</section>`;
}

function history(days) {
  const names = Object.keys(days.at(-1).characters);
  const head = `<tr><th>Day</th>${names.map(n => `<th>${esc(n)}</th>`).join('')}</tr>`;
  const rows = days.slice().reverse().map(d => `<tr><td>${esc(d.at.slice(0, 10))}</td>${names.map(n => {
    const c = d.characters[n];
    return `<td>${c ? `${c.totalLevel} · ${num(c.completion)}% · ${num(c.gp)}` : '-'}</td>`;
  }).join('')}</tr>`).join('');
  return `<section class="card wide"><h2>Last ${days.length} days <small>total level · completion · GP</small></h2><div class="scroll"><table class="hist">${head}${rows}</table></div></section>`;
}

const page = (title, sub, nav, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Melvor daily recap</title><link rel="icon" type="image/svg+xml" href="assets/mpt-mark.svg"><style>
:root{--bg:#0f1311;--card:#171d1a;--fg:#e8ece9;--mut:#93a39b;--up:#5fd39a;--down:#f08a7e;--line:#2a332f;--accent:#e9b949}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
a{color:var(--accent)}header{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem 1rem;margin-bottom:12px}
h1{font-size:1.3rem;margin:0}nav{display:flex;flex-wrap:wrap;gap:.4rem}nav a{padding:.25rem .7rem;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:.85rem}nav a.on{background:var(--accent);color:#1b1505;border-color:var(--accent)}
main{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-width:0}.wide{grid-column:1/-1}
h2{font-size:1.05rem;margin:0 0 4px}h3{font-size:.72rem;margin:12px 0 6px;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}
small{color:var(--mut)}.up{color:var(--up)}.down{color:var(--down)}.now{margin:0 0 6px}
.stats{display:flex;flex-wrap:wrap;gap:.3rem .9rem}.chips{display:flex;flex-wrap:wrap;gap:.3rem}.chip{padding:.1rem .5rem;border:1px solid var(--line);border-radius:999px;font-size:.85rem}
.xp{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.1rem 1rem}.xp li{display:flex;justify-content:space-between;gap:.5rem}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}.item{display:grid;justify-items:center;gap:1px;padding:4px;border:1px solid var(--line);border-radius:6px;text-align:center;min-width:0}
.item img{width:32px;height:32px}.item b{font-size:.8rem}.item small{font-size:.65rem;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.more{align-self:center;color:var(--mut);font-size:.8rem}
.scroll{overflow-x:auto}.hist{border-collapse:collapse}.hist td,.hist th{white-space:nowrap;border-top:1px solid var(--line);padding:4px 12px 4px 0;text-align:left;font-variant-numeric:tabular-nums}
.hub-back{display:inline-block;margin-bottom:6px;color:var(--mut);font-size:.85rem;text-decoration:none}.hub-back:hover{color:var(--accent)}
</style></head><body><a class="hub-back" href="/">← Jarvis HQ</a><header><h1><a href="./">MelvorPT</a> · ${title}</h1><small>${sub}</small><nav>${nav}</nav></header><main>${body}</main></body></html>`;

const readDays = () => !fs.existsSync(DAILY_DIR) ? [] : fs.readdirSync(DAILY_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const readDay = f => JSON.parse(fs.readFileSync(path.join(DAILY_DIR, f), 'utf8'));
const readMedia = () => { try { return JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf8')); } catch { return {}; } };

// live: the latest journal refresh against the newest snapshot; otherwise one day's snapshot against the one before
function renderDaily({ day = null, live = false } = {}) {
  const files = readDays();
  if (!files.length) return page('daily recap', '', '', '<section class="card">No daily snapshot yet: scripts/daily.sh writes one every morning.</section>');
  const media = readMedia();
  let now, before, i = files.length - 1;
  if (live) {
    const latest = JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR, 'latest.json'), 'utf8'));
    Object.assign(media, mediaOf(latest));
    now = snapshot(latest); before = readDay(files[i]);
  } else {
    if (day && files.includes(`${day}.json`)) i = files.indexOf(`${day}.json`);
    now = readDay(files[i]); before = i > 0 ? readDay(files[i - 1]) : null;
  }
  const link = (href, label, on) => `<a href="${href}"${on ? ' class="on"' : ''}>${label}</a>`;
  const nav = [link('daily', 'Last snapshot', !live && i === files.length - 1), link('daily?live=1', 'Since last snapshot (live)', live),
    !live && files[i - 1] ? link(`daily?day=${files[i - 1].slice(0, 10)}`, '← previous day') : '', !live && files[i + 1] ? link(`daily?day=${files[i + 1].slice(0, 10)}`, 'next day →') : ''].join('');
  const sub = before ? `${esc(before.at.slice(0, 16).replace('T', ' '))} → ${esc(now.at.slice(0, 16).replace('T', ' '))} UTC · ${span(now.at, before.at)}` : esc(now.at.slice(0, 16).replace('T', ' ')) + ' UTC';
  const cards = Object.entries(now.characters).map(([n, c]) => card(n, c, before?.characters?.[n], media)).join('\n');
  return page(live ? 'since last snapshot' : 'daily recap', sub, nav, cards + history(files.slice(Math.max(0, i - HISTORY_DAYS + 1), i + 1).map(readDay)));
}

function main() {
  const latest = JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR, 'latest.json'), 'utf8'));
  const snap = snapshot(latest);
  const day = snap.at.slice(0, 10);
  fs.mkdirSync(DAILY_DIR, { recursive: true });
  fs.writeFileSync(path.join(DAILY_DIR, `${day}.json`), JSON.stringify(snap));
  fs.writeFileSync(MEDIA_FILE, JSON.stringify({ ...readMedia(), ...mediaOf(latest) }));
  console.log(`daily snapshot ${day} -> journal/daily/${day}.json (dashboard /daily)`);
}

if (require.main === module) main();
module.exports = { snapshot, skillGains, itemChanges, renderDaily };
