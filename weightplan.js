// Weight plan: one model for every division, scaled by % of target weight (see FightReady weight plan Page).
// Plan line spreads the gap evenly to reach target 5 days before weigh-in; a personal fight-week allowance A covers the rest.
(function (root) {
  const dn = s => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y,m-1,d)/864e5; };
  const ymd = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'');
  const r1 = v => Math.round(v*10)/10;
  const WEIGH_IN = [['day-before','Day before the fight (20+ h to recover)'],['mid','6–20 h before the fight'],['same-day','Same day (6 h or less before)']];
  const CUT_EXP = [['first','First cut (or first in years)'],['some','Second or third cut'],['experienced','Experienced, cuts have gone well']];
  const BASE = { 'day-before':5, mid:4, 'same-day':3 }, LEAD = 5, MAX_UNSAFE = 6.7, NO_WATER_CAP = 3, MINOR_CAP = 2;
  function age(dob, today) { if (!isDate(dob)) return null; const [y,m,d] = dob.split('-').map(Number); let a = today.getFullYear()-y; if (today.getMonth()+1 < m || (today.getMonth()+1 === m && today.getDate() < d)) a--; return a; }
  // ---- Hydration (first-pee colour 1-8: 1-3 hydrated, 4-5 drink more, 6-8 dehydrated) ----
  const hyd = e => { const v = e && +e.hydration; return Number.isInteger(v) && v >= 1 && v <= 8 ? v : null; };
  const dark = e => { const v = hyd(e); return v != null && v >= 6; };
  // A weigh-in is water-affected if that morning was dark, or 2+ of the last 3 mornings (that day and the 2 before) were dark.
  function waterAffected(entries, date) { const by = {}; entries.forEach(e => { by[e.date] = e; }); if (dark(by[date])) return true;
    let n = 0; for (let i = 0; i < 3; i++) { const x = new Date(date+'T12:00'); x.setDate(x.getDate()-i); if (dark(by[ymd(x)])) n++; } return n >= 2; }
  const WATER_NOTE = 'Hydrate and re-weigh; this drop is likely water, not real loss.';
  // Personal fight-week allowance A (% of target)
  function allowance(p = {}, today = new Date()) {
    const a = age(p.dob, today), minor = a != null && a < 18, notes = [];
    let pct = BASE[p.weighIn] || BASE['day-before'];
    notes.push(`${pct}% base, ${{'day-before':'day-before','mid':'6–20 h','same-day':'same-day'}[p.weighIn||'day-before']||'day-before'} weigh-in`);
    if (a != null && a >= 18 && a <= 20) { pct -= 1; notes.push('−1 age 18–20'); }
    if (p.cutExp === 'first' || p.cutExp === 'some' || !p.cutExp) { pct -= 1; notes.push('−1 early cut experience'); }
    if (p.lastCutBad) { pct -= 1; notes.push('−1 last cut went badly'); }
    if (p.cutExp === 'experienced' && !p.lastCutBad && (a == null || a > 20)) { pct += 1; notes.push('+1 experienced'); }
    pct = Math.max(2, Math.min(6, pct));
    const water = !!p.waterCut && !minor;
    if (minor) { pct = Math.min(pct, MINOR_CAP); notes.push('under 18: 2% cap, food steps only'); }
    else if (!water && pct > NO_WATER_CAP) { pct = NO_WATER_CAP; notes.push('food-only steps: 3% cap'); }
    return { pct, minor, water, age:a, notes };
  }
  const weighInDate = p => { if (!isDate(p.fightDate)) return null; if ((p.weighIn||'day-before') === 'same-day') return p.fightDate; const x = new Date(p.fightDate+'T12:00'); x.setDate(x.getDate()-1); return ymd(x); };
  // Fight-week target for k days before weigh-in (k <= 5). Food steps take the first part, water (if opted in) the last day.
  const FRAC = { 5:1, 4:0.85, 3:0.7, 2:0.55, 1:0.4, 0:0 }, FRAC_FOOD = { 5:1, 4:0.8, 3:0.6, 2:0.4, 1:0.2, 0:0 };
  function weekTarget(T, A, k, water) { const f = k >= 5 ? 1 : (water ? FRAC : FRAC_FOOD)[Math.max(0,k)]; return r1(T * (1 + A/100 * f)); }
  // Status of the cut. ws = [{date, weight}] sorted; opts.startDate = camp start.
  function status(entries, p = {}, today = new Date(), opts = {}) {
    const T = +p.targetWeight, wi = weighInDate(p); if (!(T > 0)) return null;
    const ws = entries.filter(e => +e.weight > 0).sort((a,b)=>a.date<b.date?-1:1); if (!ws.length && !(+p.startWeight > 0)) return null;
    let W2 = null; const al = allowance(p, today), A = al.pct, rate = al.minor ? 0.75 : 1, t = dn(ymd(today));
    const cur = ws.length ? ws[ws.length-1] : { date: ymd(today), weight: +p.startWeight }, W = +cur.weight;
    const out = { T, A, allowLbs: r1(T*A/100), rate, allow: al, W, weighIn: wi, band: null };
    if (!wi) { out.band = W <= T*(1+A/100) ? 'in' : 'none'; out.text = 'Set a fight date to get a plan.'; return out; }
    const D = dn(wi) - t; out.daysToWeighIn = D; if (D < 0 && t > dn(p.fightDate)) return null;
    if (D < 0) { out.band = 'on'; out.postWeighIn = true; out.planToday = null; out.text = 'Weigh-in done. Rehydrate and refuel: the goal is pale pee (1–3) before the fight.'; return out; }
    // plan line from camp start weight (first weigh-in on/after camp start) to T at weigh-in − LEAD
    if (D > LEAD) { const wa = waterAffected(entries, cur.date);
      if (wa) { out.waterAffected = { date: cur.date, weight: +cur.weight }; const h = ws.slice().reverse().find(e => !waterAffected(entries, e.date));
        if (h) { out.usedWeight = { date: h.date, weight: +h.weight }; out.W = W2 = +h.weight; } } }
    const s0 = opts.startDate && ws.find(e => e.date >= opts.startDate) || ws[0] || cur, d0 = dn(s0.date), W0 = +s0.weight, end = dn(wi) - LEAD;
    const planAt = n => end <= d0 ? T : r1(Math.max(T, W0 - (W0 - T) * Math.min(1, Math.max(0, (n - d0) / (end - d0)))));
    out.planStart = { date: s0.date, weight: W0 }; out.planToday = D <= LEAD ? weekTarget(T, A, D, al.water) : planAt(t);
    out.planPerWeek = end > d0 ? r1((W0 - T) / ((end - d0) / 7)) : 0;
    const Wx = W2 != null ? W2 : W, wk = Math.max(0, D - LEAD) / 7, F = Math.max(T, Wx * Math.pow(1 - rate/100, wk)), X = r1((F - T) / T * 100);
    const need = wk > 0 ? r1((Wx - T*(1+A/100)) / wk / Wx * 100) : null; out.F = r1(F); out.X = X; out.needPct = need; out.needLbs = wk > 0 ? r1(Math.max(0, Wx - T*(1+A/100)) / wk) : null;
    const maxPace = (al.age != null && al.age < 21) ? 1 : 1.5;
    let band;
    if (D <= LEAD) { const tgt = weekTarget(T, A, D, al.water), over = r1((W - tgt) / T * 100);
      band = W <= tgt + 0.05 ? (W <= T ? 'on' : 'in') : over <= 2 ? 'tight' : 'unsafe'; out.weekOver = over; }
    else if (X > A + 2 || X > MAX_UNSAFE || (need != null && need > maxPace) || (al.minor && X > 3)) band = 'unsafe';
    else if (X > A || (need != null && need > rate)) band = 'tight';
    else if (X <= 0 && Wx <= planAt(t) * 1.005 && !(out.waterAffected && !out.usedWeight)) band = 'on';
    else band = 'in';
    out.band = band; out.text = (out.waterAffected ? WATER_NOTE + ' ' : '') + message(out); return out;
  }
  const BAND = { on:['On track','green'], in:['In range','green'], tight:['Tight','orange'], unsafe:['Unsafe','red'], none:['No plan','grey'] };
  function message(s) {
    const { T, A, allowLbs } = s, P = s.planPerWeek, k = s.daysToWeighIn;
    if (k <= LEAD) { const tgt = weekTarget(T, A, k, s.allow.water);
      return s.band === 'on' || s.band === 'in' ? `Today's target ${tgt} lbs. You're on it. Stick to today's fight-week steps.` :
        s.band === 'tight' ? `Today's target ${tgt} lbs; you're ${r1(s.W - tgt)} over. Tell your coach today and follow the plan, don't improvise.` :
        `You're ${r1(s.W - tgt)} lbs over today's target (${tgt}). Making ${T} safely isn't likely. Be honest with your coach now: a catchweight or a miss beats a dangerous cut.`; }
    if (s.band === 'on') return `Plan: lose ${P} lbs a week to reach ${T} five days before weigh-in. You're on track.`;
    if (s.band === 'in') return `You're In range: a normal fight-week cut (up to ${allowLbs} lbs) covers the rest. Keep losing about ${s.needLbs || P} lbs a week.`;
    if (s.band === 'tight') return `Tight: you'd need ${s.X}% in fight week; your safe limit is ${A}%. Talk to your coach this week while there's still time.`;
    return `Unsafe at this pace. Be honest with your coach now: a catchweight, a later date or a class up beats a dangerous cut.`;
  }
  // Hydration alert for today's reading. k = days to weigh-in (negative after weigh-in), water = opted in, minor.
  function hydAlert(e, k, water, minor) { const v = hyd(e);
    if (k != null && k <= 0) return { level: v == null ? 'info' : v <= 3 ? 'ok' : 'warn', stop:false, rehydrate:true,
      text: v == null ? 'Rehydration check: log your pee colour. Goal: pale (1–3) before the fight.' : v <= 3 ? 'Rehydration check: pale. You\'re rehydrated.' : 'Rehydration check: not pale yet. Keep sipping your rehydration drink; goal is pale (1–3) before the fight.' };
    if (v == null || v < 6) return null;
    if (minor) return { level:'warn', stop:false, text:'Dark pee: drink normally today. Under-18s never dehydrate to make weight.' };
    if (k == null || k > 7) return null;
    if (water && k >= 3) return { level:'stop', stop:true, text:'Drying out too early: stop, drink normally and tell your coach.' };
    if (!water) return { level:'warn', stop:false, text:'Dark pee in fight week: drink normally. Water-cut steps are off.' };
    return null; }
  // Morning weigh-in vs the day's target
  function dayCheck(weight, s) { if (!s || !(+weight > 0) || !(s.planToday > 0)) return null; const d = r1(+weight - s.planToday), pct = d / s.T * 100;
    return { target: s.planToday, diff: d, level: d <= 0.05 ? 'ok' : pct <= 1 ? 'close' : 'over', text: d <= 0.05 ? `On target (${s.planToday} lbs today)` : `${d} lbs over today's target (${s.planToday})` }; }
  // Fight-week steps for k days before weigh-in. water = opted in (and not a minor).
  const FOOD = {
    7:['Taper: training volume down 20–30%.','Normal food and drink. Weigh every morning.'],
    [-1]:['Fight day.','Familiar meals, low fibre. Keep sipping electrolytes.'],
    6:['Technical work, short sharp rounds.','Normal food and drink.'],
    5:['Last moderate session.','Normal food. You should be at or under today\'s target.'],
    4:['Light technical work.','Low-fibre food from today: under 10 g fibre (white rice, eggs, lean meat, juice).'],
    3:['Light drilling, 30–45 min.','Low fibre. Cut added salt. Carbs down to about 2 g/kg only if you need it.'],
    2:['Very light: shadowboxing, stretching.','Low fibre, low salt, small meals. Keep protein up.'],
    1:['Rest, walk, visualize.','Light low-fibre meals. Weigh morning and night.'],
    0:['Weigh-in day.','After weigh-in: rehydration drink 1–1.5 L/hour, then easy carbs up to 60 g/hour, low fibre.'] };
  const WATER = { 5:'Water loading (optional): about 100 mL/kg today, normal salt.', 4:'Water loading: about 100 mL/kg today.', 3:'Water loading: about 100 mL/kg today.',
    2:'Fluid down to about 15 mL/kg today.', 1:'Sip only. If still over: light sweating in warm clothes first; dry sauna is the last resort, never alone, short rounds, weigh between rounds.' };
  const DRINK = 'Drink normally (pale-yellow urine).';
  function steps(k, water, minor) { const f = FOOD[k]; if (!f) return null; const s = [{ icon:'🏋️', text:f[0] }, { icon:'🍚', text:f[1] }];
    s.push({ icon:'💧', text: k <= 0 ? 'Rehydrate after weigh-in.' : (water && !minor && WATER[k]) ? WATER[k] : DRINK }); return s; }
  const api = { hyd, dark, waterAffected, WATER_NOTE, hydAlert, WEIGH_IN, CUT_EXP, LEAD, BAND, allowance, weighInDate, weekTarget, status, dayCheck, steps, FOOD, WATER, age };
  if (typeof module !== 'undefined') module.exports = api; else root.WeightPlan = api;
})(this);
