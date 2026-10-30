// Earned weekend Cheat Day. Shared by app + node tests.
// Week = Mon-Fri of the current week; the award is for that week's Sat/Sun. Rules (all required):
//  1. Mon-Fri all 5 days fully logged, nutrition hit on >= 4 of 5 (Yes, or goal-day score >= 80)
//  2. Pace: FightReady score >= 80, or up >= 3 points vs the score one week earlier
//  3. Weight on track (Insights.weightVerdict) when a target weight is set; passes if no target is set
//  4. Blackout: not the first weekend of camp (first Sat/Sun on or after the app start date), and no weekend day
//     within the 14 days before the fight date.
// Unlocks once Friday's log is complete (or from Saturday). One claim per weekend, Sat or Sun only, stored as e.cheat=true
// on that date (never re-evaluated). Unused awards expire at Sunday midnight (the next week starts Monday).
(function (root) {
  const Sc = typeof module !== 'undefined' ? require('./scoring.js') : root.Scoring;
  const In = typeof module !== 'undefined' ? require('./insights.js') : root.Insights;
  const { dayNum, ymd } = Sc;
  const fromNum = n => { const d = new Date(n * 864e5); return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'); };
  const dow = n => ((n % 7) + 7 + 4) % 7; // day 0 (1970-01-01) was a Thursday; 0 = Sunday
  const PACE_MIN = 80, PACE_UP = 3, HITS_NEEDED = 4, FIGHT_WINDOW = 14;
  function evaluate(entries, opt = {}) {
    const now = opt.today || new Date(), t = dayNum(ymd(now)), mon = t - ((dow(t) + 6) % 7), sat = mon + 5, sun = mon + 6, fri = mon + 4;
    const by = new Map(entries.map(e => [e.date, e])), p = opt.profile || {}, params = opt.params || {};
    const week = [0,1,2,3,4].map(i => by.get(fromNum(mon + i))), out = { mon:fromNum(mon), sat:fromNum(sat), sun:fromNum(sun), today:fromNum(t) };
    const claimed = [sat, sun].map(fromNum).find(d => by.get(d) && by.get(d).cheat) || null; out.claimed = claimed;
    // blackout
    let blackout = null;
    if (!opt.startDate) blackout = 'camp';
    else { const s = dayNum(opt.startDate), firstSat = dow(s) === 0 ? s - 1 : s + (6 - dow(s)); if (sat <= firstSat) blackout = 'camp'; }
    if (!blackout && p.fightDate) { const f = dayNum(p.fightDate); if ([sat, sun].some(d => d >= f - FIGHT_WINDOW && d <= f)) blackout = 'fight'; }
    out.blackout = blackout;
    // 1. logging + nutrition
    const done = week.filter(e => e && In.isComplete(e)).length, hits = week.filter(e => e && Sc.nutritionHit(e)).length;
    const c1 = done === 5 && hits >= HITS_NEEDED;
    const left = [];
    if (done < 5) left.push(`${5 - done} more fully logged day${5 - done === 1 ? '' : 's'} (Mon–Fri)`);
    if (hits < HITS_NEEDED) left.push(`${HITS_NEEDED - hits} more on-target nutrition day${HITS_NEEDED - hits === 1 ? '' : 's'}`);
    // 2. pace (scores as of today: closed days only)
    const cs = d => { const r = Sc.compute(entries, d, Object.assign({}, params, { startDate: opt.startDate || null })); return r.daysLogged ? (r.locked ? Math.round(r.base) : r.score) : null; };
    const sNow = cs(new Date(now)), prevD = new Date(now); prevD.setDate(prevD.getDate() - 7); const sPrev = cs(prevD);
    const c2 = sNow != null && (sNow >= PACE_MIN || (sPrev != null && sNow - sPrev >= PACE_UP));
    // 3. weight
    const tgt = +p.targetWeight > 0, v = tgt ? In.weightVerdict(entries, p, now) : null;
    const c3 = !tgt || v.word === 'On track' || (v.word === 'On track?' && !(Sc.weightDelta(entries, t) > 0.5));
    out.conds = [
      { key:'log', ok:c1, text:`Mon–Fri fully logged ${done}/5 • nutrition on target ${hits}/5 (need ${HITS_NEEDED})` },
      { key:'pace', ok:c2, text:`Score ${sNow ?? '—'}${sPrev != null ? ` (week ago ${sPrev})` : ''}: need ${PACE_MIN}+ or up ${PACE_UP}+ points` },
      { key:'weight', ok:c3, text: tgt ? `Weight: ${v.word}${v.word === 'On track' ? '' : ' (' + v.text + ')'}` : 'Weight: no target set' },
      { key:'blackout', ok:!blackout, text: blackout === 'camp' ? 'Cheat days unlock from the second weekend of camp' : blackout === 'fight' ? 'No cheat days in the 14 days before the fight' : 'Not in a blackout weekend' } ];
    out.left = left.concat(c2 ? [] : ['lift your score to 80+ (or +3 on last week)']).concat(c3 ? [] : ['get weight back on track']);
    out.earned = c1 && c2 && c3 && !blackout;
    const friDone = !!(by.get(fromNum(fri)) && In.isComplete(by.get(fromNum(fri))));
    out.unlocked = out.earned && (t >= sat || (t === fri && friDone));
    // days still claimable: Sat/Sun, today or later, not in a fight window
    const f = p.fightDate ? dayNum(p.fightDate) : null;
    out.claimable = out.unlocked && !claimed ? [sat, sun].filter(d => d >= t && !(f != null && d >= f - FIGHT_WINDOW && d <= f)).map(fromNum) : [];
    return out; }
  function claim(entries, date, opt = {}) { const ev = evaluate(entries, opt); if (!ev.claimable.includes(date)) return null; return date; }
  const api = { evaluate, claim, PACE_MIN, PACE_UP, HITS_NEEDED, FIGHT_WINDOW };
  if (typeof module !== 'undefined') module.exports = api; else root.Cheat = api;
})(this);
