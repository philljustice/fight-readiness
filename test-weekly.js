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
console.log('All weekly tests passed');
const R = require('./report.js');
assert.ok(R.shareText('philljustice@gmail.com','Pablo – FightReady weekly report – Oct 19 to Oct 25, 2026',['x']).startsWith('Subject: Pablo – FightReady weekly report – Oct 19 to Oct 25, 2026\nTo: philljustice@gmail.com\n'));
assert.equal(R.fileName('Pablo Q','2026-10-25'), 'FightReady-Pablo-Q-2026-10-25.png');
const fs = require('fs'), app = fs.readFileSync(__dirname+'/app.js','utf8');
assert.ok(!app.includes('mailto') && !app.includes('Email weekly report')); assert.equal((app.match(/Send report with charts/g)||[]).length >= 2, true);
assert.ok(fs.readFileSync(__dirname+'/sw.js','utf8').includes("'report.js'"));
console.log('All report tests passed');
