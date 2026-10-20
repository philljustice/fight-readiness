const R = require('./reminders.js'), assert = require('assert');
const now = new Date(2026,9,19,22,0,0);
const ics = R.buildICS({ morning:'06:30', evening:'21:15', url:'https://team.example/app/', fighter:'Test Fighter', now });
// CRLF everywhere, no bare LF
assert(ics.endsWith('\r\n')); assert(!/[^\r]\n/.test(ics));
const lines = ics.split('\r\n'); lines.pop();
// folding: <=75 octets per physical line
lines.forEach(l => assert(Buffer.byteLength(l) <= 75, 'long line: ' + l));
const un = ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
assert.equal(un[0], 'BEGIN:VCALENDAR'); assert.equal(un[un.length-1], 'END:VCALENDAR');
assert(un.includes('VERSION:2.0')); assert(un.some(l => l.startsWith('PRODID:')));
// balanced blocks
for (const b of ['VCALENDAR','VEVENT','VALARM']) assert.equal(un.filter(l=>l==='BEGIN:'+b).length, un.filter(l=>l==='END:'+b).length);
const evs = ics.replace(/\r\n /g,'').split('BEGIN:VEVENT').slice(1).map(s => s.split('END:VEVENT')[0].split('\r\n').filter(Boolean));
assert.equal(evs.length, 4);
const get = (e,k) => (e.find(l => l.startsWith(k+':'))||'').slice(k.length+1);
const [m, w, e, s] = evs;
assert.equal(get(s,'DTSTART'), '20261025T180000'); assert.equal(get(s,'RRULE'), 'FREQ=WEEKLY;BYDAY=SU'); assert.equal(get(s,'SUMMARY'), 'Send weekly Fight Readiness report to Phill'); assert(get(s,'DESCRIPTION').includes('Send weekly report to Phill'));
assert.equal(get(m,'DTSTART'), '20261019T063000'); assert.equal(get(m,'RRULE'), 'FREQ=DAILY');
assert.equal(get(w,'DTSTART'), '20261019T063000'); assert.equal(get(w,'RRULE'), 'FREQ=WEEKLY;BYDAY=MO,TH'); assert(/before eating/.test(get(w,'DESCRIPTION')));
assert.equal(get(e,'DTSTART'), '20261019T211500'); assert.equal(get(e,'RRULE'), 'FREQ=DAILY');
assert(/sleep/i.test(get(m,'DESCRIPTION')) && /nutrition/i.test(get(m,'DESCRIPTION')));
for (const k of ['training','screen','family','notes']) assert(new RegExp(k,'i').test(get(e,'DESCRIPTION')), k);
evs.forEach(x => { assert(get(x,'UID')); assert(/^\d{8}T\d{6}Z$/.test(get(x,'DTSTAMP'))); assert.equal(get(x,'URL'), 'https://team.example/app/');
  assert(get(x,'DESCRIPTION').includes('https://team.example/app/')); assert(x.includes('TRIGGER:-PT0M')); assert(x.includes('ACTION:DISPLAY')); });
assert.equal(new Set(evs.map(x=>get(x,'UID'))).size, 4);
// escaping
assert(R.buildICS({fighter:'a'}).replace(/\r\n /g,'').includes('Log training (each session done Y/N\\, effort RPE + minutes)\\, recreational'));
// due logic
const full = {nutrition:true, sleep:8, training:true, screen:1, family:false};
assert.deepEqual(R.due(undefined, new Date(2026,9,19,6,59)), []);
assert.deepEqual(R.due(undefined, new Date(2026,9,19,7,0)), ['morning']);
assert.deepEqual(R.due({nutrition:true, sleep:7}, new Date(2026,9,19,12,0)), []);
assert.deepEqual(R.due({nutrition:true, sleep:''}, new Date(2026,9,19,12,0)), ['morning']);
assert.deepEqual(R.due({nutrition:true, sleep:7}, new Date(2026,9,19,21,30)), ['evening']);
assert.deepEqual(R.due(undefined, new Date(2026,9,19,21,30)), ['morning','evening']);
assert.deepEqual(R.due(full, new Date(2026,9,19,23,0)), []);
// v2 entries: wellness needed in the morning, sessions with effort/minutes in the evening
const v2 = Object.assign({}, full, {v:2, energy:4, soreness:4, mood:4, stress:4, sessions:[{done:true,rpe:6,mins:60}]});
assert.deepEqual(R.due(v2, new Date(2026,9,19,23,0)), []);
assert.deepEqual(R.due(Object.assign({}, v2, {mood:''}), new Date(2026,9,19,23,0)), ['morning']);
assert.deepEqual(R.due(Object.assign({}, v2, {sessions:[{done:true,rpe:'',mins:60}]}), new Date(2026,9,19,23,0)), ['evening']);
assert.deepEqual(R.due(Object.assign({}, v2, {sessions:[{done:null}]}), new Date(2026,9,19,23,0)), ['evening']);
assert.deepEqual(R.due(Object.assign({}, v2, {sessions:[]}), new Date(2026,9,19,23,0)), []);
const tue = R.buildICS({now:new Date(2026,9,20,9,0)}).replace(/\r\n /g,'');
assert(tue.includes('UID:fighter-weighin@fight-readiness') && /BYDAY=MO,TH[\s\S]*?/.test(tue));
assert.equal(tue.split('BEGIN:VEVENT')[2].match(/DTSTART:(\d{8})/)[1], '20261022'); // Tue -> next Thu
require('fs').writeFileSync('/tmp/sample.ics', ics);
console.log('All reminder/ICS tests passed');
