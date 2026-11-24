import { campNotificationsAllowed, recoveryNotificationsAllowed, recoverySendsThisWeek, cleanLifecycle, maintenanceWeighAllowed } from './phase-policy.js';
// Pure scheduling logic: which reminders are due for a subscriber at instant `now`.
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function localParts(now, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, dow: WD.indexOf(p.weekday), min: (+p.hour) * 60 + (+p.minute) };
}
const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const sameSlot = (r, min) => r != null && Math.floor(r / 15) === Math.floor(min / 15);
const inSlot = (t, min) => sameSlot(toMin(t), min);

export function nudgeSlots(evening) {
  const e = toMin(evening); if (e == null) return [];
  const out = []; let last = e;
  for (const c of [{ kind: 'final', min: 21 * 60 + 30 }, { kind: 'followup', min: e + 120 }].sort((a, b) => a.min - b.min)) {
    if (c.min - last >= 30 && c.min <= 23 * 60) { out.push(c); last = c.min; }
  }
  return out;
}

function campDue(rec, date, dow, min, status) {
  const out = [], name = rec.name ? `${rec.name}, ` : '';
  const weighDays = rec.weighDays || [1, 4];
  const st = status && status.date === date ? status : null;
  const nudging = rec.remind === true, complete = nudging && st && st.complete === true;
  const left = st && Number.isInteger(st.missing) && st.missing > 0 ? st.missing : 0;
  const unfinished = left ? `Finish today's log: ${left} item${left === 1 ? '' : 's'} still to log.` : `${name}finish today's log: nutrition, training, sleep, how you feel, screen time, family.`;
  if (inSlot(rec.morning, min) && !(st && st.morning === true)) out.push(weighDays.includes(dow)
    ? { kind: 'morning', title: '⚖️ CornerReady: Weigh-in + morning check-in', body: `${name}weigh in before eating, then log sleep and how you feel.`, tab: 'log' }
    : { kind: 'morning', title: '🌅 CornerReady: Morning check-in', body: `${name}log last night's sleep and how you feel today.`, tab: 'log' });
  if (inSlot(rec.evening, min) && !complete) out.push({ kind: 'evening', title: '🌙 CornerReady: Evening log', body: nudging && left ? unfinished : `${name}finish today's log: nutrition, training, screen time, family.`, tab: 'log' });
  if (nudging && !complete) for (const n of nudgeSlots(rec.evening)) if (sameSlot(n.min, min))
    out.push({ kind: n.kind, nudge: true, tag: 'fr-nudge', title: n.kind === 'final' ? '⏰ CornerReady: Last call for today\'s log' : '📝 CornerReady: Today\'s log isn\'t finished', body: n.kind === 'final' ? `${name}finish today's log before bed.${left ? ` ${left} item${left === 1 ? '' : 's'} left.` : ''}` : unfinished, tab: 'log' });
  if (dow === 0 && inSlot(rec.weekly || '18:00', min)) out.push({ kind: 'weekly', title: '📧 CornerReady: Weekly report due', body: `${name}send this week's report to Phill.`, tab: 'dash' });
  return out;
}

// Recovery: max 3 pushes/week. Day 1 (day after fight): same morning+evening times as camp (t210u supersedes earlier morning-only / no-2-a-day for day1 only).
// Other days: prioritize Fight Review until complete; soft check-in after; stop review nudges when complete; avoid duplicate kinds at the same slot.
function recoveryDue(rec, date, min, status) {
  const l = cleanLifecycle(rec.lifecycle); if (!recoveryNotificationsAllowed(rec, date, min)) return [];
  const sent = rec.sent || {}, name = rec.name ? `${rec.name}, ` : '';
  const st = status && status.date === date ? status : null;
  const reviewDone = l.reviewComplete === true;
  const checkinDone = !!(st && (st.recoveryCheckin === true || st.complete === true));
  const morning = rec.morning || '07:00';
  const evening = rec.evening || '21:00';
  const day1 = l.recoveryDay === 1 || (l.previousFightDate && date > l.previousFightDate && (() => {
    const a = Date.parse(l.previousFightDate + 'T12:00Z'), b = Date.parse(date + 'T12:00Z');
    return Number.isFinite(a) && Number.isFinite(b) && Math.round((b - a) / 864e5) === 1;
  })());
  // Weekly cap counts unique send-dates (≤3). Day1 AM+PM share one date so both slots stay available.
  if (recoverySendsThisWeek(rec, date) >= 3) return [];
  if (day1) {
    if (inSlot(morning, min) && sent['rec-day1-am'] !== date && sent['rec-review'] !== date) {
      const body = reviewDone
        ? `${name}hope the fight went well. You can still log activities, food and wellbeing today — optional, no points or streaks.`
        : `${name}we want to hear about the fight when you have a minute. Open Fight Review, or you can still log activities, food and wellbeing. Skip anything you want — no pressure.`;
      return [{ kind: 'rec-day1-am', title: 'CornerReady: Day after fight', body, tab: reviewDone ? 'log' : 'dash' }];
    }
    if (inSlot(evening, min) && sent['rec-day1-pm'] !== date && sent['rec-checkin'] !== date) {
      const body = reviewDone
        ? `${name}optional evening check-in: log how you feel, food or activities if you want. No points, no streaks.`
        : `${name}still thinking of you after the fight. Fight Review stays available, or log activities, food and wellbeing whenever you like.`;
      return [{ kind: 'rec-day1-pm', title: 'CornerReady: Day after fight', body, tab: reviewDone ? 'log' : 'dash' }];
    }
    return [];
  }
  if (!reviewDone && inSlot(morning, min) && sent['rec-review'] !== date && sent['rec-day1-am'] !== date)
    return [{ kind: 'rec-review', title: 'CornerReady: Fight Review', body: `${name}when you have a minute, open Fight Review. Skip anything you want — no pressure.`, tab: 'dash' }];
  if (reviewDone && !checkinDone && inSlot(evening, min) && sent['rec-checkin'] !== date && sent['rec-review'] !== date && sent['rec-day1-pm'] !== date)
    return [{ kind: 'rec-checkin', title: 'CornerReady: Recovery check-in', body: `${name}optional: log how you feel today. No points, no streaks.`, tab: 'log' }];
  return [];
}

// fr-v60: Maintenance weigh-in push follows the outline (weighDays sent by the app from weighInsPerWeek). Reminder only, never points.
function maintenanceDue(rec, date, dow, min, status) {
  if (!maintenanceWeighAllowed(rec, date, min)) return [];
  const days = Array.isArray(rec.weighDays) ? rec.weighDays : [];
  const st = status && status.date === date ? status : null, name = rec.name ? `${rec.name}, ` : '';
  if (!days.includes(dow) || !inSlot(rec.morning, min) || (st && st.weighed === true)) return [];
  return [{ kind: 'maint-weigh', title: '⚖️ CornerReady: Weigh-in day', body: `${name}weigh in before eating and log it. Reminder only — it doesn't change your score.`, tab: 'log' }];
}

export function dueReminders(rec, now, status = null) {
  const { date, dow, min } = localParts(now, rec.tz || 'UTC');
  const l = cleanLifecycle(rec.lifecycle);
  let out = [];
  if (l?.mode === 'recovery') out = recoveryDue(rec, date, min, status);
  else if (l?.mode === 'maintenance') out = maintenanceDue(rec, date, dow, min, status);
  else if (campNotificationsAllowed(rec, date, min)) out = campDue(rec, date, dow, min, status);
  else out = [];
  return out.filter(r => (rec.sent || {})[r.kind] !== date).map(r => ({ ...r, date }));
}
