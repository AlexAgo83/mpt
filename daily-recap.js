#!/usr/bin/env node
// Daily recap: snapshot journal/latest.json into journal/daily/<date>.json (scripts/daily.sh, after
// `journal all --record --save-backup`); journal-serve renders /daily from those snapshots.
const fs = require('fs');
const path = require('path');

const JOURNAL_DIR = path.join(__dirname, 'journal');
const DAILY_DIR = path.join(JOURNAL_DIR, 'daily');
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
    }];
  })),
});

const esc = v => String(v ?? '-').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const num = n => !Number.isFinite(n) ? '-' : Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n * 100) / 100);
const delta = (now, before) => !Number.isFinite(now) || !Number.isFinite(before) ? '' : now === before ? '<span class="z">±0</span>' : `<span class="${now > before ? 'up' : 'down'}">${now > before ? '+' : ''}${num(now - before)}</span>`;
const doing = c => c.action === 'Combat' ? `Combat · ${c.monster || '?'}${c.area ? ' (' + c.area + ')' : ''}${c.slayerTask ? ` · task ${c.slayerTask.monster} ${c.slayerTask.left} left` : ''}` : c.action || 'Idle';

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

function card(name, c, b) {
  const gains = skillGains(c, b);
  const row = (label, now, before, fmt = num) => `<tr><th>${label}</th><td>${fmt(now)}</td><td>${delta(now, before)}</td></tr>`;
  return `<section class="card"><h2>${esc(name)} <small>${esc(c.mode)}</small></h2>
<p class="now">${esc(doing(c))}${b && doing(b) !== doing(c) ? `<br><small>was: ${esc(doing(b))}</small>` : ''}</p>
<table>${row('GP', c.gp, b?.gp)}${row('Total level', c.totalLevel, b?.totalLevel)}${row('Completion %', c.completion, b?.completion)}
${row('Kills', c.stats?.kills, b?.stats?.kills)}${row('Deaths', c.stats?.deaths, b?.stats?.deaths)}${row('Dungeon clears', c.stats?.dungeonClears, b?.stats?.dungeonClears)}</table>
${gains.length ? `<h3>XP gained</h3><ul>${gains.slice(0, 6).map(g => `<li>${esc(g.name)} <b>+${num(g.xp)}</b>${g.levels ? ` <span class="up">${esc(g.levels)}</span>` : ''}</li>`).join('')}</ul>` : b ? '<p><small>no XP gained</small></p>' : '<p><small>first snapshot: deltas start tomorrow</small></p>'}
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

const page = (day, cards, hist, nav = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Melvor daily ${day}</title><link rel="icon" type="image/svg+xml" href="/assets/mpt-mark.svg"><style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#1d2330;--mut:#6b7280;--up:#15803d;--down:#b91c1c;--line:#e5e7eb}
@media (prefers-color-scheme:dark){:root{--bg:#111318;--card:#1b1f27;--fg:#e6e8ec;--mut:#9aa3b2;--up:#4ade80;--down:#f87171;--line:#2b313c}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
h1{font-size:1.3rem;margin:0 0 12px}main{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.wide{grid-column:1/-1}
h2{font-size:1.05rem;margin:0 0 6px}h3{font-size:.9rem;margin:10px 0 4px}small,.z{color:var(--mut)}.up{color:var(--up)}.down{color:var(--down)}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:2px 6px 2px 0;font-variant-numeric:tabular-nums}th{font-weight:500;color:var(--mut)}
ul{margin:0;padding-left:18px}.now{margin:0 0 8px}.scroll{overflow-x:auto}.hist td,.hist th{white-space:nowrap;border-top:1px solid var(--line);padding:4px 10px 4px 0}
</style></head><body><h1><a href="/">MelvorPT</a> · daily recap · ${day} <small>${nav}</small></h1><main>${cards}${hist}</main></body></html>`;

const readDays = () => !fs.existsSync(DAILY_DIR) ? [] : fs.readdirSync(DAILY_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const readDay = f => JSON.parse(fs.readFileSync(path.join(DAILY_DIR, f), 'utf8'));

// The recap of one day (default: the newest) against the snapshot before it, plus the last 30 days.
function renderDaily(day = null) {
  const files = readDays();
  if (!files.length) return page('no snapshot yet', '<section class="card">No daily snapshot yet: scripts/daily.sh writes one every morning.</section>', '');
  const i = day && files.includes(`${day}.json`) ? files.indexOf(`${day}.json`) : files.length - 1;
  const snap = readDay(files[i]), prev = i > 0 ? readDay(files[i - 1]) : null;
  const d = snap.at.slice(0, 10);
  const link = (j, label) => files[j] ? `<a href="/daily?day=${files[j].slice(0, 10)}">${label}</a>` : '';
  const nav = [link(i - 1, '← previous day'), link(i + 1, 'next day →')].filter(Boolean).join(' · ');
  const cards = Object.entries(snap.characters).map(([n, c]) => card(n, c, prev?.characters?.[n])).join('\n');
  return page(d, cards, history(files.slice(Math.max(0, i - HISTORY_DAYS + 1), i + 1).map(readDay)), nav);
}

function main() {
  const snap = snapshot(JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR, 'latest.json'), 'utf8')));
  const day = snap.at.slice(0, 10);
  fs.mkdirSync(DAILY_DIR, { recursive: true });
  fs.writeFileSync(path.join(DAILY_DIR, `${day}.json`), JSON.stringify(snap));
  console.log(`daily snapshot ${day} -> journal/daily/${day}.json (dashboard /daily)`);
}

if (require.main === module) main();
module.exports = { snapshot, skillGains, renderDaily };
