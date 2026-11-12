// Scoring logic. Shared by app + node tests.
(function (root) {
  const DEFAULT_PARAMS = { wNutrition:25, wTraining:25, wSleep:15, wWellness:15, wScreen:10, wFamily:10,
    idealSleep:8, sleepPenalty:25, screenFree:2, screenPenalty:40, windowDays:21, unlockDays:7, startDate:null,
    // tiered bonus as in Dashboard!C24: >=90% -> 5, >=75% -> 3, >=60% -> 1
    bonusTiers:[[90,5],[75,3],[60,1]],
    // Nutrition mode: 'yn' (plan followed Yes/No, default), 'kcal' (daily calorie goal) or 'macros' (protein/carbs/fat grams)
    nutMode:'yn', nutKcal:'', nutP:'', nutC:'', nutF:'' };
  const WELL_KEYS = ['energy','soreness','mood','stress']; // all stored 1-5. Energy/mood: 5 = best. Soreness/stress (scale v2): 5 = very sore / very stressed (worst).
  const WELL_INV = ['soreness','stress'], WELL_SCALE = 2;
  const wellGood = (k, v) => WELL_INV.includes(k) ? 6 - +v : +v; // 1 = worst .. 5 = best, for scoring
  // One-time migration: scale v1 stored soreness/stress as 5 = best. Flip to v2 (v -> 6-v). Idempotent via state.wellScale.
  function migrateWellScale(st) { if (!st || st.wellScale === WELL_SCALE) return false;
    (st.entries || []).forEach(e => WELL_INV.forEach(k => { if (isNumW(e[k]) && +e[k] >= 1 && +e[k] <= 5) e[k] = 6 - +e[k]; }));
    st.wellScale = WELL_SCALE; return true; }
  const isNumW = v => v !== '' && v != null && !isNaN(v);
  // Morning hydration: first-pee colour swatch 1 (pale) .. 8 (dark amber/brown). Stored as e.hydration (1-8). Does not affect any score.
  // Required only for new days (v2 entries dated HYD_FROM or later); older days without it still count complete.
  const HYD_FROM = '2026-10-28';
  const hydrationOK = e => !!e && e.hydration !== '' && e.hydration != null && Number.isInteger(+e.hydration) && +e.hydration >= 1 && +e.hydration <= 8;
  const hydrationRequired = e => !!e && e.v >= 2 && String(e.date || '') >= HYD_FROM;
  const isNum = v => v !== '' && v != null && !isNaN(v);

  // ---- Extended morning wellness (fr-v40). All optional for scoring: a missing item is left out of the average (no penalty).
  // Required on the log only for days from WELL3_FROM: motivation, appetite, and perceived sleep quality when no watch is used.
  const WELL3_FROM = '2026-11-02';
  const DEVICES = ['None','Garmin','Fitbit','Apple Watch','Oura','Whoop','Samsung Galaxy Watch','Other'];
  // Device sleep score -> in-app 0-100 quality. Breakpoints [device score, app score], linear between. Anchor rule: start of the
  // maker's top band -> 90, start of its "good" band -> 75 (par), start of its "fair" band -> 50, 0 -> 0. See README for sources.
  const SLEEP_SCALES = {
    'Garmin': { label:'Garmin Sleep Score (0–100)', unit:'', max:100, pts:[[0,0],[60,50],[80,75],[90,90],[100,100]], bands:[[90,'Excellent'],[80,'Good'],[60,'Fair'],[0,'Poor']] },
    'Fitbit': { label:'Fitbit Sleep Score (0–100)', unit:'', max:100, pts:[[0,0],[60,50],[80,75],[90,90],[100,100]], bands:[[90,'Excellent'],[80,'Good'],[60,'Fair'],[0,'Poor']] },
    'Apple Watch': { label:'Apple Watch Sleep Score (0–100)', unit:'', max:100, pts:[[0,0],[41,25],[61,50],[81,75],[96,90],[100,100]], bands:[[96,'Very High'],[81,'High'],[61,'OK'],[41,'Low'],[0,'Very Low']] },
    'Oura': { label:'Oura Sleep Score (0–100)', unit:'', max:100, pts:[[0,0],[60,50],[70,75],[85,90],[100,100]], bands:[[85,'Optimal'],[70,'Good'],[60,'Fair'],[0,'Pay attention']] },
    'Whoop': { label:'WHOOP Sleep Performance (%)', unit:'%', max:100, pts:[[0,0],[70,75],[85,90],[100,100]], bands:[[85,'Optimal'],[70,'Sufficient'],[0,'Poor']] },
    'Samsung Galaxy Watch': { label:'Samsung Health Sleep Score (0–100)', unit:'', max:100, pts:[[0,0],[60,50],[85,90],[100,100]], bands:[[85,'Healthy'],[60,'Fair'],[0,'Needs attention']] },
    'Other': { label:'Device sleep score (0–100)', unit:'', max:100, pts:[[0,0],[100,100]], bands:[] } };
  const usesWatch = dev => !!dev && dev !== 'None' && !!SLEEP_SCALES[dev];
  function deviceSleepQuality(dev, v) { const sc = SLEEP_SCALES[dev]; if (!sc || !isNumW(v)) return null; v = Math.max(0, Math.min(sc.max, +v)); const P = sc.pts;
    for (let i = 1; i < P.length; i++) if (v <= P[i][0]) { const [x0,y0] = P[i-1], [x1,y1] = P[i]; return y0 + (y1 - y0) * (v - x0) / (x1 - x0); } return 100; }
  const deviceBand = (dev, v) => { const sc = SLEEP_SCALES[dev]; if (!sc || !isNumW(v)) return ''; const b = sc.bands.find(([th]) => +v >= th); return b ? b[1] : ''; };
  const INJURY = { none:100, minor:50, limiting:0 }, INJ_AREAS = ['Head/neck','Shoulder','Elbow/arm','Wrist/hand','Back','Ribs/core','Hip/groin','Knee','Ankle/foot','Other'];
  const median = a => { if (!a.length) return null; const b = a.slice().sort((x,y)=>x-y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m-1] + b[m]) / 2; };
  const RHR = { WIN:30, MIN:7, SPIKE:5, ZERO:10, FREE:2 };
  // Personal resting-HR baseline: median of readings in the 30 days before `date`, once there are 7+ readings. null = no baseline yet.
  function rhrBaseline(entries, date) { const t = dayNum(date), v = entries.filter(e => { const n = dayNum(e.date); return n < t && n >= t - RHR.WIN && isNumW(e.rhr) && +e.rhr > 25; }).map(e => +e.rhr);
    return v.length >= RHR.MIN ? median(v) : null; }
  // 100 up to +2 bpm over baseline, falling to 0 at +10; no score until a baseline exists.
  const rhrScore = (rhr, base) => base == null || !isNumW(rhr) || !(+rhr > 25) ? null : Math.max(0, Math.min(100, 100 - (+rhr - base - RHR.FREE) / (RHR.ZERO - RHR.FREE) * 100));
  // Weights inside Wellness: the four Hooper items 1 each, sleep quality 1, motivation 1, injury 1, illness 1, resting HR 1, appetite 0.5.
  const W3 = { sleepq:1, motivation:1, appetite:0.5, injury:1, ill:1, rhr:1 };
  function wellnessParts(e, rhrBase) { if (!e) return null; const v = WELL_KEYS.map(k => e[k]);
    if (!v.every(x => isNumW(x) && +x >= 1 && +x <= 5)) return null;
    const parts = WELL_KEYS.map(k => [k, (wellGood(k, e[k]) - 1) * 25, 1]), r15 = x => isNumW(x) && +x >= 1 && +x <= 5;
    const sq = usesWatch(e.sleepDevice) && isNumW(e.sleepDev) ? deviceSleepQuality(e.sleepDevice, e.sleepDev) : r15(e.sleepq) ? (+e.sleepq - 1) * 25 : null;
    if (sq != null) parts.push(['sleepq', sq, W3.sleepq]);
    if (r15(e.motivation)) parts.push(['motivation', (+e.motivation - 1) * 25, W3.motivation]);
    if (r15(e.appetite)) parts.push(['appetite', (+e.appetite - 1) * 25, W3.appetite]);
    if (e.injury in INJURY) parts.push(['injury', INJURY[e.injury], W3.injury]);
    if (e.ill === true || e.ill === false) parts.push(['ill', e.ill ? 0 : 100, W3.ill]);
    const hr = rhrScore(e.rhr, rhrBase); if (hr != null) parts.push(['rhr', hr, W3.rhr]);
    return parts; }
  // Wellness 0-100 = average of the four ratings mapped 1->0 ... 5->100. null if not all four rated.
  function wellnessScore(e, rhrBase = null) { const P = wellnessParts(e, rhrBase); if (!P) return null;
    return P.reduce((a, p) => a + p[1] * p[2], 0) / P.reduce((a, p) => a + p[2], 0); }
  // Training 0-100 for one day. v2 entries: % of scheduled sessions completed (rest day = 100). Legacy: Y=100, N/blank=0.
  function trainingPct(e) { if (!e) return 0;
    if (Array.isArray(e.sessions)) { if (!e.sessions.length) return 100; return e.sessions.filter(x => x.done === true).length / e.sessions.length * 100; }
    return e.training === true ? 100 : 0; }
  // Maintenance qualifying session: comment of what was trained + estimated intensity. Minutes optional.
  // Camp completed sessions count too (label from the schedule, or a comment, plus done).
  function qualifyingSession(s) {
    if (!s || s.done === false) return false;
    const comment = String(s.comment || s.label || '').trim();
    const intensity = isNum(s.rpe) && +s.rpe >= 1 && +s.rpe <= 10;
    return !!(comment && intensity);
  }
  function countQualifyingSessions(entries) {
    return (entries || []).reduce((n, e) => {
      let c = 0;
      if (Array.isArray(e.sessions)) c += e.sessions.filter(qualifyingSession).length;
      else if (e.training === true) c += 1;
      if (e.extra && qualifyingSession(Object.assign({ done:true }, e.extra))) c += 1;
      return n + c;
    }, 0);
  }
  // 4 sessions/week = 100, 3 = 90, 2 = 60, 1 = 30, 0 = 0; interpolate between.
  function weeklyTrainingScore(sessionsPerWeek) {
    const pts = [[0,0],[1,30],[2,60],[3,90],[4,100]];
    if (!(sessionsPerWeek > 0)) return 0;
    if (sessionsPerWeek >= 4) return 100;
    for (let i = 1; i < pts.length; i++) if (sessionsPerWeek <= pts[i][0]) {
      const [x0,y0] = pts[i-1], [x1,y1] = pts[i];
      return y0 + (y1 - y0) * (sessionsPerWeek - x0) / (x1 - x0);
    }
    return 100;
  }
  function maintenanceTrainingScore(entries, today, params = {}) {
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const t = dayNum(ymd(today));
    const windowStart = t - p.windowDays;
    const st = p.startDate ? dayNum(p.startDate) : windowStart;
    const from = Math.max(windowStart, st);
    const to = p.includeToday ? t : t - 1;
    if (to < from) return 0;
    const inWin = (entries || []).filter(e => { const n = dayNum(e.date); return n >= from && n <= to; });
    if (!inWin.length) return 0;
    // Denominator starts at the first log in the window so empty weeks before the
    // fighter began logging do not dilute a 4-session week down to a 21-day rate.
    const from2 = Math.max(from, Math.min(...inWin.map(e => dayNum(e.date))));
    const span = Math.max(1, to - from2 + 1);
    const sessions = countQualifyingSessions(inWin);
    return weeklyTrainingScore(sessions / (span / 7));
  }
  function weekSessionCount(entries, date) {
    const t = dayNum(date);
    const mon = t - ((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7);
    return countQualifyingSessions((entries || []).filter(e => { const n = dayNum(e.date); return n >= mon && n < mon + 7; }));
  }
  // A day is scorable when at least one FightReady category was actually logged.
  // A weigh-in, hydration colour, or note alone does not start the score (show — not 0).
  function entryScorable(e) {
    if (!e) return false;
    if (nutritionDone(e)) return true;
    if (num(e.sleep)) return true;
    if (wellnessScore(e) != null) return true;
    if (num(e.screen)) return true;
    if (e.family === true || e.family === false) return true;
    if (e.training === true || e.training === false) return true;
    if (Array.isArray(e.sessions) && e.sessions.some(s => qualifyingSession(s) || s.done === true || s.done === false)) return true;
    if (e.extra && (String(e.extra.label || e.extra.comment || '').trim() || qualifyingSession(Object.assign({ done:true }, e.extra)))) return true;
    return false;
  }
  const hasScorable = entries => (entries || []).some(entryScorable);
  // Completed sessions with load (scheduled + optional extra; legacy single rpe/mins)
  function sessionsDone(e) { if (!e) return [];
    const out = Array.isArray(e.sessions) ? e.sessions.filter(x => x.done === true).map(x => ({ label:x.label||'', rpe:x.rpe, mins:x.mins })) : (isNum(e.rpe) || isNum(e.mins) ? [{ label:'', rpe:e.rpe, mins:e.mins }] : []);
    if (e.extra && (isNum(e.extra.rpe) || isNum(e.extra.mins) || e.extra.label)) out.push({ label:(e.extra.label||'Extra')+' (extra)', rpe:e.extra.rpe, mins:e.extra.mins, extra:true });
    return out; }
  const sessionLoad = e => { const L = sessionsDone(e).filter(x => isNum(x.rpe) && isNum(x.mins) && +x.rpe > 0 && +x.mins > 0).map(x => Math.round(+x.rpe * +x.mins)); return L.length ? L.reduce((a,b)=>a+b,0) : null; };
  // ---- Nutrition goal scoring ----
  // closeness(actual, target): within ±5% of goal = 100, then linear down to 0 at ±30% (over and under penalised the same).
  const NUT_FULL = 5, NUT_ZERO = 30, NUT_HIT = 80, MACRO_W = { protein:0.5, carbs:0.25, fat:0.25 };
  function closeness(a, t) { if (!(+t > 0) || !isNum(a)) return null; const dev = Math.abs(+a - +t) / +t * 100;
    return dev <= NUT_FULL ? 100 : dev >= NUT_ZERO ? 0 : (NUT_ZERO - dev) / (NUT_ZERO - NUT_FULL) * 100; }
  // Mode stored on each entry (e.nmode + e.ntarget) so changing Setup later never rescores past days. No nmode = Yes/No (legacy).
  const nutMode = e => e && (e.nmode === 'kcal' || e.nmode === 'macros') ? e.nmode : 'yn';
  const nutritionDone = e => { if (!e) return false; if (e.cheat) return true; const m = nutMode(e);
    if (m === 'kcal') return isNum(e.kcal); if (m === 'macros') return ['protein','carbs','fat'].every(k => isNum(e[k]));
    return e.nutrition === true || e.nutrition === false; };
  // 0-100 for the day, null if not entered (counts as 0 in the overall, like a blank Yes/No).
  function nutritionScore(e) { if (!nutritionDone(e)) return null; if (e.cheat) return 100; /* claimed cheat day */ const m = nutMode(e), t = e.ntarget || {};
    if (m === 'kcal') return closeness(e.kcal, t.kcal) ?? 0;
    if (m === 'macros') return Object.keys(MACRO_W).reduce((s, k) => s + (closeness(e[k], t[k]) ?? 0) * MACRO_W[k], 0);
    return e.nutrition ? 100 : 0; }
  // Consistency bonus "nutrition hit": Yes for Yes/No days, day score >= 80 for goal days.
  const nutritionHit = e => e && e.cheat ? true : nutMode(e) === 'yn' ? !!e && e.nutrition === true : (nutritionScore(e) ?? 0) >= NUT_HIT;
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
  // ---- Momentum (camp-long): up to +5 on top of base + 21-day consistency bonus ----
  // Days: every closed-out day from camp start to yesterday. Consistent = nutrition hit + training 100% (cheat day = hit).
  // Unlogged camp days count as NOT consistent. Weight rises linearly from 1 at camp start to 2 on fight day.
  // Weighted part: 0 at <=50% weighted consistency, linear to 4 pts at >=95%. Streak part: +1 per 14 consecutive consistent days, max 1.
  // No fight date: camp assumed 70 days (10 weeks). Needs >=7 closed camp days. Total rounded to nearest 0.5, max 5.
  const MOM = { MAX:5, WMAX:4, SMAX:1, LO:50, HI:95, STREAK_FULL:14, MIN_DAYS:7, DEFAULT_CAMP:70 };
  const isConsistent = e => !!e && nutritionHit(e) && trainingPct(e) === 100;
  function momentum(entries, today, campStart, fightDate) {
    const t = dayNum(ymd(today)), out = { points:0, weighted:0, streak:0, campDays:0, consistentDays:0, wPts:0, sPts:0, daysToFight:null, campLength:null };
    if (!campStart) return out; const st = dayNum(campStart);
    const fd = fightDate ? dayNum(fightDate) : st + MOM.DEFAULT_CAMP, L = Math.max(1, fd - st);
    out.campLength = fd - st; out.daysToFight = fightDate ? fd - t : null;
    const by = {}; entries.forEach(e => by[e.date] = e);
    let sw = 0, sc = 0;
    for (let d = st; d < t && d <= fd; d++) { const w = 1 + Math.min(1, (d - st) / L), key = new Date(d * 864e5).toISOString().slice(0,10), c = isConsistent(by[key]);
      sw += w; if (c) { sc += w; out.consistentDays++; } out.campDays++; }
    for (let d = t - 1; d >= st; d--) { const key = new Date(d * 864e5).toISOString().slice(0,10); if (isConsistent(by[key])) out.streak++; else break; }
    if (out.campDays < MOM.MIN_DAYS) return out;
    out.weighted = sw ? sc / sw * 100 : 0;
    out.wPts = MOM.WMAX * Math.max(0, Math.min(1, (out.weighted - MOM.LO) / (MOM.HI - MOM.LO)));
    out.sPts = MOM.SMAX * Math.min(1, out.streak / MOM.STREAK_FULL);
    out.points = Math.min(MOM.MAX, Math.round((out.wPts + out.sPts) * 2) / 2);
    return out; }
  const verdict = s => s >= 90 ? 'ELITE — Fight night ready! Keep the edge.' : s >= 75 ? 'FIGHT READY — Strong base, tighten 1-2 areas for next level.' : s >= 60 ? 'SOLID — Decent base, lift your weakest 2 categories.' : 'OFF PACE — Focus daily on Nutrition + Training consistency first.';
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
    const w = entries.filter(e => { const n = dayNum(e.date); return n >= t - p.windowDays && (p.includeToday ? n <= t : n < t); }); // today counts only once closed out (from tomorrow)
    const N = w.length;
    const pctY = k => N ? w.filter(e => e[k] === true).length / N * 100 : 0; // blank counts as N, like COUNTIFS/N4
    const maint = p.trainingPlan === 'maintenance';
    const cats = {
      nutrition: N ? avg(w.map(e => nutritionScore(e) ?? 0)) : 0,
      training: maint ? maintenanceTrainingScore(entries, today, p) : (N ? avg(w.map(trainingPct)) : 0),
      family: pctY('family'),
      wellness: N ? (avg(w.map(e => wellnessScore(e, rhrBaseline(entries, e.date))).filter(v => v != null)) || 0) : 0,
      sleep: N ? (avg(w.filter(e => num(e.sleep)).map(e => sleepScore(+e.sleep, p))) || 0) : 0,
      screen: N ? (avg(w.filter(e => num(e.screen)).map(e => screenScore(+e.screen, p))) || 0) : 0,
    };
    const wt = { nutrition:p.wNutrition, training:p.wTraining, sleep:p.wSleep, wellness:p.wWellness||0, screen:p.wScreen, family:p.wFamily };
    let base = 0; for (const k in cats) base += cats[k] * wt[k] / 100;
    const consistency = N ? w.filter(e => nutritionHit(e) && (maint ? weekSessionCount(entries, e.date) >= 3 : trainingPct(e) === 100)).length / N * 100 : 0;
    const bonus = bonusFor(consistency, p);
    const mom = p.noMomentum ? { points:0, weighted:0, streak:0, campDays:0, consistentDays:0, wPts:0, sPts:0, daysToFight:null, campLength:null } : momentum(entries, today, p.startDate, p.fightDate);
    const final = Math.min(100, base + bonus + mom.points);
    const delta = weightDelta(entries, t);
    const weighed = entries.filter(e => num(e.weight) && +e.weight > 0).sort((a,b)=>a.date<b.date?-1:1);
    return { locked, unlockIn, daysSinceStart, score: Math.round(final), base, bonus, consistency, momentum: mom, cats, weights: wt, daysLogged: N, windowDays: p.windowDays,
      delta, trend: trendLabel(delta), verdict: verdict(final), dataQuality: dataQuality(N),
      latestWeight: weighed.length ? weighed[weighed.length-1] : null, windowEntries: w, scorable: hasScorable(w), rhrBase: Object.fromEntries(w.map(e => [e.date, rhrBaseline(entries, e.date)])) };
  }

  // Below par: for each category under PAR (75 = green "Fight Ready" tier) in the score window, list the inputs dragging it down.
  const PAR = 75;
  function belowPar(r, params = {}) { const p = Object.assign({}, DEFAULT_PARAMS, params), w = r.windowEntries || [], N = w.length, out = [];
    if (!N) return out; const pl = (n, s) => n + ' ' + s + (n == 1 ? '' : 's'), f1 = x => (Math.round(x * 10) / 10).toFixed(1);
    const add = (key, label, why) => { const v = r.cats[key]; if (v < PAR && why.length) out.push({ key, label, score: Math.round(v), why }); };
    { const why = [], miss = w.filter(e => !nutritionDone(e)).length, cheat = w.filter(e => e.cheat).length;
      const ys = w.filter(e => nutritionDone(e) && !e.cheat && nutMode(e) === 'yn' && e.nutrition !== true).length;
      const off = w.filter(e => nutritionDone(e) && !e.cheat && nutMode(e) !== 'yn' && (nutritionScore(e) ?? 0) < NUT_HIT);
      if (ys) why.push(`Plan not followed on ${pl(ys, 'day')} of ${N}`);
      if (off.length) why.push(`Off calorie/macro target on ${pl(off.length, 'day')} of ${N} (avg ${Math.round(avg(off.map(e => nutritionScore(e) ?? 0)))}/100 on those days)`);
      if (miss) why.push(`Not logged on ${pl(miss, 'day')} (scored 0)`);
      if (cheat) why.push(`${pl(cheat, 'cheat day')} (counted as on plan)`);
      add('nutrition', 'Nutrition', why); }
    { const why = [];
      if (p.trainingPlan === 'maintenance') {
        const sess = countQualifyingSessions(w);
        why.push(`${sess} qualifying session${sess===1?'':'s'} in the window (comment + intensity; 4/week = 100, 3/week = 90)`);
      } else {
        let sch = 0, done = 0, legacyMiss = 0; w.forEach(e => { if (Array.isArray(e.sessions)) { sch += e.sessions.length; done += e.sessions.filter(x => x.done === true).length; } else if (e.training !== true) legacyMiss++; });
        const daysShort = w.filter(e => trainingPct(e) < 100).length;
        if (sch > done) why.push(`Missed ${sch - done} of ${pl(sch, 'scheduled session')}`);
        if (legacyMiss) why.push(`Training marked No/blank on ${pl(legacyMiss, 'day')}`);
        if (daysShort) why.push(`${pl(daysShort, 'day')} of ${N} not fully completed`);
      }
      add('training', 'Training', why); }
    { const why = [], sl = w.filter(e => num(e.sleep)).map(e => +e.sleep), un = N - sl.length;
      if (sl.length) { why.push(`Average ${f1(avg(sl))}h vs ${p.idealSleep}h target`); const lo = sl.filter(h => h < p.idealSleep - 1).length, hi = sl.filter(h => h > p.idealSleep + 1).length;
        if (lo) why.push(`Under ${p.idealSleep - 1}h on ${pl(lo, 'night')}`); if (hi) why.push(`Over ${p.idealSleep + 1}h on ${pl(hi, 'night')}`); }
      if (un) why.push(`Sleep not logged on ${pl(un, 'day')}`);
      add('sleep', 'Sleep', why); }
    { const why = [], rated = w.filter(e => wellnessScore(e) != null), names = { energy:['Energy','low energy'], soreness:['Soreness','high soreness'], mood:['Mood','low mood'], stress:['Stress','high stress'] };
      if (rated.length) WELL_KEYS.map(k => { const vs = rated.map(e => +e[k]), inv = WELL_INV.includes(k); return { k, inv, a: avg(vs), g: avg(vs.map(v => wellGood(k, v))), bad: vs.filter(v => wellGood(k, v) <= 2).length }; }).sort((x, y) => x.g - y.g)
        .forEach(x => { if (x.g < 4 || x.bad) why.push(`${names[x.k][0]} avg ${f1(x.a)}/5${x.bad ? ` — ${names[x.k][1]} (${x.inv ? '4–5' : '1–2'}) on ${pl(x.bad, 'day')}` : ''}`); });
      { const P = rated.map(e => [e, wellnessParts(e, (r.rhrBase || {})[e.date])]), part = k => P.map(([e, ps]) => [e, (ps.find(x => x[0] === k) || [])[1]]).filter(x => x[1] != null);
        const sq = part('sleepq'); if (sq.length) { const a = avg(sq.map(x => x[1])), poor = sq.filter(x => x[1] < 50).length; if (a < PAR || poor) why.push(`Sleep quality avg ${Math.round(a)}/100${poor ? ` — poor on ${pl(poor, 'night')}` : ''}`); }
        [['motivation','Motivation / readiness to train','low motivation'],['appetite','Appetite','poor appetite']].forEach(([k, l, b]) => { const vs = rated.filter(e => isNumW(e[k]) && +e[k] >= 1).map(e => +e[k]); if (!vs.length) return;
          const a = avg(vs), bad = vs.filter(v => v <= 2).length; if (a < 4 || bad) why.push(`${l} avg ${f1(a)}/5${bad ? ` — ${b} (1–2) on ${pl(bad, 'day')}` : ''}`); });
        const inj = rated.filter(e => e.injury === 'minor' || e.injury === 'limiting'); if (inj.length) { const lim = inj.filter(e => e.injury === 'limiting').length, areas = [...new Set(inj.map(e => e.injuryArea).filter(Boolean))];
          why.push(`Injury/pain on ${pl(inj.length, 'day')}${lim ? ` (${lim} limiting)` : ''}${areas.length ? ': ' + areas.join(', ') : ''}`); }
        const ill = rated.filter(e => e.ill === true).length; if (ill) why.push(`Feeling ill on ${pl(ill, 'day')}`);
        const hr = rated.filter(e => { const b = (r.rhrBase || {})[e.date]; return b != null && isNumW(e.rhr) && +e.rhr - b >= RHR.SPIKE; }); if (hr.length) why.push(`Resting HR ${RHR.SPIKE}+ bpm above baseline on ${pl(hr.length, 'morning')}`); }
      if (N - rated.length) why.push(`How-you-feel not fully rated on ${pl(N - rated.length, 'day')}`);
      const hyd = w.filter(e => hydrationOK(e) && +e.hydration >= 6).length, hydMiss = w.filter(e => hydrationRequired(e) && !hydrationOK(e)).length;
      if (hyd) why.push(`Dark first-pee colour (dehydrated) on ${pl(hyd, 'morning')}`); if (hydMiss) why.push(`Hydration not logged on ${pl(hydMiss, 'morning')}`);
      add('wellness', 'Wellness', why); }
    { const why = [], sc = w.filter(e => num(e.screen)).map(e => +e.screen), un = N - sc.length;
      if (sc.length) { why.push(`Average ${f1(avg(sc))}h/day vs ${p.screenFree}h limit`); const ov = sc.filter(h => h > p.screenFree).length; if (ov) why.push(`Over ${p.screenFree}h on ${pl(ov, 'day')}`); }
      if (un) why.push(`Screen time not logged on ${pl(un, 'day')}`);
      add('screen', 'Screen Time', why); }
    { const why = [], no = w.filter(e => e.family === false).length, bl = w.filter(e => e.family !== true && e.family !== false).length;
      if (no) why.push(`No family/friends time on ${pl(no, 'day')} of ${N}`); if (bl) why.push(`Not logged on ${pl(bl, 'day')} (counted as No)`);
      add('family', 'Family/Friends', why); }
    return out; }
  const api = { WELL3_FROM, DEVICES, SLEEP_SCALES, usesWatch, deviceSleepQuality, deviceBand, INJURY, INJ_AREAS, RHR, median, rhrBaseline, rhrScore, W3, wellnessParts, WELL_INV, WELL_SCALE, wellGood, migrateWellScale, PAR, belowPar, NUT_FULL, NUT_ZERO, NUT_HIT, MACRO_W, closeness, nutMode, nutritionDone, nutritionScore, nutritionHit, HYD_FROM, hydrationOK, hydrationRequired, WELL_KEYS, wellnessScore, trainingPct, qualifyingSession, countQualifyingSessions, weeklyTrainingScore, maintenanceTrainingScore, weekSessionCount, entryScorable, hasScorable, sessionsDone, sessionLoad, DEFAULT_PARAMS, sleepScore, screenScore, weightDelta, trendLabel, compute, momentum, isConsistent, MOM, ymd, dayNum, verdict, dataQuality };
  if (typeof module !== 'undefined') module.exports = api; else root.Scoring = api;
})(this);
