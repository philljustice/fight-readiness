// Nutrition modes: Yes/No (legacy), calorie goal, macros goal. Run: node test-nutrition.js
const S = require('./scoring.js'), I = require('./insights.js'), E = require('./early.js'), R = require('./reminders.js'), assert = require('assert');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
// closeness: 100 within ±5%, linear to 0 at ±30%, symmetric
near(S.closeness(2000, 2000), 100); near(S.closeness(2100, 2000), 100); near(S.closeness(1900, 2000), 100);
near(S.closeness(2300, 2000), 60); near(S.closeness(1700, 2000), 60); // 15% off -> 60
near(S.closeness(2600, 2000), 0); near(S.closeness(1000, 2000), 0); near(S.closeness(2500, 2000), 20);
assert.equal(S.closeness('', 2000), null); assert.equal(S.closeness(2000, 0), null);
const base = { date:'2026-10-29', v:2, sessions:[], family:true, sleep:8, screen:1, energy:5, soreness:5, mood:5, stress:5, hydration:2 };
const yn = o => Object.assign({}, base, { nutrition:true }, o);
const kc = (k, o) => Object.assign({}, base, { nmode:'kcal', ntarget:{ kcal:2400 }, kcal:k }, o);
const mc = (p, c, f, o) => Object.assign({}, base, { nmode:'macros', ntarget:{ protein:180, carbs:250, fat:70 }, protein:p, carbs:c, fat:f }, o);
// legacy yes/no unchanged
assert.equal(S.nutMode(yn()), 'yn'); assert.equal(S.nutritionScore(yn()), 100); assert.equal(S.nutritionScore(yn({ nutrition:false })), 0); assert.equal(S.nutritionScore(yn({ nutrition:null })), null);
assert.equal(E.daily(yn()).score, 100);
// calorie
assert.equal(S.nutritionScore(kc(2400)), 100); near(S.nutritionScore(kc(2760)), 60); near(S.nutritionScore(kc(2040)), 60);
assert.equal(S.nutritionScore(kc('')), null); assert.ok(!S.nutritionDone(kc('')));
assert.equal(E.daily(kc(2760)).score, 90); // 60*25% = 15 -> 90
// macros: protein 50 / carbs 25 / fat 25
assert.equal(S.nutritionScore(mc(180, 250, 70)), 100);
near(S.nutritionScore(mc(180, 250 * 1.3, 70)), 75); near(S.nutritionScore(mc(180 * 0.7, 250, 70)), 50);
assert.ok(!S.nutritionDone(mc(180, 250, ''))); assert.equal(S.nutritionScore(mc(180, '', 70)), null);
// hit: yes/no = true, goal = >= 80
assert.ok(S.nutritionHit(yn())); assert.ok(!S.nutritionHit(yn({ nutrition:false })));
assert.ok(S.nutritionHit(kc(2400 * 1.08))); /* 88 */ assert.ok(!S.nutritionHit(kc(2400 * 1.12))); /* 72 */
// overall: avg of daily nutrition scores; blank counts 0; mixed modes each scored by their own stored mode
const day = (d, e) => Object.assign({}, e, { date:d });
const r = S.compute([day('2026-10-27', yn()), day('2026-10-28', kc(2760)), day('2026-10-29', mc(180, 250, 70)), day('2026-10-26', kc(''))], new Date('2026-10-30T12:00'));
near(r.cats.nutrition, (100 + 60 + 100 + 0) / 4);
near(r.consistency, 2 / 4 * 100); // yes day + macros 100 day hit; 60 and blank miss
// stored ntarget used, not current setup: same kcal with different targets scores differently
assert.equal(S.nutritionScore(kc(2400, { ntarget:{ kcal:3000 } })), 40);
// completion: nutrition tile done only when the mode's fields are entered
assert.ok(I.missing(kc('')).includes('nutrition')); assert.ok(!I.missing(kc(2000)).includes('nutrition'));
assert.ok(I.sections(mc(1, 2, 3)).nutrition); assert.ok(!I.sections(mc(1, 2, '')).nutrition);
assert.ok(/calories/.test(I.checklist(kc('')).find(x => x.key === 'nutrition').label));
assert.ok(/protein, carbs and fat/.test(I.checklist(mc('', '', '')).find(x => x.key === 'nutrition').label));
assert.ok(/Yes or No/.test(I.checklist(yn({ nutrition:null })).find(x => x.key === 'nutrition').label));
// reminders: goal nutrition belongs to the evening reminder
assert.ok(R.morningDone(kc(''))); assert.ok(!R.eveningDone(kc(''))); assert.ok(R.eveningDone(kc(2400)));
// CSV columns
assert.deepEqual(I.CSV_COLS.slice(-6), ['Nutrition_Mode','Calories','Protein_g','Carbs_g','Fat_g','Nutrition_Score']);
assert.ok(I.toCSV([kc(2760)]).trim().split('\r\n')[1].endsWith(',kcal,2760,,,,60'));
console.log('nutrition tests OK');
