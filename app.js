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
function migrate(S) {
  if (S.params && S.params.wWellness == null) Object.assign(S.params, { wNutrition:25, wTraining:25, wSleep:15, wWellness:15, wScreen:10, wFamily:10 }); // v2: Wellness enters the score
  if (S.profile && !S.profile.schedule) S.profile.schedule = Profile.scheduleFromWeek(S.weeks[S.weekIdx||0]);
  return S; }
let S = migrate(load()); S.reminders = Object.assign({morning:'07:00', evening:'21:00'}, S.reminders);
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const $ = s => document.querySelector(s), esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => Scoring.ymd(new Date());
const res = () => Scoring.compute(S.entries, new Date(), Object.assign({}, S.params, {startDate:S.startDate||null}));
function reportHeader(r) { const p = S.profile || {}, cd = Profile.countdown(p.fightDate), lw = r.latestWeight, ws = Profile.weightStatus(lw && lw.weight, p.targetWeight);
  const cell = (l, v) => `<td><span class="muted">${l}</span><br><b>${esc(v||'—')}</b></td>`;
  return `<table class="hdr"><tr>${cell('Fighter', p.name + (p.nickname?' “'+p.nickname+'”':''))}${cell('Gym', p.gym)}${cell('Head coach', p.coach)}</tr>
   <tr>${cell('Weight class', p.weightClass)}${cell('Current / target', (lw?lw.weight:'—')+' / '+(p.targetWeight||'—')+' lbs'+(ws?' ('+ws.text+')':''))}${cell('Days to fight', cd?String(cd.days):'—')}</tr></table>`; }
function fightCard() { const p = S.profile || {}, lw = res().latestWeight, cd = Profile.countdown(p.fightDate), ws = Profile.weightStatus(lw && lw.weight, p.targetWeight);
  if (!cd && !ws) return '';
  return `<div class="card"><div class="row" style="margin:0">${cd?`<div><div class="muted">Fight date ${esc(p.fightDate)}</div><div style="font-size:1.8rem;font-weight:800">${cd.days===0?'🥊 Today':cd.days+' days'}</div><div class="muted">${cd.days?cd.weeks+'w '+cd.days%7+'d to go':'Fight day!'}</div></div>`:''}
   ${ws?`<div style="text-align:right"><div class="muted">Current → target</div><div style="font-size:1.4rem;font-weight:700">${ws.current} → ${ws.target}</div><div style="color:${ws.diff>0?'#ffb74d':'#81c784'}">${ws.text}</div></div>`:''}</div></div>`; }
const missingToday = e => Insights.missing(e);
function day1Banner(onLog) { if (!S.startDate || S.startDate !== today()) return '';
  const m = missingToday(S.entries.find(x=>x.date===today())); if (!m.length) return '';
  return `<div class="card hint" id="day1banner">🥊 <b>Day 1, let's finish today's log.</b> Still missing: ${m.join(', ')}.${onLog?'':' <a href="#" data-goto="log" style="color:#ffb74d">Log now →</a>'}</div>`; }
function streakCard() { const st = Insights.streak(S.entries), g = Insights.grid(S.entries);
  return `<div class="card"><div class="row" style="margin:0"><div><div class="muted">Logging streak</div><div style="font-size:1.8rem;font-weight:800">🔥 ${st.current} day${st.current==1?'':'s'}</div></div>
   <div style="text-align:right"><div class="muted">Best</div><b>${st.best}</b></div></div>
   <div class="grid" aria-label="Last 28 days">${g.map(x=>`<i class="${x.status}" title="${x.date}: ${x.status}"></i>`).join('')}</div>
   <p class="muted" style="margin:4px 0 0">Last 28 days: 🟥 full log • 🟧 partial • ⬛ none.${st.todayDone?' Today is done ✔':' Finish today to keep the streak.'}</p></div>`; }
function cutWarn(ws) { const c = Insights.cutSafety(S.entries, new Date(), S.profile||{}); let h = '';
  if (c.level) h += `<div class="hint ${c.level}">⚠️ ${esc(c.msg)}</div>`;
  const p = S.profile||{}, lw = res().latestWeight; h += planBox(lw ? lw.weight : p.startWeight, p.targetWeight, p.fightDate);
  return h; }
function planBox(cur, tgt, fd) { const c = Insights.cutPlan(cur, tgt, fd); if (!c) return '';
  if (c.level === 'ok') return `<p class="muted">🎯 Target plan: ${esc(c.msg)}</p>`;
  return `<div class="hint ${c.level}">${c.level==='warn'?'⛔ <b>Unsafe cut plan.</b>':'⚠️ <b>Tight cut plan.</b>'} ${esc(c.msg)}</div>`; }
const VCOL = { green:'#43a047', orange:'#fb8c00', red:'#e53935', grey:'#777' };
function verdictLine() { const v = Insights.weightVerdict(S.entries, S.profile||{});
  return `<p id="wverdict" style="margin:6px 0"><span style="display:inline-block;background:${VCOL[v.color]};color:#fff;font-weight:700;padding:3px 10px;border-radius:12px">${esc(v.word)}</span> ${esc(v.text)}</p>`; }
function fightWeekCard() { const p = S.profile||{}, fw = Insights.fightWeek(p.fightDate); if (!fw) return ''; const minor = p.dob && Profile.age(p.dob) < 18;
  return `<div class="card" id="fightWeek"><h3>🥊 Fight week: ${fw.daysToWeighIn===0?'weigh-in day':fw.daysToWeighIn+' day'+(fw.daysToWeighIn==1?'':'s')+' to weigh-in'}</h3>
   <div class="hint warn">⚠️ <b>General guidance, not medical advice.</b> Follow your coach and dietitian. <b>No saunas, sweat suits, diuretics, laxatives or fluid restriction for minors (under 18)${minor?' — that includes you':''}</b>, and never without supervision for anyone. If you're more than ~3% over on day −2, tell your coach. Don't try to cut it alone.</div>
   ${fw.days.map(d=>`<div class="fwday${d.today?' now':''}"><b>${d.offset===0?'Weigh-in':'Day '+d.offset}</b> <span class="muted">${d.date}${d.today?' • today':''}</span><br>🏋️ ${esc(d.train)}<br>💧 ${esc(d.water)}<br>🧂 ${esc(d.salt)}<br>🍚 ${esc(d.carbs)}</div>`).join('')}
   <p class="muted">Based on the ISSN 2025 combat-sports position stand: gradual descent, carbs ≥3 g/kg and protein 1.2–2 g/kg during the cut, oral rehydration 1–1.5 L/h and ≤60 g/h carbs after weigh-in.</p></div>`; }
function reviewCard() { const rv = Insights.weekReview(S.entries, new Date(), S.params, S.profile||{}); const li = a => a.map(x=>`<li>${esc(x)}</li>`).join('');
  return `<div class="card" id="review"><h3>📋 Weekly review (last 7 days)</h3><p><b>✅ What went well</b></p><ul>${li(rv.well)}</ul><p><b>❌ What was missed</b></p><ul>${rv.missed.length?li(rv.missed):'<li>Nothing major</li>'}</ul><p><b>🎯 Focus for next week</b></p><ul>${li(rv.focus)}</ul></div>`; }
