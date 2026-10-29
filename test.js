const S = require('./scoring.js'), assert = require('assert');
const _c=S.compute; S.compute=(e,t,p={})=>_c(e,t,Object.assign({includeToday:true},p)); // legacy fixtures include today
assert.equal(S.sleepScore(8),100); assert.equal(S.sleepScore(6),50); assert.equal(S.sleepScore(10),50); assert.equal(S.sleepScore(3),0);
assert.equal(S.screenScore(2),100); assert.equal(S.screenScore(3),60); assert.equal(S.screenScore(4),20); assert.equal(S.screenScore(5),0);
[['🔴',2],['🟠',1],['🟡',0.5],['🟡',0],['🟢',-0.5],['🟢',-1],['🔵',-1.5],['🔵',-3],['📊',null]].forEach(([e,v])=>assert.equal(S.trendLabel(v).emoji,e,String(v)));
const today = new Date(2026,9,19), mk = (i,o) => Object.assign({date:S.ymd(new Date(2026,9,19-i)), nutrition:true, training:true, family:true, sleep:8, screen:1, energy:5, soreness:5, mood:5, stress:5}, o);
let r = S.compute(Array.from({length:22},(_, i)=>mk(i)), today); assert.equal(r.score,100); assert.equal(r.daysLogged,22);
// N=2: nutrition 50, training 100, sleep 75, wellness 100, screen 80, family 100 -> 12.5+25+11.25+15+8+10=81.75; bonus 0
r = S.compute([mk(0),mk(1,{nutrition:false,sleep:6,screen:3})], today); assert.equal(r.score,82);
// old weights still reproducible via params
assert.equal(S.compute([mk(0),mk(1,{nutrition:false,sleep:6,screen:3})], today, {wNutrition:30,wTraining:30,wSleep:20,wWellness:0,wScreen:10,wFamily:10}).score,78); assert.equal(r.bonus,0);
// tiers
const tier = (yes, tot) => S.compute(Array.from({length:tot},(_, i)=>mk(i,{training:i<yes})), today).bonus;
assert.equal(tier(18,20),5); assert.equal(tier(15,20),3); assert.equal(tier(12,20),1); assert.equal(tier(11,20),0);
assert.equal(S.compute([mk(0),mk(22)], today).daysLogged,1);
// weight delta: last7 avg 170, prev7 avg 172 -> -2
r = S.compute([mk(0,{weight:169}),mk(3,{weight:171}),mk(8,{weight:172}),mk(13,{weight:172})], today); assert.equal(r.delta,-2); assert.equal(r.trend.emoji,'🔵');
assert.equal(S.compute([], today).score, 0);
// start date / unlock
const full = Array.from({length:22},(_, i)=>mk(i,{weight:170+i*0.2}));
let L = S.compute(full, today, {startDate:S.ymd(new Date(2026,9,15))}); assert.equal(L.locked,true); assert.equal(L.unlockIn,3); assert.equal(L.daysLogged,5);
L = S.compute(full, today, {startDate:S.ymd(new Date(2026,9,19))}); assert.equal(L.locked,true); assert.equal(L.unlockIn,7); assert.equal(L.daysLogged,1);
L = S.compute(full, today, {startDate:S.ymd(new Date(2026,9,12))}); assert.equal(L.locked,false); assert.equal(L.daysLogged,8); assert.equal(L.score,100);
L = S.compute(full, today, {startDate:S.ymd(new Date(2026,8,1))}); assert.equal(L.daysLogged,22); // window still 3 weeks
assert.equal(S.compute(full, today).locked, true); // no start date yet -> locked
// defaults sum to 100
const D = S.DEFAULT_PARAMS; assert.equal(D.wNutrition+D.wTraining+D.wSleep+D.wWellness+D.wScreen+D.wFamily, 100); assert.equal(D.wWellness,15);
// wellness mapping: 1->0, 3->50, 5->100; needs all four
assert.equal(S.wellnessScore({energy:5,soreness:5,mood:5,stress:5}),100); assert.equal(S.wellnessScore({energy:1,soreness:1,mood:1,stress:1}),0);
assert.equal(S.wellnessScore({energy:3,soreness:3,mood:3,stress:3}),50); assert.equal(S.wellnessScore({energy:5,soreness:1,mood:4,stress:2}),50);
assert.equal(S.wellnessScore({energy:5,soreness:5,mood:5}),null);
r = S.compute([mk(0,{energy:1,soreness:1,mood:1,stress:1})], today); assert.equal(r.cats.wellness,0); assert.equal(r.base,85); assert.equal(r.score,90);
// training pct: sessions
const ss = (...d) => d.map(x => ({label:'', done:x, rpe:x?5:'', mins:x?60:''}));
assert.equal(S.trainingPct({sessions:[]}),100); assert.equal(S.trainingPct({sessions:ss(true,false)}),50); assert.equal(S.trainingPct({sessions:ss(true,true)}),100);
assert.equal(S.trainingPct({sessions:ss(null)}),0); assert.equal(S.trainingPct({training:true}),100); assert.equal(S.trainingPct({training:false}),0);
r = S.compute([mk(0,{v:2,sessions:ss(true,false)}), mk(1,{v:2,sessions:[]})], today); assert.equal(r.cats.training,75); assert.equal(r.consistency,50);
// load: two-a-day sums, plus extra
assert.equal(S.sessionLoad({sessions:[{done:true,rpe:7,mins:90},{done:true,rpe:5,mins:60},{done:false,rpe:9,mins:30}], extra:{label:'Run',rpe:3,mins:20}}), 630+300+60);
assert.equal(S.sessionsDone({sessions:ss(true,true)}).length,2); assert.equal(S.sessionLoad({rpe:7,mins:90}),630); assert.equal(S.sessionLoad({sessions:[]}),null);
console.log('All scoring tests passed');
{ const T=new Date('2026-10-29T12:00'); const _r=_c([{date:'2026-10-29',nutrition:true,training:true,family:true,sleep:9,screen:1}],T); assert.equal(_r.daysLogged,0); const _r2=_c([{date:'2026-10-29',nutrition:true},{date:'2026-10-28',nutrition:true}],T); assert.equal(_r2.daysLogged,1); console.log('today excluded from overall ok'); }
