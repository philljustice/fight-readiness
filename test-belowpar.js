// Below-par reasons. Run: node test-belowpar.js
const S = require('./scoring.js'), assert = require('assert');
const mk = (d, o) => Object.assign({ date:d, v:2, sessions:[], nutrition:true, family:true, sleep:8, screen:1, energy:5, soreness:1, mood:5, stress:1, hydration:2, weight:'', notes:'' }, o);
const days = (n, f) => Array.from({ length:n }, (_, i) => { const d = new Date('2026-10-10T12:00'); d.setDate(d.getDate() + i); return mk(S.ymd(d), f ? f(i) : {}); });
const T = new Date('2026-10-31T12:00'), run = es => { const r = S.compute(es, T, { startDate:'2026-10-01' }); return { r, L: S.belowPar(r) }; };
assert.equal(S.PAR, 75);
// all good -> nothing below par
assert.deepEqual(run(days(21)).L, []);
// low wellness: soreness 1 and stress 2 every day, mood 2 on 7 days, dark hydration on 4 mornings; short sleep
let { r, L } = run(days(21, i => ({ soreness:5, stress:4, energy:2, mood: i < 7 ? 2 : 3, hydration: i < 4 ? 7 : 2, sleep:6 })));
const W = L.find(x => x.key === 'wellness'); assert.ok(W && r.cats.wellness < 75, JSON.stringify(L));
assert.ok(W.why[0].startsWith('Soreness avg 5.0/5 — high soreness (4–5) on 21 days'), W.why[0]);
assert.ok(W.why.some(y => /Mood avg 2\.7\/5 — low mood \(1–2\) on 7 days/.test(y)), W.why.join('|'));
assert.ok(W.why.some(y => y === 'Dark first-pee colour (dehydrated) on 4 mornings'));
const SL = L.find(x => x.key === 'sleep'); assert.ok(SL.why.includes('Average 6.0h vs 8h target') && SL.why.includes('Under 7h on 21 nights'), SL.why);
assert.ok(!L.find(x => x.key === 'nutrition') && !L.find(x => x.key === 'training'));
// missed sessions, nutrition and family
({ L } = run(days(21, i => ({ sessions:[{ done: i % 2 === 0 }], nutrition: i % 3 === 0, family: i < 5 }))));
assert.ok(L.find(x => x.key === 'training').why.includes('Missed 10 of 21 scheduled sessions'));
assert.ok(L.find(x => x.key === 'nutrition').why.includes('Plan not followed on 14 days of 21'));
assert.ok(L.find(x => x.key === 'family').why.includes('No family/friends time on 16 days of 21'));
// heavy screen
({ L } = run(days(21, () => ({ screen:5 })))); assert.ok(L.find(x => x.key === 'screen').why.includes('Average 5.0h/day vs 2h limit'));
console.log('belowpar ok');
