// Camp momentum. Run: node test-momentum.js
const S = require('./scoring.js'), assert = require('assert');
const mk = (d, o) => Object.assign({ date:d, v:2, sessions:[], nutrition:true, family:true, sleep:8, screen:1, energy:5, soreness:5, mood:5, stress:5, weight:'', notes:'' }, o);
const days = (from, n, f) => Array.from({ length:n }, (_, i) => { const d = new Date(from + 'T12:00'); d.setDate(d.getDate() + i); return mk(S.ymd(d), f ? f(i) : {}); });
const at = d => new Date(d + 'T12:00'), ST = '2026-09-19', FD = '2026-11-21', T = at('2026-10-31'); // 42 closed camp days, 21 to fight
const M = (es, o = {}) => S.momentum(es, o.today || T, o.start === undefined ? ST : o.start, o.fight === undefined ? FD : o.fight);
// perfect camp: 100% weighted, 42-day streak -> 5
let m = M(days(ST, 43)); assert.equal(m.campDays, 42); assert.equal(m.streak, 42); assert.equal(m.weighted, 100); assert.equal(m.points, 5); assert.equal(m.daysToFight, 21);
// today is not counted (open day): today unlogged changes nothing
assert.equal(M(days(ST, 42)).points, 5);
// no camp start -> 0; fewer than 7 closed days -> 0
assert.equal(M(days(ST, 43), { start:null }).points, 0); assert.equal(M(days('2026-10-26', 6), { start:'2026-10-26' }).points, 0);
// unlogged days count as missed: log only every other day -> ~50% -> ~0 weighted pts, streak <= 1
m = M(days(ST, 43).filter((_, i) => i % 2 === 0)); assert.ok(m.weighted > 45 && m.weighted < 55, m.weighted); assert.ok(m.points <= 0.5, m.points);
// late days weigh more: missing the first 10 days beats missing the last 10 days
const early = M(days(ST, 43, i => ({ nutrition: i >= 10 }))), late = M(days(ST, 43, i => ({ nutrition: i < 32 })));
assert.ok(early.weighted > late.weighted, early.weighted + ' vs ' + late.weighted); assert.equal(late.streak, 0); assert.equal(early.streak, 32);
// training < 100% breaks consistency; rest day (no sessions) is 100%; cheat day counts as nutrition hit
assert.ok(!S.isConsistent(mk('2026-10-01', { sessions:[{ done:true },{ done:false }] }))); assert.ok(S.isConsistent(mk('2026-10-01', { sessions:[] })));
assert.ok(S.isConsistent(mk('2026-10-01', { nutrition:false, cheat:true })));
// streak part: 7-day streak -> +0.5
m = M(days(ST, 43, i => ({ nutrition: i < 20 || i >= 35 }))); assert.equal(m.streak, 7); assert.equal(m.sPts, 0.5);
// no fight date: assumes 70-day camp, still works
m = M(days(ST, 43), { fight:null }); assert.equal(m.points, 5); assert.equal(m.daysToFight, null); assert.equal(m.campLength, 70);
// compute adds momentum on top and caps at 100
const r = S.compute(days(ST, 43), T, { startDate:ST, fightDate:FD }); assert.equal(r.momentum.points, 5); assert.ok(r.score <= 100);
const r2 = S.compute(days(ST, 43, i => ({ sleep:6, screen:3 })), T, { startDate:ST, fightDate:FD }); assert.equal(r2.score, Math.round(Math.min(100, r2.base + r2.bonus + 5)));
console.log('MOMENTUM OK');
