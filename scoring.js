// Scoring logic — matched to source.xlsx (Dashboard/Parameters formulas). Shared by app + node tests.
(function (root) {
  const DEFAULT_PARAMS = { wNutrition:30, wTraining:30, wSleep:20, wScreen:10, wFamily:10,
    idealSleep:8, sleepPenalty:25, screenFree:2, screenPenalty:40, windowDays:21, unlockDays:7, startDate:null,
    // tiered bonus as in Dashboard!C24: >=90% -> 5, >=75% -> 3, >=60% -> 1
    bonusTiers:[[90,5],[75,3],[60,1]] };
  const sleepScore = (h, p = DEFAULT_PARAMS) => Math.max(0, 100 - p.sleepPenalty * Math.abs(h - p.idealSleep));
  const screenScore = (h, p = DEFAULT_PARAMS) => h <= p.screenFree ? 100 : Math.max(0, 100 - p.screenPenalty * (h - p.screenFree));
  const ymd = d => { const x = new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
  const dayNum = s => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y,m-1,d)/864e5; };
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
  const num = v => v !== '' && v != null && !isNaN(v);
  // Dashboard N7..N9: avg weight (date >= today-7) minus avg weight (today-14 <= date < today-7)
  function weightDelta(entries, t) {
    const ws = entries.filter(e => num(e.weight) && +e.weight > 0);
    const last = avg(ws.filter(e => dayNum(e.date) >= t-7).map(e => +e.weight));
    const prev = avg(ws.filter(e => { const n = dayNum(e.date); return n >= t-14 && n < t-7; }).map(e => +e.weight));
    return (last && prev) ? Math.round((last - prev)*10)/10 : null;
  }
  // Dashboard!B33 thresholds
  function trendLabel(s) {
    if (s == null) return { emoji:'📊', key:'none', label:'Log at least 2 weigh-ins (Mon/Thu) in the last 14 days to see your trend' };
    if (s > 1.5) return { emoji:'🔴', key:'rapid', label:'RAPID GAIN — Urgent review of nutrition, training load & recovery needed' };
    if (s > 0.5) return { emoji:'🟠', key:'gain', label:'GAINING — Mild surplus detected. Tighten portions or increase cardio slightly' };
    if (s > -0.5) return { emoji:'🟡', key:'stable', label:'STABLE — Holding steady. Excellent for maintaining fight weight or recovery phases' };
    if (s > -1.5) return { emoji:'🟢', key:'cut', label:'GOOD CUT — Solid weekly loss. Keep protein high & monitor energy levels' };
    return { emoji:'🔵', key:'aggr', label:'AGGRESSIVE CUT — Strong progress! Prioritize sleep & watch for fatigue/overtraining' };
  }
  const bonusFor = (pct, p) => { for (const [th, pts] of p.bonusTiers) if (pct >= th) return pts; return 0; };
  const verdict = s => s >= 85 ? 'ELITE — Fight night ready! Keep the edge.' : s >= 70 ? 'SOLID — Strong base, tighten 1-2 areas for next level.' : 'BUILDING — Focus daily on Nutrition + Training consistency first.';
  const dataQuality = n => n >= 18 ? 'Excellent — full 3-week picture. Trust the score.' : n >= 10 ? 'Good — reliable trend. Log more days for precision.' : 'Limited — add daily entries for accurate readiness score.';
  function compute(entries, today = new Date(), params = {}) {
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const t = dayNum(ymd(today));
    // Window as in sheet: TODAY()-21 <= date <= TODAY()  (22 calendar days inclusive)
    const st = p.startDate ? dayNum(p.startDate) : null;
    if (st != null) entries = entries.filter(e => dayNum(e.date) >= st); // only days since app start
    const daysSinceStart = st == null ? null : t - st;
    const locked = st == null || daysSinceStart < (p.unlockDays ?? 7);
    const unlockIn = st == null ? (p.unlockDays ?? 7) : Math.max(0, (p.unlockDays ?? 7) - daysSinceStart);
    const w = entries.filter(e => { const n = dayNum(e.date); return n >= t - p.windowDays && n <= t; });
    const N = w.length;
    const pctY = k => N ? w.filter(e => e[k] === true).length / N * 100 : 0; // blank counts as N, like COUNTIFS/N4
    const cats = {
      nutrition: pctY('nutrition'), training: pctY('training'), family: pctY('family'),
      sleep: N ? (avg(w.filter(e => num(e.sleep)).map(e => sleepScore(+e.sleep, p))) || 0) : 0,
      screen: N ? (avg(w.filter(e => num(e.screen)).map(e => screenScore(+e.screen, p))) || 0) : 0,
    };
    const wt = { nutrition:p.wNutrition, training:p.wTraining, sleep:p.wSleep, screen:p.wScreen, family:p.wFamily };
    let base = 0; for (const k in cats) base += cats[k] * wt[k] / 100;
    const consistency = N ? w.filter(e => e.nutrition === true && e.training === true).length / N * 100 : 0;
    const bonus = bonusFor(consistency, p);
    const final = Math.min(100, base + bonus);
    const delta = weightDelta(entries, t);
    const weighed = entries.filter(e => num(e.weight) && +e.weight > 0).sort((a,b)=>a.date<b.date?-1:1);
    return { locked, unlockIn, daysSinceStart, score: Math.round(final), base, bonus, consistency, cats, weights: wt, daysLogged: N, windowDays: p.windowDays,
      delta, trend: trendLabel(delta), verdict: verdict(final), dataQuality: dataQuality(N),
      latestWeight: weighed.length ? weighed[weighed.length-1] : null, windowEntries: w };
  }
  const api = { DEFAULT_PARAMS, sleepScore, screenScore, weightDelta, trendLabel, compute, ymd, dayNum, verdict, dataQuality };
  if (typeof module !== 'undefined') module.exports = api; else root.Scoring = api;
})(this);
