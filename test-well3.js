// Extended wellness + watch sleep scores + resting HR. Run: node test-well3.js
const S = require('./scoring.js'), I = require('./insights.js'), assert = require('assert');
const core = { energy:4, soreness:2, mood:4, stress:2 }; // all "good 4" -> 75
// historical entries (no new fields) score exactly as before
assert.equal(S.wellnessScore(core), 75); assert.equal(S.wellnessScore({ energy:5, soreness:5, mood:1, stress:3 }), (100+0+0+50)/4);
// missing optional items don't penalise; defaults None/No lift only by their value
assert.equal(S.wellnessScore(Object.assign({}, core, { motivation:'', appetite:'' })), 75);
assert.equal(S.wellnessScore(Object.assign({}, core, { injury:'limiting' })), (75*4 + 0) / 5);
assert.equal(S.wellnessScore(Object.assign({}, core, { ill:true, appetite:1 })), (300 + 0 + 0) / 5.5);
assert.equal(S.wellnessScore(Object.assign({}, core, { sleepq:5, motivation:5, appetite:5, injury:'none', ill:false })), (300 + 100*4 + 50) / 8.5);
// device sleep mapping
assert.equal(S.deviceSleepQuality('Garmin', 80), 75); assert.equal(S.deviceSleepQuality('Garmin', 90), 90); assert.equal(S.deviceSleepQuality('Garmin', 70), 62.5);
assert.equal(S.deviceSleepQuality('Apple Watch', 81), 75); assert.equal(S.deviceSleepQuality('Oura', 85), 90); assert.equal(S.deviceSleepQuality('Whoop', 70), 75); assert.equal(S.deviceSleepQuality('Other', 63), 63);
assert.equal(S.deviceBand('Fitbit', 85), 'Good'); assert.equal(S.deviceBand('Apple Watch', 97), 'Very High');
// watch score replaces perceived quality only when a device is set
assert.equal(S.wellnessScore(Object.assign({}, core, { sleepDevice:'Garmin', sleepDev:90, sleepq:1 })), (300 + 90) / 5);
assert.equal(S.wellnessScore(Object.assign({}, core, { sleepDevice:'None', sleepDev:90, sleepq:1 })), 300 / 5);
// resting HR baseline: none until 7 readings; median of prior 30 days
const day = i => { const d = new Date('2026-10-01T12:00'); d.setDate(d.getDate() + i); return S.ymd(d); };
const es = [50,52,51,49,50,53,50].map((r, i) => Object.assign({ date:day(i), rhr:r }, core));
assert.equal(S.rhrBaseline(es.slice(0, 6), day(6)), null); assert.equal(S.rhrBaseline(es, day(7)), 50);
assert.equal(S.rhrScore(52, 50), 100); assert.equal(S.rhrScore(60, 50), 0); assert.equal(S.rhrScore(56, 50), 50); assert.equal(S.rhrScore(60, null), null);
// flags
const T = new Date('2026-11-05T12:00'), f = I.wellness([...es.map((e, i) => Object.assign({}, e, { date: S.ymd(new Date(2026, 10, i - 3)) })),
  Object.assign({ date:'2026-11-05', rhr:57, injury:'limiting', injuryArea:'Knee', ill:true, motivation:2, appetite:1, sleepDevice:'Garmin', sleepDev:45 }, core)], T).flags.map(x => x.text || x.item);
['Limiting injury (Knee)', 'Feeling ill', 'Motivation', 'Appetite', 'Poor Garmin sleep score 45 (Poor)'].forEach(x => assert.ok(f.includes(x), x + ' | ' + f.join('|')));
assert.ok(f.some(x => /^Resting HR 57 bpm \(\+7 vs baseline 50\)/.test(x)), f.join('|'));
// required items from WELL3_FROM only
const v2 = (date, o) => Object.assign({ date, v:2 }, core, o);
assert.deepEqual(I.well3Missing(v2('2026-11-01')), []);
assert.deepEqual(I.well3Missing(v2('2026-11-03')).map(x => x[0]), ['sleepq','motivation','appetite']);
assert.deepEqual(I.well3Missing(v2('2026-11-03', { sleepDevice:'Garmin', motivation:3, appetite:3 })), []);
// below-par explains new items
const w = Array.from({ length:10 }, (_, i) => v2(S.ymd(new Date(2026, 9, 20 + i)), { sessions:[], nutrition:true, family:true, sleep:8, screen:1, energy:2, soreness:4, mood:2, stress:4, motivation:1, injury:'minor', injuryArea:'Shoulder', ill: i < 3 }));
const r = S.compute(w, new Date('2026-10-31T12:00'), { startDate:'2026-10-01' }), why = S.belowPar(r).find(x => x.key === 'wellness').why.join('|');
assert.ok(/Motivation \/ readiness to train avg 1\.0\/5 — low motivation \(1–2\) on 10 days/.test(why), why);
assert.ok(why.includes('Injury/pain on 10 days: Shoulder') && why.includes('Feeling ill on 3 days'), why);
// CSV round trip columns
assert.ok(I.CSV_COLS.slice(-9).join() === 'Sleep_Quality,Sleep_Device,Device_Sleep_Score,Motivation,Appetite,Injury,Injury_Area,Ill,Resting_HR');
console.log('well3 ok');
