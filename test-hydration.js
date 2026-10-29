const S = require('./scoring.js'), I = require('./insights.js'), R = require('./reminders.js'), assert = require('assert'), fs = require('fs');
const today = new Date(2026,10,3), d = i => S.ymd(new Date(2026,10,3-i)); // Nov 3 2026 (after HYD_FROM)
const W4 = {energy:4,soreness:4,mood:4,stress:4};
const v2 = (date, o) => Object.assign({date, v:2, nutrition:true, training:undefined, family:false, sleep:8, screen:1, sessions:[{label:'A',done:true,rpe:6,mins:60}]}, W4, o);
// validity + status mapping (1-3 green, 4-5 amber, 6-8 red)
assert.equal(I.HYD_COLORS.length, 8); assert.equal(new Set(I.HYD_COLORS).size, 8);
[[1,'ok','Hydrated'],[3,'ok','Hydrated'],[4,'warn','Drink more'],[5,'warn','Drink more'],[6,'bad','Dehydrated'],[8,'bad','Dehydrated']].forEach(([v,l,t]) => { const s = I.hydrationStatus(v); assert.equal(s.level,l); assert.equal(s.label,t); assert.ok(s.tip.length > 10); assert.equal(s.color, I.HYD_COLORS[v-1]); });
['', null, undefined, 0, 9, 'x', 2.5].forEach(v => { assert.equal(I.hydrationStatus(v), null); assert.equal(S.hydrationOK({hydration:v}), false); });
assert.equal(S.hydrationOK({hydration:'4'}), true); assert.equal(S.hydrationOK({hydration:8}), true);
// required for new days only: old days without it stay complete, new days need it
assert.equal(S.HYD_FROM, '2026-10-28');
const old = v2('2026-10-27', {}), nw = v2(d(0), {});
assert.equal(I.isComplete(old), true); assert.deepEqual(I.missing(old), []);
assert.equal(I.isComplete(nw), false); assert.deepEqual(I.missing(nw), ['hydration (first pee colour)']);
assert.deepEqual(I.checklist(nw).map(x => x.key), ['hydration']); assert.equal(I.sectionOf('hydration'), 'morning');
assert.deepEqual(I.sections(nw), {morning:false,nutrition:true,training:true,evening:true});
assert.equal(I.sectionInfo(nw)[0].items.length, 1);
const ok = v2(d(0), {hydration:3}); assert.equal(I.isComplete(ok), true); assert.equal(I.checklist(ok).length, 0); assert.ok(I.sections(ok).morning);
assert.equal(I.isComplete(v2(d(0), {hydration:''})), false); assert.equal(I.isComplete(v2(d(0), {hydration:12})), false);
assert.equal(I.isComplete(Object.assign({}, nw, {v:undefined, training:true})), true, 'legacy (non-v2) day never needs it');
// morning reminder check follows the same rule
assert.equal(R.morningDone(old), true); assert.equal(R.morningDone(nw), false); assert.equal(R.morningDone(ok), true);
assert.equal(I.dayStatus(nw).complete, false); assert.deepEqual(Object.keys(I.dayStatus(ok)).sort(), ['complete','missing']);
// score weights untouched: hydration never changes the score
const a = S.compute([v2(d(0),{hydration:1})], today, {}), b = S.compute([v2(d(0),{hydration:8})], today, {}), c = S.compute([v2(d(0),{})], today, {});
assert.equal(a.base, b.base); assert.equal(a.base, c.base);
// week strip + flags
const es = [d(6),d(5),d(4),d(3),d(2),d(1),d(0)].map((x,i) => v2(x, {hydration:[2,7,3,6,4,null,8][i]}));
const h = I.hydrationWeek(es, today); assert.equal(h.days.length, 7); assert.equal(h.logged, 6); assert.equal(h.dehydrated, 3); assert.equal(h.low, 4);
assert.equal(h.days[5].v, null); assert.equal(h.days[6].v, 8); assert.equal(h.latest.v, 8);
let fl = I.hydrationFlags(es, today, {}); assert.equal(fl.length, 1); assert.ok(/3 of the last 7 mornings/.test(fl[0]));
assert.deepEqual(I.hydrationFlags([v2(d(0),{hydration:8}), v2(d(1),{hydration:2})], today, {}), [], 'one dehydrated morning is not flagged');
assert.deepEqual(I.hydrationFlags([], today, {}), []);
// fight week note (no water-cut, minors)
const fw = {fightDate: S.ymd(new Date(2026,10,8))};
fl = I.hydrationFlags([v2(d(0),{hydration:5})], today, fw); assert.equal(fl.length, 1); assert.ok(/water-cut/.test(fl[0]) && /Minors \(under 18\)/.test(fl[0]));
assert.deepEqual(I.hydrationFlags([v2(d(0),{hydration:2})], today, fw), [], 'well hydrated in fight week: no nagging');
assert.deepEqual(I.hydrationFlags([v2(d(0),{hydration:5})], today, {fightDate: S.ymd(new Date(2026,11,20))}), [], 'not fight week');
assert.equal(I.hydrationFlags(es, today, fw).length, 2);
// CSV: appended columns, old columns unchanged
assert.deepEqual(I.CSV_COLS.slice(-3), ['Complete','Hydration_Colour','Hydration_Status']);
const rows = I.toCSV([v2(d(0),{hydration:6}), v2('2026-10-27',{})]).trim().split('\r\n');
assert.ok(rows[2].endsWith(',N,6,Dehydrated') || rows[2].endsWith(',Y,6,Dehydrated'), rows[2]); assert.ok(rows[1].endsWith(',Y,,'), rows[1]);
// wiring
const app = fs.readFileSync(__dirname+'/app.js','utf8'), rep = fs.readFileSync(__dirname+'/report.js','utf8'), sw = fs.readFileSync(__dirname+'/sw.js','utf8');
assert.ok(app.includes('hydPicker(e)') && app.includes('hydrationCard()') && app.includes('hydration: { days:') && app.includes('hydrationFlags'));
assert.ok(rep.includes('d.hydration')); assert.ok(sw.includes("'fr-v28'"));
assert.ok(!/<button[^>]*class="[^"]*"[^>]*data-hyd[^>]*>[^<]+</.test(app.match(/function hydPicker[\s\S]*?\n function|function hydPicker[\s\S]{0,900}/)[0]), 'swatches carry no visible text');
console.log('All hydration tests passed');
