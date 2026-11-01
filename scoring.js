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
  // Wellness 0-100 = average of the four ratings mapped 1->0 ... 5->100. null if not all four rated.
  function wellnessScore(e) { if (!e) return null; const v = WELL_KEYS.map(k => e[k]);
    if (!v.every(x => isNum(x) && +x >= 1 && +x <= 5)) return null; return WELL_KEYS.reduce((s,k)=>s+(wellGood(k, e[k])-1)*25,0)/4; }
  // Training 0-100 for one day. v2 entries: % of scheduled sessions completed (rest day = 100). Legacy: Y=100, N/blank=0.
  function trainingPct(e) { if (!e) return 0;
    if (Array.isArray(e.sessions)) { if (!e.sessions.length) return 100; return e.sessions.filter(x => x.done === true).length / e.sessions.length * 100; }
    return e.training === true ? 100 : 0; }
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
    const cats = {
      nutrition: N ? avg(w.map(e => nutritionScore(e) ?? 0)) : 0, training: N ? avg(w.map(trainingPct)) : 0, family: pctY('family'),
      wellness: N ? (avg(w.map(wellnessScore).filter(v => v != null)) || 0) : 0,
      sleep: N ? (avg(w.filter(e => num(e.sleep)).map(e => sleepScore(+e.sleep, p))) || 0) : 0,
      screen: N ? (avg(w.filter(e => num(e.screen)).map(e => screenScore(+e.screen, p))) || 0) : 0,
    };
    const wt = { nutrition:p.wNutrition, training:p.wTraining, sleep:p.wSleep, wellness:p.wWellness||0, screen:p.wScreen, family:p.wFamily };
    let base = 0; for (const k in cats) base += cats[k] * wt[k] / 100;
    const consistency = N ? w.filter(e => nutritionHit(e) && trainingPct(e) === 100).length / N * 100 : 0;
    const bonus = bonusFor(consistency, p);
    const mom = momentum(entries, today, p.startDate, p.fightDate);
    const final = Math.min(100, base + bonus + mom.points);
    const delta = weightDelta(entries, t);
    const weighed = entries.filter(e => num(e.weight) && +e.weight > 0).sort((a,b)=>a.date<b.date?-1:1);
    return { locked, unlockIn, daysSinceStart, score: Math.round(final), base, bonus, consistency, momentum: mom, cats, weights: wt, daysLogged: N, windowDays: p.windowDays,
      delta, trend: trendLabel(delta), verdict: verdict(final), dataQuality: dataQuality(N),
      latestWeight: weighed.length ? weighed[weighed.length-1] : null, windowEntries: w };
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
    { const why = []; let sch = 0, done = 0, legacyMiss = 0; w.forEach(e => { if (Array.isArray(e.sessions)) { sch += e.sessions.length; done += e.sessions.filter(x => x.done === true).length; } else if (e.training !== true) legacyMiss++; });
      const daysShort = w.filter(e => trainingPct(e) < 100).length;
      if (sch > done) why.push(`Missed ${sch - done} of ${pl(sch, 'scheduled session')}`);
      if (legacyMiss) why.push(`Training marked No/blank on ${pl(legacyMiss, 'day')}`);
      if (daysShort) why.push(`${pl(daysShort, 'day')} of ${N} not fully completed`);
      add('training', 'Training', why); }
    { const why = [], sl = w.filter(e => num(e.sleep)).map(e => +e.sleep), un = N - sl.length;
      if (sl.length) { why.push(`Average ${f1(avg(sl))}h vs ${p.idealSleep}h target`); const lo = sl.filter(h => h < p.idealSleep - 1).length, hi = sl.filter(h => h > p.idealSleep + 1).length;
        if (lo) why.push(`Under ${p.idealSleep - 1}h on ${pl(lo, 'night')}`); if (hi) why.push(`Over ${p.idealSleep + 1}h on ${pl(hi, 'night')}`); }
      if (un) why.push(`Sleep not logged on ${pl(un, 'day')}`);
      add('sleep', 'Sleep', why); }
    { const why = [], rated = w.filter(e => wellnessScore(e) != null), names = { energy:['Energy','low energy'], soreness:['Soreness','high soreness'], mood:['Mood','low mood'], stress:['Stress','high stress'] };
      if (rated.length) WELL_KEYS.map(k => { const vs = rated.map(e => +e[k]), inv = WELL_INV.includes(k); return { k, inv, a: avg(vs), g: avg(vs.map(v => wellGood(k, v))), bad: vs.filter(v => wellGood(k, v) <= 2).length }; }).sort((x, y) => x.g - y.g)
        .forEach(x => { if (x.g < 4 || x.bad) why.push(`${names[x.k][0]} avg ${f1(x.a)}/5${x.bad ? ` — ${names[x.k][1]} (${x.inv ? '4–5' : '1–2'}) on ${pl(x.bad, 'day')}` : ''}`); });
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
  const api = { WELL_INV, WELL_SCALE, wellGood, migrateWellScale, PAR, belowPar, NUT_FULL, NUT_ZERO, NUT_HIT, MACRO_W, closeness, nutMode, nutritionDone, nutritionScore, nutritionHit, HYD_FROM, hydrationOK, hydrationRequired, WELL_KEYS, wellnessScore, trainingPct, sessionsDone, sessionLoad, DEFAULT_PARAMS, sleepScore, screenScore, weightDelta, trendLabel, compute, momentum, isConsistent, MOM, ymd, dayNum, verdict, dataQuality };
  if (typeof module !== 'undefined') module.exports = api; else root.Scoring = api;
})(this);
