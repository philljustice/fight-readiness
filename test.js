const S = require('./scoring.js'), assert = require('assert');
assert.equal(S.sleepScore(8),100); assert.equal(S.sleepScore(6),50); assert.equal(S.sleepScore(10),50); assert.equal(S.sleepScore(3),0);
assert.equal(S.screenScore(2),100); assert.equal(S.screenScore(3),60); assert.equal(S.screenScore(4),20); assert.equal(S.screenScore(5),0);
[['🔴',2],['🟠',1],['🟡',0.5],['🟡',0],['🟢',-0.5],['🟢',-1],['🔵',-1.5],['🔵',-3],['📊',null]].forEach(([e,v])=>assert.equal(S.trendLabel(v).emoji,e,String(v)));
const today = new Date(2026,9,19), mk = (i,o) => Object.assign({date:S.ymd(new Date(2026,9,19-i)), nutrition:true, training:true, family:true, sleep:8, screen:1}, o);
let r = S.compute(Array.from({length:22},(_, i)=>mk(i)), today); assert.equal(r.score,100); assert.equal(r.daysLogged,22);
// N=2: nutrition 50, training 100, sleep 75, screen 80, family 100 -> 15+30+15+8+10=78; consistency 50% -> bonus 0
r = S.compute([mk(0),mk(1,{nutrition:false,sleep:6,screen:3})], today); assert.equal(r.score,78); assert.equal(r.bonus,0);
// tiers
const tier = (yes, tot) => S.compute(Array.from({length:tot},(_, i)=>mk(i,{training:i<yes})), today).bonus;
assert.equal(tier(18,20),5); assert.equal(tier(15,20),3); assert.equal(tier(12,20),1); assert.equal(tier(11,20),0);
assert.equal(S.compute([mk(0),mk(22)], today).daysLogged,1);
// weight delta: last7 avg 170, prev7 avg 172 -> -2
r = S.compute([mk(0,{weight:169}),mk(3,{weight:171}),mk(8,{weight:172}),mk(13,{weight:172})], today); assert.equal(r.delta,-2); assert.equal(r.trend.emoji,'🔵');
assert.equal(S.compute([], today).score, 0);
// Spreadsheet sample, evaluated as of 2026-07-26 (last logged day)
// start date / unlock
const full = Array.from({length:22},(_, i)=>mk(i,{weight:170+i*0.2}));
let L = S.compute(full, today, {startDate:S.ymd(new Date(2026,9,15))}); assert.equal(L.locked,true); assert.equal(L.unlockIn,3); assert.equal(L.daysLogged,5);
L = S.compute(full, today, {startDate:S.ymd(new Date(2026,9,19))}); assert.equal(L.locked,true); assert.equal(L.unlockIn,7); assert.equal(L.daysLogged,1);
L = S.compute(full, today, {startDate:S.ymd(new Date(2026,9,12))}); assert.equal(L.locked,false); assert.equal(L.daysLogged,8); assert.equal(L.score,100);
L = S.compute(full, today, {startDate:S.ymd(new Date(2026,8,1))}); assert.equal(L.daysLogged,22); // window still 3 weeks
assert.equal(S.compute(full, today).locked, true); // no start date yet -> locked
console.log('All scoring tests passed');
