const E = require('./early.js'), S = require('./scoring.js'), assert = require('assert');
const mk = (d,o) => Object.assign({date:d, v:2, nutrition:true, sessions:[{label:'',done:true,rpe:6,mins:60}], training:true, family:true, sleep:8, screen:1, weight:170, energy:5, soreness:5, mood:5, stress:5, notes:''}, o);
assert.equal(E.daily(null), null);
assert.equal(E.daily(mk('2026-10-19')).score, 100);
let d = E.daily(mk('2026-10-19',{nutrition:false, sleep:6})); assert.equal(d.score, 68); // 0+25+7.5+15+10+10, no bonus on daily
let f = E.feedback(d, mk('2026-10-19',{nutrition:false, sleep:6})); assert.equal(f.fix, 'nutrition'); assert.ok(/\+25 pts/.test(f.text));
f = E.feedback(E.daily(mk('2026-10-19')), mk('2026-10-19')); assert.equal(f.fix, null); assert.ok(/Nothing to fix/.test(f.text));
// partial day mentions finishing the log
const part = {date:'2026-10-19', nutrition:true, sleep:8, screen:'', family:null, energy:4, soreness:4, mood:4, stress:4};
assert.ok(/Finish the rest/.test(E.feedback(E.daily(part), part).text));
// provisional score from day 1 with same weights
const today = new Date(2026,9,19);
let r = S.compute([mk('2026-10-19',{nutrition:false, sleep:6})], today, {startDate:'2026-10-19'});
assert.equal(r.locked, true); assert.equal(r.daysLogged, 1); assert.equal(Math.round(r.base), 68); assert.equal(E.progress(r).unlockIn, 7); assert.equal(E.progress(r).pct, 0);
r = S.compute([mk('2026-10-17'),mk('2026-10-18'),mk('2026-10-19')], today, {startDate:'2026-10-16'}); assert.equal(E.progress(r).unlockIn, 4); assert.equal(E.progress(r).pct, 43); assert.equal(r.daysLogged, 3);
// series + badges
assert.deepEqual(E.series([mk('2026-10-19'), mk('2026-10-18',{nutrition:false,sleep:6})]).map(x=>x.score), [68,100]);
const ids = es => E.badges(es).filter(b=>b.got).map(b=>b.id);
assert.deepEqual(ids([]), []);
assert.deepEqual(ids([mk('2026-10-19',{nutrition:false})]), ['day1']);
const days = n => Array.from({length:n},(_, i)=>mk(S.ymd(new Date(2026,9,19-i))));
assert.deepEqual(ids(days(3)), ['day1','streak3','perfect']);
assert.deepEqual(ids(days(7)), ['day1','streak3','week1','perfect']);
console.log('All early-results tests passed');
