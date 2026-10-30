// Optional insights: streaks, wellness (1-5), session load (sRPE x min), weight-cut safety, CSV export.
// None of these change the core FightReady Score (see scoring.js). Shared by app + node tests.
(function (root) {
  const S = root.Scoring || (typeof require !== 'undefined' ? require('./scoring.js') : null);
  const { dayNum, ymd } = S;
  const num = v => v !== '' && v != null && !isNaN(v);
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
  const CORE = ['nutrition','training','sleep','screen','family'];
  // Hooper-style check-in (sleep quality/duration is logged separately). Keys unchanged for data compatibility; 5 = best.
  const WELL = [['energy','Fatigue / energy','1 = always tired','5 = very fresh'],['soreness','Muscle soreness','1 = very sore','5 = no soreness'],['stress','Stress','1 = very stressed','5 = very relaxed'],['mood','Mood','1 = irritable / down','5 = very positive']];
  // What's still missing for a complete day. v2 (current) entries need wellness + every scheduled session answered (with RPE + minutes if done).
  function missing(e) { const m = [];
    if (!S.nutritionDone(e)) m.push('nutrition');
    if (!e || (e.v >= 2 ? !Array.isArray(e.sessions) || e.sessions.some(x => x.done == null) : e.training == null)) m.push('training');
    if (e && e.v >= 2 && Array.isArray(e.sessions) && e.sessions.some(x => x.done === true && !(num(x.rpe) && num(x.mins) && +x.mins > 0))) m.push('session effort + minutes');
    if (!e || !num(e.sleep)) m.push('sleep'); if (!e || !num(e.screen)) m.push('screen time'); if (!e || e.family == null) m.push('family/friends');
    if ((!e || e.v >= 2) && S.wellnessScore(e) == null) m.push('wellness (energy, soreness, mood, stress)');
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
    if (e && S.hydrationRequired(e) && !S.hydrationOK(e)) c.push({ key:'hydration', label:'Hydration: tap the colour of your first pee this morning' });
    if (!e || !num(e.screen)) c.push({ key:'screen', label:'Screen time: enter hours' });
    if (!e || e.family == null) c.push({ key:'family', label:'Family/friends: tap Yes or No' });
    return c; }
  // The only thing the push server ever learns about a day: is it complete, and how many items are still open.
  const dayStatus = e => ({ complete: isComplete(e), missing: missing(e).length });
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
  const dayWellness = e => { const v = WELL.map(w => e && e[w[0]]).filter(x => num(x) && x >= 1 && x <= 5).map(Number); return v.length ? avg(v) : null; };
  const sessionLoad = S.sessionLoad;
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
    const w = L(inRange(entries, t, 6, 0)), m = L(inRange(entries, t, 27, 0)), nSess = inRange(entries, t, 6, 0).reduce((s,e)=>s+S.sessionsDone(e).length,0);
    const week = w.reduce((s,v)=>s+v,0), month = m.reduce((s,v)=>s+v,0);
    const firstLoad = entries.filter(e => sessionLoad(e) != null).map(e => dayNum(e.date)).sort((a,b)=>a-b)[0];
    const enough = firstLoad != null && t - firstLoad >= 27 && month > 0;
    const acwr = enough ? Math.round((week/7)/(month/28)*100)/100 : null;
    const weeks = []; for (let i = 3; i >= 0; i--) weeks.push(L(inRange(entries, t, i*7+6, i*7)).reduce((s,v)=>s+v,0));
    return { week, sessions: nSess, days: w.length, acwr, weeks, flag: acwr == null ? null : acwr > 1.5 ? 'spike' : acwr < 0.8 ? 'low' : 'ok' };
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
    if (lossPct != null && lossPct > 1.5) return { word:'Too fast', color:'red', text:`Losing ${lossPct}%/week. Slow down: eat enough and do not dehydrate.` };
    if (cur <= tgt) return { word:'On track', color:'green', text:`At or under target (${tgt} lbs). Hold steady.` };
    if (lossPct == null) return { word:'On track?', color:'grey', text:`${Math.round((cur-tgt)*10)/10} lbs to go. Need 2 weeks of weigh-ins to judge pace.` };
    const need = plan ? Math.min(plan.pct, 1) : 0.5; // required pace, capped at the safe 1%/week
    if (lossPct + 0.15 < need * 0.8) return { word:'Too slow', color:'orange', text:`Losing ${Math.max(lossPct,0)}%/week; you need about ${Math.round(need*10)/10}%/week${plan?' to make '+tgt+' safely':''}.` };
    return { word:'On track', color:'green', text:`Losing ${lossPct}%/week${plan?`, need ${plan.pct}%/week`:''}.` };
  }
  // Fight-week plan: general, conservative guidance (ISSN 2025 position stand). No dehydration protocol.
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
    const w = wellness(entries, today); if (w.flags.length) out.missed.push(`🚩 Low ratings: ${w.flags.slice(0,3).map(f=>f.item+' '+f.value).join(', ')}`);
    const v = weightVerdict(entries, profile, today); if (v.word === 'On track') out.well.push('Weight on track'); else if (v.word === 'Too fast' || v.word === 'Too slow') out.missed.push(`Weight ${v.word.toLowerCase()}`);
    const tips = { nutrition:'Hit your nutrition plan or goal every day: prep meals ahead', training:'Make every scheduled session, or tell your coach early', sleep:`Aim for ${params.idealSleep||8}h of sleep: same bedtime nightly`, wellness:'Recovery: sleep, food and easier sessions; tell your coach how you feel', screen:'Cut recreational screens to 2h or less, especially before bed', family:'Plan real time with family or friends' };
    worst.forEach(([k]) => out.focus.push(tips[k]));
    if (v.word === 'Too fast') out.focus.push('Slow the cut to about 1%/week: eat enough carbs and protein');
    if (v.word === 'Too slow') out.focus.push('Tighten nutrition to get to about 0.5–1%/week loss');
    if (w.flags.length && !worst.some(c=>c[0]==='wellness')) out.focus.push('Talk to your coach about the low wellness ratings');
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
  // Flags: 2+ dehydrated mornings in the last 7 days; gentle fight-week note (no water-cut, minors never dehydrate).
  function hydrationFlags(entries, today = new Date(), profile = {}, fightWeekOn = null) {
    const h = hydrationWeek(entries, today), out = [];
    if (h.dehydrated >= 2) out.push(`Dehydrated ${h.dehydrated} of the last 7 mornings (dark first pee). Drink more through the day and tell your coach.`);
    const fw = fightWeekOn != null ? fightWeekOn : !!fightWeek(profile.fightDate, today);
    if (fw && h.latest && h.latest.v >= 4) out.push('Fight week: do not water-cut or restrict fluids to make weight. Minors (under 18) should never dehydrate. Follow your coach and dietitian.');
    return out; }
  const csvCell = v => { const s = v == null ? '' : v === true ? 'Y' : v === false ? 'N' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const CSV_COLS = ['Date','Nutrition','Training','Sleep_Hours','Screen_Hours','Family_Friends','Weight','Notes','Energy','Soreness','Mood','Stress','Wellness_Score','Sessions_Scheduled','Sessions_Done','Training_Pct','S1_Label','S1_Done','S1_RPE','S1_Min','S2_Label','S2_Done','S2_RPE','S2_Min','Extra_Label','Extra_RPE','Extra_Min','Session_Load','Complete','Hydration_Colour','Hydration_Status','Nutrition_Mode','Calories','Protein_g','Carbs_g','Fat_g','Nutrition_Score'];
  function toCSV(entries) {
    const sess = e => Array.isArray(e.sessions) ? e.sessions : (e.training != null || num(e.rpe) ? [{ label:'', done:e.training, rpe:e.rpe, mins:e.mins }] : []);
    const rows = entries.slice().sort((a,b)=>a.date<b.date?-1:1).map(e => { const ss = sess(e), x = e.extra || {}, sc = i => ss[i] ? [ss[i].label, ss[i].done, ss[i].rpe, ss[i].mins] : ['','','',''];
      const ws = S.wellnessScore(e);
      return [e.date,e.nutrition,S.trainingPct(e)===100,e.sleep,e.screen,e.family,e.weight,e.notes,e.energy,e.soreness,e.mood,e.stress,ws==null?'':ws,Array.isArray(e.sessions)?ss.length:'',ss.filter(s=>s.done===true).length,Math.round(S.trainingPct(e)),...sc(0),...sc(1),x.label,x.rpe,x.mins,sessionLoad(e),isComplete(e)?'Y':'N',S.hydrationOK(e)?+e.hydration:'',S.hydrationOK(e)?hydrationStatus(e.hydration).label:'',S.nutMode(e),e.kcal??'',e.protein??'',e.carbs??'',e.fat??'',S.nutritionScore(e)==null?'':Math.round(S.nutritionScore(e))].map(csvCell).join(','); });
    return [CSV_COLS.join(',')].concat(rows).join('\r\n') + '\r\n';
  }
  const api = { HYD_COLORS, hydrationStatus, hydrationWeek, hydrationFlags, sectionInfo, sectionOf, SECTION_META, checklist, dayStatus, sections, cutPlan, weightVerdict, fightWeek, weekReview, reviewText, WELL, missing, isComplete, isPartial, streak, grid, dayWellness, sessionLoad, wellness, load, cutSafety, toCSV, CSV_COLS };
  if (typeof module !== 'undefined') module.exports = api; else root.Insights = api;
})(this);
