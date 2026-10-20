'use strict';
const KEY = 'fightReady.v1';
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SAMPLE_WEEK = [ // sample MMA week
 ['Skill and technique','Wrestling – Gym A','Muay thai pads + drills','MMA drills',3.5,'7'],
 ['Strength and technique','Strength and conditioning','NO Gi','MMA drills and pads with coach',5,'8-9'],
 ['Sparring + technique','Striking / Mma sparring','Muay Thai pads with coach','Wrestling – Gym B',3.5,'7'],
 ['Strength and technique','Strength and conditioning','No Gi','Muay thai drills',3.5,'7'],
 ['Rest + Active Recovery','Light walk, stretching, yoga','','',2,'1'],
 ['Sparring + technique','MMA class','','',1.5,'7'],
 ['Skill and technique','Wrestling club','','',3,'7']];
const mondayOf = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return Scoring.ymd(x); };
const newWeek = start => ({ start, coach:'', phase:'', goals:'', coachNotes:'',
  days: DAYS.map((d,i)=>({ day:d, focus:SAMPLE_WEEK[i][0], s1:SAMPLE_WEEK[i][1], s2:SAMPLE_WEEK[i][2], s3:SAMPLE_WEEK[i][3], hrs:SAMPLE_WEEK[i][4], intensity:SAMPLE_WEEK[i][5], notes:'' })) });
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.entries) return s; } catch (e) {}
  return { fighter:'', coach:'', targetWeight:'', params:Object.assign({}, Scoring.DEFAULT_PARAMS), entries:[], weeks:[newWeek(mondayOf(new Date()))], weekIdx:0, reminders:{morning:'07:00', evening:'21:00'} };
}
let S = load(); S.reminders = Object.assign({morning:'07:00', evening:'21:00'}, S.reminders);
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const $ = s => document.querySelector(s), esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => Scoring.ymd(new Date());
const res = () => Scoring.compute(S.entries, new Date(), Object.assign({}, S.params, {startDate:S.startDate||null}));
const lockMsg = r => `🔒 Trends unlock in ${r.unlockIn} day${r.unlockIn==1?'':'s'}. Keep logging!`;
const ynI = v => v===true?'✅':v===false?'❌':'—';
const todayRow = () => { const e = S.entries.find(x=>x.date===today()); return e ? `<p>Today: Nutrition ${ynI(e.nutrition)} • Training ${ynI(e.training)} • Sleep ${e.sleep===''?'—':e.sleep+'h'} • Screen ${e.screen===''?'—':e.screen+'h'} • Family ${ynI(e.family)}${+e.weight?' • '+e.weight+' lbs':''}</p>` : '<p class="muted">Nothing logged today yet.</p>'; };
const CATS = [['nutrition','Nutrition','wNutrition'],['training','Training','wTraining'],['sleep','Sleep','wSleep'],['screen','Screen Time','wScreen'],['family','Family/Friends','wFamily']];

