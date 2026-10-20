// Optional insights: streaks, wellness (1-5), session load (sRPE x min), weight-cut safety, CSV export.
// None of these change the core Fight Readiness Score (see scoring.js). Shared by app + node tests.
(function (root) {
  const S = root.Scoring || (typeof require !== 'undefined' ? require('./scoring.js') : null);
  const { dayNum, ymd } = S;
  const num = v => v !== '' && v != null && !isNaN(v);
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
  const CORE = ['nutrition','training','sleep','screen','family'];
  const WELL = [['energy','Energy','😴 Drained','⚡ Fresh'],['soreness','Soreness','🥵 Very sore','💪 No soreness'],['mood','Mood','😠 Down','😄 Great'],['stress','Stress','😫 Very stressed','😌 Relaxed']];
  const isComplete = e => !!e && e.nutrition != null && e.training != null && e.family != null && num(e.sleep) && num(e.screen);
  const isPartial = e => !!e && !isComplete(e) && (CORE.some(k => num(e[k]) || e[k] === true || e[k] === false) || num(e.weight));
  // Streak = consecutive fully-logged days. Today not done yet doesn't break it (counts up to yesterday).
  function streak(entries, today = new Date()) {
    const done = new Set(entries.filter(isComplete).map(e => dayNum(e.date)));
    const t = dayNum(ymd(today)); let d = done.has(t) ? t : t - 1, cur = 0;
    while (done.has(d)) { cur++; d--; }
    let best = 0, run = 0, prev = null;
    [...done].sort((a,b)=>a-b).forEach(n => { run = prev != null && n === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = n; });
    return { current: cur, best, todayDone: done.has(t) };
  }
  // Last n days for a habit grid: 'done' | 'partial' | 'none'
  function grid(entries, today = new Date(), n = 28) {
    const by = {}; entries.forEach(e => by[e.date] = e); const out = [];
    for (let i = n - 1; i >= 0; i--) { const x = new Date(today); x.setDate(x.getDate() - i); const d = ymd(x), e = by[d];
      out.push({ date:d, status: isComplete(e) ? 'done' : isPartial(e) ? 'partial' : 'none' }); }
    return out;
  }
  const dayWellness = e => { const v = WELL.map(w => e && e[w[0]]).filter(x => num(x) && x >= 1 && x <= 5).map(Number); return v.length ? avg(v) : null; };
  const sessionLoad = e => e && num(e.rpe) && num(e.mins) && +e.rpe > 0 && +e.mins > 0 ? Math.round(+e.rpe * +e.mins) : null;
  const inRange = (entries, t, from, to) => entries.filter(e => { const n = dayNum(e.date); return n >= t - from && n <= t - to; });
  function wellness(entries, today = new Date()) {
    const t = dayNum(ymd(today)), last7 = inRange(entries, t, 6, 0), base = inRange(entries, t, 27, 0);
    const a7 = avg(last7.map(dayWellness).filter(v => v != null)), a28 = avg(base.map(dayWellness).filter(v => v != null));
    const items = {}; WELL.forEach(([k]) => items[k] = avg(last7.map(e => e[k]).filter(v => num(v) && v >= 1)));
    const flags = []; inRange(entries, t, 2, 0).forEach(e => WELL.forEach(([k,l]) => { if (num(e[k]) && +e[k] <= 2) flags.push({ date:e.date, item:l, value:+e[k] }); }));
    const n7 = last7.filter(e => dayWellness(e) != null).length;
    return { avg7: a7, avg28: a28, items, flags, days: n7, dropping: a7 != null && a28 != null && n7 >= 3 && a7 <= a28 - 0.5 };
  }
  // Weekly load (sum of sRPE x minutes) and acute:chronic ratio (7-day avg / 28-day avg). Ratio only after 28 days of data.
  function load(entries, today = new Date()) {
    const t = dayNum(ymd(today)), L = es => es.map(sessionLoad).filter(v => v != null);
    const w = L(inRange(entries, t, 6, 0)), m = L(inRange(entries, t, 27, 0));
    const week = w.reduce((s,v)=>s+v,0), month = m.reduce((s,v)=>s+v,0);
    const firstLoad = entries.filter(e => sessionLoad(e) != null).map(e => dayNum(e.date)).sort((a,b)=>a-b)[0];
    const enough = firstLoad != null && t - firstLoad >= 27 && month > 0;
    const acwr = enough ? Math.round((week/7)/(month/28)*100)/100 : null;
    const weeks = []; for (let i = 3; i >= 0; i--) weeks.push(L(inRange(entries, t, i*7+6, i*7)).reduce((s,v)=>s+v,0));
    return { week, sessions: w.length, acwr, weeks, flag: acwr == null ? null : acwr > 1.5 ? 'spike' : acwr < 0.8 ? 'low' : 'ok' };
  }
  // Weight-cut safety. ISSN (2025) combat-sports position stand: aim ~0.5-1 kg/week of gradual loss.
  // We flag loss faster than 1%/week as caution and >1.5%/week as warning.
  function cutSafety(entries, today = new Date(), profile = {}) {
    const t = dayNum(ymd(today)), ws = entries.filter(e => num(e.weight) && +e.weight > 0);
    const last = avg(inRange(ws, t, 7, 0).map(e => +e.weight)), prev = avg(ws.filter(e => { const n = dayNum(e.date); return n >= t-14 && n < t-7; }).map(e => +e.weight));
    const out = { pctPerWeek: null, level: null, msg: null, pace: null };
    if (last && prev) { const pct = Math.round((last - prev) / prev * 1000) / 10; out.pctPerWeek = pct;
      if (pct < -1.5) { out.level = 'warn'; out.msg = `Losing ${-pct}% of bodyweight per week. That's faster than the safe range (about 0.5–1%/week). Talk to your coach: eat enough protein and carbs, and don't skip meals or dehydrate.`; }
      else if (pct < -1) { out.level = 'caution'; out.msg = `Losing ${-pct}%/week. That's at the top of the safe range. Watch energy, sleep and soreness.`; } }
    const cur = ws.sort((a,b)=>a.date<b.date?-1:1).slice(-1)[0], tgt = +profile.targetWeight;
    if (cur && tgt > 0 && profile.fightDate) { const days = dayNum(profile.fightDate) - t, toGo = +cur.weight - tgt;
      if (days > 0 && toGo > 0) { const perWk = toGo / (days/7), pct = perWk / +cur.weight * 100;
        out.pace = { perWeek: Math.round(perWk*10)/10, pct: Math.round(pct*10)/10, level: pct > 1.5 ? 'warn' : pct > 1 ? 'caution' : 'ok' }; } }
    return out;
  }
  const csvCell = v => { const s = v == null ? '' : v === true ? 'Y' : v === false ? 'N' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const CSV_COLS = ['Date','Nutrition','Training','Sleep_Hours','Screen_Hours','Family_Friends','Weight','Notes','Energy','Soreness','Mood','Stress','RPE','Session_Min','Session_Load','Complete'];
  function toCSV(entries) {
    const rows = entries.slice().sort((a,b)=>a.date<b.date?-1:1).map(e => [e.date,e.nutrition,e.training,e.sleep,e.screen,e.family,e.weight,e.notes,e.energy,e.soreness,e.mood,e.stress,e.rpe,e.mins,sessionLoad(e),isComplete(e)?'Y':'N'].map(csvCell).join(','));
    return [CSV_COLS.join(',')].concat(rows).join('\r\n') + '\r\n';
  }
  const api = { WELL, isComplete, isPartial, streak, grid, dayWellness, sessionLoad, wellness, load, cutSafety, toCSV, CSV_COLS };
  if (typeof module !== 'undefined') module.exports = api; else root.Insights = api;
})(this);