function wellCard(report) { const w = Insights.wellness(S.entries), L = Insights.load(S.entries);
  if (!w.days && !L.sessions && !report) return '';
  const f = v => v==null?'—':v.toFixed(1);
  return `<div class="card"><h3>💚 Wellness & training load</h3><p class="muted">Wellness is ${S.params.wWellness}% of the score. Session load is for info only.</p>
   ${w.days?`<p>Wellness (last 7 days, 1–5, 5 = best): <b>${f(w.avg7)}</b>${w.avg28!=null?` <span class="muted">vs 4-week ${f(w.avg28)}</span>`:''}<br><span class="muted">${Insights.WELL.map(([k,l])=>l+' '+f(w.items[k])).join(' • ')}</span></p>`:'<p class="muted">No wellness check-ins in the last 7 days.</p>'}
   ${w.dropping?'<div class="hint">📉 Wellness is down compared with your normal. Consider lighter training and more sleep, and tell your coach.</div>':''}
   ${w.flags.length?`<div class="hint">🚩 Low ratings, last 3 days: ${w.flags.map(x=>esc(x.date.slice(5)+' '+x.item+' '+x.value)).join(', ')}</div>`:''}
   ${L.sessions?`<p>Session load this week: <b>${L.week}</b> AU from ${L.sessions} session${L.sessions==1?'':'s'} <span class="muted">(RPE × minutes)</span></p>${loadBars(L.weeks)}
   ${L.acwr!=null?`<p>Acute:chronic ratio: <b>${L.acwr}</b> ${L.flag==='spike'?'🔴 big jump in load. Higher injury risk, so ease up.':L.flag==='low'?'🔵 lighter than usual':'🟢 steady'}</p>`:'<p class="muted">Load ratio shows after 4 weeks of RPE logs.</p>'}`:'<p class="muted">No session RPE logged this week.</p>'}</div>`; }
function loadBars(wk) { const mx = Math.max(...wk, 1);
  return `<div class="row" style="align-items:flex-end;height:60px">${wk.map((v,i)=>`<div style="flex:1;text-align:center"><div style="background:${i==3?'#ff5252':'#555'};height:${Math.round(v/mx*44)}px;border-radius:3px"></div><span class="muted" style="font-size:.7rem">${i==3?'This wk':(3-i)+'w ago'}</span></div>`).join('')}</div>`; }
function tr7() { const es = S.entries.filter(e => Scoring.dayNum(e.date) > Scoring.dayNum(today())-7); let sch = 0, done = 0, extra = 0;
  es.forEach(e => { if (Array.isArray(e.sessions)) { sch += e.sessions.length; done += e.sessions.filter(x=>x.done===true).length; } else if (e.training != null) { sch++; if (e.training) done++; } if (e.extra && e.extra.label) extra++; });
  return `${done}/${sch} scheduled sessions done${extra?` + ${extra} extra`:''} • load ${Insights.load(S.entries).week} AU`; }
function weeklySummary() { const r = res(), st = Insights.streak(S.entries), w = Insights.wellness(S.entries), c = Insights.cutSafety(S.entries, new Date(), S.profile||{}), p = S.profile||{};
  const flags = [];
  const cp = Insights.cutPlan(r.latestWeight ? r.latestWeight.weight : p.startWeight, p.targetWeight, p.fightDate), vd = Insights.weightVerdict(S.entries, p);
  if (c.level) flags.push(`Weight loss ${-c.pctPerWeek}%/wk (${c.level})`); if (cp && cp.level !== 'ok') flags.push(`Target needs ${cp.perWeek} lbs/wk (${cp.pct}%), ${cp.short} lbs short at safe pace`);
  if (w.dropping) flags.push('Wellness below normal'); w.flags.forEach(f => flags.push(`Low ${f.item} ${f.value} on ${f.date.slice(5)}`));
  const notes = S.entries.filter(e => e.notes && Scoring.dayNum(e.date) >= Scoring.dayNum(today())-6).map(e => `${e.date.slice(5)}: ${e.notes}`);
  return `Fighter: ${p.name||S.fighter||'—'}${p.gym?' ('+p.gym+')':''}\nDate: ${today()}\nScore: ${r.locked?lockMsg(r):r.score+'/100 – '+r.verdict}\n` +
   `Streak: ${st.current} days (best ${st.best}) • Days logged (3 wks): ${r.daysLogged}\n` +
   `Training (7 days): ${tr7()} • Wellness (7 days, 1–5): ${w.avg7==null?'—':w.avg7.toFixed(1)}\n` +
   `Weight: ${r.latestWeight?r.latestWeight.weight+' lbs':'—'} • Trend: ${r.locked?'locked':(r.delta==null?'—':r.delta+' lbs/wk '+r.trend.emoji)} • Verdict: ${vd.word}\n` +
   Insights.reviewText(Insights.weekReview(S.entries, new Date(), S.params, p)) + '\n' +
   `Flags: ${flags.length?flags.join('; '):'none'}${notes.length?'\nNotes: '+notes.join(' | '):''}`; }
function weeklyCard() { const wk = Weekly.isDue(S.weeklySent||{}, new Date(), S.startDate); if (!wk) return '';
  return `<div class="card hint warn" id="weeklyCard">📧 <b>Weekly report due</b> (week ${Weekly.weekLabel(wk)}). Testing phase: please send it to ${Weekly.CONFIG.ADMIN_NAME}.<button class="btn" id="weeklyBtn">📤 Send weekly report to ${Weekly.CONFIG.ADMIN_NAME}</button></div>`; }
async function sendWeekly() { const wk = Weekly.pendingWeek(), name = (S.profile&&S.profile.name)||S.fighter||'Fighter';
  const subj = Weekly.subject(name, wk), sum = weeklySummary(), csv = Insights.toCSV(S.entries), to = Weekly.CONFIG.ADMIN_EMAIL;
  const mark = () => { S.weeklySent = Object.assign({}, S.weeklySent, {[wk]: new Date().toISOString()}); save(); show(cur); };
  try { const file = new File([csv], `fight-log-${name.replace(/\W+/g,'-')}-${wk}.csv`, { type:'text/csv' });
    if (navigator.canShare && navigator.canShare({ files:[file] })) {
      try { await navigator.share({ files:[file], title:subj, text:`To: ${to}\nSubject: ${subj}\n\n${sum}` }); mark(); }
      catch (e) { if (e.name !== 'AbortError') { location.href = Weekly.mailto(to, subj, sum, csv); mark(); } }
      return; } } catch (e) {}
  location.href = Weekly.mailto(to, subj, sum, csv); setTimeout(mark, 500); }
