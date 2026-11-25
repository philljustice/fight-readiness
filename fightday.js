/* M1 (fr-v61): fight day. Detection, fight checklist (from a week out), injury/pain/illness check-in,
   first-open fanfare, and the fight-day score card. Data: S.fightPrep[fightDate] = {items:[{label,done}], fanfare}
   and entry.fightCheck = {injury,pain,ill, injuryNote,painNote,illNote}. Uses app.js globals (S, save, upsert, blankOr, heroCard, earlyCard, todayTraining). */
const FightDay = (() => {
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const DEFAULT_ITEMS = ['Required medicals done', 'Valid membership / licence', 'Target weight on track', 'Travel arrangements sorted'];
  const dn = d => Scoring.dayNum(d);
  const mode = d => { try { return Recovery.phase(S.recovery, d).mode; } catch (err) { return 'camp'; } };
  // Upcoming fight date (camp): the scheduled bout first, then the profile date.
  function fightDate(d = today()) { try { const n = Recovery.phase(S.recovery, d).next; if (n && n.fightDate) return n.fightDate; } catch (err) {}
    const p = S.profile || {}; return p.fightDate && p.fightDate >= d ? p.fightDate : ''; }
  const isFightDay = (d = today()) => { const f = fightDate(d); return !!f && f === d && mode(d) === 'camp'; };
  const daysOut = (d = today()) => { const f = fightDate(d); return f ? dn(f) - dn(d) : null; };
  // ---- Checklist ----
  const prep = (f, create) => { if (!f) return null; S.fightPrep = S.fightPrep || {}; if (!S.fightPrep[f] && create) S.fightPrep[f] = { items: DEFAULT_ITEMS.map(label => ({ label, done:false })) }; return S.fightPrep[f] || null; };
  const items = f => { const p = prep(f, false); return p && Array.isArray(p.items) ? p.items : DEFAULT_ITEMS.map(label => ({ label, done:false })); };
  const allDone = f => { const it = items(f).filter(x => String(x.label || '').trim()); return it.length > 0 && it.every(x => x.done); };
  const showChecklist = (d = today()) => { const k = daysOut(d); return k != null && k >= 0 && k <= 7 && mode(d) === 'camp' && !allDone(fightDate(d)); };
  function checklistCard(d = today()) { if (!showChecklist(d)) return ''; const f = fightDate(d), k = daysOut(d), it = items(f);
    return `<div class="card fd-check" id="fightChecklist"><h3>✅ Fight checklist</h3><p class="muted" style="margin:0 0 8px">${k === 0 ? "It's fight day!" : k + ' day' + (k === 1 ? '' : 's') + ' to fight'} · tick each item once it's sorted. This card stays here until everything is ticked.</p>
     ${it.map((x, i) => String(x.label || '').trim() ? `<label class="chkrow fd-item"><input type="checkbox" data-fdcl="${i}" ${x.done ? 'checked' : ''}> ${e(x.label)}</label>` : '').join('')}
     <p class="muted" style="margin:8px 0 0">Change the list in Setup → Fight &amp; camp. <a href="#" data-fdsetup="1" style="color:#E1A42B">Edit list →</a></p></div>`; }
  function setupCard() { const f = fightDate(); if (mode(today()) !== 'camp' && !f) return '';
    if (!f) return `<div class="card" id="fightChecklistSetup"><h3>✅ Fight checklist</h3><p class="muted">Set a fight date above first. The checklist (medicals, membership, target weight, travel) then shows on the Score page from a week out until every item is ticked.</p></div>`;
    const it = items(f);
    return `<div class="card" id="fightChecklistSetup"><h3>✅ Fight checklist</h3><p class="muted">For the fight on <b>${e(f)}</b>. Shows on the Score page from a week out until every item is ticked. Edit the items to match what your commission and event need (no gear needed: the gym provides it).</p>
     ${it.map((x, i) => `<div class="row fd-edit" style="margin:6px 0"><input type="checkbox" data-fdcl="${i}" ${x.done ? 'checked' : ''} aria-label="Done"><input data-fdlabel="${i}" maxlength="60" value="${e(x.label)}" style="flex:1"><button type="button" class="btn alt" data-fddel="${i}" style="width:auto;margin:0">✕</button></div>`).join('')}
     <button type="button" class="btn alt" data-fdadd="1">➕ Add an item</button><button type="button" class="btn" data-fdsave="1">💾 Save checklist</button><p class="muted" id="fdSaved" role="status">Ticks save as soon as you tap them.</p></div>`; }
  function readLabels(f) { const p = prep(f, true); document.querySelectorAll('[data-fdlabel]').forEach(inp => { const i = +inp.dataset.fdlabel; if (p.items[i]) p.items[i].label = inp.value.trim(); }); return p; }
  // ---- Fight-day check-in (injury, pain, illness): any yes needs a detailed note ----
  const entryFor = d => S.entries.find(x => x.date === d);
  function checkinHtml(d = today()) { const c = (entryFor(d) || {}).fightCheck || {}, missing = Insights.fightCheckMissing({ fightCheck:c });
    const rows = Insights.FD_Q.map(([k, q]) => `<div class="fd-q"><p style="margin:10px 0 6px"><b>${q}</b></p><div class="ynx" data-fdq="${k}"><button type="button" class="n ${c[k] === false ? 'on' : ''}" data-val="0">No</button><button type="button" class="y ${c[k] === true ? 'on' : ''}" data-val="1">Yes</button></div>
      ${c[k] === true ? `<label for="fdn_${k}">Describe it * <span class="muted">(where, how bad, since when)</span></label><textarea id="fdn_${k}" data-fdnote="${k}" rows="2" maxlength="400" placeholder="Required when you answer Yes">${e(c[k + 'Note'] || '')}</textarea>` : ''}</div>`).join('');
    const anyYes = Insights.FD_Q.some(([k]) => c[k] === true);
    return `<div id="fdCheck" data-fdbox="${d}"><h3 style="margin:0">🩺 Fight-day check-in</h3><p class="muted" style="margin:4px 0 0">Required today. Any yes needs a short description.</p>${rows}
     ${anyYes ? '<p class="hint warn" style="margin:10px 0 0">Tell your coach and the event doctor before you compete. This app can\'t clear you to fight.</p>' : ''}
     <p class="muted" id="fdCheckStatus" style="margin:8px 0 0">${missing ? 'Still to answer.' : '✓ Check-in done.'}</p></div>`; }
  const checkinCard = (d = today()) => `<div class="card fd-checkin">${checkinHtml(d)}</div>`;
  function writeCheck(d, patch) { let x = entryFor(d); if (!x) { x = blankOr(null, d); }
    x.fightCheck = Object.assign({}, x.fightCheck || {}, patch); if (isFightDay(d)) x.fightDay = true; upsert([x]);
    if (typeof V !== 'undefined' && V._e && V._e.date === d) V._e.fightCheck = x.fightCheck;
    return x; }
  function afterWrite(x, rerender) {
    if (rerender) document.querySelectorAll('[data-fdbox]').forEach(el => { el.outerHTML = checkinHtml(x.date); });
    else { const st = document.getElementById('fdCheckStatus'); if (st) st.textContent = Insights.fightCheckMissing(x) ? 'Still to answer.' : '✓ Check-in done.'; }
    try { if (typeof refreshProgress === 'function' && (document.getElementById('progress') || document.getElementById('ok_morning'))) refreshProgress(x); } catch (err) {}
    try { if (x.date === today() && typeof scheduleStatus === 'function') scheduleStatus(); } catch (err) {} }
  // ---- Score card + log banner ----
  function hero(r) { const f = fightDate(), name = (S.profile || {}).name || '', photo = typeof FighterPhoto !== 'undefined' ? FighterPhoto.img('fd-photo') : '';
    const left = Insights.missing(Object.assign({ fightDay:true }, entryFor(today()) || {}, { fightDay:true }));
    const core = r.locked ? earlyCard(r) : heroCard({ score: r.scorable ? r.score : null, badge: r.scorable ? r.verdict.split(' — ')[0] : (r.daysLogged ? 'NO SCORE YET' : 'NO DATA YET'),
      verdict: r.scorable ? r.verdict.split(' — ').slice(1).join(' — ') : 'No scored days in the last 3 weeks yet.', extra: '',
      foot: `Base ${r.base.toFixed(1)} + consistency ${r.bonus} • ${r.daysLogged} days logged • ${e(r.dataQuality.split(' — ')[0])} data` });
    const banner = `<div class="fd-banner" id="fightDayBanner" role="status">${photo}<div class="fd-text"><div class="fd-eyebrow">🥊 FIGHT DAY · ${e(f)}</div><div class="fd-title">It's fight day!</div>${name ? `<div class="fd-name">${e(name)}</div>` : ''}</div></div>
     <p class="fd-note" id="fightDayNote">${left.length ? 'Today you only log wellness, hydration and the fight-day check-in. Still needed: ' + e(left.map(x => x.replace(/ \(.*\)$/, '')).join(', ')) + '. <a href="#" data-goto="log">Log now →</a>' : '✓ Today\'s fight-day log is done. Trust your camp.'}</p>`;
    return core.replace('class="card hero ', 'class="card hero fightday ').replace('<div class="hero-title">CORNERREADY SCORE</div>', banner + '<div class="hero-title">CORNERREADY SCORE</div>'); }
  const logBanner = () => `<div class="card hint fd-logbanner" id="fdLogBanner">🥊 <b>It's fight day!</b> Only the morning wellness, hydration and the fight-day check-in are needed today. Training and food are skipped and won't count against you.</div>`;
  // Training log: the day's scheduled training, so the fighter can confirm it without checking the Schedule tab.
  function schedBox(d) { if (isFightDay(d)) return '<div class="hint fd-sched" id="schedToday">🥊 <b>Fight day:</b> no scheduled training today. Nothing to log here.</div>';
    let t; try { t = todayTraining(d); } catch (err) { return ''; }
    const rows = t.rest ? `<div>😴 Rest day${t.focus && /rest|recovery/i.test(t.focus) ? ': ' + e(t.focus) : ''}</div>` : t.sessions.map((x, i) => `<div>• Session ${i + 1}: <b>${e(x.label)}</b>${+x.mins > 0 ? ' <span class="muted">(' + e(x.mins) + ' min)</span>' : ''}</div>`).join('');
    return `<div class="hint fd-sched" id="schedToday"><div class="muted" style="font-size:.8rem;letter-spacing:.06em">📋 SCHEDULED ${d === today() ? 'TODAY' : 'FOR ' + e(d)}${t.focus && !t.rest ? ' · ' + e(t.focus) : ''}${t.hrs ? ' · ' + e(t.hrs) + 'h planned' : ''}</div>${rows}<div class="muted" style="margin-top:4px">Confirm below what you actually did.</div></div>`; }
  // ---- Fanfare: once, on the first Score open of fight day ----
  function maybeFanfare() { if (typeof document === 'undefined' || !isFightDay() || document.querySelector('#fightDayFanfare,#fightCelebration')) return;
    const f = fightDate(), p = prep(f, true); if (p.fanfare) return; p.fanfare = today(); save();
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const o = document.createElement('section'); o.id = 'fightDayFanfare'; o.className = 'fight-celebration fd-fanfare'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', "It's fight day");
    o.innerHTML = `<div class="fight-celebration-inner ${reduced ? 'still' : ''}"><div class="fight-rays"></div><div class="fight-ring"><img class="fight-f" src="brand/splash/c.webp" alt=""><img class="fight-r" src="brand/splash/r.webp" alt=""><img class="fight-crown" src="brand/splash/crown.webp" alt="CornerReady crown"></div><h1>It's fight day!</h1><p>${e((S.profile || {}).name || '')}</p><p>The work is done. Log how you feel and your hydration, answer the fight-day check-in, and trust your corner.</p><button class="btn" id="fdFanfareGo">Let's go</button></div>`;
    const bg = Array.from(document.querySelectorAll('body > header,#view,#tabs')).map(x => [x, x.inert]); bg.forEach(([x]) => { x.inert = true; }); document.body.append(o);
    let tm = null; const close = () => { clearTimeout(tm); o.remove(); bg.forEach(([x, v]) => { x.inert = v; }); };
    const b = o.querySelector('button'); b.onclick = close; try { b.focus({ preventScroll:true }); } catch (err) {} o.onkeydown = ev => { if (ev.key === 'Escape') close(); };
    if (!reduced) tm = setTimeout(close, 6000); }
  function install() { const dash = V.dash; V.dash = o => { const h = dash(o); if (typeof setTimeout === 'function') setTimeout(maybeFanfare, 60); return h; };
    document.addEventListener('click', ev => { const t = ev.target.closest('[data-fdq] button,[data-fdadd],[data-fddel],[data-fdsave],[data-fdsetup]'); if (!t) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (t.dataset.fdsetup) { if (typeof SetupHub !== 'undefined') SetupHub.area = 'fight'; return show('setup'); }
      const f = fightDate();
      if (t.dataset.fdadd) { const p = readLabels(f); p.items.push({ label:'', done:false }); save(); return show('setup'); }
      if (t.dataset.fddel != null) { const p = readLabels(f); p.items.splice(+t.dataset.fddel, 1); save(); return show('setup'); }
      if (t.dataset.fdsave) { const p = readLabels(f); p.items = p.items.filter(x => x.label); save(); show('setup'); const s = document.getElementById('fdSaved'); if (s) s.textContent = 'Checklist saved ✔'; return; }
      const box = t.closest('[data-fdq]'), k = box.dataset.fdq, d = (t.closest('[data-fdbox]') || {}).dataset?.fdbox || today();
      afterWrite(writeCheck(d, { [k]: t.dataset.val === '1' }), true); }, true);
    document.addEventListener('change', ev => { const t = ev.target; if (t.dataset && t.dataset.fdcl != null) { const f = fightDate(), p = prep(f, true); if (p.items[+t.dataset.fdcl]) p.items[+t.dataset.fdcl].done = t.checked; save();
      if (cur === 'dash' && allDone(f)) show('dash'); } });
    document.addEventListener('input', ev => { const t = ev.target; if (t.dataset && t.dataset.fdnote) { const d = (t.closest('[data-fdbox]') || {}).dataset?.fdbox || today(); afterWrite(writeCheck(d, { [t.dataset.fdnote + 'Note']: t.value }), false); } }); }
  // Coach-facing lines for the most recent fight-day check-in in the last 14 days.
  function checkLines() { const t = dn(today()), x = S.entries.filter(y => y.fightCheck && t - dn(y.date) <= 14 && t >= dn(y.date)).sort((p, q) => p.date < q.date ? 1 : -1)[0]; if (!x) return [];
    const c = x.fightCheck; return Insights.FD_Q.map(([k, q]) => q.replace('?', '') + ': ' + (c[k] === true ? 'YES — ' + String(c[k + 'Note'] || '').trim() : c[k] === false ? 'no' : 'not answered')).map(l => 'Fight-day check-in (' + x.date + ') · ' + l); }
  const checkReportCard = () => { const L = checkLines(); return L.length ? `<div class="card" id="fdCheckReport"><h3>🩺 Fight-day check-in</h3>${L.map(l => `<p>${e(l.replace(/^Fight-day check-in /, ''))}</p>`).join('')}</div>` : ''; };
  return { checkLines, checkReportCard, DEFAULT_ITEMS, fightDate, isFightDay, daysOut, items, allDone, showChecklist, checklistCard, setupCard, checkinHtml, checkinCard, hero, logBanner, schedBox, maybeFanfare, install };
})();
