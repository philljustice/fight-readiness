// Overtraining risk detector (fr-v46). Run: node test-overtraining.js
const I = require('./insights.js'), S = require('./scoring.js'), assert = require('assert');
const T = new Date(2026, 10, 1, 12), day = i => { const d = new Date(T); d.setDate(d.getDate() - i); return S.ymd(d); };
// i = days ago; base healthy athlete (higher is higher: soreness/stress 5 = very sore/stressed)
const mk = (i, o = {}) => Object.assign({ date: day(i), v: 2, sessions: [{ done: true, rpe: o.rpe ?? 6, mins: o.mins ?? 60 }], nutrition: true, family: true, sleep: 8.5, screen: 1,
  energy: 4, soreness: 2, stress: 2, mood: 4, sleepq: 4, motivation: 4, appetite: 4, injury: 'none', ill: false, weight: 171 }, o);
const vary = i => ({ mins: [60, 45, 75, 0, 60, 90, 30][i % 7], rpe: [6, 5, 7, 1, 6, 7, 4][i % 7] });
const hist = (n, f = () => ({})) => Array.from({ length: n }, (_, i) => mk(i, Object.assign(vary(i), f(i))));
const run = es => I.overtraining(es, T);

// 1. normal varied training: no alert
assert.equal(run(hist(35)).level, null, 'steady training, fine');
// 2. normal hard week (load spike) but feeling fine: no alert
let a = run(hist(35, i => i < 7 ? { mins: 120, rpe: 8 } : {})); assert.equal(a.level, null, 'hard week, no signs -> no alert'); assert.ok(a.load.level, 'but load is flagged as high');
// 3. spike + soreness + low energy for 3 days -> high risk
a = run(hist(35, i => i < 7 ? Object.assign({ mins: 120, rpe: 8 }, i < 3 ? { soreness: 5, energy: 2 } : {}) : {}));
assert.equal(a.level, 'high', 'spike + 2 persistent signs'); assert.ok(a.reasons.some(r => /soreness/.test(r)) && a.reasons.some(r => /load/.test(r)), a.reasons);
// 4. spike + one sign -> watch
a = run(hist(35, i => i < 7 ? Object.assign({ mins: 120, rpe: 8 }, i < 3 ? { soreness: 5 } : {}) : {})); assert.equal(a.level, 'watch');
// 5. a single bad day is not persistent
assert.equal(run(hist(35, i => i < 7 ? Object.assign({ mins: 120, rpe: 8 }, i === 0 ? { soreness: 5, energy: 1 } : {}) : {})).level, null, 'one bad day ignored');
// 6. illness after high load -> high, even with only 5 days of data
a = run(hist(5, i => i === 0 ? { ill: true, rpe: 1, mins: 0 } : { rpe: 9, mins: 90 })); assert.equal(a.level, 'high', 'ill after hard days'); assert.ok(/ill/.test(a.reasons[0]));
// 7. illness on an easy normal week -> not an overtraining alert
assert.equal(run(hist(35, i => i === 0 ? { ill: true } : {})).level, null, 'illness alone, normal load');
// 8. monotony: identical hard load every day + 1 sign -> watch
a = run(hist(35, i => Object.assign({ mins: 90, rpe: 8 }, i < 2 ? { motivation: 1 } : {}))); assert.ok(a.load.reasons.some(r => /monotony/.test(r)), a.load); assert.equal(a.level, 'watch');
// 9. under 7 days of data, signs alone -> no alert
assert.equal(run(hist(5, i => ({ soreness: 5, energy: 1 }))).level, null, '<7 days: no alert');
// 10. 2+ signs trending with normal load -> watch
assert.equal(run(hist(35, i => i < 4 ? { mood: 2, stress: 5 } : {})).level, 'watch', 'signs trending');
// 11. resting HR spike + load -> high
a = run(hist(35, i => Object.assign({ rhr: i < 3 ? 60 : 50 }, i < 7 ? { mins: 120, rpe: 8 } : {}))); assert.equal(a.level, 'high', 'rhr + load');
// 12. before 28 days: week-over-week jump detects load
assert.ok(I.loadContext(hist(14, i => i < 7 ? { mins: 120, rpe: 8 } : {}), S.dayNum(day(0))).level, 'early load jump');
console.log('overtraining ok');