const lockMsg = r => `🔒 Trends unlock in ${r.unlockIn} day${r.unlockIn==1?'':'s'}. Keep logging!`;
const ynI = v => v===true?'✅':v===false?'❌':'—';
const todayRow = () => { const e = S.entries.find(x=>x.date===today()); return e ? `<p>Today: Nutrition ${ynI(e.nutrition)} • Training ${trainTxt(e)} • Sleep ${e.sleep===''?'—':e.sleep+'h'} • Screen ${e.screen===''?'—':e.screen+'h'} • Family ${ynI(e.family)}${+e.weight?' • '+e.weight+' lbs':''}</p>` : '<p class="muted">Nothing logged today yet.</p>'; };
const trainTxt = e => Array.isArray(e.sessions) ? (e.sessions.length ? e.sessions.filter(x=>x.done===true).length+'/'+e.sessions.length+(e.sessions.some(x=>x.done==null)?'…':'') : 'Rest')+(e.extra&&e.extra.label?' +extra':'') : e.training==null?'—':e.training?'Y':'N';
const CATS = [['nutrition','Nutrition','wNutrition'],['training','Training','wTraining'],['sleep','Sleep','wSleep'],['wellness','Wellness','wWellness'],['screen','Screen Time','wScreen'],['family','Family/Friends','wFamily']];

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
  return `${day1Banner(false)}${dueNow.map(k=>`<div class="card hint">⏰ ${k==='morning'?'Morning log not done: sleep hours, nutrition plan, how you feel (energy, soreness, mood, stress)'+([1,4].includes(new Date().getDay())?' + weigh-in before eating':''):'Evening log not done: each training session (effort + minutes), screen hours, family/friends, notes'}. <a href="#" data-goto="log" style="color:#ffb74d">Log now →</a></div>`).join('')}${weeklyCard()}${fightCard()}${fightWeekCard()}${streakCard()}
  ${isWeighDay?'<div class="card hint">⚖️ It\'s a weigh-in day (Mon/Thu). Weigh in this morning, fasted, and log it.</div>':''}
  ${r.locked?`<div class="card"><div class="muted" style="text-align:center">Fight Readiness Score</div><div class="big">🔒</div><p style="text-align:center"><b>${lockMsg(r)}</b></p><p class="muted" style="text-align:center">Days logged so far: ${r.daysLogged}</p>${todayRow()}</div>`:`
  <div class="card"><div class="muted" style="text-align:center">Fight Readiness Score</div><div class="big">${r.daysLogged?r.score:'—'}</div>
  <p style="text-align:center">${r.daysLogged?esc(r.verdict):'No entries in the last 3 weeks yet.'}</p>
  <p class="muted" style="text-align:center">Base ${r.base.toFixed(1)} + bonus ${r.bonus} • Data Quality: ${esc(r.dataQuality)} (${r.daysLogged} days logged)</p></div>
  <div class="card"><h3>Categories (last 3 weeks)</h3>${catTable(r)}
  <p>Core consistency (Nutrition + Training both Y): <b>${r.consistency.toFixed(0)}%</b> → ${r.bonus?'+'+r.bonus+' pts for daily discipline!':'Build streaks on both key plans'}</p>
  <p class="muted">Bonus: +5 at ≥90%, +3 at ≥75%, +1 at ≥60%.</p></div>`}
  <div class="card"><h3>🥊 Weight</h3>${verdictLine()}<p>Latest: <b>${lw?lw.weight+' lbs':'—'}</b> ${lw?'<span class="muted">('+lw.date+')</span>':''}${+S.targetWeight?` • Target ${esc(S.targetWeight)} lbs`:''}</p>
  ${r.locked?`<p>7-day trend: ${lockMsg(r)}</p>`:`<p>7-day trend: <b>${r.delta==null?'—':(r.delta>0?'+':'')+r.delta+' lbs/wk'}</b></p><p>${r.trend.emoji} ${esc(r.trend.label)}</p>`}${cutWarn()}${weightChart()}</div>${wellCard(false)}`;
 },
 log() {
  const d = V._date || today(), ex = S.entries.find(x=>x.date===d), e = JSON.parse(JSON.stringify(ex || {date:d, v:2, nutrition:null, training:null, family:null, sleep:'', screen:'', weight:'', notes:''}));
  const legacy = ex && !Array.isArray(ex.sessions) && ex.v !== 2;
  if (!legacy && !Array.isArray(e.sessions)) { e.sessions = Profile.sessionsFor(S.profile && S.profile.schedule, d) || []; e.v = 2; }
  const opt10 = (v) => `<option value="">—</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option ${+v===n?'selected':''}>${n}</option>`).join('')}`;
  const sessHTML = () => legacy ? yn('training','Training session completed?') : `<label>Training today</label>${e.sessions.length ? e.sessions.map((x,i)=>`<div class="sess"><p style="margin:8px 0 6px"><b>Did you complete session ${i+1}${x.label?' ('+esc(x.label)+')':''}?</b></p>
     <div class="yn" data-k="sess" data-i="${i}"><button class="y ${x.done===true?'on':''}" data-val="1">✅ Yes</button><button class="n ${x.done===false?'on':''}" data-val="0">❌ No</button></div>
     <div class="row sx" id="sx_${i}" style="${x.done===true?'':'display:none'}"><div style="flex:1"><label>Effort (RPE 1–10) *</label><select data-srpe="${i}">${opt10(x.rpe)}</select></div>
     <div style="flex:1"><label>Minutes *</label><input data-smin="${i}" type="number" inputmode="numeric" min="1" max="600" step="5" value="${esc(x.mins)}"></div></div></div>`).join('') : '<p class="hint">🛌 Rest day: training counts 100% when you rest.</p>'}
   <details class="opt" ${e.extra&&e.extra.label?'open':''}><summary>➕ Extra session (not on your schedule)</summary>
    <label for="f_xlabel">What was it?</label><input id="f_xlabel" maxlength="40" placeholder="e.g. Open mat" value="${esc(e.extra&&e.extra.label)}">
    <div class="row"><div style="flex:1"><label>Effort (RPE 1–10)</label><select id="f_xrpe">${opt10(e.extra&&e.extra.rpe)}</select></div><div style="flex:1"><label>Minutes</label><input id="f_xmin" type="number" inputmode="numeric" min="1" max="600" step="5" value="${esc(e.extra&&e.extra.mins)}"></div></div>
    <p class="muted">Logged and added to your load. Doesn't change the training %.</p></details>
   <p class="muted">RPE: 1 very easy, 3 moderate, 5 hard, 7 very hard, 10 max. Load = RPE × minutes.</p>`;
  const yn = (k,l) => `<label>${l}</label><div class="yn" data-k="${k}"><button class="y ${e[k]===true?'on':''}" data-val="1">✅ Yes</button><button class="n ${e[k]===false?'on':''}" data-val="0">❌ No</button></div>`;
  const step = (k,l,st) => `<label>${l}</label><div class="step"><button data-step="${k}" data-d="-${st}">−</button><input id="f_${k}" type="number" inputmode="decimal" step="${st}" min="0" max="24" value="${esc(e[k])}"><button data-step="${k}" data-d="${st}">+</button></div>`;
  const chips = (k, vals) => `<div class="chips">${vals.map(v=>`<button data-chip="${k}" data-val="${v}" class="${+e[k]===v&&e[k]!==''?'on':''}">${v}h</button>`).join('')}</div>`;
  const wd = [1,4].includes(new Date(d+'T12:00').getDay());
  V._e = Object.assign({}, e);
  return `${d===today()?day1Banner(true):''}<div class="card"><label>Date</label><input id="f_date" type="date" value="${d}" max="${today()}">
  ${yn('nutrition','Nutrition plan followed?')}${sessHTML()}
  ${step('sleep','Sleep last night (hours)',0.5)}${chips('sleep',[6,7,7.5,8,8.5,9])}${step('screen','Recreational screen time (hours)',0.5)}${chips('screen',[0,1,2,3,4])}
  ${yn('family','Quality time with family/friends?')}
  <h3 style="margin:18px 0 0">How do you feel today? *</h3>
  ${Insights.WELL.map(([k,l,lo,hi])=>`<label>${l} <span class="muted">(${lo} … ${hi})</span></label><div class="sc" data-k="${k}">${[1,2,3,4,5].map(n=>`<button class="${+e[k]===n?'on':''}" data-val="${n}">${n}</button>`).join('')}</div>`).join('')}
  <label>Weight (lbs) ${wd?'<span style="color:#ff9800">— weigh-in day! ⚖️</span>':'<span class="muted">(Mon/Thu mornings)</span>'}</label>
  <input id="f_weight" type="number" inputmode="decimal" step="0.1" value="${esc(e.weight)}">
  <label>Notes (injuries, illness, soreness, energy, mood)</label><textarea id="f_notes" rows="3">${esc(e.notes)}</textarea>
  <button class="btn" id="saveLog">💾 Save day</button>
  ${S.entries.some(x=>x.date===d)?'<button class="btn alt" id="delLog">Delete this day</button>':''}</div>
  <div class="card"><h3>Recent entries</h3><table><tr><th>Date</th><th>N</th><th>T</th><th>Sl</th><th>Sc</th><th>F</th><th>Wt</th><th>✓</th></tr>
  ${S.entries.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,V._all?1e9:21).map(x=>`<tr data-date="${x.date}"><td><a href="#" data-edit="${x.date}">${x.date.slice(5)}</a></td><td>${x.nutrition==null?'—':x.nutrition?'Y':'N'}</td><td>${trainTxt(x)}</td><td>${x.sleep??''}</td><td>${x.screen??''}</td><td>${x.family==null?'—':x.family?'Y':'N'}</td><td>${x.weight||''}</td><td>${Insights.isComplete(x)?'✅':'…'}</td></tr>`).join('')}</table>
  <p class="muted">Tap a date to view or edit that day.</p>${S.entries.length>21&&!V._all?`<button class="btn alt" id="showAll">Show all ${S.entries.length} days</button>`:''}</div>`;
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
  ${reportHeader(r)}<p class="muted">Report date: ${today()} • Data period: last 3 weeks (${r.daysLogged} days logged)</p></div>
  ${r.locked?`<div class="card"><p style="text-align:center"><b>${lockMsg(r)}</b><br>Days logged so far: ${r.daysLogged}</p>${todayRow()}</div>`:`<div class="card"><div class="big">${r.score}</div><p style="text-align:center">${esc(r.verdict)}</p></div>`}
  <div class="card"><h3>Weight & trend</h3>${verdictLine()}<p>Latest: ${r.latestWeight?r.latestWeight.weight+' lbs ('+r.latestWeight.date+')':'—'}${+S.targetWeight?' • Target: '+esc(S.targetWeight)+' lbs':''}<br>
   7-day trend: ${r.locked?lockMsg(r):(r.delta==null?'—':r.delta+' lbs/wk')+' '+r.trend.emoji+' '+esc(r.trend.label)}</p>${cutWarn()}${weightChart()}</div>
  ${reviewCard()}${fightWeekCard()}
  <div class="card"><h3>Training</h3><p>Last 7 days: <b>${tr7()}</b></p></div>
  <div class="card"><h3>Logging</h3><p>Current streak: <b>${Insights.streak(S.entries).current} days</b> (best ${Insights.streak(S.entries).best}) • Full logs in last 28 days: <b>${Insights.grid(S.entries).filter(x=>x.status==='done').length}/28</b></p></div>
  ${wellCard(true)}
  <div class="card"><h3>Category performance</h3><table><tr><th>Category</th><th>Score</th><th>Weight</th><th>Contribution</th></tr>
   ${CATS.map(([k,l,w])=>`<tr><td>${l}</td><td>${r.cats[k].toFixed(0)}</td><td>${S.params[w]}%</td><td>${(r.cats[k]*S.params[w]/100).toFixed(1)}</td></tr>`).join('')}
   ${r.locked?`<tr><td colspan="4">Base score & consistency bonus: ${lockMsg(r)}</td></tr>`:`<tr><th>Base score</th><td></td><td></td><th>${r.base.toFixed(1)}</th></tr><tr><td>Consistency bonus</td><td>${r.consistency.toFixed(0)}%</td><td></td><td>+${r.bonus}</td></tr>`}</table></div>
  <div class="card"><h3>Recent injury / illness notes (last 14 days)</h3>${notes.length?notes.slice(0,6).map(n=>`<p><b>${n.date}:</b> ${esc(n.notes)}</p>`).join(''):'<p>No notes logged in the last 14 days.</p>'}</div>
  <div class="card noprint"><button class="btn" id="printBtn">🖨️ Print / Save as PDF</button><button class="btn alt" id="shareBtn">📤 Share text summary</button><button class="btn alt" id="csvBtn">📊 Export log as CSV (for coach / Excel)</button><button class="btn alt" data-send="1">📧 Send report to ${Weekly.CONFIG.ADMIN_NAME}</button></div>`;
 },
 profile() {
  const p = S.profile || {}, first = !S.profile, er = V._perr || {}, v = k => esc(V._pdraft ? V._pdraft[k] : p[k]);
  const fld = (k, l, attrs='', req=false) => `<label for="p_${k}">${l}${req?' *':''}</label><input id="p_${k}" ${attrs} value="${v(k)}">${er[k]?`<p class="err">${esc(er[k])}</p>`:''}`;
  const sel = (k, l, opts) => `<label for="p_${k}">${l}</label><select id="p_${k}"><option value="">—</option>${opts.map(o=>`<option ${(V._pdraft?V._pdraft[k]:p[k])===o?'selected':''}>${o}</option>`).join('')}</select>${er[k]?`<p class="err">${esc(er[k])}</p>`:''}`;
  const num = 'type="number" inputmode="decimal" step="0.1" min="60" max="400"';
  return `${first?'<div class="card"><h2 style="margin:0">🥊 Welcome! Sign up</h2><p class="muted">Set up your fighter profile. It stays on this phone only and is included in your backups. You can edit it later in Setup.</p></div><div class="card hint" id="day1note">📅 <b>Your sign-up day is Day 1 of tracking.</b> After you sign up, finish today&#39;s log tonight: nutrition, each training session (with effort + minutes), sleep, how you feel (energy, soreness, mood, stress), screen time, and family/friends. Trends unlock after 7 days.</div>':'<div class="card"><h2 style="margin:0">Fighter profile</h2></div>'}
  ${Object.keys(er).length?'<div class="card hint">Please fix the highlighted fields.</div>':''}
  <div class="card"><h3>Fighter</h3>${fld('name','Fighter name','autocomplete="name" maxlength="60" required',true)}${fld('nickname','Nickname','maxlength="40"')}
   ${fld('dob','Date of birth','type="date" max="'+today()+'"')}${p.dob&&!V._pdraft?`<p class="muted">Age ${Profile.age(p.dob)}</p>`:''}
   ${sel('discipline','Discipline focus',Profile.DISCIPLINES)}</div>
  <div class="card"><h3>Team</h3>${fld('gym','Gym name','maxlength="60"')}${fld('coach','Head coach','maxlength="60"')}${Weekly.CONFIG.SHOW_COACH_CONTACT?fld('coachContact','Coach email or phone','type="text" inputmode="email" maxlength="80"'):''}</div>
  <div class="card"><h3>Weight & fight</h3>${sel('weightClass','Weight class',Profile.WEIGHT_CLASSES)}
   ${fld('startWeight','Starting weight (lbs)',num+(first?'':' disabled'))}${first?'<p class="muted">Saved as your first weigh-in.</p>':''}
   ${fld('targetWeight','Target weight (lbs)',num)}${fld('fightDate','Fight date (optional)','type="date" min="'+today()+'"')}<div id="cutBox"></div></div>
  <div class="card" id="schedCard"><h3>🗓️ Training schedule</h3><p class="muted">Your usual week. The daily log asks about each session. Training score = % of scheduled sessions done (rest days count 100%).</p>
   <label>Do you train once or twice a day?</label><div class="sc" id="perDay"><button data-perday="1">Once</button><button data-perday="2">Twice</button></div>
   ${Profile.DAYS.map((dn,i)=>`<div class="sday"><label>${dn}</label><div class="sc">${['Rest','1 session','2 sessions'].map((l,n)=>`<button data-sd="${i}" data-n="${n}">${l}</button>`).join('')}</div>
    <div class="row" style="margin:6px 0 0"><input data-sl="${i}-0" placeholder="Session 1 label (e.g. Wrestling)" maxlength="40"><input data-sl="${i}-1" placeholder="Session 2 label (e.g. Strength)" maxlength="40"></div></div>`).join('')}</div>
  <div class="card"><h3>Safety</h3>${fld('emName','Emergency contact name','maxlength="60"')}${fld('emPhone','Emergency contact phone','type="tel" inputmode="tel" maxlength="30"')}
   <label for="p_medical">Injuries / allergies / medical notes</label><textarea id="p_medical" rows="3" maxlength="500">${v('medical')}</textarea>
   <button class="btn" id="saveProfile">${first?'✅ Create profile':'💾 Save profile'}</button>${first?'':'<button class="btn alt" data-v="setup">Cancel</button>'}</div>`;
 },
 setup() {
  const p = S.params, n = (k,l) => `<label>${l}</label><input data-p="${k}" type="number" step="any" value="${p[k]}">`;
  const pr = S.profile || {};
  return `<div class="card"><h3>Fighter profile</h3><p><b>${esc(pr.name||'—')}</b>${pr.nickname?' “'+esc(pr.nickname)+'”':''}<br><span class="muted">${[pr.gym,pr.coach&&'Coach '+pr.coach,pr.weightClass,pr.discipline].filter(Boolean).map(esc).join(' • ')||'No details yet'}</span></p>
   <p class="muted">Schedule: ${pr.schedule?Profile.DAYS.map((dn,i)=>dn.slice(0,3)+' '+(pr.schedule.days[i].n?pr.schedule.days[i].n+'×':'rest')).join(' • '):'—'}</p>
   <button class="btn" data-v="profile">✏️ Edit profile & training schedule</button></div>
  <div class="card"><h3>Scoring parameters</h3><p class="muted">Category weights must add up to 100 (default: Nutrition 25, Training 25, Sleep 15, Wellness 15, Screen 10, Family 10).${S.startDate?' App start date: '+S.startDate+'.':''}</p>
   ${n('wNutrition','Nutrition weight %')}${n('wTraining','Training weight %')}${n('wSleep','Sleep weight %')}${n('wWellness','Wellness weight %')}${n('wScreen','Screen weight %')}${n('wFamily','Family/Friends weight %')}
   ${n('idealSleep','Ideal sleep hours')}${n('sleepPenalty','Sleep penalty per hour off')}${n('screenFree','Max screen hours for full score')}${n('screenPenalty','Screen penalty per extra hour')}
   <p id="wsum" class="muted"></p><button class="btn" id="saveSetup">💾 Save setup</button><button class="btn alt" id="resetParams">Reset parameters to defaults</button></div>
  <div class="card" id="remCard"><h3>⏰ Reminders</h3>
   <label for="r_morning">Morning reminder</label><select id="r_morning">${Reminders.MORNING_TIMES.map(t=>`<option ${t===Reminders.nearest(S.reminders.morning,Reminders.MORNING_TIMES)?'selected':''}>${t}</option>`).join('')}</select>
   <label for="r_evening">Evening reminder</label><select id="r_evening">${Reminders.EVENING_TIMES.map(t=>`<option ${t===Reminders.nearest(S.reminders.evening,Reminders.EVENING_TIMES)?'selected':''}>${t}</option>`).join('')}</select>
   <div id="pushBox">${pushBox()}</div>
   <p class="muted" style="margin-top:12px"><b>Or use calendar reminders</b> (backup option):</p>
   <a class="btn alt" id="calLink" href="${calURL()}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">📅 Add reminders to my calendar</a>
   <div class="hint" style="margin-top:10px"><b>iPhone:</b> tap the button above. Safari opens a calendar preview with 4 events. Tap <b>Add All</b> (top right), pick your calendar, then come back to the app.<br><b>Android:</b> open the downloaded file and choose your Calendar app to import it.</div>
   <a class="btn alt" id="calSub" href="${calURL().replace(/^https?:/,'webcal:')}" style="text-align:center;text-decoration:none">🔁 Or subscribe (webcal)</a>
   <p class="muted">Subscribe also works. On iPhone, open Settings → Calendar → Accounts → Subscribed Calendars → Fight Readiness and turn <b>off</b> "Remove Alerts", or the alarms won't ring.</p>
   <button class="btn alt" id="icsShare">📤 Share / save the calendar file</button>
   <p class="muted">The calendar file adds 4 repeating events with alarms: a daily morning log, a Mon/Thu weigh-in, a daily evening log, and a Sunday 6 PM reminder to send the weekly report to ${Weekly.CONFIG.ADMIN_NAME}. <b>Already added reminders before? Tap the button again to get the new Sunday reminder</b> (delete the old duplicates in your calendar). If you change the times, tap the button again and delete the old events in your calendar.</p></div>
  <div class="card"><h3>Backup & import</h3>
   <button class="btn" id="exportBtn">⬇️ Export backup (JSON)</button><button class="btn alt" id="csvBtn">📊 Export log as CSV (Excel / Google Sheets)</button><button class="btn alt" data-send="1">📧 Send report to ${Weekly.CONFIG.ADMIN_NAME}</button>
   <label>Restore backup (JSON) or import FightLog CSV</label><input type="file" id="importFile" accept=".json,.csv,application/json,text/csv">
   <p class="muted">CSV columns: Date, Nutrition, Training, Sleep_Hours, Screen_Hours, Family_Friends, [Sleep_Score, Screen_Score,] Weight, Notes, plus optional Energy, Soreness, Mood, Stress, RPE, Session_Min. Existing dates are overwritten.</p>
   <button class="btn alt" id="wipeBtn" style="background:#5d1010">🗑️ Erase all data on this phone</button></div>`;
 },
 help() {
  return `<div class="card"><h3>How to use</h3>
  <p><b>Install:</b> open the link in Safari (iPhone: Share → Add to Home Screen) or Chrome (Android: menu → Install app). Works offline after first load.</p>
  <p><b>First week:</b> the score, weight trend and bonus unlock 7 days after you finish Setup. Only days since then count.</p>
  <p><b>Day 1:</b> your sign-up day is Day 1. Finish that day's log that night. Trends unlock after 7 days.</p>
  <p><b>Profile:</b> on first open, sign up with your name (required) and optional team, weight, fight date and safety details. Edit it anytime in Setup → Edit profile. Your starting weight becomes your first weigh-in. The Dashboard shows your fight countdown and lbs to go.</p>
  <p><b>Daily log (about 30 sec):</b> tap Log. Nutrition = followed your plan (macros, timing, hydration). <b>Training:</b> for each session on your schedule today, answer "Did you complete session N?" and, if yes, its effort (RPE 1–10) and minutes (both required). Rest days need nothing. Add an unscheduled extra session if you did one. Sleep = hours slept last night. Screen = recreational screen time only (not film study or school). Family/Friends = real quality time without heavy screens. <b>How you feel</b> (required daily, 1–5): Energy (5 = fresh), Soreness (5 = no soreness), Mood (5 = great), Stress (5 = no stress).</p>
  <p><b>Training schedule:</b> set at sign-up (once or twice a day, then Rest / 1 / 2 sessions per weekday with optional labels). Edit it in Setup → Edit profile & training schedule. Saving it updates this week's and future Weekly Outlines.</p>
  <p><b>Reminders:</b> Setup → Reminders → pick a morning (5:00–10:00) and evening (18:00–23:00) time in 30-min steps → tap <i>Add reminders to my calendar</i>. <b>On iPhone</b> Safari opens a calendar preview: tap <b>Add All</b>. This works from the home-screen app too. You get a daily morning and evening alarm, a Mon/Thu weigh-in, and a Sunday 6 PM weekly-report reminder, even when the app is closed. Alternatives: <i>Subscribe (webcal)</i> (then turn off "Remove Alerts" in Settings → Calendar → Accounts → Subscribed Calendars) or <i>Share / save the calendar file</i>. The app also shows a banner if today's morning or evening items aren't logged after those times.</p>
  <p><b>Weight:</b> weigh Monday & Thursday mornings: fasted, after the bathroom, same scale, minimal clothing.</p>
  <p><b>Streak:</b> 🔥 counts days in a row with a full log (nutrition, every scheduled session with effort + minutes, sleep, screen, family, and all 4 wellness ratings). Today not done yet doesn't break it. Miss a whole day and it resets.</p>
  <p><b>How you feel (Hooper-style check-in):</b> four quick 1–5 ratings modelled on the Hooper Index used by pro teams: fatigue/energy, muscle soreness, stress and mood (5 = best). Sleep is logged separately as hours. It's 15% of the score.</p>
  <p><b>Weight verdict:</b> the Dashboard shows one line every day. 🟢 <b>On track</b> = losing at roughly the pace you need, within the safe ~1%/week. 🔴 <b>Too fast</b> = losing more than 1.5%/week. 🟠 <b>Too slow</b> = well under the pace you need. ⚪ <b>No target</b> = set a target weight in your profile.</p>
  <p><b>Impossible-cut check:</b> with a target weight and fight date set, the app works out the weekly loss needed. Over 1%/week of bodyweight shows a caution and over 1.5% says the plan is unsafe. It shows the weight a safe pace reaches by fight day and how far short that is, so you can talk to your coach about a higher weight class or a later date.</p>
  <p><b>Fight week:</b> in the last 7 days before your fight date (used as weigh-in day) the Dashboard and Report show a day-by-day card covering taper, water, salt and carbs. It's general, conservative guidance based on the ISSN 2025 combat-sports position stand, not medical advice. Follow your coach and dietitian. No saunas, diuretics or fluid restriction for minors.</p>
  <p><b>Weekly review:</b> the Coach Report, weekly email and share text include an automatic "What went well / What was missed / Focus for next week" from your last 7 days (best and worst categories, missed sessions, 🚩 flags, weight verdict).</p>
  <p><b>Wellness & load:</b> wellness ratings of 1–2 get a 🚩 flag for your coach, and a drop below your normal is highlighted. Session load = RPE × minutes summed over all sessions (two-a-days add up). It's shown on the Dashboard and Coach Report and doesn't change the score.</p>
  <p><b>Safe weight cut:</b> the app warns if you lose more than 1%/week of bodyweight (caution) or 1.5%/week (warning), or if your target and fight date would need a faster pace. Sports-nutrition guidance for combat sports is a gradual ~0.5–1 kg (1–2 lbs) per week. Never cut by skipping meals or dehydrating without coach supervision.</p>
  <p><b>Weekly report (testing phase):</b> every Sunday (and on the first open after, until it's sent) the Score screen shows a <i>Send weekly report to ${Weekly.CONFIG.ADMIN_NAME}</i> card. Tap it, pick <b>Mail</b>, check the To address is ${Weekly.CONFIG.ADMIN_EMAIL}, and tap Send. It attaches your log as a CSV plus a short summary (name, score, streak, weight trend, flags). If your phone can't share files, it opens a pre-filled email instead. You can send anytime from Setup or Report → <i>Send report to ${Weekly.CONFIG.ADMIN_NAME}</i>. A calendar reminder fires Sundays at 6 PM.</p>
  <p><b>Notes:</b> injuries, illness, soreness, bad sleep causes, low energy. These show up on the Coach Report.</p></div>
  <div class="card"><h3>Scoring</h3><p>Score 0–100 from the last 3 weeks of logs. Nutrition 25%, Training 25%, Sleep 15%, Wellness 15%, Screen 10%, Family 10% (editable in Setup, must add up to 100).</p>
  <p>• Nutrition / Family = % of logged days marked Yes.<br>• Training = average daily % of scheduled sessions completed (rest day = 100%; older days: Yes = 100).<br>• Wellness = average of Energy, Soreness, Mood, Stress mapped 1→0, 2→25, 3→50, 4→75, 5→100 (days with all 4 rated).<br>• Sleep: 100 at 8h, −25 per hour off (6h or 10h = 50).<br>• Screen: 100 if ≤2h, −40 per extra hour (3h = 60, 4h = 20).<br>
  • Consistency bonus: +5 if ≥90% of days had Nutrition = Yes AND all scheduled sessions done, +3 if ≥75%, +1 if ≥60%. Capped at 100.<br>• 85+ Elite • 70+ Solid • below 70 Building.</p>
  <p><b>Weight trend</b> = average weight of the last 7 days minus the previous 7 days:<br>🔴 > +1.5 rapid gain • 🟠 +0.5 to +1.5 gaining • 🟡 −0.5 to +0.5 stable • 🟢 −0.5 to −1.5 good cut • 🔵 below −1.5 aggressive cut. A steady 0.75–1.5 lbs/week loss is ideal in the final 8–12 weeks.</p></div>
  <div class="card"><h3>Your data</h3><p>Everything stays on this phone only. Nothing is uploaded. Use Setup → Export backup regularly (e.g. weekly), and before you switch phones or clear browser data. Share the Coach Report as a PDF or text.</p></div>`;
 }
};
let cur = 'dash';
function refreshCut() { const b = $('#cutBox'); if (!b) return; const lw = res().latestWeight, sw = $('#p_startWeight');
  b.innerHTML = planBox(lw ? lw.weight : sw && sw.value, $('#p_targetWeight').value, $('#p_fightDate').value); }
