const W = require('./weekly.js'), assert = require('assert');
assert.equal(W.CONFIG.ADMIN_EMAIL, 'philljustice@gmail.com'); assert.equal(W.CONFIG.SHOW_COACH_CONTACT, false);
assert.equal(W.pendingWeek(new Date(2026,9,18,20)), '2026-10-18'); // Sunday
assert.equal(W.pendingWeek(new Date(2026,9,20,9)), '2026-10-18');  // Tuesday -> last Sunday
assert.equal(W.weekLabel('2026-10-18'), '2026-10-12 to 2026-10-18');
assert.equal(W.isDue({}, new Date(2026,9,18,10), '2026-10-01'), '2026-10-18');
assert.equal(W.isDue({'2026-10-18':1}, new Date(2026,9,20), '2026-10-01'), null);
assert.equal(W.isDue({}, new Date(2026,9,20), '2026-10-19'), null); // started after that Sunday
assert.equal(W.isDue({}, new Date(2026,9,20), null), null);
assert.equal(W.subject('Al','2026-10-18'), 'Fight Readiness weekly – Al – 2026-10-12 to 2026-10-18');
const csv = 'Date,A\r\n' + Array.from({length:60},(_,i)=>`2026-08-${String(i%28+1).padStart(2,'0')},${'x'.repeat(30)}`).join('\r\n');
const u = W.mailto(W.CONFIG.ADMIN_EMAIL, 'S', 'Summary', csv); assert.ok(u.length <= 1800, u.length); assert.ok(u.startsWith('mailto:philljustice@gmail.com?subject=S&body='));
assert.ok(decodeURIComponent(u).includes('last')); assert.ok(W.mailto('a@b.c','S','Sum','Date\r\n2026-01-01').includes(encodeURIComponent('2026-01-01')));
console.log('All weekly tests passed');
