const S = require('./scoring.js'), I = require('./insights.js'), assert = require('assert');
const today = new Date(2026,9,19), d = i => S.ymd(new Date(2026,9,19-i));
const full = (i,o) => Object.assign({date:d(i), nutrition:true, training:true, family:false, sleep:8, screen:1}, o);
// streaks
assert.deepEqual(I.streak([], today), {current:0,best:0,todayDone:false});
let st = I.streak([full(1),full(2),full(3),full(5),full(6),full(7),full(8)], today); assert.equal(st.current,3); assert.equal(st.best,4); assert.equal(st.todayDone,false);
st = I.streak([full(0),full(1)], today); assert.equal(st.current,2); assert.equal(st.todayDone,true);
assert.equal(I.streak([full(0,{sleep:''}),full(1)], today).current,1); // today incomplete -> doesn't break
assert.equal(I.streak([full(2)], today).current,0); // missed yesterday
assert.equal(I.isComplete(full(0,{family:null})), false);
// v2 completion needs wellness + all sessions answered with effort/minutes
const W4 = {energy:4,soreness:4,mood:4,stress:4}, v2 = o => full(0, Object.assign({v:2, training:undefined, sessions:[{label:'A',done:true,rpe:6,mins:60}]}, W4, o));
assert.equal(I.isComplete(v2({})), true); assert.deepEqual(I.missing(v2({energy:''})), ['wellness (energy, soreness, mood, stress)']);
assert.deepEqual(I.missing(v2({sessions:[{done:true,rpe:'',mins:60}]})), ['session effort + minutes']);
assert.deepEqual(I.missing(v2({sessions:[{done:null}]})), ['training']); assert.equal(I.isComplete(v2({sessions:[]})), true);
assert.equal(I.isComplete(v2({sessions:[{done:false,rpe:'',mins:''}]})), true);
assert.equal(I.missing(undefined).length, 6); assert.equal(I.isPartial({date:d(0),weight:170,nutrition:null}), true);
const g = I.grid([full(0),{date:d(1),weight:170}], today, 7); assert.equal(g.length,7); assert.equal(g[6].status,'done'); assert.equal(g[5].status,'partial'); assert.equal(g[0].status,'none');
// wellness
assert.equal(I.dayWellness({energy:4,soreness:2,mood:'',stress:null}),3); assert.equal(I.dayWellness({}),null);
let w = I.wellness([full(0,{energy:1,mood:5}),full(1,{energy:3,soreness:3}),full(10,{energy:5,soreness:5,mood:5,stress:5})], today);
assert.equal(w.days,2); assert.equal(w.flags.length,1); assert.equal(w.flags[0].item,'Energy'); assert.equal(w.items.energy,2);
// load
assert.equal(I.sessionLoad({rpe:7,mins:90}),630); assert.equal(I.sessionLoad({rpe:7,mins:''}),null);
let L = I.load([full(0,{rpe:8,mins:60}),full(3,{rpe:5,mins:60})], today); assert.equal(L.week,780); assert.equal(L.sessions,2); assert.equal(L.acwr,null);
const steady = Array.from({length:28},(_,i)=>full(i,{rpe:5,mins:60})); L = I.load(steady, today); assert.equal(L.acwr,1); assert.equal(L.flag,'ok'); assert.deepEqual(L.weeks,[2100,2100,2100,2100]);
L = I.load(steady.map((e,i)=>i<7?Object.assign({},e,{rpe:10}):e), today); assert.ok(L.acwr>1.5); assert.equal(L.flag,'spike');
// weight-cut safety: prev 200, last 196 -> -2%/wk warn ; 198 -> -1% ok? (-1 is not < -1) ; 197.6 -> -1.2 caution
const wt = (a,b) => [full(1,{weight:a}),full(9,{weight:b})];
assert.equal(I.cutSafety(wt(196,200), today).level,'warn'); assert.equal(I.cutSafety(wt(197.6,200), today).level,'caution');
assert.equal(I.cutSafety(wt(198,200), today).level,null); assert.equal(I.cutSafety(wt(202,200), today).level,null); assert.equal(I.cutSafety([], today).pctPerWeek,null);
assert.ok(Math.abs(S.weightDelta(wt(196,200), S.dayNum(d(0))) - -4) < 1e-9); // consistent with core trend window
let p = I.cutSafety([full(0,{weight:170})], today, {targetWeight:155, fightDate:S.ymd(new Date(2026,9,19+35))}).pace; assert.equal(p.perWeek,3); assert.equal(p.level,'warn');
p = I.cutSafety([full(0,{weight:160})], today, {targetWeight:155, fightDate:S.ymd(new Date(2026,9,19+70))}).pace; assert.equal(p.level,'ok');
// CSV
const csv = I.toCSV([full(0,{notes:'sore, "left" knee',rpe:6,mins:90}), full(1)]);
const csv2 = I.toCSV([full(0,{v:2,energy:4,soreness:4,mood:4,stress:4,sessions:[{label:'Wrestling',done:true,rpe:7,mins:90},{label:'Strength',done:false,rpe:'',mins:''}],extra:{label:'Run',rpe:3,mins:20}})]).trim().split('\r\n')[1];
assert.ok(csv2.includes(',75,2,1,50,Wrestling,Y,7,90,Strength,N,,,Run,3,20,690,Y'), csv2); const lines = csv.trim().split('\r\n');
assert.equal(lines[0], I.CSV_COLS.join(',')); assert.ok(lines[1].startsWith(d(1)+',Y,Y,8,1,N')); assert.ok(lines[2].includes('"sore, ""left"" knee"')); assert.ok(lines[2].includes(',1,100,,Y,6,90,,,,,,,,540,Y'), lines[2]);
// core score unaffected by optional fields
const base = Array.from({length:10},(_,i)=>full(i)); const extra = base.map(e=>Object.assign({},e,{energy:1,soreness:1,rpe:10,mins:200}));
assert.equal(S.compute(base,today).score, S.compute(extra,today).score);
console.log('All insights tests passed');
