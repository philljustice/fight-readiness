// Testing-phase config + weekly report to the tester admin. Shared by app + node tests.
(function (root) {
  const CONFIG = { SHOW_COACH_CONTACT: false, ADMIN_EMAIL: 'philljustice@gmail.com', ADMIN_NAME: 'Phill', MAILTO_MAX: 1800 };
  const ymd = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  // Report week = Mon..Sun, keyed by its Sunday. Pending week = most recent Sunday on or before today.
  function pendingWeek(now = new Date()) { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return ymd(d); }
  const weekLabel = sun => { const d = new Date(sun+'T12:00'); d.setDate(d.getDate()-6); return ymd(d)+' to '+sun; };
  function isDue(sent = {}, now = new Date(), startDate = null) { const w = pendingWeek(now);
    if (sent[w] || !startDate || startDate > w) return null; return w; }
  const subject = (fighter, week) => `Fight Readiness weekly – ${fighter || 'Fighter'} – ${weekLabel(week)}`;
  function mailto(to, subj, summary, csv, max = CONFIG.MAILTO_MAX) {
    const lines = csv.trim().split(/\r?\n/), head = lines[0], rows = lines.slice(1);
    const mk = (r, note) => `mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(summary + '\n\nCSV' + note + ':\n' + [head].concat(r).join('\n'))}`;
    let u = mk(rows, ''); if (u.length <= max) return u;
    let r = rows.slice(-14); u = mk(r, ' (last 14 days)');
    while (u.length > max && r.length) { r = r.slice(1); u = mk(r, ` (last ${r.length} days)`); }
    if (u.length > max) u = `mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(summary.slice(0, 1200))}`;
    return u;
  }
  const api = { CONFIG, pendingWeek, weekLabel, isDue, subject, mailto };
  if (typeof module !== 'undefined') module.exports = api; else root.Weekly = api;
})(this);
