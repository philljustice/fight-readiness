// Reminder helpers: ICS generation + "is it logged?" checks. Shared by app + node tests.
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // RFC 5545 line folding at 75 octets (UTF-8 aware)
  function fold(line) {
    const enc = new TextEncoder(), out = []; let cur = '', len = 0;
    for (const ch of line) { const b = enc.encode(ch).length;
      if (len + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
      cur += ch; len += b; }
    out.push(cur); return out.join('\r\n ');
  }
  const stamp = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const local = (d, hm) => { const [h, m] = hm.split(':'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(+h)}${pad(+m)}00`; };
  function buildICS({ morning = '07:00', evening = '21:00', url = '', fighter = '', now = new Date() } = {}) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const uidBase = (fighter || 'fighter').replace(/\W+/g, '-').toLowerCase();
    const wStart = new Date(start); while (![1,4].includes(wStart.getDay())) wStart.setDate(wStart.getDate()+1); // DTSTART must match BYDAY
    const ev = (id, hm, rrule, summary, desc, s = start) => [
      'BEGIN:VEVENT', `UID:${uidBase}-${id}@fight-readiness`, `DTSTAMP:${stamp(now)}`,
      `DTSTART:${local(s, hm)}`, 'DURATION:PT10M', `RRULE:${rrule}`,
      `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc + (url ? '\nOpen app: ' + url : ''))}`, ...(url ? [`URL:${url}`] : []),
      'TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT'];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fight Readiness//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Fight Readiness',
      ...ev('morning', morning, 'FREQ=DAILY', '🥊 Morning log: sleep + nutrition', 'Log last night\'s sleep hours and whether you\'re following your nutrition plan today.'),
      ...ev('weighin', morning, 'FREQ=WEEKLY;BYDAY=MO,TH', '⚖️ Weigh-in day (Mon/Thu)', 'Weigh in before eating: after the bathroom, same scale, minimal clothing. Log the weight in the app.', wStart),
      ...ev('evening', evening, 'FREQ=DAILY', '🥊 Evening log: training + screen + family', 'Log training (done Y/N), recreational screen hours, family/friends time, and any notes (injuries, illness, soreness).'),
      'END:VCALENDAR'];
    return lines.map(fold).join('\r\n') + '\r\n';
  }
  const num = v => v !== '' && v != null && !isNaN(v);
  const morningDone = e => !!e && num(e.sleep) && (e.nutrition === true || e.nutrition === false);
  const eveningDone = e => !!e && (e.training === true || e.training === false) && num(e.screen) && (e.family === true || e.family === false);
  const mins = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  // which reminders are due & unfinished right now
  function due(entry, now, morning = '07:00', evening = '21:00') {
    const t = now.getHours() * 60 + now.getMinutes(), out = [];
    if (t >= mins(morning) && !morningDone(entry)) out.push('morning');
    if (t >= mins(evening) && !eveningDone(entry)) out.push('evening');
    return out;
  }
  const api = { buildICS, fold, morningDone, eveningDone, due };
  if (typeof module !== 'undefined') module.exports = api; else root.Reminders = api;
})(this);