function weightChart() {
  const pts = S.entries.filter(e => +e.weight > 0).sort((a,b)=>a.date<b.date?-1:1).slice(-30);
  if (pts.length < 2) return '<p class="muted">Log 2+ weigh-ins to see the chart.</p>';
  const W=320,H=150,P=28, xs=pts.map(p=>Scoring.dayNum(p.date)), ys=pts.map(p=>+p.weight);
  const tw=+S.targetWeight>0?+S.targetWeight:null; const all=tw?ys.concat(tw):ys;
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...all)-1, y1=Math.max(...all)+1;
  const X=x=>P+(x-x0)/((x1-x0)||1)*(W-P-8), Y=y=>H-20-(y-y0)/(y1-y0)*(H-30);
  const line = pts.map((p,i)=>(i?'L':'M')+X(xs[i]).toFixed(1)+','+Y(ys[i]).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight chart">
   <text x="2" y="${Y(y1)+10}" fill="#999" font-size="10">${y1.toFixed(0)}</text><text x="2" y="${Y(y0)}" fill="#999" font-size="10">${y0.toFixed(0)}</text>
   ${tw?`<line x1="${P}" x2="${W-8}" y1="${Y(tw)}" y2="${Y(tw)}" stroke="#4caf50" stroke-dasharray="4"/><text x="${W-60}" y="${Y(tw)-3}" fill="#4caf50" font-size="10">target ${tw}</text>`:''}
   <path d="${line}" fill="none" stroke="#ff5252" stroke-width="2.5"/>${pts.map((p,i)=>`<circle cx="${X(xs[i])}" cy="${Y(ys[i])}" r="3" fill="#ff5252"/>`).join('')}
   <text x="${P}" y="${H-4}" fill="#999" font-size="10">${pts[0].date}</text><text x="${W-70}" y="${H-4}" fill="#999" font-size="10">${pts[pts.length-1].date}</text></svg>`;
}
function catTable(r) {
  return CATS.map(([k,l,w]) => `<div class="row"><span style="width:110px">${l} (${S.params[w]}%)</span><div class="bar"><i style="width:${r.cats[k]}%"></i></div><b style="width:70px;text-align:right">${r.cats[k].toFixed(0)} → ${(r.cats[k]*S.params[w]/100).toFixed(1)}</b></div>`).join('');
}
const V = {
 dash() {
  const r = res(), lw = r.latestWeight;
  const isWeighDay = [1,4].includes(new Date().getDay()) && !S.entries.some(e=>e.date===today() && +e.weight>0);
  const dueNow = Reminders.due(S.entries.find(e=>e.date===today()), new Date(), S.reminders.morning, S.reminders.evening);
  return `${dueNow.map(k=>`<div class="card hint">⏰ ${k==='morning'?'Morning log not done: sleep hours + nutrition plan'+([1,4].includes(new Date().getDay())?' + weigh-in before eating':''):'Evening log not done: training, screen hours, family/friends, notes'}. <a href="#" data-goto="log" style="color:#ffb74d">Log now →</a></div>`).join('')}${!S.fighter?'<div class="card hint">👋 First time? Go to <b>Setup</b> to enter your name.</div>':''}
  ${isWeighDay?'<div class="card hint">⚖️ It\'s a weigh-in day (Mon/Thu). Weigh in this morning, fasted, and log it.</div>':''}
  ${r.locked?`<div class="card"><div class="muted" style="text-align:center">Fight Readiness Score</div><div class="big">🔒</div><p style="text-align:center"><b>${lockMsg(r)}</b></p><p class="muted" style="text-align:center">Days logged so far: ${r.daysLogged}</p>${todayRow()}</div>`:`
  <div class="card"><div class="muted" style="text-align:center">Fight Readiness Score</div><div class="big">${r.daysLogged?r.score:'—'}</div>
  <p style="text-align:center">${r.daysLogged?esc(r.verdict):'No entries in the last 3 weeks yet.'}</p>
  <p class="muted" style="text-align:center">Base ${r.base.toFixed(1)} + bonus ${r.bonus} • Data Quality: ${esc(r.dataQuality)} (${r.daysLogged} days logged)</p></div>
  <div class="card"><h3>Categories (last 3 weeks)</h3>${catTable(r)}
  <p>Core consistency (Nutrition + Training both Y): <b>${r.consistency.toFixed(0)}%</b> → ${r.bonus?'+'+r.bonus+' pts for daily discipline!':'Build streaks on both key plans'}</p>
  <p class="muted">Bonus: +5 at ≥90%, +3 at ≥75%, +1 at ≥60%.</p></div>`}
  <div class="card"><h3>🥊 Weight</h3><p>Latest: <b>${lw?lw.weight+' lbs':'—'}</b> ${lw?'<span class="muted">('+lw.date+')</span>':''}${+S.targetWeight?` • Target ${esc(S.targetWeight)} lbs`:''}</p>
  ${r.locked?`<p>7-day trend: ${lockMsg(r)}</p>`:`<p>7-day trend: <b>${r.delta==null?'—':(r.delta>0?'+':'')+r.delta+' lbs/wk'}</b></p><p>${r.trend.emoji} ${esc(r.trend.label)}</p>`}${weightChart()}</div>`;
 },
 log() {
  const d = V._date || today(), e = S.entries.find(x=>x.date===d) || {date:d, nutrition:null, training:null, family:null, sleep:'', screen:'', weight:'', notes:''};
  const yn = (k,l) => `<label>${l}</label><div class="yn" data-k="${k}"><button class="y ${e[k]===true?'on':''}" data-val="1">✅ Yes</button><button class="n ${e[k]===false?'on':''}" data-val="0">❌ No</button></div>`;
  const step = (k,l,st) => `<label>${l}</label><div class="step"><button data-step="${k}" data-d="-${st}">−</button><input id="f_${k}" type="number" inputmode="decimal" step="${st}" min="0" max="24" value="${esc(e[k])}"><button data-step="${k}" data-d="${st}">+</button></div>`;
  const wd = [1,4].includes(new Date(d+'T12:00').getDay());
  V._e = Object.assign({}, e);
  return `<div class="card"><label>Date</label><input id="f_date" type="date" value="${d}" max="${today()}">
  ${yn('nutrition','Nutrition plan followed?')}${yn('training','Training session completed?')}
  ${step('sleep','Sleep last night (hours)',0.5)}${step('screen','Recreational screen time (hours)',0.5)}
  ${yn('family','Quality time with family/friends?')}
  <label>Weight (lbs) ${wd?'<span style="color:#ff9800">— weigh-in day! ⚖️</span>':'<span class="muted">(Mon/Thu mornings)</span>'}</label>
  <input id="f_weight" type="number" inputmode="decimal" step="0.1" value="${esc(e.weight)}">
  <label>Notes (injuries, illness, soreness, energy, mood)</label><textarea id="f_notes" rows="3">${esc(e.notes)}</textarea>
  <button class="btn" id="saveLog">💾 Save day</button>
  ${S.entries.some(x=>x.date===d)?'<button class="btn alt" id="delLog">Delete this day</button>':''}</div>
  <div class="card"><h3>Recent entries</h3><table><tr><th>Date</th><th>N</th><th>T</th><th>Sl</th><th>Sc</th><th>F</th><th>Wt</th></tr>
  ${S.entries.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,21).map(x=>`<tr data-date="${x.date}"><td><a href="#" data-edit="${x.date}">${x.date.slice(5)}</a></td><td>${x.nutrition==null?'—':x.nutrition?'Y':'N'}</td><td>${x.training==null?'—':x.training?'Y':'N'}</td><td>${x.sleep??''}</td><td>${x.screen??''}</td><td>${x.family==null?'—':x.family?'Y':'N'}</td><td>${x.weight||''}</td></tr>`).join('')}</table></div>`;
 },
 plan() {
  const w = S.weeks[S.weekIdx], f = (i,k,ph) => `<input data-d="${i}" data-k="${k}" placeholder="${ph}" value="${esc(w.days[i][k])}">`;
  return `<div class="card noprint"><div class="row"><button class="btn alt" id="wkPrev" style="margin:0">◀</button>
   <select id="wkSel">${S.weeks.map((x,i)=>`<option value="${i}" ${i==S.weekIdx?'selected':''}>Week of ${x.start}</option>`).join('')}</select>
   <button class="btn alt" id="wkNext" style="margin:0">▶</button></div>
   <button class="btn" id="wkDup">📋 Duplicate as next week</button><button class="btn alt" id="wkDel">Delete this week</button></div>
  <div class="card"><h3>🥊 Weekly Training Outline</h3>
   <label>Week starting</label><input id="w_start" type="date" value="${esc(w.start)}">
   <label>Coach</label><input id="w_coach" value="${esc(w.coach)}"><label>Camp phase</label><input id="w_phase" value="${esc(w.phase)}">
   <label>Weekly goals & focus</label><textarea id="w_goals" rows="3" placeholder="Technical focus, sparring goals, strength targets, recovery, film study">${esc(w.goals)}</textarea></div>
  ${w.days.map((d,i)=>`<div class="card day"><h3>${d.day}</h3>${f(i,'focus','Primary focus')}${f(i,'s1','Session 1')}${f(i,'s2','Session 2')}${f(i,'s3','Session 3')}
   <div class="row" style="margin:0">${f(i,'hrs','Hours')}${f(i,'intensity','Intensity 1-10')}</div>${f(i,'notes','Notes / drills / recovery')}</div>`).join('')}
  <div class="card"><label>Coach notes & feedback</label><textarea id="w_coachNotes" rows="3">${esc(w.coachNotes)}</textarea></div>
  <p class="muted">Total: ${w.days.reduce((s,d)=>s+(+d.hrs||0),0)} hrs. Standalone planner — doesn't affect the score.</p>`;
 },
 report() {
  const r = res(), notes = S.entries.filter(e=>e.notes && Scoring.dayNum(e.date) >= Scoring.dayNum(today())-14).sort((a,b)=>a.date<b.date?1:-1);
  return `<div class="card"><h2 style="margin:0">🥊 Coach Report: Fight Readiness Summary</h2>
  <p>Fighter: <b>${esc(S.fighter||'[Enter name in Setup]')}</b>${S.coach?' • Coach: '+esc(S.coach):''}<br>Report date: ${today()} • Data period: last 3 weeks (${r.daysLogged} days logged)</p></div>
  ${r.locked?`<div class="card"><p style="text-align:center"><b>${lockMsg(r)}</b><br>Days logged so far: ${r.daysLogged}</p>${todayRow()}</div>`:`<div class="card"><div class="big">${r.score}</div><p style="text-align:center">${esc(r.verdict)}</p></div>`}
  <div class="card"><h3>Weight & trend</h3><p>Latest: ${r.latestWeight?r.latestWeight.weight+' lbs ('+r.latestWeight.date+')':'—'}${+S.targetWeight?' • Target: '+esc(S.targetWeight)+' lbs':''}<br>
   7-day trend: ${r.locked?lockMsg(r):(r.delta==null?'—':r.delta+' lbs/wk')+' '+r.trend.emoji+' '+esc(r.trend.label)}</p>${weightChart()}</div>
  <div class="card"><h3>Category performance</h3><table><tr><th>Category</th><th>Score</th><th>Weight</th><th>Contribution</th></tr>
   ${CATS.map(([k,l,w])=>`<tr><td>${l}</td><td>${r.cats[k].toFixed(0)}</td><td>${S.params[w]}%</td><td>${(r.cats[k]*S.params[w]/100).toFixed(1)}</td></tr>`).join('')}
   ${r.locked?`<tr><td colspan="4">Base score & consistency bonus: ${lockMsg(r)}</td></tr>`:`<tr><th>Base score</th><td></td><td></td><th>${r.base.toFixed(1)}</th></tr><tr><td>Consistency bonus</td><td>${r.consistency.toFixed(0)}%</td><td></td><td>+${r.bonus}</td></tr>`}</table></div>
  <div class="card"><h3>Recent injury / illness notes (last 14 days)</h3>${notes.length?notes.slice(0,6).map(n=>`<p><b>${n.date}:</b> ${esc(n.notes)}</p>`).join(''):'<p>No notes logged in the last 14 days.</p>'}</div>
  <div class="card noprint"><button class="btn" id="printBtn">🖨️ Print / Save as PDF</button><button class="btn alt" id="shareBtn">📤 Share text summary</button></div>`;
 },
 setup() {
  const p = S.params, n = (k,l) => `<label>${l}</label><input data-p="${k}" type="number" step="any" value="${p[k]}">`;
  return `<div class="card"><h3>Fighter</h3><label>Fighter name</label><input id="s_fighter" value="${esc(S.fighter)}">
   <label>Coach name (optional)</label><input id="s_coach" value="${esc(S.coach)}">
   <label>Target weight (lbs)</label><input id="s_target" type="number" inputmode="decimal" step="0.1" value="${esc(S.targetWeight)}"></div>
  <div class="card"><h3>Scoring parameters</h3><p class="muted">Weights should add up to 100.${S.startDate?' App start date: '+S.startDate+'.':''}</p>
   ${n('wNutrition','Nutrition weight %')}${n('wTraining','Training weight %')}${n('wSleep','Sleep weight %')}${n('wScreen','Screen weight %')}${n('wFamily','Family/Friends weight %')}
   ${n('idealSleep','Ideal sleep hours')}${n('sleepPenalty','Sleep penalty per hour off')}${n('screenFree','Max screen hours for full score')}${n('screenPenalty','Screen penalty per extra hour')}
   <p id="wsum" class="muted"></p><button class="btn" id="saveSetup">💾 Save setup</button><button class="btn alt" id="resetParams">Reset parameters to defaults</button></div>
  <div class="card"><h3>⏰ Reminders</h3><label>Morning reminder</label><input id="r_morning" type="time" value="${S.reminders.morning}">
   <label>Evening reminder</label><input id="r_evening" type="time" value="${S.reminders.evening}">
   <button class="btn" id="icsBtn">📅 Add reminders to my calendar</button>
   <button class="btn alt" id="notifBtn">🔔 Also notify me while the app is open</button>
   <p class="muted">The calendar file adds 3 repeating events with alarms: a daily morning log, a Mon/Thu weigh-in, and a daily evening log. If you change the times, tap the button again and delete the old events in your calendar.</p></div>
  <div class="card"><h3>Backup & import</h3>
   <button class="btn" id="exportBtn">⬇️ Export backup (JSON)</button>
   <label>Restore backup (JSON) or import FightLog CSV</label><input type="file" id="importFile" accept=".json,.csv,application/json,text/csv">
   <p class="muted">CSV columns: Date, Nutrition, Training, Sleep_Hours, Screen_Hours, Family_Friends, [Sleep_Score, Screen_Score,] Weight, Notes. Existing dates are overwritten.</p>
   <button class="btn alt" id="wipeBtn" style="background:#5d1010">🗑️ Erase all data on this phone</button></div>`;
 },
 help() {
  return `<div class="card"><h3>How to use</h3>
  <p><b>Install:</b> open the link in Safari (iPhone: Share → Add to Home Screen) or Chrome (Android: menu → Install app). Works offline after first load.</p>
  <p><b>First week:</b> the score, weight trend and bonus unlock 7 days after you finish Setup. Only days since then count.</p>
  <p><b>Daily log (under 60 sec):</b> after training or before bed, tap Log. Nutrition = followed your plan (macros, timing, hydration). Training = completed the scheduled session (N if missed or partial). Sleep = hours slept last night. Screen = recreational screen time only (not film study or school). Family/Friends = real quality time without heavy screens.</p>
  <p><b>Reminders:</b> Setup → Reminders → pick times → <i>Add reminders to my calendar</i>. Your phone's calendar then alerts you every morning and evening, plus a Mon/Thu weigh-in alert, even when the app is closed. The app also shows a banner if today's morning or evening items aren't logged after those times. You can log the morning items first and add the evening ones later.</p>
  <p><b>Weight:</b> weigh Monday & Thursday mornings: fasted, after the bathroom, same scale, minimal clothing.</p>
  <p><b>Notes:</b> injuries, illness, soreness, bad sleep causes, low energy. These show up on the Coach Report.</p></div>
  <div class="card"><h3>Scoring</h3><p>Score 0–100 from the last 3 weeks of logs. Nutrition 30%, Training 30%, Sleep 20%, Screen 10%, Family 10%.</p>
  <p>• Nutrition / Training / Family = % of logged days marked Yes.<br>• Sleep: 100 at 8h, −25 per hour off (6h or 10h = 50).<br>• Screen: 100 if ≤2h, −40 per extra hour (3h = 60, 4h = 20).<br>
  • Consistency bonus: +5 if ≥90% of days had Nutrition AND Training = Yes, +3 if ≥75%, +1 if ≥60%. Capped at 100.<br>• 85+ Elite • 70+ Solid • below 70 Building.</p>
  <p><b>Weight trend</b> = average weight of the last 7 days minus the previous 7 days:<br>🔴 > +1.5 rapid gain • 🟠 +0.5 to +1.5 gaining • 🟡 −0.5 to +0.5 stable • 🟢 −0.5 to −1.5 good cut • 🔵 below −1.5 aggressive cut. A steady 0.75–1.5 lbs/week loss is ideal in the final 8–12 weeks.</p></div>
  <div class="card"><h3>Your data</h3><p>Everything stays on this phone only. Nothing is uploaded. Use Setup → Export backup regularly (e.g. weekly), and before you switch phones or clear browser data. Share the Coach Report as a PDF or text.</p></div>`;
 }
};
let cur = 'dash';
function show(v) { cur = v; $('#view').innerHTML = V[v](); document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  $('#title').textContent = 'Fight Readiness' + (S.fighter ? ' — ' + S.fighter : ''); window.scrollTo(0,0); }
function upsert(list) { list.forEach(e => { const i = S.entries.findIndex(x=>x.date===e.date); if (i>=0) S.entries[i]=e; else S.entries.push(e); }); S.entries.sort((a,b)=>a.date<b.date?-1:1); save(); }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text],{type})); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); }
function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).map(l => { const out=[]; let cur='', q=false; for (const ch of l) { if (ch=='"') q=!q; else if (ch==',' && !q) { out.push(cur); cur=''; } else cur+=ch; } out.push(cur); return out.map(s=>s.trim()); });
  const h = rows.shift().map(s=>s.toLowerCase()), col = re => h.findIndex(x=>re.test(x));
  const c = { d:col(/^date/), n:col(/^nutrition/), t:col(/^training/), sl:col(/^sleep_?hours|^sleep$/), sc:col(/^screen_?hours|^screen$/), f:col(/^family/), w:col(/^weight/), no:col(/^notes/) };
  if (c.d < 0) throw new Error('CSV needs a Date column');
  const YN = v => /^y/i.test(v||'') ? true : /^n/i.test(v||'') ? false : null, numv = v => v===''||v==null||isNaN(v) ? '' : +v;
  return rows.filter(r=>r[c.d]).map(r => { let d = r[c.d]; const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) d = `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) throw new Error('Bad date: '+d);
    return { date:d.slice(0,10), nutrition:YN(r[c.n]), training:YN(r[c.t]), sleep:numv(r[c.sl]), screen:numv(r[c.sc]), family:YN(r[c.f]), weight:numv(r[c.w]), notes:c.no>=0?r[c.no]||'':'' }; });
}
function shareText() { const r = res();
  if (r.locked) return `🥊 Fight Readiness: ${S.fighter||'Fighter'} (${today()})\n${lockMsg(r)}\nDays logged so far: ${r.daysLogged}`;
  return `🥊 Fight Readiness: ${S.fighter||'Fighter'} (${today()})\nScore: ${r.score}/100, ${r.verdict}\n` +
   CATS.map(([k,l])=>`${l}: ${r.cats[k].toFixed(0)}`).join(' | ') + `\nConsistency: ${r.consistency.toFixed(0)}% (+${r.bonus})\n` +
   `Weight: ${r.latestWeight?r.latestWeight.weight+' lbs':'—'}, trend ${r.delta==null?'—':r.delta+' lbs/wk'} ${r.trend.emoji}\nDays logged: ${r.daysLogged} (last 3 weeks)`; }

document.addEventListener('click', async ev => {
  const t = ev.target.closest('button,a'); if (!t) return;
  if (t.dataset.v) return show(t.dataset.v);
  if (t.dataset.goto) { ev.preventDefault(); V._date = null; return show(t.dataset.goto); }
  if (t.closest('.yn')) { const k = t.closest('.yn').dataset.k; V._e[k] = t.dataset.val==='1'; t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t)); return; }
  if (t.dataset.step) { const i = $('#f_'+t.dataset.step); i.value = Math.max(0, Math.min(24, (+i.value||0) + +t.dataset.d)); return; }
  if (t.dataset.edit) { ev.preventDefault(); V._date = t.dataset.edit; return show('log'); }
  const w = S.weeks[S.weekIdx];
  switch (t.id) {
    case 'saveLog': { const e = V._e; e.date = $('#f_date').value || today();
      ['sleep','screen','weight'].forEach(k => { const v = $('#f_'+k).value; e[k] = v===''?'':+v; }); e.notes = $('#f_notes').value.trim();
      if (e.nutrition==null && e.training==null && e.family==null && e.sleep==='' && e.screen==='' && e.weight==='' && !e.notes) return alert('Nothing to save yet.');
      upsert([e]); V._date = null; alert('Saved ✔ (you can come back later to fill the rest)'); return show('dash'); }
    case 'delLog': if (confirm('Delete this day?')) { S.entries = S.entries.filter(x=>x.date!==V._e.date); save(); V._date=null; show('log'); } return;
    case 'wkPrev': S.weekIdx = Math.max(0, S.weekIdx-1); save(); return show('plan');
    case 'wkNext': S.weekIdx = Math.min(S.weeks.length-1, S.weekIdx+1); save(); return show('plan');
    case 'wkDup': { const c = JSON.parse(JSON.stringify(w)); const d = new Date(w.start+'T12:00'); d.setDate(d.getDate()+7); c.start = Scoring.ymd(d); c.coachNotes=''; c.days.forEach(x=>x.notes='');
      S.weeks.splice(S.weekIdx+1, 0, c); S.weekIdx++; save(); return show('plan'); }
    case 'wkDel': if (S.weeks.length>1 && confirm('Delete this week?')) { S.weeks.splice(S.weekIdx,1); S.weekIdx=Math.max(0,S.weekIdx-1); save(); show('plan'); } else if (S.weeks.length===1) alert('Keep at least one week.'); return;
    case 'icsBtn': return addToCalendar();
    case 'notifBtn': if (!('Notification' in window)) return alert('Notifications are not supported here. Use the calendar reminders.');
      { const p = await Notification.requestPermission(); S.notify = p==='granted'; save(); alert(p==='granted'?'OK. You\'ll get a notification if the app is open at reminder time.':'Notifications are off. The calendar reminders still work.'); } return;
    case 'printBtn': return window.print();
    case 'shareBtn': { const txt = shareText();
      if (navigator.share) { try { await navigator.share({ title:'Fight Readiness Report', text:txt }); } catch (e) {} }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(txt); alert('Summary copied to clipboard.'); } else alert(txt); return; }
    case 'saveSetup': { S.fighter = $('#s_fighter').value.trim(); S.coach = $('#s_coach').value.trim(); S.targetWeight = $('#s_target').value; if (!S.startDate) S.startDate = today();
      document.querySelectorAll('[data-p]').forEach(i => { if (i.value!=='') S.params[i.dataset.p] = +i.value; });
      const sum = CATS.reduce((s,c)=>s+S.params[c[2]],0); save(); alert(sum===100?'Saved ✔':`Saved. Note: weights add up to ${sum}, not 100.`); return show('dash'); }
    case 'resetParams': S.params = Object.assign({}, Scoring.DEFAULT_PARAMS); save(); return show('setup');
    case 'exportBtn': return download(`fight-readiness-${(S.fighter||'fighter').replace(/\W+/g,'-')}-${today()}.json`, JSON.stringify(Object.assign({app:'fight-readiness',version:1,exported:new Date().toISOString()}, S), null, 1), 'application/json');
    case 'wipeBtn': if (confirm('Erase ALL data on this phone? Export a backup first!') && confirm('Really erase?')) { localStorage.removeItem(KEY); S = load(); show('setup'); } return;
  }
});
document.addEventListener('input', ev => { const t = ev.target, w = S.weeks[S.weekIdx];
  if (t.dataset.d !== undefined && t.dataset.k) { w.days[+t.dataset.d][t.dataset.k] = t.value; save(); }
  else if (t.id && t.id.startsWith('w_')) { w[t.id.slice(2)] = t.value; save(); }
});
document.addEventListener('change', async ev => { const t = ev.target;
  if (t.id === 'r_morning' || t.id === 'r_evening') { if (t.value) { S.reminders[t.id.slice(2)] = t.value; save(); } return; }
  if (t.id === 'wkSel') { S.weekIdx = +t.value; save(); return show('plan'); }
  if (t.id === 'w_start') return show('plan');
  if (t.id === 'f_date') { V._date = t.value; return show('log'); }
  if (t.id === 'importFile' && t.files[0]) { const text = await t.files[0].text();
    try { if (/\.json$/i.test(t.files[0].name) || text.trim().startsWith('{')) { const d = JSON.parse(text); if (!Array.isArray(d.entries)) throw new Error('Not a Fight Readiness backup');
        if (!confirm(`Restore backup for "${d.fighter||'fighter'}" with ${d.entries.length} days? This replaces data on this phone.`)) return;
        delete d.app; delete d.version; delete d.exported; S = Object.assign(load(), d); S.params = Object.assign({}, Scoring.DEFAULT_PARAMS, d.params); save(); alert('Restored ✔'); }
      else { const rows = parseCSV(text); upsert(rows); alert(`Imported ${rows.length} days ✔`); }
      show('dash'); } catch (e) { alert('Import failed: ' + e.message); } }
});
function addToCalendar() {
  const ics = Reminders.buildICS({ morning:S.reminders.morning, evening:S.reminders.evening, fighter:S.fighter, url: location.origin + location.pathname.replace(/[^/]*$/, '') });
  const name = 'fight-readiness-reminders.ics', ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if (ios) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; } // Safari opens the "Add to Calendar" sheet
  download(name, ics, 'text/calendar;charset=utf-8');
}
let lastNotified = {};
function reminderTick() {
  const d = Reminders.due(S.entries.find(e=>e.date===today()), new Date(), S.reminders.morning, S.reminders.evening);
  if (cur === 'dash' && d.length !== document.querySelectorAll('#view .hint a[data-goto]').length) show('dash');
  if (S.notify && 'Notification' in window && Notification.permission === 'granted') d.forEach(k => { const key = today()+k; if (!lastNotified[key]) { lastNotified[key] = 1;
    try { new Notification('Fight Readiness', { body: k==='morning' ? 'Morning log: sleep + nutrition' : 'Evening log: training, screen, family, notes', icon:'icons/icon-192.png' }); } catch (e) {} } });
}
setInterval(reminderTick, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) reminderTick(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
show(S.fighter ? 'dash' : 'setup');
