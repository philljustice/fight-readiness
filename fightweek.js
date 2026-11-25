/* M1 (fr-v61): fight-week plan, day by day. Built only from WeightPlan (same targets, steps, under-18 and opt-in water-cut limits).
   Shown inside the Score fight-week card and on the Schedule tab from 14 days before weigh-in. Guideline only, not medical advice. */
const FightWeek = (() => {
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return Scoring.ymd(x); };
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // rows: k = days to weigh-in (7 … 0), plus the fight day when it is after the weigh-in day.
  function plan(s, profile) { if (!s || !s.weighIn || !(s.T > 0)) return null; const water = !!s.allow.water, minor = !!s.allow.minor, rows = [];
    for (let k = 7; k >= 0; k--) { const date = addDays(s.weighIn, -k), tgt = WeightPlan.weekTarget(s.T, s.A, Math.min(k, 6), water);
      rows.push({ k, date, target: tgt, atOrUnder: k >= 5, label: k === 0 ? 'Weigh-in day' : k + ' day' + (k === 1 ? '' : 's') + ' out', steps: WeightPlan.steps(k, water, minor) || [] }); }
    const fd = profile && profile.fightDate; if (fd && fd > s.weighIn) rows.push({ k:-1, date: fd, target: null, label: 'Fight day', steps: WeightPlan.steps(-1, water, minor) || [] });
    return { rows, water, minor, band: s.band, warn: s.band === 'tight' || s.band === 'unsafe' ? s.text : '' }; }
  function table(p, today) { return `${p.warn ? `<div class="wp-box ${e(p.band)}" id="fwPlanWarn">⚠️ ${e(p.warn)}</div>` : ''}<div class="fw-plan" id="fwPlanRows">${p.rows.map(r => `<div class="fw-day${r.date === today ? ' on' : ''}${r.k < 0 ? ' fight' : ''}"><div class="fw-h"><b>${DOW[new Date(r.date + 'T12:00').getDay()]} ${e(r.date.slice(5))}</b> <span class="muted">${e(r.label)}</span>${r.target ? `<span class="fw-t">${r.atOrUnder ? '≤ ' : ''}${r.target} lbs</span>` : ''}</div>${r.steps.map(x => `<div class="fw-s">${x.icon} ${e(x.text)}</div>`).join('')}</div>`).join('')}</div>
    <p class="muted" style="margin:8px 0 0">${p.minor ? '🛡️ Under 18: food-based steps only, never water cutting or sauna.' : p.water ? 'Water-cut steps are on (you opted in). Guideline only, not medical advice.' : 'Food-based steps only. Water-cut steps are off.'} Targets come from your weight plan; your coach chooses the division. <a href="#" data-goto="help" data-anchor="helpStop" style="color:#E1A42B">Stop signs →</a></p>`; }
  // Collapsible version for the Score fight-week card.
  function details(s, profile, today) { const p = plan(s, profile); if (!p) return ''; return `<details class="fw-details" id="fwPlanDetails"><summary><b>📋 Full fight-week plan</b></summary>${table(p, today)}</details>`; }
  // Card for the Schedule tab (camp): from 14 days before weigh-in until the fight.
  function card(s, profile, today) { if (!s || s.daysToWeighIn == null || s.daysToWeighIn > 14) return ''; const p = plan(s, profile); if (!p) return '';
    return `<div class="card" id="fwPlanCard"><h3>⚖️ Fight-week plan</h3><p class="muted" style="margin:0 0 8px">Weigh-in ${e(s.weighIn)}${s.daysToWeighIn > 0 ? ' · ' + s.daysToWeighIn + ' day' + (s.daysToWeighIn === 1 ? '' : 's') + ' away' : ''}. Each day's target and steps. Weigh every morning.</p>${table(p, today)}</div>`; }
  return { plan, details, card };
})();
if (typeof module !== 'undefined') module.exports = FightWeek;
