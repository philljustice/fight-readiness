// Soreness/stress scale v2 (5 = worst) + one-time migration. Run: node test-wellscale.js
const S = require('./scoring.js'), I = require('./insights.js'), assert = require('assert');
// scoring inverts soreness/stress
assert.equal(S.wellnessScore({ energy:5, soreness:1, mood:5, stress:1 }), 100);
assert.equal(S.wellnessScore({ energy:1, soreness:5, mood:1, stress:5 }), 0);
assert.equal(S.wellnessScore({ energy:5, soreness:5, mood:5, stress:5 }), 50);
// migration: v1 entries (5 = best) flipped once; scores unchanged; idempotent
const v1 = [{ date:'2026-10-01', energy:4, soreness:5, mood:3, stress:2 }, { date:'2026-10-02', energy:3, soreness:'', mood:3, stress:1 }];
const oldScore = v1.map(e => { const v = [e.energy, e.soreness, e.mood, e.stress]; return v.every(x => x !== '') ? v.reduce((s, x) => s + (x - 1) * 25, 0) / 4 : null; });
const st = { entries: JSON.parse(JSON.stringify(v1)) };
assert.equal(S.migrateWellScale(st), true); assert.equal(st.wellScale, 2);
assert.equal(st.entries[0].soreness, 1); assert.equal(st.entries[0].stress, 4); assert.equal(st.entries[0].energy, 4);
assert.equal(st.entries[1].soreness, ''); assert.equal(st.entries[1].stress, 5);
assert.deepEqual(st.entries.map(S.wellnessScore), oldScore);
assert.equal(S.migrateWellScale(st), false); assert.equal(st.entries[0].soreness, 1); // second run: no change
// red flags: soreness/stress 4-5 flag, 1-2 don't; energy/mood 1-2 flag
const d = '2026-10-31', T = new Date(d + 'T12:00');
let f = I.wellness([{ date:d, energy:5, soreness:5, mood:5, stress:1 }], T).flags; assert.deepEqual(f.map(x => x.value), [5]);
f = I.wellness([{ date:d, energy:2, soreness:1, mood:5, stress:4 }], T).flags; assert.equal(f.length, 2);
// CSV carries scale marker
assert.ok(I.CSV_COLS.includes('Wellness_Scale')); assert.ok(I.toCSV([{ date:d, energy:5, soreness:1, mood:5, stress:1 }]).includes(',2,'));
console.log('wellscale ok');
