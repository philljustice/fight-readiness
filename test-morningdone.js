// Regression (fr-v41): banner/notifications must agree with the Morning tile. Run: node test-morningdone.js
const S = require('./scoring.js'), I = require('./insights.js'), R = require('./reminders.js'), assert = require('assert');
// a realistic v2 morning made in the UI: sleep, pee colour, 4 core ratings (+ v40 items), nutrition plan NOT yet answered, no evening items
const morning = { date:'2026-11-01', v:2, sleep:8, hydration:2, energy:4, soreness:2, mood:4, stress:2, sleepq:4, motivation:4, appetite:4, injury:'none', ill:false,
  sessions:[{ done:null }], nutrition:null, nmode:'yn', screen:'', family:null, wellScale:2 };
assert.equal(I.sectionInfo(morning).find(x => x.key === 'morning').done, true, 'Morning tile done');
assert.equal(R.morningDone(morning), true, 'morning reminder must agree with the tile (old rule demanded nutrition plan)');
const at = new Date(2026, 10, 1, 10, 3);
assert.deepEqual(R.due(morning, at, '07:00', '21:00'), []);
assert.deepEqual(I.morningMissing(morning), []);
assert.equal(I.dayStatus(morning).morning, true); assert.equal(I.dayStatus(morning).complete, false);
// same for a watch user (no perceived sleep quality) and for v39-migrated values
assert.equal(R.morningDone(Object.assign({}, morning, { sleepq:'', sleepDevice:'Garmin', date:'2026-11-03' })), true);
// genuinely unfinished morning still nags, and lists what's left
const half = Object.assign({}, morning, { stress:'', hydration:'' , date:'2026-11-03'});
assert.equal(R.morningDone(half), false); assert.deepEqual(R.due(half, at, '07:00', '21:00'), ['morning']);
assert.ok(I.morningMissing(half).some(x => /stress/.test(x)) && I.morningMissing(half).some(x => /pee/.test(x)), I.morningMissing(half).join('|'));
assert.equal(R.morningDone(undefined), false);
// evening = nutrition + training + evening tiles
assert.deepEqual(R.due(morning, new Date(2026, 10, 1, 21, 5), '07:00', '21:00'), ['evening']);
const full = Object.assign({}, morning, { nutrition:true, sessions:[{ done:false }], screen:1, family:true });
assert.deepEqual(R.due(full, new Date(2026, 10, 1, 21, 5), '07:00', '21:00'), []);
assert.equal(I.isComplete(full), true);
console.log('morningdone ok');
