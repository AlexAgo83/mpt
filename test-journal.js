#!/usr/bin/env node
// Offline self-check for journal pure logic: ids, dedup, dismissed, stale, latest.json shape.
const assert = require('assert');
const { buildCharacterJournal, journalMd, mergeLedger, buildLatest, renderDashboard } = require('./melvor-report.js');

const data = {
  report: {
    name: 'TestChar', mode: 'Standard', action: 'Fishing', gp: 1000, combatLevel: 50,
    totalLevel: 800, maxedSkills: '2/30', hp: 500, food: 'Shrimp', foodQty: 100,
    equipment: { Summon2: 'Bear', Amulet: 'Amulet of Fishing' },
    lowSkills: [{ name: 'Agility', level: 10 }, { name: 'Harvesting', level: 1 }],
  },
  skilling: { notes: ['some note'] },
  bank: { Octopus: 3 },
};
const save = { source: 'local', diffMs: 10 * 60000 };
const now = '2026-07-05T12:00:00.000Z';

const c = buildCharacterJournal('TestChar', data, save);
assert.strictEqual(c.actions.length, 1, 'Fishing without Octopus proposes one equip');
const a = c.actions[0];
assert.strictEqual(a.item, 'Octopus');
assert.match(a.id, /^[0-9a-f]{12}$/);
assert.ok(c.analysis.saveRisk && /local save newer/.test(c.analysis.saveRisk), 'local-newer save risk detected');
assert.ok(c.observed.saveSource.source === 'local' && c.analysis.riskNotes.length >= 1);

// same state twice -> stable id, no duplicate event on rerun
const c2 = buildCharacterJournal('TestChar', data, save);
assert.strictEqual(c2.actions[0].id, a.id, 'action id is stable');
const first = mergeLedger([c], new Map(), now);
assert.strictEqual(first.events.length, 1);
assert.strictEqual(first.events[0].status, 'proposed');
const rerun = mergeLedger([c2], first.latest, now);
assert.strictEqual(rerun.events.length, 0, 'unchanged context proposes nothing');

// dismissed is respected until context changes
const dismissed = new Map(first.latest);
dismissed.set(a.id, { ...first.latest.get(a.id), status: 'dismissed' });
assert.strictEqual(mergeLedger([c2], dismissed, now).events.length, 0, 'dismissed not re-proposed');
const changed = buildCharacterJournal('TestChar', {
  ...data, report: { ...data.report, equipment: { ...data.report.equipment, Summon2: 'Eagle' } },
}, save);
const reproposed = mergeLedger([changed], dismissed, now);
assert.ok(reproposed.events.some(e => e.id === a.id && e.status === 'proposed'), 'context change re-proposes');

// open action no longer recommended -> stale
const idle = buildCharacterJournal('TestChar', { ...data, report: { ...data.report, action: 'Woodcutting' } }, save);
const stale = mergeLedger([idle], first.latest, now);
assert.ok(stale.events.some(e => e.id === a.id && e.status === 'stale'), 'dropped recommendation goes stale');

// open action whose item is now equipped -> done, not stale
const applied = buildCharacterJournal('TestChar', {
  ...data, report: { ...data.report, equipment: { ...data.report.equipment, Summon2: 'Octopus' } },
}, save);
const doneMerge = mergeLedger([applied], first.latest, now);
assert.ok(doneMerge.events.some(e => e.id === a.id && e.status === 'done'), 'applied action goes done');
assert.ok(!doneMerge.events.some(e => e.status === 'stale'), 'applied action is not stale');

// decisions are rebuilt from the ledger even for carried-over characters
const prevSnap = buildLatest([c], first.latest, null, now);
const afterDismiss = buildLatest([], dismissed, prevSnap, now);
assert.strictEqual(afterDismiss.characters.TestChar.decisions.dismissed.length, 1, 'carried-over decisions refresh');
assert.strictEqual(afterDismiss.characters.TestChar.decisions.proposed.length, 0);

// latest.json shape
const snap = buildLatest([c], first.latest, null, now);
assert.deepStrictEqual(Object.keys(snap).sort(), ['account', 'actionsSummary', 'characters', 'generatedAt']);
const cc = snap.characters.TestChar;
assert.ok(cc.observed && cc.analysis && cc.decisions, 'observed/analysis/decisions present');
assert.strictEqual(cc.decisions.proposed.length, 1);
assert.strictEqual(snap.actionsSummary.proposed, 1);
assert.ok(snap.account.saveRisks.includes('TestChar'));

// markdown entry has the required sections and no sensitive content
const md = journalMd(c);
for (const s of ['### State', '### Recommendations', '### Optimization plan', '### Proposed actions', '### History'])
  assert.ok(md.includes(s), `markdown has ${s}`);
assert.ok(!/Users\/|HOME|password|profile/i.test(md), 'markdown is sanitized');

// dashboard: self-contained, data escaped, no sensitive content
const evil = buildCharacterJournal('TestChar', {
  ...data, skilling: { notes: ['<script>alert(1)</script>'] },
}, save);
const html = renderDashboard(buildLatest([evil], first.latest, null, now));
assert.ok(!/<script>alert/.test(html), 'embedded JSON escapes <');
assert.ok(!/https?:\/\/(?!melvoridle)/.test(html), 'no external assets');
assert.ok(html.includes('SAVE RISK') && html.includes('stale only'), 'risk badge and stale filter present');
assert.ok(!/Users\/|password|9223|chrome-profile/i.test(html), 'dashboard is sanitized');

console.log('journal self-check ok');
