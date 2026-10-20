// Builds the static reminder calendars served by GitHub Pages: node build-ics.js
const R = require('./reminders.js'), fs = require('fs');
const URL = 'https://philljustice.github.io/fight-readiness/', now = new Date(2026, 9, 20, 12, 0, 0);
fs.mkdirSync('cal', { recursive: true }); fs.readdirSync('cal').forEach(f => fs.unlinkSync('cal/' + f));
let n = 0; for (const m of R.MORNING_TIMES) for (const e of R.EVENING_TIMES) { fs.writeFileSync(R.calFile(m, e), R.buildICS({ morning:m, evening:e, url:URL, fighter:'team', now })); n++; }
console.log('wrote', n, 'calendar files');
