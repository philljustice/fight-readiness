// First-run restore from a JSON backup (fr-v42). Run: node test-restore.js
const Sc = require('./scoring.js'), P = require('./profile.js'), assert = require('assert');
const base = () => ({ entries: [], weeks: [{ start:'2026-10-26', days: [] }], weekIdx: 0, reminders: { morning:'07:00', evening:'21:00' }, params: Object.assign({}, Sc.DEFAULT_PARAMS), wellScale: 2 });
const backup = { app:'fight-readiness', version:1, exported:'2026-11-01T15:00:00Z', fighter:'Pablo', startDate:'2026-10-01', fightDate:'2026-12-12', push:true, notify:true,
  profile:{ name:'Pablo', device:'Garmin', schedule:{ days:[] } }, reminders:{ morning:'06:30', evening:'20:30' }, params:{ idealSleep:9 }, wellScale:2,
  entries:[{ date:'2026-10-31', v:2, soreness:1, stress:4, sleepDev:84, sleepDevice:'Garmin', rhr:51 }] };
const S = P.fromBackup(JSON.stringify(backup), base(), Sc);
assert.equal(S.profile.name, 'Pablo'); assert.equal(S.profile.device, 'Garmin'); assert.equal(S.fightDate, '2026-12-12'); assert.equal(S.startDate, '2026-10-01');
assert.equal(S.reminders.morning, '06:30'); assert.equal(S.params.idealSleep, 9); assert.equal(S.params.par ?? Sc.DEFAULT_PARAMS.par, Sc.DEFAULT_PARAMS.par);
assert.equal(S.entries[0].soreness, 1, 'v2 backup not re-flipped'); assert.equal(S.wellScale, 2);
assert.equal(S.push, false); assert.equal(S.notify, false); assert.ok(!('app' in S) && !('exported' in S));
// older (pre-v39) backup: no wellScale marker -> soreness/stress flipped once
const old = Object.assign({}, backup, { wellScale: undefined, entries:[{ date:'2026-10-20', v:2, soreness:5, stress:2 }] }); delete old.wellScale; delete old.profile;
const O = P.fromBackup(JSON.stringify(old), base(), Sc);
assert.equal(O.entries[0].soreness, 1); assert.equal(O.entries[0].stress, 4); assert.equal(O.wellScale, 2); assert.equal(O.profile.name, 'Pablo', 'legacy fighter -> profile');
// wrong files fail with a clear message and never return a state
for (const bad of ['not json', '[]', '{"foo":1}', JSON.stringify({ app:'other', entries:[] }), JSON.stringify({ entries:[{ date:'x' }], fighter:'A' }), JSON.stringify({ entries:[] })])
  assert.throws(() => P.fromBackup(bad, base(), Sc), e => /backup/i.test(e.message), bad);
assert.ok(P.fromBackup('\uFEFF' + JSON.stringify(backup), base(), Sc).profile);
console.log('restore ok');
