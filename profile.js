// Fighter profile: validation + derived values. Shared by app + node tests.
(function (root) {
  const DISCIPLINES = ['MMA','Wrestling','Muay Thai','BJJ','Boxing'];
  const WEIGHT_CLASSES = ['Strawweight (115)','Flyweight (125)','Bantamweight (135)','Featherweight (145)','Lightweight (155)','Welterweight (170)','Middleweight (185)','Light Heavyweight (205)','Heavyweight (265)','Other'];
  const dn = s => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y,m-1,d)/864e5; };
  const ymd = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !isNaN(dn(s));
  const digits = s => String(s||'').replace(/\D/g,'').length;
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  function age(dob, today = new Date()) { if (!isDate(dob)) return null; const [y,m,d] = dob.split('-').map(Number);
    let a = today.getFullYear() - y; if (today.getMonth()+1 < m || (today.getMonth()+1 === m && today.getDate() < d)) a--; return a; }
  const daysTo = (date, today = new Date()) => isDate(date) ? dn(date) - dn(ymd(today)) : null;
  function validate(p, today = new Date()) {
    const e = {}; const t = ymd(today);
    if (!String(p.name||'').trim()) e.name = 'Fighter name is required.';
    else if (p.name.trim().length > 60) e.name = 'Keep the name under 60 characters.';
    if (p.dob) { const a = age(p.dob, today); if (a == null || p.dob > t) e.dob = 'Enter a valid date of birth.'; else if (a < 8 || a > 80) e.dob = 'Age must be between 8 and 80.'; }
    for (const k of ['startWeight','targetWeight']) if (p[k] !== '' && p[k] != null) { const v = +p[k]; if (isNaN(v) || v < 60 || v > 400) e[k] = 'Enter a weight between 60 and 400 lbs.'; }
    if (p.fightDate) { if (!isDate(p.fightDate)) e.fightDate = 'Enter a valid date.'; else if (p.fightDate < t) e.fightDate = 'Fight date is in the past.'; }
    if (p.coachContact) { const c = p.coachContact.trim(); if (c.includes('@') ? !isEmail(c) : digits(c) < 7) e.coachContact = 'Enter a valid email or phone number.'; }
    if (p.emPhone && digits(p.emPhone) < 7) e.emPhone = 'Enter a valid phone number.';
    if (p.emPhone && !String(p.emName||'').trim()) e.emName = 'Add the emergency contact\'s name.';
    if (p.discipline && !DISCIPLINES.includes(p.discipline)) e.discipline = 'Pick a discipline.';
    return e;
  }
  function weightStatus(current, target) {
    if (!(+current > 0) || !(+target > 0)) return null;
    const diff = Math.round((current - target) * 10) / 10;
    return { current:+current, target:+target, diff, text: diff > 0 ? `${diff} lbs to cut` : diff < 0 ? `${-diff} lbs under target` : 'On target' };
  }
  function countdown(fightDate, today = new Date()) { const d = daysTo(fightDate, today); if (d == null || d < 0) return null;
    return { days:d, weeks:Math.floor(d/7), text: d === 0 ? 'Fight day! 🥊' : `${d} day${d===1?'':'s'} to fight (${Math.floor(d/7)}w ${d%7}d)` }; }
  // Training schedule: days[0..6] = Mon..Sun, each { n:0|1|2, labels:[s1,s2] }. perDay = default sessions on training days.
  const REST = /rest|recovery|off/i;
  function scheduleFromWeek(week) { const days = (week && week.days || []).slice(0,7).map(d => { const labels = [d.s1, d.s2].map(x => String(x||'').trim());
      const n = REST.test(d.focus||'') || !labels.some(Boolean) ? 0 : labels.filter(Boolean).length; return { n, labels: n ? labels : ['',''] }; });
    while (days.length < 7) days.push({ n:0, labels:['',''] });
    const tr = days.filter(d => d.n); return { perDay: tr.length && tr.filter(d=>d.n===2).length * 2 >= tr.length ? 2 : 1, days }; }
  const dow = date => (new Date(date + 'T12:00').getDay() + 6) % 7; // Mon = 0
  function sessionsFor(schedule, date) { if (!schedule) return null; const d = schedule.days[dow(date)];
    return Array.from({ length: d ? d.n : 0 }, (_, i) => ({ label: (d.labels[i] || '').trim(), done:null, rpe:'', mins:'' })); }
  // Push schedule labels into a weekly outline (sessions 1-2, rest days marked)
  function applyToWeek(schedule, week) { if (!schedule || !week) return week; week.days.forEach((d, i) => { const s = schedule.days[i];
      if (!s.n) { if (!REST.test(d.focus||'')) d.focus = 'Rest'; d.s1 = ''; d.s2 = ''; }
      else { d.s1 = s.labels[0] || 'Session 1'; d.s2 = s.n > 1 ? (s.labels[1] || 'Session 2') : ''; if (REST.test(d.focus||'')) d.focus = 'Training'; } }); return week; }
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const api = { DAYS, scheduleFromWeek, sessionsFor, applyToWeek, dow, DISCIPLINES, WEIGHT_CLASSES, validate, age, daysTo, weightStatus, countdown };
  if (typeof module !== 'undefined') module.exports = api; else root.Profile = api;
})(this);
