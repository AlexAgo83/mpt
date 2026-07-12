#!/usr/bin/env node
// Offline self-check for journal pure logic: ids, dedup, dismissed, stale, latest.json shape.
const assert = require('assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { buildCharacterJournal, journalMd, mergeLedger, buildLatest, renderDashboard, potionItemName, journalRefreshSummary, sanitizeIncident, incidentSignature, readIncidents, incidentCandidates, promoteIncidentCandidates, structuredInsights } = require('./melvor-report.js');

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

assert.strictEqual(potionItemName('Damage Reduction Potion IV for first clear safety'), 'Damage Reduction Potion IV');
assert.strictEqual(potionItemName('Ranged Assistance Potion IV if accuracy is the bottleneck'), 'Ranged Assistance Potion IV');

const c = buildCharacterJournal('TestChar', data, save);
assert.strictEqual(c.actions.length, 1, 'Fishing without Octopus proposes one equip');
const a = c.actions[0];
assert.strictEqual(a.item, 'Octopus');
assert.match(a.id, /^[0-9a-f]{12}$/);
assert.strictEqual(c.analysis.saveRisk, null, 'known local source is not a journal risk');
assert.ok(c.observed.saveSource.source === 'local');

const noStock = buildCharacterJournal('NoStock', { ...data, bank: {} }, save);
assert.strictEqual(noStock.actions.length, 0, 'missing bank items are not proposed');
const proven = buildCharacterJournal('Proven', {
  ...data,
  report: { ...data.report, action: 'Cooking', equipment: { Amulet: 'Amulet of Fishing' } },
  bank: { 'Jeweled Necklace': 1 },
  skills: [{ name: 'Cooking', level: 10, levelCap: 120, abyssalLevel: 1, abyssalCap: 60 }],
  skillingOptions: { Cooking: [{ recipe: 'Abyssal Soup', abyssalLevel: 1, maxActions: 20000, runwayHours: 12, xpPerHour: 1000, inputs: [{ item: 'Abyssal Fish', owned: 20000, perAction: 1 }] }] },
}, save);
assert.strictEqual(proven.actions[0].item, 'Jeweled Necklace', 'owned replacement is proposed');
assert.match(proven.analysis.abyssalPlan[0], /Abyssal Soup; 20000 actions; 12.0 h runway/);

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

// Level ETA: computed only from comparable skill snapshots, then preserved on dashboard rebuilds.
const withSkills = (xp, at, action = 'Fishing') => {
  const entry = buildCharacterJournal('EtaChar', {
    ...data,
    report: { ...data.report, action, equipment: { Summon2: 'Octopus' } },
    skills: [
      { name: 'Fishing', level: 50, xp, levelCap: 99 },
      { name: 'Attack', level: 40, xp: 40000, levelCap: 99 },
    ],
  }, save);
  entry.observed.at = at;
  return entry;
};
const etaPrev = buildLatest([withSkills(100000, '2026-07-05T12:00:00.000Z')], new Map(), null, now);
const etaSnap = buildLatest([withSkills(106000, '2026-07-05T12:10:00.000Z')], new Map(), etaPrev, now);
assert.ok(/Fishing: 6,000 XP gained/.test(etaSnap.characters.EtaChar.analysis.progressEtas[0]), 'skill ETA uses XP delta');
const etaRebuild = buildLatest([], new Map(), etaSnap, '2026-07-05T12:11:00.000Z');
assert.deepStrictEqual(etaRebuild.characters.EtaChar.analysis.progressEtas, etaSnap.characters.EtaChar.analysis.progressEtas, 'ETA survives rebuild without scan');
const etaPending = buildLatest([withSkills(106000, '2026-07-05T12:10:00.000Z')], new Map(), prevSnap, now);
assert.match(etaPending.characters.EtaChar.analysis.progressEtas[0], /previous journal snapshot has no skill XP/);
const cloudPrevEntry = withSkills(106000, '2026-07-05T12:00:00.000Z');
cloudPrevEntry.observed.saveSource = { source: 'cloud', diffMinutes: -60 };
const cloudPrev = buildLatest([cloudPrevEntry], new Map(), null, now);
const cloudAgain = withSkills(105000, '2026-07-05T12:10:00.000Z');
cloudAgain.observed.saveSource = { source: 'cloud', diffMinutes: -60 };
const cloudSnap = buildLatest([cloudAgain], new Map(), cloudPrev, now);
assert.match(cloudSnap.characters.EtaChar.analysis.progressEtas[0], /cloud save has not advanced/);
assert.ok(!cloudSnap.characters.EtaChar.analysis.alerts.some(a => /XP is lower/.test(a)), 'same cloud snapshot cannot regress XP');
const withAbyssal = (abyssalXP, at) => {
  const entry = buildCharacterJournal('AbyssEtaChar', {
    ...data,
    report: { ...data.report, action: 'Thieving', equipment: {} },
    skills: [{ name: 'Thieving', level: 120, xp: 104000000, levelCap: 120, abyssalLevel: 1, abyssalCap: 60, abyssalXP, abyssalXPNextLevel: 13000 }],
  }, save);
  entry.observed.at = at;
  return entry;
};
const abyssPrev = buildLatest([withAbyssal(1000, '2026-07-05T12:00:00.000Z')], new Map(), null, now);
const abyssSnap = buildLatest([withAbyssal(7000, '2026-07-05T12:10:00.000Z')], new Map(), abyssPrev, now);
assert.ok(/Thieving: 6,000 abyssal XP gained/.test(abyssSnap.characters.AbyssEtaChar.analysis.progressEtas[0]), 'abyssal XP delta is reported');
assert.ok(/abyssal next level ETA/.test(abyssSnap.characters.AbyssEtaChar.analysis.progressEtas[0]), 'abyssal ETA uses mapped thresholds');

// latest.json shape
const snap = buildLatest([c], first.latest, null, now);
assert.deepStrictEqual(Object.keys(snap).sort(), ['account', 'actionsSummary', 'characters', 'generatedAt']);
const cc = snap.characters.TestChar;
assert.ok(cc.observed && cc.analysis && cc.decisions, 'observed/analysis/decisions present');
assert.strictEqual(cc.decisions.proposed.length, 1);
assert.strictEqual(snap.actionsSummary.proposed, 1);
assert.ok(!snap.account.saveRisks.includes('TestChar'));
assert.ok(snap.account.operations && snap.account.operations.openDecisions === 1);
const insights = structuredInsights({
  observed: { action: 'Combat' },
  analysis: {
    alerts: ['current XP is lower than previous scan; verify source-of-truth before acting'],
    recommendations: ['Slayer task ETA about 4 min (14 kills left)'],
    currentActionPlan: ['Slayer task ETA about 4 min (14 kills left)'],
  },
});
assert.strictEqual(insights.length, 2, 'duplicate recommendation text is collapsed');
assert.deepStrictEqual(insights[0], {
  id: insights[0].id,
  type: 'source_of_truth', priority: 'critical', severity: 'danger',
  label: 'current XP is lower than previous scan; verify source-of-truth before acting',
  source: 'alert', actionable: true,
});
assert.strictEqual(insights[1].etaSeconds, 240);
assert.strictEqual(insights[1].metric, 14);
assert.strictEqual(insights[1].unit, 'kills');

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
assert.ok(html.includes('sauvegarde à risque') && html.includes('à surveiller'), 'risk and attention controls present');
assert.ok(html.includes('Commencer ici') && html.includes('À faire') && html.includes("panel('progress'") && html.includes("panel('plans'"), 'cockpit focus and detail tabs present');
assert.ok(!/Users\/|password|9223|chrome-profile/i.test(html), 'dashboard is sanitized');

const refreshedAt = '2026-07-05T12:01:00.000Z';
const previousForRefresh = structuredClone(snap);
const refreshed = buildLatest([c], first.latest, previousForRefresh, refreshedAt);
refreshed.characters.TestChar.analysis.alerts = ['new warning'];
const refreshLines = journalRefreshSummary(refreshed, previousForRefresh, refreshedAt);
assert.match(refreshLines[0], /characters 1 \| save risks 0 \| new alerts 1$/);
assert.strictEqual(refreshLines[1], '  alert: TestChar: new warning');
assert.throws(() => journalRefreshSummary(snap, snap, now), /was not refreshed/);

const testPort = 20000 + process.pid % 30000;
const lock = `/tmp/melvor-report-${testPort}.lock`;
const incidents = `/tmp/melvor-incidents-${process.pid}.jsonl`;
fs.writeFileSync(lock, String(process.pid));
try {
  const blocked = spawnSync(process.execPath, ['melvor-report.js', 'smoke'], {
    cwd: __dirname,
    env: { ...process.env, MELVOR_ACCOUNT: 'test', MELVOR_TEST_PORT: String(testPort), MELVOR_INCIDENT_FILE: incidents },
    encoding: 'utf8',
  });
  assert.strictEqual(blocked.status, 1);
  assert.match(blocked.stderr, new RegExp(`port ${testPort}:\\s+${process.pid}\\s+\\S+\\s+node`));
  const captured = readIncidents(incidents);
  assert.strictEqual(captured.length, 1);
  assert.ok(captured[0].durationMs >= 0);
  assert.ok(!captured[0].message.includes(process.env.HOME));
} finally {
  fs.unlinkSync(lock);
  fs.rmSync(incidents, { force: true });
}

const safe = sanitizeIncident(`failed at ${process.env.HOME}/secret <https://localhost:9223/json> ${'x'.repeat(100)}`);
assert.strictEqual(safe, 'failed at <path>/secret <<url> <redacted>');
const signature = incidentSignature('journal', 'port 9223: PID 123 ran for 00:12');
assert.strictEqual(signature, incidentSignature('journal', 'port 9333: PID 456 ran for 00:45'));
assert.strictEqual(incidentCandidates([
  { ts: '2026-07-01', signature, command: 'journal all --record', message: 'failed' },
  { ts: '2026-07-02', signature, command: 'journal all --record', message: 'failed' },
]).at(0).count, 2);
const promotions = `/tmp/melvor-promotions-${process.pid}.jsonl`;
const candidate = incidentCandidates([
  { ts: '2026-07-01', signature, command: 'journal all --record', message: 'failed' },
  { ts: '2026-07-02', signature, command: 'journal all --record', message: 'failed' },
]);
let promotionRuns = 0;
const fakeLogics = (_command, args) => {
  promotionRuns++;
  return JSON.stringify({ ref: args[0] === 'flow' ? 'req_test' : null });
};
assert.strictEqual(promoteIncidentCandidates(candidate, promotions, fakeLogics).length, 1);
assert.strictEqual(promoteIncidentCandidates(candidate, promotions, fakeLogics).length, 0);
assert.strictEqual(promotionRuns, 2, 'one request and one index refresh');
fs.rmSync(promotions, { force: true });

console.log('journal self-check ok');
