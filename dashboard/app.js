// MelvorPT dashboard client: inlined into journal/index.html by renderDashboard (melvor-report.js).
// Plain JavaScript file: regexes and escapes are written once, no template-literal doubling.
// A script error must never leave a blank page: say what broke, where the To do box is.
window.addEventListener('error', e => { const box = document.getElementById('pageError'); if (box) { box.hidden = false; box.textContent = 'Dashboard error: ' + (e.message || 'unknown') + '. Refresh the journal; if it persists, run ./melvor-report.js improve --record.'; } });
const snap = JSON.parse(document.getElementById('data').textContent);
// Plans goal per character: journal/goals.json via journal-serve, localStorage when the page is opened from disk.
const GOAL_LABELS = { progression: 'Progression', dungeons: 'Dungeon path', completion: 'Completion', target: 'Target item', mastery: 'Mastery pools', profit: 'Profit', afk: 'AFK', slayer: 'Slayer', safe: 'Hardcore safe', capes: 'Capes & pets', shop: 'Shop' };
const GOAL_INTRO = {
  progression: 'Raise the lowest skills (standard and abyssal) with the best recipe you have materials for.',
  dungeons: 'Dungeons, Abyss depths and strongholds in game order: what to clear next and what blocks the rest.',
  completion: 'Cheapest Completion Log gains first: items to craft once, monsters never killed, near-max masteries, pets.',
  target: 'One item you want: how to get it, where to farm it and how long it takes on average.',
  mastery: 'Mastery pools closest to their next checkpoint (10, 25, 50, 95%): each checkpoint unlocks a permanent bonus.',
  profit: 'Activities ranked by GP per hour (sell value minus inputs; combat from the simulator).',
  afk: 'What runs longest without you: no deaths, enough food, materials for 12 h or more.',
  slayer: 'Current task, Slayer coins and the Slayer areas still locked with what each needs.',
  safe: 'For Hardcore: only fights the simulator clears with 0% deaths; skilling is always safe.',
  capes: 'Skillcapes you can buy or still need, and pets left to find.',
  shop: 'Permanent shop upgrades you can afford right now.',
};
const GOAL_GROUP = { progression: 0, dungeons: 0, completion: 0, target: 0, mastery: 1, profit: 1, afk: 1, slayer: 2, safe: 2, capes: 2, shop: 2 };
const GOAL_ICONS = {
  progression: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  dungeons: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/>',
  completion: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  target: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  mastery: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  profit: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  afk: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  slayer: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
  safe: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  capes: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  shop: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
};
const goalStore = (() => { try { return JSON.parse(localStorage.getItem('mpt-goals') || '{}'); } catch { return {}; } })();
// served pages trust journal/goals.json (shared by every browser); a page opened from disk keeps its own choice
const served = location.protocol.startsWith('http');
const goalOf = (name, c) => (served ? snap.goals?.[name]?.goal : goalStore[name] || snap.goals?.[name]?.goal) || (c && c.observed.mode === 'Hardcore Mode' ? 'safe' : 'progression');
const saveGoal = async (name, patch) => {
  snap.goals = { ...(snap.goals || {}), [name]: { ...(snap.goals?.[name] || {}), ...patch } };
  if (patch.goal) { goalStore[name] = patch.goal; try { localStorage.setItem('mpt-goals', JSON.stringify(goalStore)); } catch {} }
  if (location.protocol.startsWith('http')) { try { await fetch('/goal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ character: name, ...patch }) }); } catch {} }
};
const goalLines = (c, goal) => goal === 'progression' ? null : c.analysis.goals?.[goal] || null;
let keepOpen = null; // reopen this card on this tab after a re-render
const GOAL_SHORT = { progression: 'Lowest skills first', dungeons: 'Next dungeon, what blocks the rest', completion: 'Cheapest Completion Log gains', target: 'The path to one item', mastery: 'Pools near a checkpoint', profit: 'Best GP per hour', afk: 'Runs long without you', slayer: 'Task, coins, locked areas', safe: 'Fights at 0% deaths', capes: 'Capes and pets left', shop: 'Affordable upgrades' };
const goalIcon = id => '<svg viewBox="0 0 24 24" aria-hidden="true">' + GOAL_ICONS[id] + '</svg>';
// One goal picker for the Plans tab and the Next column: a small popover under the button that opened it.
function openGoalPicker(anchor, name, c) {
  document.querySelector('.goal-pop')?.remove();
  const current = goalOf(name, c);
  const pop = el('div', 'goal-pop'); pop.setAttribute('role', 'menu'); pop.setAttribute('aria-label', 'Plan goal for ' + name);
  for (const [id, label] of Object.entries(GOAL_LABELS)) {
    const b = el('button', 'goal-opt'); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(id === current));
    b.innerHTML = goalIcon(id); b.append(el('b', '', label), el('small', '', GOAL_SHORT[id]));
    b.addEventListener('click', async e => {
      e.stopPropagation(); pop.remove();
      const card = anchor.closest('details.character');
      keepOpen = card?.open ? { name, tab: card.querySelector('[data-tab][aria-selected=true]')?.dataset.tab || 'plans' } : null;
      await saveGoal(name, { goal: id }); render(); loadWikiIcons();
    });
    pop.append(b);
  }
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8)) + 'px';
  pop.querySelector('[aria-checked=true]')?.focus();
  const close = e => { if (e.type === 'keydown' ? e.key === 'Escape' : !pop.contains(e.target) && e.target !== anchor) { pop.remove(); document.removeEventListener('click', close, true); document.removeEventListener('keydown', close); } };
  setTimeout(() => { document.addEventListener('click', close, true); document.addEventListener('keydown', close); });
}
const goalButton = (name, c, cls) => {
  const id = goalOf(name, c); const b = el('button', cls); b.type = 'button'; b.title = 'Change the plan goal for ' + name; b.setAttribute('aria-haspopup', 'menu');
  b.innerHTML = goalIcon(id); b.append(el('span', '', GOAL_LABELS[id])); b.insertAdjacentHTML('beforeend', '<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>');
  for (const type of ['mousedown', 'keydown']) b.addEventListener(type, e => e.stopPropagation());
  b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openGoalPicker(b, name, c); });
  return b;
};

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
// "Cooking: Carrot Cake; 17903 actions; 39.8 h runway; ..." is a plan to switch skill: say so, keep the runway
const planLine = label => { const parts = label.split('; '); if (parts[1] === 'no materials needed') return 'Switch to ' + parts[0] + ' · ' + (parts[2] || ''); return /^\d+ actions$/.test(parts[1] || '') ? 'Switch to ' + parts[0] + ' · ' + (parts.find(p => /runway/.test(p)) || '').replace(' runway', ' of materials') : null; };
const nextAction = decision => short(decision ? planLine(decision.label) || decision.label.replace(/^current [^:]+:\s*/i, '').split(';')[0] : 'Nothing: let it run', 72);
const current = c => {
  const combat = c.observed.combat;
  if (c.observed.action === 'Combat' && combat?.slayerTask) return 'Combat · ' + combat.slayerTask.monster + ' · ' + combat.slayerTask.left + ' kills';
  return c.observed.action || 'Idle';
};
const attention = (name, c) => hasRisk(name) || isStale(name) || insights(c).some(i => i.severity === 'danger' || i.severity === 'warning');
const fmtEta = seconds => seconds < 3600 ? Math.round(seconds / 60) + ' min' : seconds < 172800 ? Math.round(seconds / 3600) + ' h' : Math.round(seconds / 86400) + ' d';
const relative = value => { const min = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000)); return min < 1 ? 'just now' : min < 60 ? min + ' min ago' : min < 1440 ? Math.round(min / 60) + ' h ago' : Math.round(min / 1440) + ' d ago'; };
const scanTime = document.getElementById('scanTime'); scanTime.textContent = 'Scanned ' + relative(snap.generatedAt); scanTime.title = new Date(snap.generatedAt).toLocaleString('en-GB');
document.getElementById('setupButton').addEventListener('click', () => document.getElementById('setup').showModal());
const refreshCharacter = document.getElementById('refreshCharacter');
for (const name of Object.keys(snap.characters).sort()) refreshCharacter.append(new Option(name, name));
const refreshButton = document.getElementById('refreshButton');
const refreshStatus = document.getElementById('refreshStatus');
if (location.protocol !== 'http:' && location.protocol !== 'https:') {
  refreshButton.lastChild.textContent = 'Copy command';
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

// Only real actions: "ETA pending" lines are status, they stay muted in the card's Next column.
const isAction = i => !isAutomaticTask(i.label) && !/^ETA pending/i.test(i.label);
// To do: one item per character (save risk, alert, the goal's next step, quick wins), shown in a dialog behind a count pill.
// Rebuilt by render() so it follows goal changes.
function todoItems() {
  const items = [];
  for (const [name, c] of Object.entries(snap.characters)) {
    const gl = goalLines(c, goalOf(name, c))?.[0];
    const item = hasRisk(name) ? { priority: 'critical', label: 'Local save is newer than cloud: do not load cloud.' }
      : insights(c).find(i => isAction(i) && (i.severity === 'danger' || i.severity === 'warning'))
      || (gl && !/^(Safe|No Slayer|Pick a target|Refresh this|Every unlocked)/.test(gl) ? { priority: 'high', label: gl } : null)
      || insights(c).find(i => isAction(i) && i.actionable);
    if (item) items.push([name, item]);
    const quick = c.analysis.goals?.quick || {};
    if (quick.farmingReady) items.push([name, { priority: 'medium', label: 'Harvest the farming plots' }]);
    if (quick.slayerTaskDone) items.push([name, { priority: 'medium', label: 'Start a new Slayer task' }]);
  }
  return items.sort((a, b) => RANK[a[1].priority] - RANK[b[1].priority]);
}
function renderTodo() {
  const items = todoItems();
  const pill = document.getElementById('todoButton'), list = document.getElementById('todoList');
  document.getElementById('todoCount').textContent = items.length || '✓';
  pill.classList.toggle('has', items.length > 0); pill.classList.toggle('critical', items.some(([, i]) => i.priority === 'critical'));
  pill.title = items.length ? items.length + ' thing(s) to do' : 'All running, nothing to do';
  list.replaceChildren();
  if (!items.length) list.append(el('p', 'muted', '✓ All running, nothing to do.'));
  for (const [name, item] of items) {
    const parts = item.label.split('; ');
    const row = el('button', 'todo-item p-' + item.priority); row.type = 'button'; row.title = item.label;
    row.append(el('span', 'name-chip', name), el('span', '', planLine(item.label) || [parts[0], parts.find(p => /runway|left|ETA/.test(p))].filter(Boolean).join(' · ')));
    row.addEventListener('click', () => { document.getElementById('todo').close(); keepOpen = { name, tab: 'plans' }; render(); loadWikiIcons(); [...document.querySelectorAll('#cards details.character')].find(d => d.querySelector('.identity-title strong')?.textContent === name)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    list.append(row);
  }
}
document.getElementById('todoButton').addEventListener('click', () => document.getElementById('todo').showModal());

const summary = document.getElementById('summary');
const operations = snap.account.operations || {};
const stat = (label, value, quickFilter, tone) => {
  const d = el(quickFilter ? 'button' : 'span', 'kpi' + (value ? ' ' + (tone || 'on') : ' zero')); if (quickFilter) { d.type = 'button'; d.dataset.quick = quickFilter; }
  d.append(el('b', '', String(value)), document.createTextNode(' ' + label)); summary.append(d);
};
const completions = Object.values(snap.characters).map(c => c.observed.completion?.total).filter(v => v != null);
stat('characters', Object.keys(snap.characters).length, 'all', 'plain');
stat('alerts', Object.values(snap.characters).flatMap(c => insights(c)).filter(i => i.severity === 'danger' || i.severity === 'warning').length, 'attention', 'warn');
stat('due within 1 h', (operations.nearTermCompletions || []).length, 'soon'); summary.lastChild.title = 'Slayer task or level reached within the hour';
stat('save risks', snap.account.saveRisks.length, 'risk', 'warn');
if (completions.length) stat('avg completion', (completions.reduce((a, b) => a + b, 0) / completions.length).toFixed(1) + '%', null, 'plain');
let quick = 'all';
const setQuick = value => { quick = value; for (const b of document.querySelectorAll('#quick [data-quick]')) b.setAttribute('aria-pressed', String(b.dataset.quick === value)); render(); loadWikiIcons(); };
document.addEventListener('click', e => { const b = e.target.closest('[data-quick]'); if (b) setQuick(b.dataset.quick); });

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
const fmtCompact = n => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const wikiText = text => {
  const fragment = document.createDocumentFragment(); const value = String(text || ''); let last = 0;
  for (const match of value.matchAll(wikiPattern)) { fragment.append(document.createTextNode(value.slice(last, match.index)), wiki(match[0])); last = match.index + match[0].length; }
  fragment.append(document.createTextNode(value.slice(last))); return fragment;
};
const list = items => { const ul = el('ul', 'plain-list'); for (const item of [...new Set(items)].filter(Boolean)) { const row = el('li'); row.append(wikiText(item)); ul.append(row); } return ul; };
const spanAll = node => { node?.classList.add('span-all'); return node; };
const box = (title, nodes) => { nodes = nodes.filter(Boolean); if (!nodes.length) return null; const b = el('section', 'group'); const stack = el('div', 'stack'); stack.append(...nodes); b.append(el('h3', '', title), stack); return b; };
const group = (title, items) => { if (!items.length) return null; const box = el('section', 'group'); box.append(el('h3', '', title), list(items)); return box; };
// Icon-only tab switch: the label stays in title/aria-label. Static Lucide-style paths, no user data.
// One line under the tab bar saying what the tab holds and how to read it.
const TAB_INTRO = {
  now: 'What this character is running right now: task, consumables, familiars and food, with how long each lasts.',
  progress: 'XP gained since the previous scan and when the next levels land. Lows lists the skills furthest from their cap.',
  completion: 'Completion Log progress (as in game) for the whole game, per expansion and per category, and how it moved over time.',
  equipment: 'Gear worn in the current set and the saved sets, with the active style, damage type and accuracy.',
  upgrades: 'Better gear for what this character is doing now: items to loot or craft, and owned items worth equipping.',
  inventory: 'Everything in the bank, grouped by kind and worth (sell price). In use shows what the current activity consumes.',
  skills: 'What is left first: levels, mastery pools, XP/h and next-level time per skill; maxed skills fold at the bottom. Click a column to sort.',
  plans: 'The plan for the chosen goal; the Next column and To do follow it.',
  history: 'What changed between journal scans: activity, total level, maxed skills and GP.',
};
const TAB_GROUP = { now: 0, skills: 0, completion: 0, equipment: 1, upgrades: 1, inventory: 1, plans: 2, history: 2 };
const TAB_LABELS = { now: 'Now', progress: 'Progress', equipment: 'Equipment', upgrades: 'Upgrades', completion: 'Completion', skills: 'Skills', inventory: 'Inventory', plans: 'Plans', history: 'History' };
const TAB_ICONS = {
  now: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  progress: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  equipment: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  upgrades: '<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>',
  completion: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  skills: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  inventory: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  plans: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  history: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
};
// One open decision: what, why, and buttons that write the ledger (journal-serve) or give the CLI command (file).
function decisionRow(a, status) {
  const row = el('div', 'insight decision status-' + status);
  const head = el('div'); head.append(el('span', 'badge ' + (status === 'blocked' ? 'danger' : status === 'approved' ? 'ok' : 'info'), status));
  if (a.type === 'goal') head.append(document.createTextNode(' '), wikiText(a.item)); else head.append(document.createTextNode(' Equip '), wiki(a.item), document.createTextNode(' in ' + a.slot));
  const bar = el('div', 'decision-actions'); const note = el('span', 'muted');
  for (const [label, next] of [['Done', 'done'], ['Approve', 'approved'], ['Dismiss', 'dismissed']]) {
    if (next === status) continue;
    const b = el('button', '', label); b.type = 'button';
    b.addEventListener('click', async () => {
      if (!location.protocol.startsWith('http')) { await navigator.clipboard?.writeText('./melvor-report.js journal-action ' + a.id + ' ' + next); note.textContent = 'Command copied (open the page with journal-serve to click instead).'; return; }
      const r = await fetch('/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id, status: next }) });
      if (r.ok) { if (next === 'approved') { head.firstChild.textContent = 'approved'; b.remove(); } else row.remove(); } else note.textContent = (await r.json()).error || 'failed';
    });
    bar.append(b);
  }
  row.append(head, el('div', 'muted', a.reason || ''), bar, note);
  return row;
}
function plansPanel(name, c, actions, hidden) {
  const goal = goalOf(name, c);
  const body = el('div', 'panel panel-grid'); body.dataset.panel = 'plans';
  const head = el('div', 'goal-head span-all'); head.append(el('span', 'goal-head-label', 'Goal'), goalButton(name, c, 'goal-trigger'), el('span', 'muted', GOAL_INTRO[goal]));
  body.append(head);
  if (goal === 'target') {
    const form = el('form', 'controls span-all'); const input = el('input'); input.type = 'search'; input.placeholder = 'Item name, e.g. Hollow Reaper Scythe'; input.value = snap.goals?.[name]?.target || c.analysis.goals?.targetName || '';
    const go = el('button', '', 'Set target'); go.type = 'submit'; go.style.width = 'auto';
    const note = el('span', 'muted');
    form.addEventListener('submit', async e => { e.preventDefault(); await saveGoal(name, { target: input.value.trim() }); note.textContent = location.protocol.startsWith('http') ? 'Saved: refresh ' + name + ' to build the plan.' : 'Open the dashboard with journal-serve to save a target.'; });
    form.append(input, go, note); body.append(form);
  }
  const lines = goalLines(c, goal);
  const goalBox = goal === 'progression'
    ? [box('Standard plan', (c.analysis.standardPlan || []).map(line => detailRow(line))), box('Abyssal plan', (c.analysis.abyssalPlan || []).map(line => detailRow(line))), box('After the Slayer task', (c.analysis.afterTaskPlan || []).map(line => detailRow(line))), (c.analysis.standardPlan || []).length || (c.analysis.abyssalPlan || []).length || (c.analysis.afterTaskPlan || []).length ? null : box('Next activities', [el('p', 'muted', c.observed.action === 'Combat' && c.observed.combat?.slayerTask ? 'Paused while a Slayer task runs: skill plans come back when it ends.' : 'Nothing to switch to: no low skill has materials for 8 h or more.')])]
    : [spanAll(box(GOAL_LABELS[goal], lines ? (lines.length ? lines.map(line => detailRow(line, /^(Risky|Unlock)/.test(line) ? 'sev-warning' : /^(Safe|Clear|Buy|Craft|Kill|Farm)/.test(line) ? 'p-high' : '')) : [el('p', 'muted', 'Nothing found for this goal.')]) : [el('p', 'muted', 'Refresh this character to build this plan.')]))];
  for (const node of [...goalBox, box('Decisions', actions), box('Risk notes', (c.analysis.riskNotes || []).map(line => detailRow(line, 'sev-warning')))].filter(Boolean)) body.append(node);
  return body;
}
const completionSheet = c => {
  const now = c.observed.completion, prev = c.analysis.completionPrevious;
  if (!now) return null;
  const delta = (v, p) => p == null || v === p ? '' : ' ' + (v > p ? '+' : '') + (v - p).toFixed(2);
  const names = { base: 'Base game', toth: 'Throne of the Herald', aod: 'Atlas of Discovery', ita: 'Into the Abyss', skills: 'Skills', mastery: 'Mastery', items: 'Items', monsters: 'Monsters', pets: 'Pets' };
  const rows = key => Object.entries(now[key] || {}).map(([k, v]) => meterRow(names[k] || k, v, 100, v.toFixed(1) + '%' + delta(v, prev?.[key]?.[k]), key === 'expansions' && k !== 'base'));
  const total = el('div', 'hero-stat'); const hist = c.analysis.completionHistory || []; let since = hist.length - 1; while (since > 0 && hist[since - 1].total === now.total) since--;
  const moved = prev && prev.total !== now.total;
  total.append(el('b', '', now.total.toFixed(2) + '%'), el('span', '', 'Completion Log · ' + (moved ? delta(now.total, prev.total).trim() + ' since ' + new Date(prev.at).toLocaleString() : hist.length > 1 ? 'unchanged since ' + new Date(hist[since].at).toLocaleString() : 'first record')));
  const bar = el('progress'); bar.max = 100; bar.value = now.total; total.append(bar);
  return panel('completion', [
    box('Total', [total]),
    box('Expansions', rows('expansions')),
    box('Categories', rows('categories')),
    box('History', (c.analysis.completionHistory || []).filter((h, i, all) => i === 0 || h.total !== all[i - 1].total).reverse().map((h, i, shown) => meterRow(new Date(h.at).toLocaleString(), h.total, 100, h.total.toFixed(2) + '%' + (shown[i + 1] ? delta(h.total, shown[i + 1].total) : ' · first record')))),
  ]);
};
const panel = (name, groups) => { const body = el('div', 'panel panel-grid'); body.dataset.panel = name; for (const item of groups.filter(Boolean)) body.append(item); return body.children.length ? body : null; };
// "Skill: headline; detail; detail" -> headline + level meter + detail chips. Shared by Now, Progress and History.
const detailRow = (label, cls) => {
  const [headline, ...details] = label.split('; ');
  const row = el('div', 'insight ' + (cls || ''));
  const head = el('div'); head.append(wikiText(headline)); row.append(head);
  const chips = el('div', 'insight-chips');
  for (const detail of details) {
    const level = /^(abyssal )?level (\d+)\/(\d+)$/.exec(detail);
    if (level) row.append(meterRow((level[1] ? 'abyssal ' : '') + 'level', +level[2], +level[3], level[2] + '/' + level[3]));
    else chips.append(el('span', '', detail.replace(/ ETA /, ' · ')));
  }
  if (chips.children.length) row.append(chips);
  return row;
};
const meterRow = (label, value, max, text, linkLabel) => {
  const row = el('div', 'meter-row'); const bar = el('progress'); bar.max = max; bar.value = Math.min(value, max);
  const name = el('span', 'meter-name'); if (linkLabel) name.append(wiki(label)); else name.textContent = label;
  row.append(name, bar, el('span', 'meter-value', text)); return row;
};
const insightPanel = items => {
  if (!items.length) return null;
  const body = el('div', 'panel stack'); body.dataset.panel = 'now';
  for (const item of items.slice(0, 10)) { const row = detailRow(item.label, 'p-' + item.priority + ' sev-' + item.severity); row.title = item.priority + ' priority'; body.append(row); }
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
    if (value) { const stat = el('span'); stat.append(document.createTextNode(label + ': '), el('strong', '', value)); summary.append(stat); }
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
  if (!plan || (!Object.keys(plan.slots || {}).length && !Object.keys(plan.skilling || {}).length && !plan.activity?.length && plan.context?.kind !== 'non_combat_skill')) return null;
  const body = el('section', 'panel panel-grid'); body.dataset.panel = 'upgrades';
  const context = plan.context || {};
  const contextRow = el('section', 'group'); contextRow.append(el('h3', '', 'Context'));
  const contextText = context.kind === 'non_combat_skill' ? ['Skilling: ', wiki(context.target || 'unknown'), document.createTextNode(' · combat upgrades wait until it stops')] : context.kind === 'slayer_task' ? ['Slayer task: ', wiki(context.target || 'unknown'), document.createTextNode(' · ' + (context.remaining ?? '?') + ' kills left · ' + context.refresh)] : context.kind === 'dungeon' ? ['Dungeon: ', wiki(context.target || 'unknown'), document.createTextNode(' · strategy guide: '), wiki(context.target || 'unknown')] : ['Activity: ' + (context.target || 'unknown')];
  const contextLine = el('div'); contextLine.append(...contextText); const build = el('div', 'insight-chips'); build.append(el('span', '', 'build: ' + (plan.attackType || 'unknown') + (plan.damageType ? ' / ' + plan.damageType : ''))); const ctx = el('div', 'insight'); ctx.append(contextLine); if (plan.sim) { const sc = el('div', 'insight-chips'); sc.append(el('span', plan.sim.error ? 'chip-warn' : '', plan.sim.error ? 'not simulated: ' + plan.sim.error : 'simulated on ' + plan.sim.monster + ': current gear ' + fmtCompact(plan.sim.baseline.xpPerHour || 0) + ' XP/h, kill ' + (plan.sim.baseline.killTimeS || 0).toFixed(1) + ' s, ' + plan.sim.sims + ' candidates')); ctx.append(sc); } if (context.kind !== 'non_combat_skill') ctx.append(build); contextRow.append(ctx); contextRow.classList.add('span-all'); body.append(contextRow);
  const source = (item, kind) => kind === 'craft' && item.craft ? (item.craft.recipe === item.name ? [document.createTextNode('craft: ' + item.craft.skill)] : [document.createTextNode('craft: ' + item.craft.skill + ' / '), wiki(item.craft.recipe)]) : kind === 'bank' ? [document.createTextNode('in bank x' + (item.owned || 0).toLocaleString('en-US'))] : item.loot ? [document.createTextNode('loot: '), wiki(item.loot), document.createTextNode(item.lootChance ? ' · ' + (item.lootChance >= 1 ? item.lootChance.toFixed(1) : item.lootChance.toPrecision(2)) + '%' : '')] : [document.createTextNode(item.source || 'source unknown')];
  // --sim results: XP/h change against the current gear on the current target, from [Myth] Combat Simulator
  const sim = plan.sim && !plan.sim.error ? plan.sim : null;
  const simOf = (slot, item) => sim?.results?.[slot]?.[item.name];
  const gain = r => r && !r.failed && sim.baseline?.xpPerHour ? (r.xpPerHour - sim.baseline.xpPerHour) / sim.baseline.xpPerHour * 100 : null;
  const section = (title, kind) => {
    const tiles = Object.entries(plan.slots || {}).filter(([, entry]) => entry[kind]).map(([slot, entry]) => {
      let choice = entry[kind];
      if (sim && kind === 'bank') { const all = [choice.primary, ...(choice.alternatives || [])].sort((a, b) => (gain(simOf(slot, b)) ?? -1e9) - (gain(simOf(slot, a)) ?? -1e9)); choice = { primary: all[0], alternatives: all.slice(1) }; }
      const g = gain(simOf(slot, choice.primary)), r = simOf(slot, choice.primary);
      const worse = g !== null && (g < 0 || (r.deathRate || 0) > (sim.baseline.deathRate || 0));
      const tile = el('div', 'tile' + (choice.primary.blocked?.length ? ' blocked' : '') + (worse ? ' worse' : ''));
      const name = el('div', 'tile-title'); name.append(wiki(choice.primary.name));
      const meta = el('div', 'insight-chips'); const src = el('span'); src.append(...source(choice.primary, kind)); meta.append(src);
      if (g !== null) meta.append(el('span', g > 0.5 ? 'chip-good' : g < -0.5 ? 'chip-warn' : '', 'sim ' + (g >= 0 ? '+' : '') + g.toFixed(1) + '% XP/h · ' + (r.killTimeS != null ? 'kill ' + r.killTimeS.toFixed(1) + ' s' : 'no kill') + (r.deathRate ? ' · deaths ' + (r.deathRate * 100).toFixed(1) + '%' : '')));
      else if (r?.failed) meta.append(el('span', 'chip-warn', 'sim failed: ' + r.failed));
      if (choice.primary.blocked?.length) meta.append(el('span', 'chip-warn', 'blocked: ' + choice.primary.blocked.join(', ')));
      if (kind !== 'bank' && choice.primary.owned) meta.append(el('span', '', 'owned x' + choice.primary.owned.toLocaleString('en-US')));
      for (const passive of choice.primary.passives || []) meta.append(el('span', '', passive));
      tile.append(el('small', '', slot), name, meta);
      if (choice.alternatives?.length) { const alt = el('div', 'tile-alt'); alt.append(document.createTextNode('or ')); choice.alternatives.forEach((item, i) => { if (i) alt.append(document.createTextNode(', ')); alt.append(wiki(item.name)); }); tile.append(alt); }
      return tile;
    });
    if (!tiles.length) return null;
    const b = el('section', 'group span-all'); const grid = el('div', 'tile-grid'); grid.append(...tiles); b.append(el('h3', '', title), grid); return b;
  };
  // same tile as loot/craft: slot, best owned swap, why, other owned options
  const swapTile = (slot, current, item, owned, why, others) => {
    const tile = el('div', 'tile'); const name = el('div', 'tile-title'); name.append(wiki(item));
    const meta = el('div', 'insight-chips'); meta.append(el('span', '', 'owned x' + owned.toLocaleString('en-US'))); for (const w of why) meta.append(el('span', '', w));
    const from = el('div', 'tile-alt'); from.append(document.createTextNode('replaces '), wiki(current || 'empty'));
    tile.append(el('small', '', slot), name, meta, from);
    if (others.length) { const alt = el('div', 'tile-alt'); alt.append(document.createTextNode('or ')); others.forEach((o, i) => { if (i) alt.append(document.createTextNode(', ')); alt.append(wiki(o)); }); tile.append(alt); }
    return tile;
  };
  const tileGroup = (title, tiles) => { if (!tiles.length) return null; const b = el('section', 'group span-all'); const grid = el('div', 'tile-grid'); grid.append(...tiles); b.append(el('h3', '', title), grid); return b; };
  const skilling = tileGroup('Skilling gear in your bank', Object.entries(plan.skilling || {}).map(([slot, entry]) => swapTile(slot, entry.current, entry.candidates[0].name, entry.candidates[0].available, entry.candidates[0].passives, entry.candidates.slice(1).map(item => item.name))));
  const activity = tileGroup('For the current activity', (plan.activity || []).map(a => swapTile(a.slot, a.current, a.item, a.available, [a.reason], [])));
  body.append(...[skilling, activity, section('Equip from your bank', 'bank'), section('Next loot', 'loot'), section('Next craft', 'craft')].filter(Boolean));
  return body;
}
// Skills as a compact table: what is left first, maxed skills folded, filters and sortable columns.
const SKILL_KIND = { Attack: 'Combat', Strength: 'Combat', Defence: 'Combat', Hitpoints: 'Combat', Ranged: 'Combat', Magic: 'Combat', Prayer: 'Combat', Slayer: 'Combat', Corruption: 'Combat',
  Woodcutting: 'Gathering', Fishing: 'Gathering', Mining: 'Gathering', Thieving: 'Gathering', Farming: 'Gathering', Astrology: 'Gathering', Archaeology: 'Gathering', Harvesting: 'Gathering',
  Firemaking: 'Artisan', Cooking: 'Artisan', Smithing: 'Artisan', Fletching: 'Artisan', Crafting: 'Artisan', Runecrafting: 'Artisan', Herblore: 'Artisan', Summoning: 'Artisan',
  Agility: 'Support', Township: 'Support', Cartography: 'Support' };
function skillsSheet(c, charName) {
  const panel = el('section', 'panel skills-table'); panel.dataset.panel = 'skills';
  const skills = (c.observed.skills || []).filter(s => (s.levelCap ?? 120) > 1 || (s.abyssalCap ?? 0) > 1);
  if (!skills.length) { panel.append(el('p', 'muted', 'Refresh this character to load skills.')); return panel; }
  const abyss = c.observed.abyss !== false;
  const pct = (v, a, b) => Number.isFinite(b) && b > a ? Math.max(0, Math.min(100, (v - a) / (b - a) * 100)) : null;
  const abyssOpen = s => abyss && (s.abyssalCap ?? 0) > 1;
  const maxed = s => s.level >= (s.levelCap ?? 120) && (!abyssOpen(s) || (s.abyssalLevel ?? 0) >= s.abyssalCap);
  // what is left: abyssal gap first once in the Abyss, then the standard gap
  const gap = s => (abyssOpen(s) ? (s.abyssalCap - (s.abyssalLevel ?? 0)) / s.abyssalCap : 0) * 1000 + ((s.levelCap ?? 120) - s.level) / (s.levelCap ?? 120) * 100;
  // next-level ETA from the Progress lines ("Skill: ...; next level ETA 9 h" or "abyssal next level ETA ...")
  const etaOf = name => { for (const line of c.analysis.progressEtas || []) { if (!line.startsWith(name + ':')) continue; const p = line.split('; ').find(x => x.includes('next level ETA')); if (p) return p.split('ETA ')[1]; } return null; };
  // XP per hour measured between the last two scans (Progress lines: "Skill: 2,352,928 abyssal XP gained (6.8M/h); ...")
  const rateOf = name => { for (const line of c.analysis.progressEtas || []) { if (!line.startsWith(name + ':')) continue; const m = line.split('; ')[0].split('(')[1]; if (m) return m.replace(')', ''); } return null; };
  const pending = (c.analysis.progressEtas || []).find(line => line.startsWith('ETA pending'));
  const planned = (() => { const goal = goalOf(charName, c); const line = goalLines(c, goal)?.[0] || (c.analysis.standardPlan || [])[0] || (c.analysis.afterTaskPlan || [])[0] || ''; return line.replace(/^(Switch to |abyssal )+/, '').split(':')[0]; })();
  const kinds = ['All', 'Not maxed', 'Combat', 'Gathering', 'Artisan', 'Support'];
  let kind = 'All', sortBy = 'gap', desc = true;
  const meter = (value, text, title, cls) => { const m = el('div', 'st-meter ' + (cls || '')); const bar = el('progress'); bar.max = 100; bar.value = value; m.append(bar, el('span', '', text)); if (title) m.title = title; return m; };
  const levelCell = s => (s.levelCap ?? 120) <= 1 ? el('span', 'muted', '—') : s.level >= (s.levelCap ?? 120) ? el('span', 'st-done', '✓ ' + s.level)
    : meter(pct(s.xp, s.xpLevelStart, s.xpNextLevel) ?? 0, s.level + '/' + s.levelCap, fmtCompact(s.xp - (s.xpLevelStart || 0)) + ' / ' + fmtCompact((s.xpNextLevel || 0) - (s.xpLevelStart || 0)) + ' XP to the next level');
  const abyssCell = s => !abyssOpen(s) ? el('span', 'muted', '—') : (s.abyssalLevel ?? 0) >= s.abyssalCap ? el('span', 'st-done', '✓ ' + s.abyssalLevel)
    : (() => { const p = pct(s.abyssalXP, s.abyssalXPLevelStart, s.abyssalXPNextLevel); return meter(p ?? 0, s.abyssalLevel + '/' + s.abyssalCap + (p != null ? ' · ' + Math.round(p) + '%' : ''), p != null ? fmtCompact(s.abyssalXP - s.abyssalXPLevelStart) + ' / ' + fmtCompact(s.abyssalXPNextLevel - s.abyssalXPLevelStart) + ' abyssal XP to the next level' : null, 'abyss'); })();
  const poolCell = s => {
    const box = el('div', 'st-pools');
    for (const pool of (s.masteryPools || []).filter(p => abyss || !/abyss/i.test(p.realm))) {
      const tag = /abyss/i.test(pool.realm) ? 'abyss ' : '';
      if (pool.cap > 0 && pool.xp >= pool.cap) box.append(el('span', 'st-done', '✓ ' + tag + 'full' + (pool.xp > pool.cap ? ' (+' + fmtCompact(pool.xp - pool.cap) + ')' : '')));
      else if (pool.cap > 0) box.append(meter(pool.xp / pool.cap * 100, tag + Math.floor(pool.xp / pool.cap * 100) + '%', fmtCompact(pool.xp) + ' / ' + fmtCompact(pool.cap) + ' pool XP', 'pool'));
    }
    return box;
  };
  const row = s => {
    const r = el('div', 'st-row' + (s.name === c.observed.action ? ' current' : '') + (s.name === planned ? ' planned' : ''));
    r.style.setProperty('--skill-color', s.color || SKILL_COLORS[s.name] || 'var(--accent)');
    const name = el('div', 'st-name'); name.append(wiki(s.name));
    if (s.name === c.observed.action) name.append(el('span', 'st-tag', 'training'));
    else if (s.name === planned) name.append(el('span', 'st-tag plan', 'plan'));
    r.append(name, levelCell(s));
    if (abyss) r.append(abyssCell(s));
    const est = c.observed.skillRates?.[s.name];
    const estEta = est ? (() => { const need = est.abyssal ? (s.abyssalXPNextLevel ?? 0) - (s.abyssalXP ?? 0) : (s.xpNextLevel ?? 0) - (s.xp ?? 0); const h = need > 0 ? need / est.xpPerHour : null; return h == null ? null : h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h < 48 ? h.toFixed(1) + ' h' : Math.round(h / 24) + ' d'; })() : null;
    const nextCell = el('span', 'st-next muted');
    if (rateOf(s.name) || etaOf(s.name)) nextCell.textContent = [rateOf(s.name), etaOf(s.name) ? 'next ' + etaOf(s.name) : null].filter(Boolean).join(' · ');
    else if (est) { nextCell.textContent = fmtCompact(est.xpPerHour) + '/h' + (estEta ? ' · next ' + estEta : ''); nextCell.title = (est.current ? 'Current action: ' : 'If you train ') + est.action + (est.abyssal ? ' (abyssal XP)' : '') + ' · rate from ' + (est.source === 'ETA' ? 'the ETA mod' : 'base game values') + ', not measured'; nextCell.classList.add('estimate'); }
    r.append(poolCell(s), nextCell);
    return r;
  };
  const filters = el('div', 'seg st-filters');
  const head = el('div', 'st-row st-head');
  const cols = [['name', 'Skill'], ['level', 'Level'], ...(abyss ? [['abyssal', 'Abyssal']] : []), ['pool', 'Mastery pool'], ['eta', 'XP/h · next level']];
  for (const [key, label] of cols) { const b = el('button', '', label); b.type = 'button'; b.dataset.sort = key; b.addEventListener('click', () => { desc = sortBy === key ? !desc : key !== 'name'; sortBy = key; draw(); }); head.append(b); }
  const list = el('div', 'st-list'); const folded = el('details', 'st-maxed');
  const order = { gap, eta: s => -(etaOf(s.name) ? 1 : 0), name: s => s.name, level: s => s.level + pct(s.xp, s.xpLevelStart, s.xpNextLevel) / 100, abyssal: s => (s.abyssalLevel ?? 0) / (s.abyssalCap || 1), pool: s => Math.min(...(s.masteryPools || []).map(p => p.cap ? p.xp / p.cap : 2), 2) };
  const draw = () => {
    for (const b of filters.children) b.setAttribute('aria-pressed', String(b.textContent.startsWith(kind)));
    for (const b of head.children) b.classList.toggle('sorted', b.dataset.sort === sortBy);
    const shown = skills.filter(s => kind === 'All' || (kind === 'Not maxed' ? !maxed(s) : SKILL_KIND[s.name] === kind));
    const key = order[sortBy]; const cmp = (a, b) => { const x = key(a), y = key(b); const d = typeof x === 'string' ? x.localeCompare(y) : x - y; return (desc ? -d : d) || a.name.localeCompare(b.name); };
    const open = shown.filter(s => !maxed(s)).sort(cmp), done = shown.filter(maxed).sort((a, b) => a.name.localeCompare(b.name));
    list.replaceChildren(...open.map(row));
    if (!open.length) list.append(el('p', 'muted', 'Every skill here is maxed.'));
    folded.replaceChildren(); folded.hidden = !done.length;
    const sum = el('summary'); sum.append(el('strong', '', 'Maxed'), el('span', 'muted', ' ' + done.length)); folded.append(sum, ...done.map(row));
    loadWikiIcons();
  };
  for (const k of kinds) { const n = skills.filter(s => k === 'All' || (k === 'Not maxed' ? !maxed(s) : SKILL_KIND[s.name] === k)).length; if (!n) continue; const b = el('button', '', k + ' · ' + n); b.type = 'button'; b.addEventListener('click', () => { kind = k; draw(); }); filters.append(b); }
  panel.classList.toggle('no-abyss', !abyss);
  panel.append(filters);
  if (pending) panel.append(el('p', 'muted st-pending', 'Measured XP/h needs two scans with play in between (' + pending.replace('ETA pending: ', '') + '). Italic values are estimates for the current or best action.'));
  panel.append(head, list, folded); draw();
  return panel;
}
// Bank view in the game's style: icon tiles grouped by item type, "In use" first, value from the sell price.
function inventorySheet(c) {
  const panel = el('section', 'panel inventory'); panel.dataset.panel = 'inventory';
  const inventory = c.observed.inventory || [];
  if (!inventory.length) { panel.append(el('p', 'muted', 'Refresh this character to load inventory.')); return panel; }
  const value = item => item.currency === 'GP' ? item.sell * item.quantity : 0;
  const gp = inventory.reduce((sum, item) => sum + value(item), 0);
  const ap = inventory.reduce((sum, item) => sum + (item.currency === 'AP' ? item.sell * item.quantity : 0), 0);
  // ~10 families over the game's 80-odd item types; the raw type stays in the tile tooltip
  // by what the item is (class and equipment slot), the type text only as a fallback: a Diamond is a resource, an Agile Gem is gear
  const RESOURCE_TYPES = /logs|ore|bar|herb|fish|hide|shard|bone|essence|leather|plank|thread|fibre|ash|dust|crystal|soul|gem|fragment|material|ingredient|arrowhead|headless|unstrung|leaves/i;
  const family = item => {
    if (/artefact/i.test(item.type || '')) return 'Artefacts';
    if (item.slot === 'Summon1' || item.slot === 'Summon2') return 'Familiars';
    if (item.slot === 'Consumable') return 'Consumables';
    if (item.slot) return 'Equipment';
    if (item.kind === 'FoodItem') return 'Food';
    if (item.kind === 'PotionItem') return 'Potions';
    if (item.kind === 'RuneItem') return 'Runes';
    if (/seed/i.test(item.type || '')) return 'Seeds';
    if (!item.kind && /armour|weapon|amulet|ring|cape|glove|boot|helm|shield|quiver/i.test(item.type || '')) return 'Equipment';
    if (RESOURCE_TYPES.test(item.type || '')) return 'Resources';
    return 'Other';
  };
  const types = new Map(); for (const item of inventory) { const t = family(item); types.set(t, (types.get(t) || []).concat(item)); }
  const summary = el('div', 'insight-chips inv-summary');
  summary.append(el('span', '', inventory.length.toLocaleString('en-US') + ' items'), el('span', '', types.size + ' groups'), el('span', '', 'bank value ' + fmtCompact(gp) + ' GP'));
  if (ap) summary.append(el('span', '', fmtCompact(ap) + ' AP'));
  if (!inventory[0].type) summary.append(el('span', 'chip-warn', 'refresh to load categories and values'));

  const tile = (item, warn) => {
    const t = el('a', 'bank-tile' + (warn ? ' low' : '')); t.href = 'https://wiki.melvoridle.com/w/' + encodeURIComponent(item.name.replace(/ /g, '_')); t.target = '_blank'; t.rel = 'noopener';
    t.title = item.name + (item.type ? ' (' + item.type + ')' : '') + ' x' + item.quantity.toLocaleString('en-US') + (value(item) ? ' · ' + fmtCompact(value(item)) + ' GP' : '') + (warn ? ' · ' + warn : '');
    t.dataset.name = item.name.toLowerCase();
    const icon = el('span', 'bank-icon');
    if (item.media) { const img = el('img'); img.src = item.media; img.alt = ''; img.loading = 'lazy'; icon.append(img); } else icon.dataset.wikiTitle = item.name;
    t.append(icon, el('span', 'bank-qty', fmtCompact(item.quantity)), el('span', 'bank-name', item.name));
    return t;
  };
  const grid = items => { const g = el('div', 'bank-grid'); g.append(...items); return g; };

  // In use: equipped stackables and food, flagged when the runway is under a day
  const byName = new Map(inventory.map(item => [item.name, item]));
  const eq = c.observed.equipment || {};
  const usedNames = [...new Set([eq.Quiver, eq.Consumable, eq.Summon1, eq.Summon2, c.observed.food].filter(Boolean))];
  const runway = name => insights(c).find(i => i.type === 'resource_runway' && i.label.includes(name) && i.etaSeconds != null);
  const equippedQty = name => name === c.observed.food ? c.observed.foodQty : Object.entries(eq).filter(([, n]) => n === name).reduce((q, [slot]) => q + ((c.observed.equipmentQuantities || {})[slot] || 0), 0);
  const inUse = usedNames.map(name => { const r = runway(name); const item = { ...(byName.get(name) || { name }), quantity: equippedQty(name) || byName.get(name)?.quantity || 0 }; return tile(item, r && r.etaSeconds < 86400 ? 'runs out in ' + fmtEta(r.etaSeconds) : null); });

  const filter = document.createElement('input'); filter.type = 'search'; filter.placeholder = 'Filter items…'; filter.setAttribute('aria-label', 'Filter inventory');
  const sort = document.createElement('select'); sort.setAttribute('aria-label', 'Sort inventory'); sort.append(new Option('Sort: value', 'value'), new Option('Sort: quantity', 'quantity'), new Option('Sort: name', 'name'));
  const cats = el('div', 'seg inv-cats'); let wanted = '';
  const chip = (label, key) => { const b = el('button', '', label); b.type = 'button'; b.setAttribute('aria-pressed', String(key === wanted)); b.addEventListener('click', () => { wanted = key; for (const x of cats.children) x.setAttribute('aria-pressed', String(x === b)); show(); }); return b; };
  const sortedTypes = [...types].sort((a, b) => b[1].length - a[1].length);
  cats.append(chip('All', ''), ...sortedTypes.slice(0, 12).map(([t, items]) => chip(t + ' · ' + items.length, t)));
  if (sortedTypes.length > 12) { const more = document.createElement('select'); more.setAttribute('aria-label', 'More categories'); more.append(new Option('More…', ''), ...sortedTypes.slice(12).map(([t, items]) => new Option(t + ' ' + items.length, t))); more.addEventListener('change', () => { wanted = more.value; for (const x of cats.children) if (x.tagName === 'BUTTON') x.setAttribute('aria-pressed', String(!wanted && x.textContent === 'All')); show(); }); cats.append(more); }

  const sections = el('div', 'stack');
  const order = { value: (a, b) => value(b) - value(a) || b.quantity - a.quantity, quantity: (a, b) => b.quantity - a.quantity, name: (a, b) => a.name.localeCompare(b.name) };
  const show = () => {
    const q = filter.value.toLowerCase(); sections.replaceChildren();
    const groups = [...types].filter(([t]) => !wanted || t === wanted)
      .map(([t, items]) => [t, items.filter(item => !q || item.name.toLowerCase().includes(q)).sort(order[sort.value])]).filter(([, items]) => items.length)
      .sort((a, b) => sort.value === 'name' ? a[0].localeCompare(b[0]) : a[1].reduce((s2, i) => s2 + value(i), 0) < b[1].reduce((s2, i) => s2 + value(i), 0) ? 1 : -1);
    for (const [t, items] of groups) {
      const d = el('details', 'bank-group'); d.open = groups.indexOf(groups.find(g => g[0] === t)) < 3 || Boolean(q) || Boolean(wanted);
      const head = el('summary'); head.append(el('strong', '', t), el('span', 'muted', ' ' + items.length + ' · ' + fmtCompact(items.reduce((s2, i) => s2 + value(i), 0)) + ' GP'));
      d.append(head, grid(items.map(item => tile(item)))); sections.append(d);
    }
    if (!groups.length) sections.append(el('p', 'muted', 'No item matches.'));
    loadWikiIcons();
  };
  show();
  filter.addEventListener('input', show); sort.addEventListener('change', show);
  const controls = el('div', 'controls'); controls.append(filter, sort);
  panel.append(summary, controls, cats);
  if (inUse.length) { const b = el('section', 'group'); b.append(el('h3', '', 'In use'), grid(inUse)); panel.append(b); }
  panel.append(sections);
  return panel;
}
function render() {
  renderTodo();
  const q = document.getElementById('q').value.toLowerCase();
  const wantAction = fAction.value, wantRisk = document.getElementById('fRisk').value, wantStatus = fStatus.value, wantPriority = document.getElementById('fPriority').value;
  const attentionOnly = document.getElementById('fAttention').checked;
  cards.replaceChildren();
  const sortBy = document.getElementById('sort').value;
  const done = c => c.observed.completion?.total ?? -1;
  const entries = Object.entries(snap.characters).sort((a, b) => sortBy === 'name' ? a[0].localeCompare(b[0]) : sortBy === 'completion' ? done(b[1]) - done(a[1]) : score(b[1]) - score(a[1]) || RANK[priority(a[1])] - RANK[priority(b[1])] || a[0].localeCompare(b[0]));
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
    if (quick === 'attention' && !attention(name, c)) continue;
    if (quick === 'combat' && action !== 'Combat') continue;
    if (quick === 'skilling' && (action === 'Combat' || action === 'idle')) continue;
    if (quick === 'soon' && !(snap.account.operations?.nearTermCompletions || []).includes(name)) continue;
    if (quick === 'risk' && !hasRisk(name)) continue;

    const p = priority(c);
    const eta = insights(c).find(i => i.type === 'progress_eta' && i.etaSeconds !== undefined) || insights(c).find(i => i.type === 'progress_eta');
    const concern = insights(c).find(i => i.severity === 'danger' || i.severity === 'warning');
    const decision = (concern && !isAutomaticTask(concern.label) ? concern : null) || insights(c).find(i => !isAutomaticTask(i.label) && i.actionable);
    const progress = eta?.etaSeconds && eta.metric ? fmtEta(eta.etaSeconds) + ' · ' + eta.metric.toLocaleString() + ' ' + eta.unit + ' left' : eta?.label || 'No ETA yet';
    const details = el('details', 'character priority-' + p);
    if (keepOpen?.name === name) details.open = true;
    const head = el('summary', 'character-head');
    const identity = el('div', 'identity');
    const identityTitle = el('div', 'identity-title');
    identityTitle.append(el('strong', '', name), el('span', 'badge info', 'total lvl ' + score(c).toLocaleString('en-US')));
    if (p === 'critical') identityTitle.append(el('span', 'badge danger', p));
    const lagging = Math.abs(Date.parse(snap.generatedAt) - Date.parse(c.observed.at)) > 30 * 60000;
    identity.append(identityTitle, el('small', '', (c.observed.mode || '') + (lagging ? ' · scanned ' + relative(c.observed.at) : '')));
    if (hasRisk(name)) identity.append(el('span', 'badge risk', 'save risk'));
    const cell = (label, value) => { const n = el('div', 'cell'); const text = el('span', 'cell-value'); text.append(value || 'n/a'); n.append(el('span', 'cell-label', label), text); return n; };
    const goal = goalOf(name, c), gl = goalLines(c, goal);
    const next = gl?.length ? short(planLine(gl[0]) || gl[0].split('; ').slice(0, 2).join(' · '), 72) : nextAction(decision);
    const nextCell = cell('Next', wikiText(next)); if (/^(Nothing|ETA pending)/.test(next)) nextCell.classList.add('idle');
    // discreet goal button: the shared picker rewrites Next without opening the card
    nextCell.querySelector('.cell-label').after(goalButton(name, c, 'goal-pick'));
    const done = c.observed.completion?.total;
    const completionCell = cell('Completion', null); completionCell.classList.add('completion-cell');
    if (done != null) { const bar = el('progress'); bar.max = 100; bar.value = done; completionCell.querySelector('.cell-value').replaceChildren(el('span', '', done.toFixed(1) + '%'), bar); }
    head.append(identity, cell('Current', wikiText(current(c) + (eta?.etaSeconds ? ' · ' + fmtEta(eta.etaSeconds) : ''))), nextCell, completionCell);
    details.append(head);

    const body = el('div', 'character-body');
    const equipment = equipmentSheet(c);
    const history = el('div', 'panel history'); history.dataset.panel = 'history';
    // what changed between two journal entries, from their State lines
    const stateOf = h => { const text = (h.state || []).join('\n'); const num = re => { const m = re.exec(text); return m ? m[1] : null; };
      const gp = num(/GP ([\d.]+[KMBT]?)/); const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
      return { action: num(/Action: ([^(\n]+?) \(/), total: +num(/Total level (\d+)/), maxed: num(/maxed (\d+\/\d+)/), combat: +num(/combat (\d+)/), gp: gp ? parseFloat(gp) * (mult[gp.slice(-1)] || 1) : null }; };
    const entries = c.history || [];
    let quiet = null;
    for (const [i, h] of entries.slice(0, 5).entries()) {
      const now = stateOf(h), before = entries[i + 1] ? stateOf(entries[i + 1]) : null;
      const changes = !before ? ['first journal entry' + (now.action ? ' · ' + now.action : '')] : [
        now.action !== before.action && now.action ? 'activity: ' + (before.action || 'idle') + ' → ' + now.action : null,
        now.total > before.total ? 'total level +' + (now.total - before.total) + ' (' + now.total + ')' : null,
        now.maxed && now.maxed !== before.maxed ? 'maxed skills ' + now.maxed : null,
        now.combat > before.combat ? 'combat level +' + (now.combat - before.combat) : null,
        now.gp != null && before.gp != null && Math.abs(now.gp - before.gp) >= 1e6 ? 'GP ' + (now.gp > before.gp ? '+' : '−') + fmtCompact(Math.abs(now.gp - before.gp)) : null,
      ].filter(Boolean);
      if (!changes.length) { // fold a run of unchanged scans into one line
        if (quiet) { quiet.count++; quiet.time.textContent = new Date(h.at).toLocaleString() + ' → ' + quiet.last; quiet.chip.textContent = 'no change · ' + quiet.count + ' scans'; continue; }
      } else quiet = null;
      const row = el('div', 'history-entry'); const time = el('time', '', new Date(h.at).toLocaleString()); row.append(time);
      const chips = el('div', 'insight-chips'); for (const change of changes.length ? changes : ['no change']) chips.append(el('span', '', change));
      if (!changes.length) quiet = { count: 1, time, chip: chips.firstChild, last: new Date(h.at).toLocaleString() };
      const box = el('div', 'insight'); box.append(chips); row.append(box); history.append(row);
    }
    const hidden = ['stale', 'done', 'dismissed'].reduce((n, s) => n + (c.decisions[s] || []).length, 0);
    const actions = STATUSES.filter(s => !['stale', 'done', 'dismissed'].includes(s)).flatMap(s => (c.decisions[s] || []).map(a => decisionRow(a, s)));
    const panels = [
      insightPanel(insights(c).filter(i => i.source !== 'progress_eta' && i.type !== 'status' && !planLine(i.label))),
      skillsSheet(c, name),
      completionSheet(c),
      equipment,
      upgradeSheet(c),
      inventorySheet(c),
      plansPanel(name, c, actions, hidden),
      history.children.length ? history : null,
    ].filter(Boolean);
    const tabs = el('div', 'tab-switch'); tabs.setAttribute('role', 'tablist');
    for (const [index, content] of panels.entries()) {
      const tabName = content.dataset.panel;
      const label = TAB_LABELS[tabName] || tabName;
      const btn = el('button', ''); btn.type = 'button'; btn.dataset.tab = tabName; btn.setAttribute('role', 'tab'); btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      if (TAB_ICONS[tabName]) btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + TAB_ICONS[tabName] + '</svg>';
      btn.append(el('span', 'tab-label', label));
      if (index && TAB_GROUP[tabName] !== TAB_GROUP[panels[index - 1].dataset.panel]) tabs.append(el('span', 'tab-sep'));
      if (TAB_INTRO[tabName]) content.prepend(el('p', 'tab-intro span-all', TAB_INTRO[tabName]));
      const active = keepOpen?.name === name ? keepOpen.tab === tabName : index === 0;
      btn.setAttribute('aria-selected', String(active));
      content.hidden = !active; tabs.append(btn); body.append(content);
    }
    body.prepend(tabs);
    // the raw Markdown journal sits at the end of the tab bar instead of a footer link
    const journal = el('a', 'tab-link'); journal.href = encodeURIComponent(name) + '.md'; journal.target = '_blank'; journal.rel = 'noopener'; journal.title = 'Full Markdown journal';
    journal.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    journal.append(el('span', 'tab-label', 'Journal')); tabs.append(journal);
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
for (const id of ['q', 'sort', 'fAction', 'fRisk', 'fStatus', 'fPriority', 'fAttention']) document.getElementById(id).addEventListener('input', () => { render(); loadWikiIcons(); });
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
