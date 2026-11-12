// Day-1 results: daily score + breakdown, feedback, badges, sparkline data. Shared by app + node tests.
(function (root) {
  const Sc = typeof module !== 'undefined' ? require('./scoring.js') : root.Scoring;
  const In = typeof module !== 'undefined' ? require('./insights.js') : root.Insights;
  const NAMES = { nutrition:'Nutrition', training:'Training', sleep:'Sleep', wellness:'Wellness', screen:'Screen time', family:'Family/Friends' };
  const TIPS = { nutrition:'stick to the nutrition plan tomorrow (or land within 5% of your calorie/macro goal), prep meals tonight', training:'complete every scheduled session tomorrow (rest days count 100%)',
    sleep:'aim for 8 hours tonight, screens off 30 min before bed', wellness:'recover well: hydrate, eat, stretch, sleep (it lifts energy and soreness)',
    screen:'keep recreational screen time to 2 hours or less', family:'make time for family or friends tomorrow' };
  const MAINT_TIPS = Object.assign({}, TIPS, { training:'log the sessions you do this week — four is the target, three can still be Fight Ready' });
  // Score for one day with the same weights. null if nothing logged.
  function daily(e, params = {}) { if (!e) return null;
    const maint = params.trainingPlan==='maintenance' || (e.context && e.context.mode==='maintenance');
    const r = Sc.compute([e], new Date(e.date + 'T12:00'), Object.assign({}, params, { startDate:null, includeToday:true, noMomentum: !!(maint || params.noMomentum), trainingPlan: maint ? 'maintenance' : (params.trainingPlan || 'camp') }));
    const scorable = typeof Sc.entryScorable === 'function' ? Sc.entryScorable(e) : true;
    const out = { score: Math.round(r.base), base: r.base, cats: Object.assign({}, r.cats), weights: Object.assign({}, r.weights), trainingPlan: maint ? 'maintenance' : 'camp', scorable, trainingRest: false };
    if (maint && Sc.countQualifyingSessions([e]) === 0) {
      out.trainingRest = true;
      out.weights.training = 0;
      const denom = Object.keys(out.weights).reduce((s,k)=>s+(+out.weights[k]||0),0);
      if (scorable && denom > 0) {
        let pts = 0; for (const k in out.weights) if (k !== 'training') pts += (out.cats[k]||0) * out.weights[k] / 100;
        out.base = pts / denom * 100; out.score = Math.round(out.base);
      } else { out.base = null; out.score = null; }
    } else if (!scorable) { out.base = null; out.score = null; }
    return out; }
  function feedback(d, e) { if (!d) return null;
    if (!d.scorable || d.score == null) return { best:null, fix:null, text:'Log what you did today to start your score.' };
    const ks = Object.keys(d.cats).filter(k => (d.weights[k]||0) > 0);
    const tips = (d.trainingPlan==='maintenance' || (e && e.context && e.context.mode==='maintenance')) ? MAINT_TIPS : TIPS;
    const best = ks.slice().sort((a,b) => d.cats[b]*d.weights[b] - d.cats[a]*d.weights[a] || d.cats[b]-d.cats[a])[0];
    const fix = ks.slice().sort((a,b) => (100-d.cats[b])*d.weights[b] - (100-d.cats[a])*d.weights[a])[0];
    const lost = (100 - d.cats[fix]) * d.weights[fix] / 100, done = In.isComplete(e);
    const lead = d.score >= 90 ? 'Elite day.' : d.score >= 75 ? 'Strong day.' : d.score >= 60 ? 'Solid day.' : 'Good start, every log builds the picture.';
    return { best, fix: lost >= 1 ? fix : null,
      text: `${lead} Best: ${NAMES[best]} (${Math.round(d.cats[best])}).` + (lost >= 1 ? ` One thing for tomorrow: ${tips[fix]} (+${lost.toFixed(0)} pts available).` : ' Nothing to fix, repeat it tomorrow.') + (done ? '' : ' Finish the rest of today\'s log to complete the day.') }; }
  // Score per logged day, oldest first
  const series = (entries, params = {}, n = 21) => entries.slice().sort((a,b)=>a.date<b.date?-1:1).slice(-n).map(e => ({ date:e.date, score: daily(e, params).score }));
  function badges(entries, params = {}) { const st = In.streak(entries);
    const perfect = entries.some(e => In.isComplete(e) && daily(e, params).score >= 95);
    return [ { id:'day1', icon:'🥊', label:'Day 1 logged', got: entries.length > 0 },
      { id:'streak3', icon:'🔥', label:'3-day streak', got: st.best >= 3 },
      { id:'week1', icon:'📅', label:'First full week', got: st.best >= 7 },
      { id:'perfect', icon:'⭐', label:'Perfect day (95+)', got: perfect } ]; }
  // Early-score progress: days logged since start vs unlock
  function progress(r, unlockDays = 7) { const done = Math.min(unlockDays, unlockDays - r.unlockIn); return { pct: Math.round(done / unlockDays * 100), unlockIn: r.unlockIn }; }
  const api = { NAMES, TIPS, daily, feedback, series, badges, progress };
  if (typeof module !== 'undefined') module.exports = api; else root.Early = api;
})(this);
