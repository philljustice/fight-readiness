// Optional insights: streaks, wellness (1-5), session load (sRPE x min), weight-cut safety, CSV export.
// None of these change the core FightReady Score (see scoring.js). Shared by app + node tests.
(function (root) {
  const S = root.Scoring || (typeof require !== 'undefined' ? require('./scoring.js') : null);
  const { dayNum, ymd } = S;
  const num = v => v !== '' && v != null && !isNaN(v);
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
  const CORE = ['nutrition','training','sleep','screen','family'];
  // Hooper-style check-in (sleep quality/duration is logged separately). Keys unchanged for data compatibility; 5 = best.
  const WELL = [['energy','Fatigue / energy','1 = always tired','5 = very fresh'],['soreness','Muscle soreness','1 = no soreness','5 = very sore'],['stress','Stress','1 = very relaxed','5 = very stressed'],['mood','Mood','1 = irritable / down','5 = very positive']];
  // Extra morning items required from S.WELL3_FROM (v2 days): motivation, appetite, and perceived sleep quality unless a watch score is used.
  const FLAG_TXT = { energy:'Low energy / tired', soreness:'High muscle soreness', stress:'High stress', mood:'Low mood', sleepq:'Poor sleep quality', motivation:'Low motivation', appetite:'Low appetite' };
  const WELL3 = [['sleepq','Sleep quality','1 = very poor','5 = excellent'],['motivation','Motivation / readiness to train','1 = none','5 = can\'t wait'],['appetite','Appetite','1 = no appetite','5 = normal / hungry']];
  const ok15 = v => num(v) && +v >= 1 && +v <= 5;
  const well3Missing = e => !e || !(e.v >= 2) || String(e.date || '') < S.WELL3_FROM ? [] : WELL3.filter(([k]) => k === 'sleepq' ? !S.usesWatch(e.sleepDevice) && !ok15(e.sleepq) : !ok15(e[k])).map(([k, l]) => [k, l.split(' / ')[0].toLowerCase()]);
  // What's still missing for a complete day. v2 (current) entries need wellness + every scheduled session answered (with RPE + minutes if done).
  function missing(e) { const m = [];
    if (!S.nutritionDone(e)) m.push('nutrition');
    if (!e || (e.v >= 2 ? !Array.isArray(e.sessions) || e.sessions.some(x => x.done == null) : e.training == null)) m.push('training');
    if (e && e.v >= 2 && Array.isArray(e.sessions) && e.sessions.some(x => x.done === true && !(num(x.rpe) && num(x.mins) && +x.mins > 0))) m.push('session effort + minutes');
    if (!e || !num(e.sleep)) m.push('sleep'); if (!e || !num(e.screen)) m.push('screen time'); if (!e || e.family == null) m.push('family/friends');
    if ((!e || e.v >= 2) && S.wellnessScore(e) == null) m.push('wellness (energy, soreness, mood, stress)');
    else if (e && well3Missing(e).length) m.push('wellness (' + well3Missing(e).map(x => x[1]).join(', ') + ')');
    if (e && S.hydrationRequired(e) && !S.hydrationOK(e)) m.push('hydration (first pee colour)');
    return m; }
  // Log-screen sections. All four true <=> isComplete for current (v2) days.
  function sections(e) { const ms = missing(e);
    return { morning: !ms.includes('sleep') && !ms.some(m => m.startsWith('wellness') || m.startsWith('hydration')), nutrition: !ms.includes('nutrition'),
      training: !ms.includes('training') && !ms.includes('session effort + minutes'), evening: !ms.includes('screen time') && !ms.includes('family/friends') }; }
  // Log menu: which section each checklist item belongs to, and one tile per section (done <=> sections(e)[key]).
  const SECTION_META = [['morning','🌅','Morning check-in','Sleep, hydration, weight & how you feel'],['nutrition','🍽️','Nutrition','Your plan or goal for the day'],['training','🥊','Training','Sessions, effort & minutes'],['evening','🌙','Evening','Screen time, family & notes']];
  const sectionOf = k => /^(sleep|well-|hydration)/.test(k) ? 'morning' : k === 'nutrition' ? 'nutrition' : /^(training|sess)/.test(k) ? 'training' : 'evening';
  function sectionInfo(e) { const items = checklist(e), st = sections(e);
    return SECTION_META.map(([key, icon, title, sub]) => ({ key, icon, title, sub, done: !!st[key], items: items.filter(i => sectionOf(i.key) === key) })); }
  // Same rules as missing(), but one entry per field the fighter must fill, with a key the Log screen maps to an input (tap to jump).
  function checklist(e) { const c = [], v2 = !!e && e.v >= 2, ss = e && Array.isArray(e.sessions) ? e.sessions : [];
    if (!S.nutritionDone(e)) { const m = S.nutMode(e); c.push({ key:'nutrition', label: m === 'kcal' ? 'Nutrition: enter calories eaten today' : m === 'macros' ? 'Nutrition: enter protein, carbs and fat (g)' : 'Nutrition plan: tap Yes or No' }); }
    if (!e || (v2 ? !Array.isArray(e.sessions) : e.training == null)) c.push({ key:'training', label:'Training: tap Yes or No' });
    else if (v2) ss.forEach((x, i) => { if (x.done == null) c.push({ key:'sess-' + i, label:`Session ${i+1}: tap Yes or No` });
      else if (x.done === true && !(num(x.rpe) && num(x.mins) && +x.mins > 0)) c.push({ key:'sessfx-' + i, label:`Session ${i+1}: add effort (RPE) and minutes` }); });
    if (!e || !num(e.sleep)) c.push({ key:'sleep', label:'Sleep: enter hours slept last night' });
    if ((!e || e.v >= 2)) WELL.forEach(([k, l]) => { if (!e || !(num(e[k]) && +e[k] >= 1)) c.push({ key:'well-' + k, label:`How you feel: rate ${l.split(' / ')[0].toLowerCase()} (1–5)` }); });
    well3Missing(e).forEach(([k, l]) => c.push({ key:'well-' + k, label:`How you feel: rate ${l} (1–5)` }));
    if (e && S.hydrationRequired(e) && !S.hydrationOK(e)) c.push({ key:'hydration', label:'Hydration: tap the colour of your first pee this morning' });
    if (!e || !num(e.screen)) c.push({ key:'screen', label:'Screen time: enter hours' });
    if (!e || e.family == null) c.push({ key:'family', label:'Family/friends: tap Yes or No' });
    return c; }
  // The only thing the push server ever learns about a day: is it complete, and how many items are still open.
  // ONE completeness rule for reminders: morning = the Morning check-in tile; evening = Nutrition + Training + Evening tiles.
  const morningDone = e => !!e && sections(e).morning;
  const eveningDone = e => { if (!e) return false; const s = sections(e); return s.nutrition && s.training && s.evening; };
  const morningMissing = e => checklist(e).filter(i => sectionOf(i.key) === 'morning').map(i => i.label);
  const dayStatus = e => ({ complete: isComplete(e), missing: missing(e).length, morning: morningDone(e) });
  // Legacy (pre-v2) days with the old 5 items stay complete.
  const isComplete = e => !!e && !missing(e).length;
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
  const dayWellness = e => { const v = WELL.filter(([k]) => e && num(e[k]) && e[k] >= 1 && e[k] <= 5).map(([k]) => S.wellGood(k, e[k])); return v.length ? avg(v) : null; };
  const sessionLoad = S.sessionLoad;
  const inRange = (entries, t, from, to) => entries.filter(e => { const n = dayNum(e.date); return n >= t - from && n <= t - to; });
  function wellness(entries, today = new Date()) {
    const t = dayNum(ymd(today)), last7 = inRange(entries, t, 6, 0), base = inRange(entries, t, 27, 0);
    const a7 = avg(last7.map(dayWellness).filter(v => v != null)), a28 = avg(base.map(dayWellness).filter(v => v != null));
    const items = {}; WELL.forEach(([k]) => items[k] = avg(last7.map(e => e[k]).filter(v => num(v) && v >= 1)));
    const flags = []; inRange(entries, t, 2, 0).forEach(e => { WELL.forEach(([k,l]) => { if (num(e[k]) && +e[k] >= 1 && S.wellGood(k, e[k]) <= 2) flags.push({ date:e.date, item:l, value:+e[k], text:FLAG_TXT[k] + ' (' + e[k] + '/5)' }); });
      WELL3.forEach(([k, l]) => { if (k === 'sleepq' && S.usesWatch(e.sleepDevice) && num(e.sleepDev)) { const q = S.deviceSleepQuality(e.sleepDevice, e.sleepDev); if (q < 50) flags.push({ date:e.date, item:'Sleep score', value:+e.sleepDev, text:`Poor ${e.sleepDevice} sleep score ${e.sleepDev} (${S.deviceBand(e.sleepDevice, e.sleepDev)})` }); }
        else if (ok15(e[k]) && +e[k] <= 2) flags.push({ date:e.date, item:l.split(' / ')[0], value:+e[k], text:FLAG_TXT[k] + ' (' + e[k] + '/5)' }); });
      if (e.injury === 'limiting') flags.push({ date:e.date, item:'Injury', value:'limiting', text:`Limiting injury${e.injuryArea ? ' (' + e.injuryArea + ')' : ''}` });
      if (e.ill === true) flags.push({ date:e.date, item:'Illness', value:'yes', text:'Feeling ill' });
      { const b = S.rhrBaseline(entries, e.date); if (b != null && num(e.rhr) && +e.rhr - b >= S.RHR.SPIKE) flags.push({ date:e.date, item:'Resting HR', value:+e.rhr, text:`Resting HR ${e.rhr} bpm (+${Math.round(+e.rhr - b)} vs baseline ${Math.round(b)})` }); } });
    const n7 = last7.filter(e => dayWellness(e) != null).length;
    return { avg7: a7, avg28: a28, items, flags, days: n7, dropping: a7 != null && a28 != null && n7 >= 3 && a7 <= a28 - 0.5 };
  }
  // Weekly load (sum of sRPE x minutes) and acute:chronic ratio (7-day avg / 28-day avg). Ratio only after 28 days of data.
  function load(entries, today = new Date()) {
    const t = dayNum(ymd(today)), L = es => es.map(sessionLoad).filter(v => v != null);
    const w = L(inRange(entries, t, 6, 0)), m = L(inRange(entries, t, 27, 0)), nSess = inRange(entries, t, 6, 0).reduce((s,e)=>s+S.sessionsDone(e).length,0);
    const week = w.reduce((s,v)=>s+v,0), month = m.reduce((s,v)=>s+v,0);
    const firstLoad = entries.filter(e => sessionLoad(e) != null).map(e => dayNum(e.date)).sort((a,b)=>a-b)[0];
    const enough = firstLoad != null && t - firstLoad >= 27 && month > 0;
    const acwr = enough ? Math.round((week/7)/(month/28)*100)/100 : null;
    const weeks = []; for (let i = 3; i >= 0; i--) weeks.push(L(inRange(entries, t, i*7+6, i*7)).reduce((s,v)=>s+v,0));
    return { week, sessions: nSess, days: w.length, acwr, weeks, flag: acwr == null ? null : acwr > 1.5 ? 'spike' : acwr < 0.8 ? 'low' : 'ok' };
  }

  // Overtraining risk: training-load context + persistent recovery warning signs vs the athlete's own baseline.
  // Load context: ACWR >1.3 (elevated) / >1.5 (high); before 28 days, week-over-week jump >=30% / >=50% or 7-day load >=40% above
  // the running weekly average; or Foster monotony (7-day mean / SD of daily load) >2.0 with high strain (load x monotony).
  // Signs count only if present on 2+ of the last 5 days. Illness during/right after a high-load stretch is a trigger on its own.
  const OT = { WIN:5, PERSIST:2, MIN_DAYS:7, ILL_LOOKBACK:10, ILL_RECENT:3, MONO:2.0, STRAIN:6000 };
  function loadContext(entries, tt) {
    const byN = {}; entries.forEach(e => { const n = dayNum(e.date); if (n <= tt) byN[n] = (byN[n] || 0) + (sessionLoad(e) || 0); });
    const ns = Object.keys(byN).map(Number); if (!ns.length) return { level:null, reasons:[] };
    const first = Math.min(...ns), sum = (a, b) => { let s = 0; for (let n = a; n <= b; n++) s += byN[n] || 0; return s; };
    const wk = sum(tt-6, tt), prev = sum(tt-13, tt-7), span = tt - first + 1, reasons = []; let lvl = 0;
    const L = load(entries, (u => new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 12))(new Date(tt * 864e5))), acwr = span >= 28 ? L.acwr : null;
    if (acwr != null) { if (acwr > 1.5) { lvl = 2; reasons.push(`training load spiked (acute:chronic ${acwr})`); } else if (acwr > 1.3) { lvl = 1; reasons.push(`training load up (acute:chronic ${acwr})`); } }
    else if (span >= 10) { const pct = prev > 0 ? Math.round((wk - prev) / prev * 100) : null, past = span - 7, run = past > 0 ? sum(first, tt-7) / past * 7 : 0;
      if (pct != null && pct >= 50) { lvl = 2; reasons.push(`training load up ${pct}% on last week`); } else if (pct != null && pct >= 30) { lvl = 1; reasons.push(`training load up ${pct}% on last week`); }
      if (!lvl && run > 0 && wk >= 1.4 * run) { lvl = 1; reasons.push(`7-day load ${Math.round((wk / run - 1) * 100)}% above your average`); } }
    const d = []; for (let n = tt-6; n <= tt; n++) d.push(byN[n] || 0); const mean = wk / 7, sd = Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / 7);
    const mono = mean > 0 ? (sd > 0 ? mean / sd : 99) : 0, strain = Math.round(wk * Math.min(mono, 10));
    if (span >= 7 && mono > OT.MONO && strain >= OT.STRAIN) { lvl = Math.max(lvl, 1); reasons.push(`same hard load every day with no easy days (monotony ${mono >= 99 ? '>10' : mono.toFixed(1)})`); }
    return { level: lvl === 2 ? 'high' : lvl === 1 ? 'elevated' : null, acwr, week: wk, prevWeek: prev, monotony: mono >= 99 ? null : Math.round(mono * 10) / 10, strain, reasons };
  }
  function overtraining(entries, today = new Date()) {
    const t = dayNum(ymd(today)), es = entries.filter(e => dayNum(e.date) <= t), days = es.length, out = { level:null, reasons:[], signs:[], actions:[], load:null, ill:false };
    if (!days) return out;
    const lc = loadContext(entries, t); out.load = lc;
    const win = inRange(entries, t, OT.WIN - 1, 0), base = inRange(entries, t, 35, 7), mean = a => avg(a.filter(v => v != null));
    const g15 = (e, k) => k === 'energy' || k === 'soreness' || k === 'stress' || k === 'mood' ? (ok15(e[k]) ? S.wellGood(k, e[k]) : null) : (ok15(e[k]) ? +e[k] : null);
    const SIGNS = [['soreness','muscle soreness high'],['energy','energy low / always tired'],['motivation','motivation low'],['mood','mood down'],['stress','stress high'],['appetite','appetite low'],['sleepq','sleep quality poor']];
    SIGNS.forEach(([k, label]) => { const b = mean(base.map(e => g15(e, k)));
      const bad = win.filter(e => { if (k === 'sleepq' && S.usesWatch(e.sleepDevice)) return false; const g = g15(e, k); return g != null && (g <= 2 || (b != null && g <= 3 && g <= b - 1.5)); }).length;
      if (bad >= OT.PERSIST) out.signs.push({ key:k, text:`${label} (${bad} of last ${OT.WIN} days)` }); });
    { const q = e => S.usesWatch(e.sleepDevice) && num(e.sleepDev) ? S.deviceSleepQuality(e.sleepDevice, e.sleepDev) : null, b = mean(base.map(q));
      const bad = win.filter(e => { const v = q(e); return v != null && (v < 50 || (b != null && v <= b - 20)); }).length;
      if (bad >= OT.PERSIST) out.signs.push({ key:'sleepDev', text:`watch sleep score down (${bad} of last ${OT.WIN} days)` }); }
    { const bad = win.filter(e => { const b = S.rhrBaseline(entries, e.date); return b != null && num(e.rhr) && +e.rhr - b >= S.RHR.SPIKE; });
      if (bad.length >= OT.PERSIST) out.signs.push({ key:'rhr', text:`resting HR up ${Math.round(+bad[bad.length-1].rhr - S.rhrBaseline(entries, bad[bad.length-1].date))}+ bpm on ${bad.length} of last ${OT.WIN} days` }); }
    { const inj = win.filter(e => e.injury === 'minor' || e.injury === 'limiting');
      if (inj.length >= OT.PERSIST || win.some(e => e.injury === 'limiting')) out.signs.push({ key:'injury', text:`niggles / injury logged (${inj.length} of last ${OT.WIN} days)` }); }
    // illness in the last 3 days, during or right after high load in the last ~10 days (hard days if there isn't enough history)
    const ill = inRange(entries, t, OT.ILL_RECENT - 1, 0).some(e => e.ill === true); out.ill = ill;
    let hiLoad = false; if (ill) { for (let n = t; n >= t - OT.ILL_LOOKBACK && !hiLoad; n--) if (loadContext(entries, n).level) hiLoad = true;
      if (!hiLoad) { const hard = inRange(entries, t, OT.ILL_LOOKBACK, 0).filter(e => S.sessionsDone(e).some(x => +x.rpe >= 8)).length; if (hard >= 3) hiLoad = true; } }
    const loadHigh = !!lc.level, n = out.signs.length, rhr = out.signs.some(x => x.key === 'rhr');
    if (ill && hiLoad) out.level = 'high';
    else if (days >= OT.MIN_DAYS) { if ((loadHigh && n >= 2) || (rhr && loadHigh)) out.level = 'high'; else if ((loadHigh && n >= 1) || n >= 2) out.level = 'watch'; }
    if (!out.level) return out;
    if (ill && hiLoad) out.reasons.push('feeling ill during / right after a hard training stretch, which often means the body is run down');
    if (loadHigh) out.reasons.push(...lc.reasons); out.reasons.push(...out.signs.map(x => x.text));
    out.actions = out.level === 'high'
      ? [ill ? 'Rest or very light work until the illness clears' : 'Back right off intensity for a few days (light technique, no hard sparring)', 'Extra recovery: sleep 9+ h, eat enough, hydrate', 'Talk to your coach today']
      : ['Ease intensity or add an easy / rest day', 'Prioritise sleep and food', 'Keep an eye on it and tell your coach if it continues'];
    out.label = out.level === 'high' ? 'High risk' : 'Watch'; out.summary = `Overtraining risk: ${out.label} (${out.reasons.slice(0,3).join('; ')})`;
    return out;
  }
  // Weight-cut safety. ISSN (2025) combat-sports position stand: aim ~0.5-1 kg/week of gradual loss.
  // We flag loss faster than 1%/week as caution and >1.5%/week as warning.
  function cutSafety(entries, today = new Date(), profile = {}) {
    const t = dayNum(ymd(today)), ws = entries.filter(e => num(e.weight) && +e.weight > 0);
    const last = avg(inRange(ws, t, 7, 0).map(e => +e.weight)), prev = avg(ws.filter(e => { const n = dayNum(e.date); return n >= t-14 && n < t-7; }).map(e => +e.weight));
    const out = { pctPerWeek: null, level: null, msg: null, pace: null };
    if (last && prev) { const pct = Math.round((last - prev) / prev * 1000) / 10; out.pctPerWeek = pct;
      if (pct < -1.5) { out.level = 'warn'; out.msg = `Losing fast (${-pct}% this week). Eat enough carbs and protein so you keep your strength. The water part comes in fight week, not now.`; }
      else if (pct < -1) { out.level = 'caution'; out.msg = `Losing ${-pct}% this week, the top of the steady range. Keep an eye on energy, sleep and soreness.`; } }
    const cur = ws.sort((a,b)=>a.date<b.date?-1:1).slice(-1)[0], tgt = +profile.targetWeight;
    if (cur && tgt > 0 && profile.fightDate) { const days = dayNum(profile.fightDate) - t, toGo = +cur.weight - tgt;
      if (days > 0 && toGo > 0) { const perWk = toGo / (days/7), pct = perWk / +cur.weight * 100;
        out.pace = { perWeek: Math.round(perWk*10)/10, pct: Math.round(pct*10)/10, level: pct > 1.5 ? 'warn' : pct > 1 ? 'caution' : 'ok' }; } }
    return out;
  }
  // Impossible-cut check. Safe pace = 1%/week of current weight (caution above 1%, warning above 1.5%).
  function cutPlan(current, target, fightDate, today = new Date()) {
    current = +current; target = +target; if (!(current > 0) || !(target > 0) || !fightDate) return null;
    const days = dayNum(fightDate) - dayNum(ymd(today)); if (days < 0) return null;
    const toGo = Math.round((current - target)*10)/10, r1 = v => Math.round(v*10)/10;
    if (toGo <= 0) return { level:'ok', toGo, perWeek:0, pct:0, days, msg:`At or under target (${target} lbs).` };
    const weeks = Math.max(days, 1) / 7, perWeek = toGo / weeks, pct = perWeek / current * 100;
    let safe = current; for (let i = 0; i < Math.floor(weeks); i++) safe *= 0.99; safe -= safe * 0.01 * (weeks - Math.floor(weeks));
    const reach = r1(Math.max(safe, target)), short = r1(Math.max(0, reach - target));
    const level = pct > 1.5 ? 'warn' : pct > 1 ? 'caution' : 'ok';
    const msg = level === 'ok' ? `Needs ${r1(perWeek)} lbs/week (${r1(pct)}%/week). That's within the safe range.` :
      `You'd need ${r1(perWeek)} lbs/week (${r1(pct)}% of bodyweight). A safe pace (~1%/week) reaches about ${reach} lbs by fight day, ${short} lbs short of ${target}. ` +
      (level === 'warn' ? 'This plan is not safe. Talk to your coach about a higher weight class or a later fight date.' : 'This is at the edge of safe. Consider a higher weight class or a later date, and watch energy and soreness.');
    return { level, toGo, perWeek:r1(perWeek), pct:r1(pct), days, reach, short, msg };
  }
  // One-line daily weight verdict: On track / Too fast / Too slow / No target
  function weightVerdict(entries, profile = {}, today = new Date()) {
    const tgt = +profile.targetWeight; if (!(tgt > 0)) return { word:'No target', color:'grey', text:'Set a target weight in your profile.' };
    const ws = entries.filter(e => num(e.weight) && +e.weight > 0).sort((a,b)=>a.date<b.date?-1:1), cur = ws.length ? +ws[ws.length-1].weight : null;
    if (cur == null) return { word:'No data', color:'grey', text:'Log a weigh-in.' };
    const c = cutSafety(entries, today, profile), plan = cutPlan(cur, tgt, profile.fightDate, today), lossPct = c.pctPerWeek == null ? null : -c.pctPerWeek;
    if (lossPct != null && lossPct > 1.5) return { word:'Too fast', color:'red', text:`Losing ${lossPct}%/week. Eat enough carbs and protein to keep your strength; any water cut belongs in fight week (opt-in), not now.` };
    if (cur <= tgt) return { word:'On track', color:'green', text:`At or under target (${tgt} lbs). Hold steady.` };
    if (lossPct == null) return { word:'On track?', color:'grey', text:`${Math.round((cur-tgt)*10)/10} lbs to go. Need 2 weeks of weigh-ins to judge pace.` };
    const need = plan ? Math.min(plan.pct, 1) : 0.5; // required pace, capped at the safe 1%/week
    if (lossPct + 0.15 < need * 0.8) return { word:'Too slow', color:'orange', text:`Losing ${Math.max(lossPct,0)}%/week; you need about ${Math.round(need*10)/10}%/week${plan?' to make '+tgt+' safely':''}.` };
    return { word:'On track', color:'green', text:`Losing ${lossPct}%/week${plan?`, need ${plan.pct}%/week`:''}.` };
  }
  // LEGACY (not shown since fr-v50): conservative food-only fight-week table kept for tests/back-compat. Live fight-week steps: weightplan.js (water steps opt-in, never for under-18s).
  const FW = [
    [7,'Train normally but start the taper: keep intensity, cut volume ~20–30%.','Drink normally (pale-yellow urine).','Normal salt.','Normal carbs (not below ~3 g/kg/day), protein 1.2–2 g/kg.'],
    [6,'Technical work + short hard rounds; no new skills.','Drink normally.','Normal salt.','Normal carbs; keep protein high.'],
    [5,'Volume down ~40%. Last moderate sparring at most, light contact.','Drink normally.','Normal salt; skip very salty fast food.','Normal carbs; start choosing lower-fibre foods if your coach/dietitian plans it.'],
    [4,'Light technical session, pads, mobility.','Drink normally. Any water-loading only if your coach/dietitian runs it.','Moderate salt; any sodium change only if supervised.','Carbs can come down a little if planned, but do not crash them; keep lower fibre.'],
    [3,'Light drilling + shadowboxing, 30–45 min.','Keep drinking. No fluid restriction on your own.','Moderate salt.','Smaller, low-fibre meals; keep eating.'],
    [2,'Very light: shadowboxing, stretching, rest.','Keep drinking unless your coach/dietitian has a supervised plan.','Normal to low salt if planned.','Small low-fibre meals. Weigh yourself morning + night.'],
    [1,'Rest, walk, visualize. Check weight with your coach.','Sip to thirst. No saunas, sweat suits or spitting on your own.','—','Light, familiar, low-fibre food.'],
    [0,'Weigh-in day. After weigh-in: rehydrate and refuel.','After weigh-in: oral rehydration ~1–1.5 L/hour with electrolytes.','Electrolyte drink after weigh-in.','After weigh-in: fast carbs up to ~60 g/hour, low fibre, familiar food.']];
  function fightWeek(fightDate, today = new Date(), weighInDate = null) {
    if (!fightDate) return null; const wi = weighInDate || fightDate, d = dayNum(wi) - dayNum(ymd(today)); if (d < 0 || d > 7) return null;
    return { daysToWeighIn: d, days: FW.map(([n, train, water, salt, carbs]) => { const x = new Date(wi+'T12:00'); x.setDate(x.getDate()-n);
      return { offset:-n, date:ymd(x), today: n === d, train, water, salt, carbs }; }) };
  }
  // Rule-based weekly review: what went well / what was missed / focus for next week
  function weekReview(entries, today = new Date(), params = {}, profile = {}) {
    const t = dayNum(ymd(today)), wk = inRange(entries, t, 6, 0), r = S.compute(wk, today, Object.assign({}, params, { windowDays:6, startDate:null }));
    const NAMES = { nutrition:'Nutrition', training:'Training', sleep:'Sleep', wellness:'Wellness', screen:'Screen time', family:'Family/friends' };
    const out = { well:[], missed:[], focus:[] };
    if (!wk.length) { out.missed.push('No days logged this week'); out.focus.push('Log every day: it takes about 30 seconds'); return out; }
    const cats = Object.keys(NAMES).filter(k => r.cats[k] != null).map(k => [k, Math.round(r.cats[k])]).sort((a,b)=>b[1]-a[1]);
    const best = cats.filter(c => c[1] >= 80).slice(0,2), worst = cats.slice().reverse().filter(c => c[1] < 70).slice(0,2);
    best.forEach(([k,v]) => out.well.push(`${NAMES[k]} ${v}/100`));
    const full = wk.filter(isComplete).length; if (full >= 6) out.well.push(`${full}/7 days fully logged`); else out.missed.push(`Only ${full}/7 days fully logged`);
    let sch = 0, done = 0; const miss = [];
    wk.forEach(e => { if (Array.isArray(e.sessions)) e.sessions.forEach((x,i) => { sch++; if (x.done === true) done++; else miss.push(e.date.slice(5)+' '+(x.label||'session '+(i+1))); }); else if (e.training != null) { sch++; if (e.training) done++; else miss.push(e.date.slice(5)); } });
    if (sch && done === sch) out.well.push(`All ${sch} scheduled sessions done`); else if (sch) out.missed.push(`${sch-done} of ${sch} sessions missed${miss.length?' ('+miss.slice(0,4).join(', ')+')':''}`);
    worst.forEach(([k,v]) => out.missed.push(`${NAMES[k]} only ${v}/100`));
    const w = wellness(entries, today); if (w.flags.length) out.missed.push(`🚩 Wellness flags: ${w.flags.slice(0,3).map(f=>f.text||(f.item+' '+f.value)).join(', ')}`);
    const v = weightVerdict(entries, profile, today); if (v.word === 'On track') out.well.push('Weight on track'); else if (v.word === 'Too fast' || v.word === 'Too slow') out.missed.push(`Weight ${v.word.toLowerCase()}`);
    const tips = { nutrition:'Hit your nutrition plan or goal every day: prep meals ahead', training:'Make every scheduled session, or tell your coach early', sleep:`Aim for ${params.idealSleep||8}h of sleep: same bedtime nightly`, wellness:'Recovery: sleep, food and easier sessions; tell your coach how you feel', screen:'Cut recreational screens to 2h or less, especially before bed', family:'Plan real time with family or friends' };
    worst.forEach(([k]) => out.focus.push(tips[k]));
    if (v.word === 'Too fast') out.focus.push('Slow the cut to about 1%/week: eat enough carbs and protein');
    if (v.word === 'Too slow') out.focus.push('Tighten nutrition to get to about 0.5–1%/week loss');
    if (w.flags.length && !worst.some(c=>c[0]==='wellness')) out.focus.push('Talk to your coach about the wellness flags');
    if (!out.focus.length) out.focus.push('Keep the same habits: consistency wins camps');
    if (!out.well.length) out.well.push('You showed up and logged: build from here');
    return out;
  }
  const reviewText = rv => `What went well: ${rv.well.join('; ')}\nWhat was missed: ${rv.missed.length?rv.missed.join('; '):'nothing major'}\nFocus next week: ${rv.focus.join('; ')}`;
  // ---- Hydration (first-pee colour chart). 8 swatches, pale straw -> dark amber/brown. Info only, never changes the score. ----
  const HYD_COLORS = ['#fbf6d3','#f7eca0','#f3de6a','#eec94a','#e3a92d','#cc8420','#a9611a','#7e4214'];
  const HYD_TIPS = { ok:'Nice work. Keep sipping water through the day, especially around training.',
    warn:'A bit low. Drink 2 glasses of water now and keep water with you today, more around training.',
    bad:'Drink water steadily over the next hour (not all at once), add electrolytes if you train hard, and tell your coach if it stays dark.' };
  function hydrationStatus(v) { if (v === '' || v == null) return null; v = +v; if (!Number.isInteger(v) || v < 1 || v > 8) return null;
    const level = v <= 3 ? 'ok' : v <= 5 ? 'warn' : 'bad';
    return { level, value:v, color:HYD_COLORS[v-1], emoji: level === 'ok' ? '🟢' : level === 'warn' ? '🟡' : '🔴', label: level === 'ok' ? 'Hydrated' : level === 'warn' ? 'Drink more' : 'Dehydrated', tip:HYD_TIPS[level] }; }
  // Last n mornings (oldest first), one cell per day; v = null when not logged.
  function hydrationWeek(entries, today = new Date(), n = 7) {
    const by = {}; entries.forEach(e => { by[e.date] = e; }); const days = [];
    for (let i = n - 1; i >= 0; i--) { const x = new Date(today); x.setDate(x.getDate() - i); const d = ymd(x), e = by[d], v = e && S.hydrationOK(e) ? +e.hydration : null;
      days.push({ date:d, v, status: v == null ? null : hydrationStatus(v) }); }
    const got = days.filter(x => x.v != null);
    return { days, logged:got.length, dehydrated:got.filter(x => x.v >= 6).length, low:got.filter(x => x.v >= 4).length, latest: got.length ? got[got.length-1] : null };
  }
  // Flags: 2+ dehydrated mornings in the last 7 days. Fight-week hydration alerts live in WeightPlan.hydAlert (opt-in aware).
  function hydrationFlags(entries, today = new Date(), profile = {}, fightWeekOn = null) {
    const h = hydrationWeek(entries, today), out = [];
    if (h.dehydrated >= 2) out.push(`Dehydrated ${h.dehydrated} of the last 7 mornings (dark first pee). Drink more through the day and tell your coach.`);
    const fw = fightWeekOn != null ? fightWeekOn : !!fightWeek(profile.fightDate, today);
    return out; }
  const csvCell = v => { const s = v == null ? '' : v === true ? 'Y' : v === false ? 'N' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const CSV_COLS = ['Date','Nutrition','Training','Sleep_Hours','Screen_Hours','Family_Friends','Weight','Notes','Energy','Soreness','Mood','Stress','Wellness_Score','Sessions_Scheduled','Sessions_Done','Training_Pct','S1_Label','S1_Done','S1_RPE','S1_Min','S2_Label','S2_Done','S2_RPE','S2_Min','Extra_Label','Extra_RPE','Extra_Min','Session_Load','Complete','Hydration_Colour','Hydration_Status','Nutrition_Mode','Calories','Protein_g','Carbs_g','Fat_g','Nutrition_Score','Wellness_Scale','Sleep_Quality','Sleep_Device','Device_Sleep_Score','Motivation','Appetite','Injury','Injury_Area','Ill','Resting_HR'];
  function toCSV(entries) {
    const sess = e => Array.isArray(e.sessions) ? e.sessions : (e.training != null || num(e.rpe) ? [{ label:'', done:e.training, rpe:e.rpe, mins:e.mins }] : []);
    const rows = entries.slice().sort((a,b)=>a.date<b.date?-1:1).map(e => { const ss = sess(e), x = e.extra || {}, sc = i => ss[i] ? [ss[i].label, ss[i].done, ss[i].rpe, ss[i].mins] : ['','','',''];
      const ws = S.wellnessScore(e);
      return [e.date,e.nutrition,S.trainingPct(e)===100,e.sleep,e.screen,e.family,e.weight,e.notes,e.energy,e.soreness,e.mood,e.stress,ws==null?'':ws,Array.isArray(e.sessions)?ss.length:'',ss.filter(s=>s.done===true).length,Math.round(S.trainingPct(e)),...sc(0),...sc(1),x.label,x.rpe,x.mins,sessionLoad(e),isComplete(e)?'Y':'N',S.hydrationOK(e)?+e.hydration:'',S.hydrationOK(e)?hydrationStatus(e.hydration).label:'',S.nutMode(e),e.kcal??'',e.protein??'',e.carbs??'',e.fat??'',S.nutritionScore(e)==null?'':Math.round(S.nutritionScore(e)),S.WELL_SCALE,e.sleepq??'',e.sleepDevice??'',e.sleepDev??'',e.motivation??'',e.appetite??'',e.injury??'',e.injuryArea??'',e.ill==null?'':e.ill,e.rhr??''].map(csvCell).join(','); });
    return [CSV_COLS.join(',')].concat(rows).join('\r\n') + '\r\n';
  }
  const api = { morningDone, eveningDone, morningMissing, WELL3, well3Missing, HYD_COLORS, hydrationStatus, hydrationWeek, hydrationFlags, sectionInfo, sectionOf, SECTION_META, checklist, dayStatus, sections, cutPlan, weightVerdict, fightWeek, weekReview, reviewText, WELL, missing, isComplete, isPartial, streak, grid, dayWellness, sessionLoad, wellness, load, cutSafety, overtraining, loadContext, OT, toCSV, CSV_COLS };
  if (typeof module !== 'undefined') module.exports = api; else root.Insights = api;
})(this);