function refreshSched() { const sc = V._sched; if (!sc || !$('#schedCard')) return;
  document.querySelectorAll('#perDay button').forEach(b => b.classList.toggle('on', +b.dataset.perday === sc.perDay));
  sc.days.forEach((d,i) => { document.querySelectorAll(`[data-sd="${i}"]`).forEach(b => b.classList.toggle('on', +b.dataset.n === d.n));
    [0,1].forEach(j => { const inp = document.querySelector(`[data-sl="${i}-${j}"]`); inp.value = d.labels[j] || ''; inp.style.display = d.n > j ? '' : 'none'; }); }); }
function show(v) { if (!S.profile && v !== 'help') v = 'profile';
  if (v === 'profile' && !V._sched) V._sched = JSON.parse(JSON.stringify((S.profile && S.profile.schedule) || Profile.scheduleFromWeek(S.weeks[S.weekIdx])));
  if (v !== 'profile') V._sched = null; cur = v; $('#view').innerHTML = V[v](); document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.v===(v==='profile'?'setup':v)));
  $('#title').textContent = 'Fight Readiness' + (S.fighter ? ' — ' + S.fighter : ''); if (v === 'profile') { refreshSched(); refreshCut(); } window.scrollTo(0,0); }
function upsert(list) { list.forEach(e => { const i = S.entries.findIndex(x=>x.date===e.date); if (i>=0) S.entries[i]=e; else S.entries.push(e); }); S.entries.sort((a,b)=>a.date<b.date?-1:1); save(); }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text],{type})); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); }
function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).map(l => { const out=[]; let cur='', q=false; for (const ch of l) { if (ch=='"') q=!q; else if (ch==',' && !q) { out.push(cur); cur=''; } else cur+=ch; } out.push(cur); return out.map(s=>s.trim()); });
  const h = rows.shift().map(s=>s.toLowerCase()), col = re => h.findIndex(x=>re.test(x));
  const c = { d:col(/^date/), n:col(/^nutrition/), t:col(/^training/), sl:col(/^sleep_?hours|^sleep$/), sc:col(/^screen_?hours|^screen$/), f:col(/^family/), w:col(/^weight/), no:col(/^notes/), en:col(/^energy/), so:col(/^soreness/), mo:col(/^mood/), stx:col(/^stress/), rp:col(/^rpe/), mi:col(/^session_?min/), s1l:col(/^s1_label/), s1d:col(/^s1_done/), s1r:col(/^s1_rpe/), s1m:col(/^s1_min/), s2l:col(/^s2_label/), s2d:col(/^s2_done/), s2r:col(/^s2_rpe/), s2m:col(/^s2_min/), ss:col(/^sessions_scheduled/), xl:col(/^extra_label/), xr:col(/^extra_rpe/), xm:col(/^extra_min/) };
  if (c.d < 0) throw new Error('CSV needs a Date column');
  const YN = v => /^y/i.test(v||'') ? true : /^n/i.test(v||'') ? false : null, numv = v => v===''||v==null||isNaN(v) ? '' : +v;
  return rows.filter(r=>r[c.d]).map(r => { let d = r[c.d]; const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) d = `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) throw new Error('Bad date: '+d);
    const g = j => c[j]>=0 ? r[c[j]] : '', o = { date:d.slice(0,10), nutrition:YN(r[c.n]), training:YN(r[c.t]), sleep:numv(r[c.sl]), screen:numv(r[c.sc]), family:YN(r[c.f]), weight:numv(r[c.w]), notes:c.no>=0?r[c.no]||'':'', ...Object.fromEntries([['energy','en'],['soreness','so'],['mood','mo'],['stress','stx'],['rpe','rp'],['mins','mi']].filter(([,j])=>c[j]>=0&&numv(r[c[j]])!=='').map(([k,j])=>[k,numv(r[c[j]])])) };
    if (c.ss>=0 && g('ss')!=='') { const n = +g('ss'); o.v = 2; o.sessions = [['s1l','s1d','s1r','s1m'],['s2l','s2d','s2r','s2m']].slice(0,n).map(([l,dd,rr,mm]) => ({ label:g(l), done:YN(g(dd)), rpe:numv(g(rr)), mins:numv(g(mm)) }));
      o.training = o.sessions.some(x=>x.done==null) ? null : Scoring.trainingPct(o) === 100; delete o.rpe; delete o.mins; }
    if (g('xl') || g('xr')) o.extra = { label:g('xl')||'Extra session', rpe:numv(g('xr')), mins:numv(g('xm')) };
    return o; });
}
function shareText() { const r = res();
  if (r.locked) return `🥊 Fight Readiness: ${S.fighter||'Fighter'} (${today()})\n${lockMsg(r)}\nDays logged so far: ${r.daysLogged}`;
  return `🥊 Fight Readiness: ${S.fighter||'Fighter'} (${today()})${S.profile&&S.profile.gym?' • '+S.profile.gym:''}${S.profile&&Profile.countdown(S.profile.fightDate)?'\n'+Profile.countdown(S.profile.fightDate).text:''}\nScore: ${r.score}/100, ${r.verdict}\n` +
   CATS.map(([k,l])=>`${l}: ${r.cats[k].toFixed(0)}`).join(' | ') + `\nConsistency: ${r.consistency.toFixed(0)}% (+${r.bonus})\n` +
   `Weight: ${r.latestWeight?r.latestWeight.weight+' lbs':'—'}, trend ${r.delta==null?'—':r.delta+' lbs/wk'} ${r.trend.emoji}\nWeight verdict: ${Insights.weightVerdict(S.entries, S.profile||{}).word}\nTraining (7 days): ${tr7()}\n${Insights.reviewText(Insights.weekReview(S.entries, new Date(), S.params, S.profile||{}))}\nDays logged: ${r.daysLogged} (last 3 weeks) • Streak: ${Insights.streak(S.entries).current} days`; }

document.addEventListener('click', async ev => {
  const t = ev.target.closest('button,a'); if (!t) return;
  if (t.dataset.v) return show(t.dataset.v);
  if (t.dataset.goto) { ev.preventDefault(); V._date = null; return show(t.dataset.goto); }
  if (t.closest('.yn') && t.closest('.yn').dataset.k === 'sess') { const i = +t.closest('.yn').dataset.i, on = t.dataset.val==='1'; V._e.sessions[i].done = on;
    t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t)); $('#sx_'+i).style.display = on ? '' : 'none'; return; }
  if (t.dataset.sd != null) { const i = +t.dataset.sd, n = +t.dataset.n, sd = V._sched.days[i]; sd.n = n; refreshSched(); return; }
  if (t.dataset.perday) { V._sched.perDay = +t.dataset.perday; V._sched.days.forEach(d => { if (d.n) d.n = V._sched.perDay; }); refreshSched(); return; }
  if (t.closest('.yn')) { const k = t.closest('.yn').dataset.k; V._e[k] = t.dataset.val==='1'; t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t)); return; }
  if (t.closest('.sc')) { const k = t.closest('.sc').dataset.k, n = +t.dataset.val; V._e[k] = V._e[k]===n ? '' : n; t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t && V._e[k]!=='')); return; }
  if (t.dataset.chip) { $('#f_'+t.dataset.chip).value = t.dataset.val; t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t)); return; }
  if (t.dataset.step) { const i = $('#f_'+t.dataset.step); i.value = Math.max(0, Math.min(24, (+i.value||0) + +t.dataset.d)); return; }
  if (t.dataset.edit) { ev.preventDefault(); V._date = t.dataset.edit; return show('log'); }
  if (t.dataset.send || t.id === 'weeklyBtn') return sendWeekly();
  const w = S.weeks[S.weekIdx];
  switch (t.id) {
    case 'saveLog': { const e = V._e; e.date = $('#f_date').value || today();
      ['sleep','screen','weight'].forEach(k => { const v = $('#f_'+k).value; e[k] = v===''?'':+v; }); e.notes = $('#f_notes').value.trim();
      if (Array.isArray(e.sessions)) { e.v = 2;
        e.sessions.forEach((x,i) => { const r = document.querySelector(`[data-srpe="${i}"]`).value, m = document.querySelector(`[data-smin="${i}"]`).value; x.rpe = r===''?'':+r; x.mins = m===''?'':+m; if (x.done !== true) { x.rpe = ''; x.mins = ''; } });
        const bad = e.sessions.findIndex(x => x.done === true && !(x.rpe > 0 && x.mins > 0)); if (bad >= 0) return alert(`Session ${bad+1}: add effort (RPE) and minutes.`);
        const xl = $('#f_xlabel').value.trim(), xr = $('#f_xrpe').value, xm = $('#f_xmin').value;
        e.extra = xl || xr || xm ? { label: xl || 'Extra session', rpe: xr===''?'':+xr, mins: xm===''?'':+xm } : null;
        e.training = e.sessions.some(x => x.done == null) ? null : Scoring.trainingPct(e) === 100; }
      if (e.nutrition==null && e.training==null && e.family==null && e.sleep==='' && e.screen==='' && e.weight==='' && !e.notes && !Insights.dayWellness(e) && !(e.sessions||[]).some(x=>x.done!=null) && !e.extra) return alert('Nothing to save yet.');
      upsert([e]); V._date = null; const left = e.date===today() ? missingToday(e) : [];
      alert(left.length ? 'Saved ✔ Still to log today: ' + left.join(', ') : 'Saved ✔'); return show(left.length ? 'log' : 'dash'); }
    case 'showAll': V._all = true; return show('log');
    case 'csvBtn': return download(`fight-log-${(S.fighter||'fighter').replace(/\W+/g,'-')}-${today()}.csv`, Insights.toCSV(S.entries), 'text/csv;charset=utf-8');
    case 'delLog': if (confirm('Delete this day?')) { S.entries = S.entries.filter(x=>x.date!==V._e.date); save(); V._date=null; show('log'); } return;
    case 'wkPrev': S.weekIdx = Math.max(0, S.weekIdx-1); save(); return show('plan');
    case 'wkNext': S.weekIdx = Math.min(S.weeks.length-1, S.weekIdx+1); save(); return show('plan');
    case 'wkDup': { const c = JSON.parse(JSON.stringify(w)); const d = new Date(w.start+'T12:00'); d.setDate(d.getDate()+7); c.start = Scoring.ymd(d); c.coachNotes=''; c.days.forEach(x=>x.notes='');
      S.weeks.splice(S.weekIdx+1, 0, c); S.weekIdx++; save(); return show('plan'); }
    case 'wkDel': if (S.weeks.length>1 && confirm('Delete this week?')) { S.weeks.splice(S.weekIdx,1); S.weekIdx=Math.max(0,S.weekIdx-1); save(); show('plan'); } else if (S.weeks.length===1) alert('Keep at least one week.'); return;
    case 'icsBtn': return addToCalendar();
    case 'icsShare': return shareICS();
    case 'pushOn': { const b = t; b.disabled = true; b.textContent = 'Turning on…';
      try { await Push.enable(S.reminders, (S.profile&&S.profile.name)||S.fighter); S.push = true; S.notify = true; save(); alert('🔔 Notifications are on. You\'ll get your morning and evening check-ins, the Mon/Thu weigh-in, and the Sunday 6 PM report reminder, even when the app is closed.'); }
      catch (e) { alert(e.message==='denied' ? 'Notifications were blocked. To allow them: iPhone Settings → Notifications → Fight Readiness. Calendar reminders below still work.' : 'Could not turn on notifications (' + e.message + '). Check your connection and try again, or use the calendar reminders.'); }
      return show('setup'); }
    case 'pushOff': await Push.disable(); S.push = false; save(); alert('Notifications are off.'); return show('setup');
    case 'pushTest': if (!navigator.serviceWorker) return; (await navigator.serviceWorker.ready).showNotification('🥊 Fight Readiness', { body:'Test: notifications work on this phone.', icon:'icons/icon-192.png', tag:'fr-test' }); return;
    case 'notifBtn': if (!('Notification' in window)) return alert('Notifications are not supported here. Use the calendar reminders.');
      { const p = await Notification.requestPermission(); S.notify = p==='granted'; save(); alert(p==='granted'?'OK. You\'ll get a notification if the app is open at reminder time.':'Notifications are off. The calendar reminders still work.'); } return;
    case 'printBtn': return window.print();
    case 'shareBtn': { const txt = shareText();
      if (navigator.share) { try { await navigator.share({ title:'Fight Readiness Report', text:txt }); } catch (e) {} }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(txt); alert('Summary copied to clipboard.'); } else alert(txt); return; }
    case 'saveProfile': { const keys = ['name','nickname','dob','discipline','gym','coach','coachContact','weightClass','startWeight','targetWeight','fightDate','emName','emPhone','medical'];
      const first = !S.profile, d = {}; keys.forEach(k => { const el = $('#p_'+k); d[k] = el ? el.value.trim() : ''; });
      if (!first) d.startWeight = S.profile.startWeight || '';
      if (!Weekly.CONFIG.SHOW_COACH_CONTACT) d.coachContact = (S.profile && S.profile.coachContact) || ''; // hidden in testing: keep existing value
      const errs = Profile.validate(d); if (Object.keys(errs).length) { V._perr = errs; V._pdraft = d; show('profile'); const f = document.querySelector('.err'); if (f) f.previousElementSibling.focus(); return; }
      d.schedule = JSON.parse(JSON.stringify(V._sched));
      V._perr = V._pdraft = null; S.profile = d; const wk0 = mondayOf(new Date()); S.weeks.forEach(w => { if (w.start >= wk0 || S.weeks.length === 1) Profile.applyToWeek(d.schedule, w); }); S.fighter = d.name; S.coach = d.coach; S.targetWeight = d.targetWeight;
      if (first) { if (!S.startDate) S.startDate = today();
        if (+d.startWeight > 0 && !S.entries.some(e=>+e.weight>0)) upsert([{ date:today(), v:2, sessions:Profile.sessionsFor(d.schedule, today()), nutrition:null, training:null, family:null, sleep:'', screen:'', weight:+d.startWeight, notes:'' }]); }
      save(); V._date = null; return show(first ? 'log' : 'setup'); }
    case 'saveSetup': { if (!S.startDate) S.startDate = today();
      const np = Object.assign({}, S.params); document.querySelectorAll('[data-p]').forEach(i => { if (i.value!=='') np[i.dataset.p] = +i.value; });
      const sum = CATS.reduce((s,c)=>s+(+np[c[2]]||0),0); if (Math.abs(sum-100) > 1e-9) return alert(`Category weights must add up to 100 (now ${sum}). Not saved.`);
      S.params = np; save(); alert('Saved ✔'); return show('dash'); }
    case 'resetParams': S.params = Object.assign({}, Scoring.DEFAULT_PARAMS); save(); return show('setup');
    case 'exportBtn': return download(`fight-readiness-${(S.fighter||'fighter').replace(/\W+/g,'-')}-${today()}.json`, JSON.stringify(Object.assign({app:'fight-readiness',version:1,exported:new Date().toISOString()}, S), null, 1), 'application/json');
    case 'wipeBtn': if (confirm('Erase ALL data on this phone? Export a backup first!') && confirm('Really erase?')) { localStorage.removeItem(KEY); S = load(); show('setup'); } return;
  }
});
document.addEventListener('input', ev => { const t = ev.target, w = S.weeks[S.weekIdx];
  if (['p_startWeight','p_targetWeight','p_fightDate'].includes(t.id)) refreshCut();
  if (t.dataset.sl && V._sched) { const [i,j] = t.dataset.sl.split('-').map(Number); V._sched.days[i].labels[j] = t.value; return; }
  if (t.dataset.d !== undefined && t.dataset.k) { w.days[+t.dataset.d][t.dataset.k] = t.value; save(); }
  else if (t.id && t.id.startsWith('w_')) { w[t.id.slice(2)] = t.value; save(); }
});
document.addEventListener('change', async ev => { const t = ev.target;
  if (t.id === 'r_morning' || t.id === 'r_evening') { if (t.value) { S.reminders[t.id.slice(2)] = t.value; save(); if (S.push) Push.update(S.reminders, (S.profile&&S.profile.name)||S.fighter).catch(()=>{}); $('#calLink').href = calURL(); $('#calSub').href = calURL().replace(/^https?:/,'webcal:'); } return; }
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
function pushBox() { const st = Push.status();
  if (st === 'not-configured') return '<p class="muted">🔔 Push notifications are coming soon. Use the calendar reminders for now.</p>';
  if (st === 'ios-install') return '<div class="hint">🔔 <b>Want notifications?</b> On iPhone they only work from the Home Screen app. In Safari tap Share → <b>Add to Home Screen</b>, open Fight Readiness from the new icon, then come back to Setup and tap <i>Turn on notifications</i>. (Needs iOS 16.4 or newer.)</div>';
  if (st === 'unsupported') return '<p class="muted">🔔 This browser can\'t receive notifications. Use the calendar reminders below.</p>';
  if (S.push && typeof Notification !== 'undefined' && Notification.permission === 'granted') return '<p>🔔 <b>Notifications are on.</b> Changing the times above updates them automatically.</p><button class="btn alt" id="pushTest">Send a test notification</button><button class="btn alt" id="pushOff">Turn off notifications</button>';
  return '<button class="btn" id="pushOn">🔔 Turn on notifications</button><p class="muted">Recommended. Sends your morning and evening check-ins, the Mon/Thu weigh-in, and the Sunday 6 PM weekly-report reminder, even when the app is closed. Only your reminder times, time zone and first name are sent to the reminder server; your logs stay on this phone.</p>'; }
function calURL() { return new URL(Reminders.calFile(S.reminders.morning, S.reminders.evening), location.href.replace(/[#?].*$/,'')).href; }
async function shareICS() { const url = calURL(), name = 'fight-readiness-reminders.ics';
  try { const txt = await (await fetch(url, { cache:'no-store' })).text(); const f = new File([txt], name, { type:'text/calendar' });
    if (navigator.canShare && navigator.canShare({ files:[f] })) { try { await navigator.share({ files:[f], title:'Fight Readiness reminders' }); } catch (e) {} return; }
    download(name, txt, 'text/calendar;charset=utf-8'); } catch (e) { location.href = url; } }
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
if (!S.profile && S.fighter) S.profile = { name:S.fighter, coach:S.coach||'', targetWeight:S.targetWeight||'', startWeight:'' }; // migrate older installs
{ const q = new URLSearchParams(location.search).get('tab'); show(['dash','log','plan','report','setup','help'].includes(q) ? q : 'dash'); }
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.tab) { V._date = null; show(e.data.tab); } });
if (S.push) Push.update(S.reminders, (S.profile&&S.profile.name)||S.fighter).catch(()=>{});
