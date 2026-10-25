const W = require('./weekly.js'), assert = require('assert');
assert.equal(W.CONFIG.ADMIN_EMAIL, 'philljustice@gmail.com'); assert.equal(W.CONFIG.SHOW_COACH_CONTACT, false);
assert.equal(W.pendingWeek(new Date(2026,9,18,20)), '2026-10-18'); // Sunday
assert.equal(W.pendingWeek(new Date(2026,9,20,9)), '2026-10-18');  // Tuesday -> last Sunday
assert.equal(W.weekLabel('2026-10-18'), '2026-10-12 to 2026-10-18');
assert.equal(W.isDue({}, new Date(2026,9,18,10), '2026-10-01'), '2026-10-18');
assert.equal(W.isDue({'2026-10-18':1}, new Date(2026,9,20), '2026-10-01'), null);
assert.equal(W.isDue({}, new Date(2026,9,20), '2026-10-19'), null); // started after that Sunday
assert.equal(W.isDue({}, new Date(2026,9,20), null), null);
assert.equal(W.subject('Pablo','2026-10-25'), 'Pablo – FightReady weekly report – Oct 19 to Oct 25, 2026');
assert.equal(W.subject('','2026-10-18'), 'Fighter – FightReady weekly report – Oct 12 to Oct 18, 2026');
assert.equal(W.subject('Diego','2027-01-03'), 'Diego – FightReady weekly report – Dec 28, 2026 to Jan 3, 2027');
{ const s = W.subject('Pablo','2026-10-25'), m = W.mailto(W.CONFIG.ADMIN_EMAIL, s, 'Sum', 'Date\r\n2026-10-25');
  assert.ok(m.startsWith('mailto:philljustice@gmail.com?subject=' + encodeURIComponent(s) + '&body='));
  assert.equal(new URL(m).searchParams.get('subject'), s); }
const csv = 'Date,A\r\n' + Array.from({length:60},(_,i)=>`2026-08-${String(i%28+1).padStart(2,'0')},${'x'.repeat(30)}`).join('\r\n');
const u = W.mailto(W.CONFIG.ADMIN_EMAIL, 'S', 'Summary', csv); assert.ok(u.length <= 1800, u.length); assert.ok(u.startsWith('mailto:philljustice@gmail.com?subject=S&body='));
assert.ok(decodeURIComponent(u).includes('last')); assert.ok(W.mailto('a@b.c','S','Sum','Date\r\n2026-01-01').includes(encodeURIComponent('2026-01-01')));
console.log('All weekly tests passed');
