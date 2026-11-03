const assert = require('assert'), W = require('./weightplan.js');
const today = new Date(2026,10,3,9), fd = n => { const x = new Date(2026,10,3+n,12); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
const adult = '1995-01-01', pablo = '2008-06-01', kid = '2010-06-01';
// allowance
assert.equal(W.allowance({dob:adult, weighIn:'day-before', cutExp:'experienced', waterCut:true}, today).pct, 6);
assert.equal(W.allowance({dob:adult, weighIn:'day-before', cutExp:'some', waterCut:true}, today).pct, 4);
assert.equal(W.allowance({dob:adult, weighIn:'day-before', cutExp:'experienced'}, today).pct, 3); // no water opt-in caps at 3
assert.equal(W.allowance({dob:pablo, weighIn:'day-before', cutExp:'experienced', waterCut:true}, today).pct, 4);
assert.equal(W.allowance({dob:pablo, weighIn:'same-day', cutExp:'first', lastCutBad:true, waterCut:true}, today).pct, 2);
let k = W.allowance({dob:kid, weighIn:'day-before', cutExp:'experienced', waterCut:true}, today); assert.equal(k.pct, 2); assert.equal(k.minor, true); assert.equal(k.water, false);
// weigh-in date
assert.equal(W.weighInDate({fightDate:fd(10)}), fd(9)); assert.equal(W.weighInDate({fightDate:fd(10), weighIn:'same-day'}), fd(10));
const e = (n, w) => ({ date: fd(n), weight: w });
// Diego: 190, 42 days out, target 180 -> on track / in range
let P = {dob:adult, weighIn:'day-before', cutExp:'experienced', waterCut:true, targetWeight:180, fightDate:fd(43)};
let s = W.status([e(0,190)], P, today); assert.ok(['on','in'].includes(s.band), s.band); assert.equal(s.A, 6);
// Pablo fits plan: 135, 42 days out, 125 -> in range or tight (pace)
P = {dob:pablo, weighIn:'day-before', cutExp:'some', waterCut:true, targetWeight:125, fightDate:fd(43)};
s = W.status([e(0,135)], P, today); assert.ok(['in','tight'].includes(s.band), s.band);
// Pablo 135 one week out -> unsafe
P.fightDate = fd(8); s = W.status([e(0,135)], P, today); assert.equal(s.band, 'unsafe');
// minor: 4% over, 6 weeks out -> unsafe? 3% over 6 wks out -> projected below -> fine
P = {dob:kid, targetWeight:125, fightDate:fd(43)}; s = W.status([e(0,140)], P, today); assert.equal(s.band, 'unsafe');
s = W.status([e(0,128)], P, today); assert.ok(['on','in'].includes(s.band), s.band);
// at target well before
s = W.status([e(0,124)], {dob:adult, targetWeight:125, fightDate:fd(30)}, today); assert.equal(s.band, 'on');
// fight-week targets descend to T at weigh-in and dayCheck
assert.equal(W.weekTarget(180, 5, 5, true), 189); assert.equal(W.weekTarget(180, 5, 0, true), 180); assert.ok(W.weekTarget(180,5,1,true) > 180);
P = {dob:adult, weighIn:'day-before', cutExp:'experienced', waterCut:true, targetWeight:180, fightDate:fd(4)}; // weigh-in in 3 days
s = W.status([e(0,186)], P, today); assert.equal(s.daysToWeighIn, 3); assert.equal(s.planToday, W.weekTarget(180,6,3,true)); assert.ok(['in','on'].includes(s.band));
let c = W.dayCheck(186, s); assert.equal(c.level, 'ok'); c = W.dayCheck(s.planToday + 3, s); assert.equal(c.level, 'over');
// steps: water only if opted in and not minor
assert.ok(/Water loading/.test(W.steps(4, true, false)[2].text)); assert.ok(!/Water|sauna/i.test(W.steps(4, false, false).map(x=>x.text).join(' ')));
assert.ok(!/Water|sauna/i.test(W.steps(1, true, true).map(x=>x.text).join(' ')));
// message wording never says "not safe" style for in-range
P = {dob:adult, weighIn:'day-before', cutExp:'experienced', waterCut:true, targetWeight:180, fightDate:fd(43)}; s = W.status([e(0,190)], P, today); assert.ok(!/unsafe/i.test(s.text));
console.log('weightplan ok');
