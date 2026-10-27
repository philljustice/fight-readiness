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
    const sun = new Date(start); while (sun.getDay() !== 0) sun.setDate(sun.getDate()+1);
    const wStart = new Date(start); while (![1,4].includes(wStart.getDay())) wStart.setDate(wStart.getDate()+1); // DTSTART must match BYDAY
    const ev = (id, hm, rrule, summary, desc, s = start) => [
      'BEGIN:VEVENT', `UID:${uidBase}-${id}@fight-readiness`, `DTSTAMP:${stamp(now)}`,
      `DTSTART:${local(s, hm)}`, 'DURATION:PT10M', `RRULE:${rrule}`,
      `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc + (url ? '\nOpen app: ' + url : ''))}`, ...(url ? [`URL:${url}`] : []),
      'TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT'];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FightReady//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:FightReady',
      ...ev('morning', morning, 'FREQ=DAILY', '🥊 Morning log: sleep + nutrition + how you feel', 'Log last night\'s sleep hours, whether you\'re following your nutrition plan today, and how you feel (energy, soreness, mood, stress 1-5).'),
      ...ev('weighin', morning, 'FREQ=WEEKLY;BYDAY=MO,TH', '⚖️ Weigh-in day (Mon/Thu)', 'Weigh in before eating: after the bathroom, same scale, minimal clothing. Log the weight in the app.', wStart),
      ...ev('evening', evening, 'FREQ=DAILY', '🥊 Evening log: training + screen + family', 'Log training (each session done Y/N, effort RPE + minutes), recreational screen hours, family/friends time, and any notes (injuries, illness, soreness).'),
      ...ev('weekly', '18:00', 'FREQ=WEEKLY;BYDAY=SU', 'Send weekly FightReady report to Phill', 'Open the FightReady app and tap "Send weekly report to Phill" (then pick Mail and tap Send).', sun),
      'END:VCALENDAR'];
    return lines.map(fold).join('\r\n') + '\r\n';
  }
  const Sc = root.Scoring || (typeof require !== 'undefined' ? require('./scoring.js') : null);
  const num = v => v !== '' && v != null && !isNaN(v);
  const wellOK = e => !(e.v >= 2) || ['energy','soreness','mood','stress'].every(k => num(e[k]) && +e[k] >= 1);
  const trainOK = e => e.v >= 2 ? Array.isArray(e.sessions) && e.sessions.every(x => x.done === false || (x.done === true && num(x.rpe) && num(x.mins))) : (e.training === true || e.training === false);
  // morning = sleep + nutrition + wellness (energy/soreness/mood/stress); evening = sessions (+ effort/minutes) + screen + family
  const morningDone = e => !!e && num(e.sleep) && (e.nutrition === true || e.nutrition === false) && wellOK(e) && !(Sc.hydrationRequired(e) && !Sc.hydrationOK(e));
  const eveningDone = e => !!e && trainOK(e) && num(e.screen) && (e.family === true || e.family === false);
  const mins = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  // which reminders are due & unfinished right now
  function due(entry, now, morning = '07:00', evening = '21:00') {
    const t = now.getHours() * 60 + now.getMinutes(), out = [];
    if (t >= mins(morning) && !morningDone(entry)) out.push('morning');
    if (t >= mins(evening) && !eveningDone(entry)) out.push('evening');
    return out;
  }
  // Pre-built static calendar files (cal/r-HHMM-HHMM.ics) at 30-min steps: morning 05:00-10:00, evening 18:00-23:00.
  const steps = (h0, h1) => { const o = []; for (let m = h0*60; m <= h1*60; m += 30) o.push(pad(Math.floor(m/60)) + ':' + pad(m%60)); return o; };
  const MORNING_TIMES = steps(5, 10), EVENING_TIMES = steps(18, 23);
  const toMin = hm => { const [h, m] = String(hm).split(':').map(Number); return h*60 + (m||0); };
  const nearest = (hm, list) => list.reduce((b, x) => Math.abs(toMin(x) - toMin(hm)) < Math.abs(toMin(b) - toMin(hm)) ? x : b, list[0]);
  const calFile = (m, e) => `cal/r-${nearest(m, MORNING_TIMES).replace(':','')}-${nearest(e, EVENING_TIMES).replace(':','')}.ics`;
  const api = { MORNING_TIMES, EVENING_TIMES, nearest, calFile, buildICS, fold, morningDone, eveningDone, due };
  if (typeof module !== 'undefined') module.exports = api; else root.Reminders = api;
})(this);
