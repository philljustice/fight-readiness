// Earned weekend cheat day. Run: node test-cheatday.js
const C = require('./cheat.js'), S = require('./scoring.js'), I = require('./insights.js'), assert = require('assert');
const mk = (d, o) => Object.assign({ date:d, v:2, sessions:[], nutrition:true, family:true, sleep:8, screen:1, energy:5, soreness:5, mood:5, stress:5, hydration:2, weight:'', notes:'' }, o);
const days = (from, n, o) => Array.from({ length:n }, (_, i) => { const d = new Date(from + 'T12:00'); d.setDate(d.getDate() + i); return mk(S.ymd(d), typeof o === 'function' ? o(i) : o); });
const at = d => new Date(d + 'T12:00');
const START = '2026-10-12'; // Monday: first weekend of camp = Oct 17-18 (blocked); Oct 24-25 is the first eligible weekend
const full = days('2026-10-12', 19); // Mon Oct 12 .. Fri Oct 30
const ev = (es, today, o = {}) => C.evaluate(es, Object.assign({ today:at(today), startDate:START, profile:{} , params:{} }, o));
// earned on Saturday, both days claimable
let r = ev(full, '2026-10-31'); assert.equal(r.mon, '2026-10-26'); assert.ok(r.earned && r.unlocked, JSON.stringify(r.conds)); assert.deepEqual(r.claimable, ['2026-10-31','2026-11-01']);
// Sunday: only Sunday left
assert.deepEqual(ev(full, '2026-11-01').claimable, ['2026-11-01']);
// Friday: unlocked only once Friday's log is complete
assert.ok(ev(full, '2026-10-30').unlocked);
const friPartial = full.map(e => e.date === '2026-10-30' ? Object.assign({}, e, { screen:'' }) : e);
r = ev(friPartial, '2026-10-30'); assert.ok(!r.unlocked); assert.ok(!r.conds[0].ok); assert.ok(/1 more fully logged day/.test(r.left[0]));
// mid-week: not yet, progress text
r = ev(full.filter(e => e.date <= '2026-10-28'), '2026-10-28'); assert.ok(!r.earned); assert.ok(r.conds[0].text.includes('3/5'));
// nutrition hits: 3 of 5 fails, 4 of 5 passes
const hits = n => full.map(e => e.date >= '2026-10-26' && e.date <= '2026-10-30' && (Date.parse(e.date) - Date.parse('2026-10-26')) / 864e5 >= n ? Object.assign({}, e, { nutrition:false }) : e);
assert.ok(ev(hits(4), '2026-10-31').conds[0].ok); r = ev(hits(3), '2026-10-31'); assert.ok(!r.conds[0].ok); assert.ok(r.left.some(x => /1 more on-target nutrition day/.test(x)));
// goal-mode day: score >= 80 counts as hit
const goal = (k) => ({ nutrition:null, nmode:'kcal', ntarget:{ kcal:2400 }, kcal:k });
const g = full.map(e => e.date >= '2026-10-26' && e.date <= '2026-10-27' ? Object.assign({}, e, goal(e.date === '2026-10-26' ? 2500 : 3000)) : e);
r = ev(g, '2026-10-31'); assert.ok(r.conds[0].text.includes('on target 4/5'));
// pace: low score fails unless up 3+ points on last week
const low = full.map(e => Object.assign({}, e, { sleep:5, screen:4, family:false })); assert.ok(!ev(low, '2026-10-31').conds[1].ok);
const rising = full.map(e => e.date < '2026-10-24' ? Object.assign({}, e, { sleep:4, screen:5, family:false, nutrition:false, energy:1 }) : Object.assign({}, e, { sleep:5, screen:4, family:false }));
r = ev(rising, '2026-10-31'); assert.ok(r.conds[1].ok, r.conds[1].text);
// blackout: first weekend of camp
r = ev(full, '2026-10-17'); assert.equal(r.blackout, 'camp'); assert.ok(!r.earned);
r = ev(full, '2026-10-24'); assert.equal(r.blackout, null); assert.ok(r.earned, JSON.stringify(r.conds)); // second weekend eligible
assert.equal(C.evaluate(full, { today:at('2026-10-31'), startDate:'2026-10-25', profile:{} }).blackout, null); // Sunday start: Oct 24-25 is weekend 1, Oct 31 is weekend 2
assert.equal(C.evaluate(full, { today:at('2026-10-31'), startDate:'2026-10-26', profile:{} }).blackout, 'camp'); // Mon start: Oct 31 is weekend 1
assert.equal(C.evaluate(full, { today:at('2026-10-31'), startDate:null, profile:{} }).blackout, 'camp');
// blackout: within 14 days of fight
assert.equal(ev(full, '2026-10-31', { profile:{ fightDate:'2026-11-14' } }).blackout, 'fight');
assert.equal(ev(full, '2026-10-31', { profile:{ fightDate:'2026-11-16' } }).blackout, null); // window starts Nov 2, so Oct 31/Nov 1 ok
assert.deepEqual(ev(full, '2026-10-31', { profile:{ fightDate:'2026-11-15' } }).blackout, 'fight'); // Nov 1 = fight-14
// weight: target set and gaining -> fails; no target -> passes; target but no weigh-ins -> fails
const wGain = full.map((e, i) => Object.assign({}, e, { weight: 160 + i * 0.5 }));
r = ev(wGain, '2026-10-31', { profile:{ targetWeight:155 } }); assert.ok(!r.conds[2].ok, r.conds[2].text);
const wLoss = full.map((e, i) => Object.assign({}, e, { weight: +(170 - i * 0.2).toFixed(1) }));
r = ev(wLoss, '2026-10-31', { profile:{ targetWeight:160 } }); assert.ok(r.conds[2].ok, r.conds[2].text);
assert.ok(ev(full, '2026-10-31').conds[2].ok); assert.ok(!ev(full, '2026-10-31', { profile:{ targetWeight:155 } }).conds[2].ok);
// claim: stored per date; nutrition counts 100 + hit; one per weekend; past days and fight window not claimable
assert.equal(C.claim(full, '2026-10-31', { today:at('2026-10-31'), startDate:START }), '2026-10-31');
assert.equal(C.claim(full, '2026-10-30', { today:at('2026-10-31'), startDate:START }), null);
const claimed = full.concat([mk('2026-10-31', { cheat:true, nutrition:null })]);
r = ev(claimed, '2026-11-01'); assert.equal(r.claimed, '2026-10-31'); assert.deepEqual(r.claimable, []);
const cd = claimed[claimed.length - 1]; assert.equal(S.nutritionScore(cd), 100); assert.ok(S.nutritionHit(cd)); assert.ok(I.isComplete(cd));
assert.equal(S.nutritionScore(Object.assign({}, cd, goal(5000))), 100); // goal values ignored on cheat day
// next week: award expired, not re-evaluated for the claimed date
r = ev(claimed, '2026-11-02'); assert.equal(r.mon, '2026-11-02'); assert.equal(r.claimed, null); assert.ok(!r.earned);
console.log('cheat day tests OK');
