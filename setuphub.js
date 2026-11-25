/* M1 (fr-v61): Setup as a set of boxes. Each box describes one setup area; tapping it opens only that area's settings.
   The existing Setup cards are still rendered (same ids and handlers); cards outside the open area are hidden. */
const SetupHub = (() => {
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const AREAS = [
    ['fight', '🥊', 'Fight & camp', 'Fight date, weigh-in, fight checklist, recovery window and camp history.'],
    ['outline', '🧭', 'Maintenance outline & goals', 'Weekly training target, weigh-ins and the goals you agree with your coach.'],
    ['profile', '👤', 'Profile, photo & schedule', 'Name, team, photo, weight class, cut plan, watch and your usual training week.'],
    ['reminders', '⏰', 'Reminders', 'Morning and evening check-in alerts, phone notifications and calendar reminders.'],
    ['nutrition', '🍽️', 'Nutrition goal', 'How the Nutrition log works: Yes/No, calories or macros.'],
    ['care', '🩺', 'Care notes & clearance', 'Injury or illness holds and a professional’s clearance.'],
    ['scoring', '📊', 'Scoring', 'Category weights and score settings.'],
    ['data', '💾', 'Backup & updates', 'Export or restore your data, check for an app update, or erase this phone.']
  ];
  // Which area a top-level Setup card belongs to (by id or heading). Unknown cards go to "data" so nothing is ever lost.
  function areaOf(el) { const id = el.id || '', hd = el.querySelector('h2,h3'), h = hd ? hd.textContent || '' : (el.textContent || '').slice(0, 160);
    if (id === 'remCard' || /Gentle reminders|Camp alarms are not appropriate/.test(h)) return 'reminders';
    if (id === 'nutSetup' || /Nutrition goal/.test(h)) return 'nutrition';
    if (id === 'photoCard' || /Smart watch|Fighter profile|Fighter photo/.test(h)) return 'profile';
    if (/Maintenance outline|hydrated weight band/.test(h) || el.querySelector('#rcOutlineIntro')) return 'outline';
    if (/Restrictions|clearance/i.test(h)) return 'care';
    if (/Scoring parameters/.test(h)) return 'scoring';
    if (id === 'fightChecklistSetup' || /Fight-date scheduler|Fight Review|Early Maintenance|Camp & review history|Fight camp/.test(h)) return 'fight';
    return 'data'; }
  let area = null;
  function render(html) { const tpl = document.createElement('template'); tpl.innerHTML = html; const counts = {};
    Array.from(tpl.content.children).forEach(el => { const a = areaOf(el); counts[a] = (counts[a] || 0) + 1; el.setAttribute('data-sarea', a); if (a !== area) el.setAttribute('hidden', ''); });
    const q = Recovery.phase(S.recovery, today()), m = (S.recovery && S.recovery.maintenance) || {};
    const flag = k => k === 'outline' && q.mode === 'maintenance' && !m.outlineSaved ? '<span class="sh-flag">Start here</span>' : k === 'fight' && q.mode === 'recovery' ? '<span class="sh-flag">Fight Review</span>' : '';
    const order = AREAS.filter(([k]) => counts[k]).sort((a, b) => (q.mode === 'maintenance' && a[0] === 'outline' ? -1 : q.mode === 'maintenance' && b[0] === 'outline' ? 1 : 0));
    const cur = AREAS.find(x => x[0] === area);
    const top = cur ? `<div class="secbar sh-bar"><button type="button" class="btn alt secback" data-sharea="">‹ All settings</button></div><h2 class="sh-title" id="setupAreaTitle">${cur[1]} ${e(cur[2])}</h2>`
      : `<div class="card sh-intro"><h2 style="margin:0">⚙️ Setup</h2><p class="muted" style="margin:4px 0 0">Tap an area to open its settings.</p></div><div id="setupHub" class="sh-grid" role="list">${order.map(([k, ic, t, d]) => `<button type="button" class="sh-box" data-sharea="${k}" id="sh_${k}" role="listitem"><span class="sh-ic">${ic}</span><span class="sh-tt"><b>${e(t)}</b>${flag(k)}<span class="sh-d">${e(d)}</span></span><span class="sh-go">›</span></button>`).join('')}</div>`;
    const wrap = document.createElement('div'); wrap.appendChild(tpl.content);
    return `<div id="setupPage" data-area="${e(area || '')}">${top}${wrap.innerHTML}</div>`; }
  function install() { const inner = V.setup;
    V.setup = () => { if (area && !AREAS.some(x => x[0] === area)) area = null; let html = inner();
      if (typeof FightDay !== 'undefined') html = html.replace(/(<section class="card rc"><h2>Restrictions)/, FightDay.setupCard() + '$1');
      if (typeof FighterPhoto !== 'undefined') html = html.replace(/(<div class="card"><h3>Fighter profile<\/h3>)/, FighterPhoto.card() + '$1');
      return render(html); };
    document.addEventListener('click', ev => { const t = ev.target.closest('[data-sharea],#tabs [data-v]'); if (!t) return;
      if (t.dataset.sharea != null) { ev.preventDefault(); ev.stopImmediatePropagation(); area = t.dataset.sharea || null; show('setup'); return; }
      area = null; }, true); }
  return { AREAS, areaOf, render, install, get area() { return area; }, set area(v) { area = v || null; } };
})();
