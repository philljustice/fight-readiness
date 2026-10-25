// Testing-phase config + weekly report to the tester admin. Shared by app + node tests.
(function (root) {
  const CONFIG = { SHOW_COACH_CONTACT: false, ADMIN_EMAIL: 'philljustice@gmail.com', ADMIN_NAME: 'Phill',};
  const ymd = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  // Report week = Mon..Sun, keyed by its Sunday. Pending week = most recent Sunday on or before today.
  function pendingWeek(now = new Date()) { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return ymd(d); }
  const weekLabel = sun => { const d = new Date(sun+'T12:00'); d.setDate(d.getDate()-6); return ymd(d)+' to '+sun; };
  function isDue(sent = {}, now = new Date(), startDate = null) { const w = pendingWeek(now);
    if (sent[w] || !startDate || startDate > w) return null; return w; }
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // "Pablo – FightReady weekly report – Oct 19 to Oct 25, 2026" (start gets its year only if it differs)
  const prettyRange = sun => { const e = new Date(sun+'T12:00'), b = new Date(e); b.setDate(b.getDate()-6);
    return `${MON[b.getMonth()]} ${b.getDate()}${b.getFullYear()!==e.getFullYear()?', '+b.getFullYear():''} to ${MON[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`; };
  const subject = (fighter, week) => `${String(fighter||'').trim() || 'Fighter'} – FightReady weekly report – ${prettyRange(week)}`;
  const api = { CONFIG, pendingWeek, weekLabel, prettyRange, isDue, subject };
  if (typeof module !== 'undefined') module.exports = api; else root.Weekly = api;
})(this);
