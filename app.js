const APP_VERSION='fr-v26';
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
  return { fighter:'', coach:'', targetWeight:'', params:Object.assign({}, Scoring.DEFAULT_PARAMS), entries:[], weeks:[newWeek(mondayOf(new Date()))], weekIdx:0, reminders:{morning:'07:00', evening:'21:00', untilDone:true} };
}
function migrate(S) {
  if (S.params && S.params.wWellness == null) Object.assign(S.params, { wNutrition:25, wTraining:25, wSleep:15, wWellness:15, wScreen:10, wFamily:10 }); // v2: Wellness enters the score
  if (S.profile && !S.profile.schedule) S.profile.schedule = Profile.scheduleFromWeek(S.weeks[S.weekIdx||0]);
  return S; }
let S = migrate(load()); S.reminders = Object.assign({morning:'07:00', evening:'21:00', untilDone:true}, S.reminders);
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
   <p class="muted" style="margin:4px 0 0">Last 28 days: 🟥 full log • 🟧 partial • ⬛ none.${st.todayDone?' Today is done ✔':' Finish today to keep the streak.'}</p>${badgeRow()}</div>`; }
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
   <p class="muted">Load (AU = arbitrary units) = effort (RPE 1–10) × minutes. E.g. 60 min at RPE 7 = 420 AU. A sudden jump in weekly load (more than ~10–15% over last week) raises injury and overtraining risk.</p>
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
  return `<div class="card hint warn" id="weeklyCard">📧 <b>Weekly report due</b> (week ${Weekly.weekLabel(wk)}). Testing phase: please send it to ${Weekly.CONFIG.ADMIN_NAME}.<button class="btn" data-send="1">🖼️ Send report with charts to ${Weekly.CONFIG.ADMIN_NAME}</button><button class="btn alt" data-sharefile="1">📎 Share full log file (CSV)</button></div>`; }
function weeklyParts() { const wk = Weekly.pendingWeek(), name = (S.profile&&S.profile.name)||S.fighter||'Fighter';
  return { wk, name, subj: Weekly.subject(name, wk), sum: weeklySummary(), csv: Insights.toCSV(S.entries), to: Weekly.CONFIG.ADMIN_EMAIL }; }
const markWeekly = wk => { S.weeklySent = Object.assign({}, S.weeklySent, {[wk]: new Date().toISOString()}); save(); show(cur); };
// Weekly report = PNG of the Coach Report (charts) via the share sheet. Subject + To repeated in the text.
function reportData() { const r = res(), p = S.profile||{}, P = weeklyParts(), w = Insights.wellness(S.entries), L = Insights.load(S.entries), cd = Profile.countdown(p.fightDate);
  const lw = r.latestWeight, ws = Profile.weightStatus(lw && lw.weight, p.targetWeight || S.targetWeight), t = Scoring.dayNum(today());
  const wk = S.entries.filter(e => Scoring.dayNum(e.date) > t-7), es = S.entries.slice().sort((a,b)=>a.date<b.date?-1:1).slice(-21);
  const c = Insights.cutSafety(S.entries, new Date(), p), cp = Insights.cutPlan(lw ? lw.weight : p.startWeight, p.targetWeight, p.fightDate), flags = [];
  if (c.level) flags.push(`Weight loss ${-c.pctPerWeek}%/week (${c.level})`); if (cp && cp.level !== 'ok') flags.push(`Target needs ${cp.perWeek} lbs/week (${cp.pct}%), ${cp.short} lbs short at a safe pace`);
  if (w.dropping) flags.push('Wellness below normal'); w.flags.forEach(f => flags.push(`Low ${f.item} (${f.value}/5) on ${f.date.slice(5)}`));
  const lp = L.weeks[2] ? Math.round((L.weeks[3]-L.weeks[2])/L.weeks[2]*100) : null; if (lp != null && lp > 15) flags.push(`Training load up ${lp}% vs last week`);
  const rpes = wk.flatMap(e => Scoring.sessionsDone(e)).map(x => +x.rpe).filter(x => x > 0), sl = wk.map(e => +e.sleep).filter(x => x > 0), avg = a => a.length ? (a.reduce((s,x)=>s+x,0)/a.length).toFixed(1) : '—';
  return { subject: P.subj, name: P.name, meta: [p.gym && 'Gym: '+p.gym, p.coach && 'Coach: '+p.coach, p.weightClass].filter(Boolean).join(' • '),
    score: r.daysLogged ? (r.locked ? Math.round(r.base) : r.score) : null, scoreLabel: r.locked ? `Early FightReady Score (${r.daysLogged} day${r.daysLogged==1?'':'s'})` : 'FightReady Score (3 weeks)',
    verdict: r.locked ? lockMsg(r).replace('🔒 ','') : r.verdict,
    head: [['Days logged this week', `${wk.length}/7`], ['Streak', `${Insights.streak(S.entries).current} days`], ['Weight vs target', ws ? `${ws.current} lbs • ${ws.text}` : (lw ? lw.weight+' lbs' : '—')], ['Fight', cd ? cd.text : '—'],
      ['Wellness (1–5)', w.avg7==null?'—':w.avg7.toFixed(1)], ['Avg sleep', sl.length ? avg(sl)+' h' : '—']],
    cats: CATS.map(([k,l,wt]) => [l, r.cats[k], S.params[wt]]), daily: Early.series(S.entries, S.params).map(x=>({date:x.date,y:x.score})),
    weight: es.filter(e => +e.weight > 0).map(e => ({date:e.date, y:+e.weight})), target: +(p.targetWeight || S.targetWeight) || null,
    sleep: es.map(e => ({date:e.date, y: e.sleep===''||e.sleep==null ? null : +e.sleep})), idealSleep: S.params.idealSleep||8,
    loadWeeks: L.weeks, training: `${tr7().split(' • ')[0]} • load ${L.week} AU${lp!=null?` (${lp>=0?'+':''}${lp}% vs last week)`:''} • avg effort RPE ${avg(rpes)}`,
    flags, review: Insights.weekReview(S.entries, new Date(), S.params, p) }; }
async function sendWeekly() { const P = weeklyParts(), d = reportData(), cv = Report.draw(document.createElement('canvas'), d);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png')), file = new File([blob], Report.fileName(P.name, P.wk), { type:'image/png' });
  const text = Report.shareText(P.to, P.subj, [`FightReady ${d.score ?? '—'} • ${d.head[0][0]}: ${d.head[0][1]}`, d.flags.length ? 'Flags: '+d.flags.join('; ') : 'No flags', 'Charts attached.']);
  if (navigator.canShare && navigator.canShare({ files:[file] })) { try { await navigator.share({ files:[file], title:P.subj, text }); markWeekly(P.wk); } catch (e) {} return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); markWeekly(P.wk);
  alert(`Report image downloaded. Email it to ${P.to} with subject:\n${P.subj}`); }
// Secondary: share the full CSV as a file (subject may not carry over in Mail, so it is repeated in the text).
async function shareWeeklyFile() { const p = weeklyParts();
  const file = new File([p.csv], `FightReady-${p.name.replace(/\W+/g,'-')}-${p.wk}.csv`, { type:'text/csv' });
  if (navigator.canShare && navigator.canShare({ files:[file] })) {
    try { await navigator.share({ files:[file], title:p.subj, text:`To: ${p.to}\nSubject: ${p.subj}\n\n${p.sum}` }); } catch (e) {} return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); }
const lockMsg = r => `🔒 Weekly trends unlock in ${r.unlockIn} day${r.unlockIn==1?'':'s'}. Keep logging!`;
const ynI = v => v===true?'✅':v===false?'❌':'—';
const todayRow = () => { const e = S.entries.find(x=>x.date===today()); return e ? `<p>Today: Nutrition ${ynI(e.nutrition)} • Training ${trainTxt(e)} • Sleep ${e.sleep===''?'—':e.sleep+'h'} • Screen ${e.screen===''?'—':e.screen+'h'} • Family ${ynI(e.family)}${+e.weight?' • '+e.weight+' lbs':''}</p>` : '<p class="muted">Nothing logged today yet.</p>'; };
const trainTxt = e => Array.isArray(e.sessions) ? (e.sessions.length ? e.sessions.filter(x=>x.done===true).length+'/'+e.sessions.length+(e.sessions.some(x=>x.done==null)?'…':'') : 'Rest')+(e.extra&&e.extra.label?' +extra':'') : e.training==null?'—':e.training?'Y':'N';
const CATS = [['nutrition','Nutrition','wNutrition'],['training','Training','wTraining'],['sleep','Sleep','wSleep'],['wellness','Wellness','wWellness'],['screen','Screen Time','wScreen'],['family','Family/Friends','wFamily']];

function weightChart() {
  const pts = S.entries.filter(e => +e.weight > 0).sort((a,b)=>a.date<b.date?-1:1).slice(-30);
  if (pts.length < 2) return '<p class="muted">Log 2+ weigh-ins to see the chart.</p>';
  const W=320,H=150,P=28, xs=pts.map(p=>Scoring.dayNum(p.date)), ys=pts.map(p=>+p.weight);
  const tgt=+S.targetWeight||+((S.profile||{}).targetWeight), tw=tgt>0?tgt:null; const all=tw?ys.concat(tw):ys;
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

function todayCard(title) { const e = S.entries.find(x=>x.date===(V._date||today())), d = Early.daily(e, S.params); if (!d) return '';
  const f = Early.feedback(d, e);
  return `<div class="card" id="todayCard"><div class="row" style="margin:0"><h3 style="margin:0">${title||"Today's score"}</h3><b style="font-size:1.8rem">${d.score}</b></div>
   ${CATS.map(([k,l,w]) => `<div class="row"><span style="width:110px">${l}</span><div class="bar"><i style="width:${d.cats[k]}%"></i></div><b style="width:44px;text-align:right">${(d.cats[k]*S.params[w]/100).toFixed(0)}/${S.params[w]}</b></div>`).join('')}
   <p style="margin:6px 0 0">${esc(f.text)}</p></div>`; }
function badgeRow() { return `<div class="badges">${Early.badges(S.entries, S.params).map(b=>`<span class="badge ${b.got?'on':''}" title="${esc(b.label)}">${b.icon} ${esc(b.label)}</span>`).join('')}</div>`; }
function earlyCard(r) { const pr = Early.progress(r, S.params.unlockDays||7);
  return `<div class="card"><div class="muted" style="text-align:center">FightReady Score</div><div class="big">${r.daysLogged?Math.round(r.base):'—'}</div>
   <p style="text-align:center"><b>Early score – based on ${r.daysLogged} day${r.daysLogged==1?'':'s'}</b></p>
   <div class="bar" style="margin:6px 0"><i style="width:${pr.pct}%"></i></div>
   <p class="muted" style="text-align:center">Full score unlocks in ${pr.unlockIn} day${pr.unlockIn==1?'':'s'}. Same weights as the full score, it just firms up as you log more days.</p></div>`; }
function spark(vals, opts = {}) { const v = vals.filter(x => x.y != null); if (v.length < 2) return `<p class="muted">${opts.empty||'Log 2+ days to see this chart.'}</p>`;
  const W=320,H=70,P=4, ys=v.map(x=>x.y).concat(opts.ref!=null?[opts.ref]:[]), y0=opts.min??Math.min(...ys), y1=opts.max??Math.max(...ys);
  const X=i=>P+i/(v.length-1)*(W-2*P), Y=y=>H-P-(y-y0)/((y1-y0)||1)*(H-2*P);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label||'chart')}">${opts.ref!=null?`<line x1="0" x2="${W}" y1="${Y(opts.ref)}" y2="${Y(opts.ref)}" stroke="#4caf50" stroke-dasharray="4"/>`:''}
   <path d="${v.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(x.y).toFixed(1)).join(' ')}" fill="none" stroke="#ff5252" stroke-width="2.5"/>${v.map((x,i)=>`<circle cx="${X(i)}" cy="${Y(x.y)}" r="3" fill="#ff5252"><title>${x.date}: ${x.y}</title></circle>`).join('')}</svg>
   <p class="muted" style="margin:0">${v[0].date} → ${v[v.length-1].date} • latest <b>${v[v.length-1].y}</b>${opts.unit||''}${opts.ref!=null?' • target '+opts.ref+(opts.unit||''):''}</p>`; }
function miniCharts() { const es = S.entries.slice().sort((a,b)=>a.date<b.date?-1:1).slice(-21);
  return `<div class="card"><h3>📈 Daily score</h3>${spark(Early.series(S.entries, S.params).map(x=>({date:x.date,y:x.score})),{min:0,max:100,label:'Daily score'})}
   <h3>😴 Sleep hours</h3>${spark(es.map(e=>({date:e.date,y:e.sleep===''||e.sleep==null?null:+e.sleep})),{ref:S.params.idealSleep||8,unit:'h',label:'Sleep hours'})}</div>`; }
const V = {
 dash() {
  const r = res(), lw = r.latestWeight;
  const isWeighDay = [1,4].includes(new Date().getDay()) && !S.entries.some(e=>e.date===today() && +e.weight>0);
  const dueNow = Reminders.due(S.entries.find(e=>e.date===today()), new Date(), S.reminders.morning, S.reminders.evening);
  return `${day1Banner(false)}${dueNow.map(k=>`<div class="card hint">⏰ ${k==='morning'?'Morning log not done: sleep hours, nutrition plan, how you feel (energy, soreness, mood, stress)'+([1,4].includes(new Date().getDay())?' + weigh-in before eating':''):'Evening log not done: each training session (effort + minutes), screen hours, family/friends, notes'}. <a href="#" data-goto="log" style="color:#ffb74d">Log now →</a></div>`).join('')}${weeklyCard()}${fightCard()}${fightWeekCard()}${streakCard()}
  ${isWeighDay?'<div class="card hint">⚖️ It\'s a weigh-in day (Mon/Thu). Weigh in this morning, fasted, and log it.</div>':''}
  ${r.locked?`${earlyCard(r)}${todayCard()}<div class="card"><h3>Categories so far (${r.daysLogged} day${r.daysLogged==1?'':'s'})</h3>${catTable(r)}<p class="muted">Consistency bonus: 🔒 unlocks in ${r.unlockIn} day${r.unlockIn==1?'':'s'}.</p></div>`:`${todayCard()}
  <div class="card"><div class="muted" style="text-align:center">FightReady Score</div><div class="big">${r.daysLogged?r.score:'—'}</div>
  <p style="text-align:center">${r.daysLogged?esc(r.verdict):'No entries in the last 3 weeks yet.'}</p>
  <p class="muted" style="text-align:center">Base ${r.base.toFixed(1)} + bonus ${r.bonus} • Data Quality: ${esc(r.dataQuality)} (${r.daysLogged} days logged)</p></div>
  <div class="card"><h3>Categories (last 3 weeks)</h3>${catTable(r)}
  <p>Core consistency (Nutrition + Training both Y): <b>${r.consistency.toFixed(0)}%</b> → ${r.bonus?'+'+r.bonus+' pts for daily discipline!':'Build streaks on both key plans'}</p>
  <p class="muted">Bonus: +5 at ≥90%, +3 at ≥75%, +1 at ≥60%.</p></div>`}
  <div class="card"><h3>🥊 Weight</h3>${verdictLine()}<p>Latest: <b>${lw?lw.weight+' lbs':'—'}</b> ${lw?'<span class="muted">('+lw.date+')</span>':''}${+S.targetWeight?` • Target ${esc(S.targetWeight)} lbs`:''}</p>
  ${r.locked?`<p>7-day trend: ${lockMsg(r)}</p>`:`<p>7-day trend: <b>${r.delta==null?'—':(r.delta>0?'+':'')+r.delta+' lbs/wk'}</b></p><p>${r.trend.emoji} ${esc(r.trend.label)}</p>`}${cutWarn()}${weightChart()}</div>${miniCharts()}${wellCard(false)}`;
 },
 log() {
  const d = V._date || today(), ex = S.entries.find(x=>x.date===d), e = blankOr(ex, d);
  const legacy = ex && !Array.isArray(ex.sessions) && ex.v !== 2;
  const opt10 = (v) => `<option value="">—</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option ${+v===n?'selected':''}>${n}</option>`).join('')}`;
  const yn = (k,l) => `<label>${l}</label><div class="yn" data-k="${k}"><button class="y ${e[k]===true?'on':''}" data-val="1">✅ Yes</button><button class="n ${e[k]===false?'on':''}" data-val="0">❌ No</button></div>`;
  const step = (k,l,st) => `<label>${l}</label><div class="step"><button data-step="${k}" data-d="-${st}">−</button><input id="f_${k}" type="number" inputmode="decimal" step="${st}" min="0" max="24" value="${esc(e[k])}"><button data-step="${k}" data-d="${st}">+</button></div>`;
  const chips = (k, vals) => `<div class="chips">${vals.map(v=>`<button data-chip="${k}" data-val="${v}" class="${+e[k]===v&&e[k]!==''?'on':''}">${v}h</button>`).join('')}</div>`;
  const wd = [1,4].includes(new Date(d+'T12:00').getDay()), st = Insights.sections(e), nDone = Object.values(st).filter(Boolean).length, left = missingToday(e);
  const head = (key, title) => `<div class="row" style="margin:0 0 4px"><h3 style="margin:0">${title}</h3><span class="secok ${st[key]?'on':''}" id="ok_${key}">${st[key]?'✓ Done':'…'}</span></div>`;
  const sessCard = () => legacy ? `${yn('training','Training session completed?')}` :
    (e.sessions.length ? e.sessions.map((x,i)=>{ const ok = ex && ex.sessions && ex.sessions[i] && ex.sessions[i].done != null && (ex.sessions[i].done === false || (ex.sessions[i].rpe > 0 && ex.sessions[i].mins > 0));
      return `<div class="sess"><p style="margin:8px 0 6px" id="sessq_${i}"><b>Did you complete session ${i+1}${x.label?' ('+esc(x.label)+')':''}?</b> ${ok?'<span class="secok on">✓</span>':''}</p>
     <div class="yn" id="sess_${i}" data-k="sess" data-i="${i}"><button class="y ${x.done===true?'on':''}" data-val="1">✅ Yes</button><button class="n ${x.done===false?'on':''}" data-val="0">❌ No</button></div>
     <div class="row sx" id="sx_${i}" style="${x.done===true?'':'display:none'}"><div style="flex:1"><label>Effort (RPE 1–10) *</label><select data-srpe="${i}">${opt10(x.rpe)}</select></div>
     <div style="flex:1"><label>Minutes *</label><input data-smin="${i}" type="number" inputmode="numeric" min="1" max="600" step="5" value="${esc(x.mins)}"></div></div></div>`; }).join('') : '<p class="hint">🛌 Rest day: training counts 100% when you rest.</p>') +
    `<details class="opt" ${e.extra&&e.extra.label?'open':''}><summary>➕ Extra session (not on your schedule)</summary>
    <label for="f_xlabel">What was it?</label><input id="f_xlabel" maxlength="40" placeholder="e.g. Open mat" value="${esc(e.extra&&e.extra.label)}">
    <div class="row"><div style="flex:1"><label>Effort (RPE 1–10)</label><select id="f_xrpe">${opt10(e.extra&&e.extra.rpe)}</select></div><div style="flex:1"><label>Minutes</label><input id="f_xmin" type="number" inputmode="numeric" min="1" max="600" step="5" value="${esc(e.extra&&e.extra.mins)}"></div></div>
    <p class="muted">Logged and added to your load. Doesn't change the training %. Clear all three fields to remove it.</p></details>
   <p class="muted">RPE: 1 very easy, 3 moderate, 5 hard, 7 very hard, 10 max.</p>
   <p class="muted">Load (AU = arbitrary units) = effort (RPE 1–10) × minutes. E.g. 60 min at RPE 7 = 420 AU. A sudden jump in weekly load (more than ~10–15% over last week) raises injury and overtraining risk.</p>`;
  V._e = JSON.parse(JSON.stringify(e)); V._legacy = legacy;
  const cards = {
   morning: `<div class="card" id="sec_morning">${head('morning','🌅 Morning check-in')}
   ${step('sleep','Sleep last night (hours) *',0.5)}${chips('sleep',[6,7,7.5,8,8.5,9])}
   <label>Weight (lbs) ${wd?'<span style="color:#ff9800">— weigh-in day! ⚖️ Weigh in before eating.</span>':'<span class="muted">(Mon/Thu mornings)</span>'}</label>
   <input id="f_weight" type="number" inputmode="decimal" step="0.1" value="${esc(e.weight)}">
   <p style="margin:14px 0 0"><b>How do you feel? *</b></p>
   ${Insights.WELL.map(([k,l,lo,hi])=>`<label>${l} <span class="muted">(${lo} … ${hi})</span></label><div class="sc" data-k="${k}">${[1,2,3,4,5].map(n=>`<button class="${+e[k]===n?'on':''}" data-val="${n}">${n}</button>`).join('')}</div>`).join('')}
   </div>`,
   nutrition: `<div class="card" id="sec_nutrition">${head('nutrition','🍽️ Nutrition')}${yn('nutrition','Nutrition plan followed today?')}</div>`,
   training: `<div class="card" id="sec_training">${head('training','🥊 Training')}${sessCard()}</div>`,
   evening: `<div class="card" id="sec_evening">${head('evening','🌙 Evening')}
   ${step('screen','Recreational screen time (hours) *',0.5)}${chips('screen',[0,1,2,3,4])}
   ${yn('family','Quality time with family/friends? *')}
   <label>Notes (injuries, illness, soreness, energy, mood)</label><textarea id="f_notes" rows="3">${esc(e.notes)}</textarea>
   </div>` };
  if (V._sec && cards[V._sec]) return sectionView(V._sec, cards[V._sec], d, e);
  const info = Insights.sectionInfo(e), nDoneM = info.filter(x => x.done).length, all = nDoneM === info.length, dl = Early.daily(e, S.params);
  return `${d===today()?day1Banner(true):''}<div class="card" id="menuTop"><div class="row" style="margin:0"><div style="flex:1;min-width:0"><p id="progress" style="margin:0;font-weight:700;font-size:1.1rem">${all?'✅ ':''}${nDoneM} of ${info.length} sections done</p>
   <p class="muted" id="stillToLog" style="margin:4px 0 0">${left.length?'Still to log: '+left.join(', '):'All done for this day 🎉'}</p></div>
   ${dl?`<div style="text-align:center;flex:none"><div class="muted" style="font-size:.75rem">${d===today()?'Today':'Day'}'s score</div><b id="topScore" style="font-size:2rem;line-height:1">${dl.score}</b></div>`:''}</div>
   <label for="f_date" style="margin-top:12px">Date</label><input id="f_date" type="date" value="${d}" max="${today()}"></div>
  <div id="tiles" role="list">${info.map(x => tileHtml(x, e)).join('')}</div>
  <p class="muted" style="margin:-2px 4px 14px">Tap a section to log it, then tap <b>Done</b> (or go back) to return here. Everything saves automatically on this phone.</p>
  <div class="card" id="saveCard"><button class="btn big-save" id="saveDay">${all?'✅':'💾'} Save ${d===today()?"today's":"this day's"} log</button><div id="saveResult" aria-live="polite">${all?allDoneHtml(d):''}</div>${ex?'<button class="btn alt" id="delLog">Delete this day</button>':''}</div>
  <div id="todayWrap">${todayCard(d===today()?"Today's score":'Score for '+d)}</div>
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
  return `<div class="card"><h2 style="margin:0">🥊 Coach Report: FightReady Summary</h2>
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
  <div class="card noprint"><button class="btn" data-send="1">🖼️ Send report with charts to ${Weekly.CONFIG.ADMIN_NAME}</button><button class="btn alt" id="printBtn">🖨️ Print / Save as PDF</button><button class="btn alt" id="shareBtn">📤 Share text summary</button><button class="btn alt" id="csvBtn">📊 Export log as CSV (for coach / Excel)</button><button class="btn alt" data-sharefile="1">📎 Share full log file (CSV)</button></div>`;
 },
 profile() {
  const p = S.profile || {}, first = !S.profile, er = V._perr || {}, v = k => esc(V._pdraft ? V._pdraft[k] : p[k]);
  const fld = (k, l, attrs='', req=false) => `<label for="p_${k}">${l}${req?' *':''}</label><input id="p_${k}" ${attrs} value="${v(k)}">${er[k]?`<p class="err">${esc(er[k])}</p>`:''}`;
  const sel = (k, l, opts) => `<label for="p_${k}">${l}</label><select id="p_${k}"><option value="">—</option>${opts.map(o=>`<option ${(V._pdraft?V._pdraft[k]:p[k])===o?'selected':''}>${o}</option>`).join('')}</select>${er[k]?`<p class="err">${esc(er[k])}</p>`:''}`;
  const num = 'type="number" inputmode="decimal" step="0.1" min="60" max="400"';
  return `${first?'<div class="card"><h2 style="margin:0">🥊 Welcome! Sign up</h2><p class="muted">Set up your fighter profile. It stays on this phone only and is included in your backups. You can edit it later in Setup.</p></div><div class="card hint" id="day1note">📅 <b>Your sign-up day is Day 1 of tracking.</b> After you sign up, finish today&#39;s log tonight: nutrition, each training session (with effort + minutes), sleep, how you feel (energy, soreness, mood, stress), screen time, and family/friends. You get a daily score and an early FightReady Score from your first log. The full score and weekly trends unlock after 7 days.</div>':'<div class="card"><h2 style="margin:0">Fighter profile</h2></div>'}
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
   <label class="chkrow"><input type="checkbox" id="r_untilDone" ${S.reminders.untilDone!==false?'checked':''}> <span><b>Remind me until today's log is done</b><br><span class="muted">If your log isn't finished after your evening reminder, you get a follow-up 2 hours later and a last one at 9:30 PM, and they stop as soon as it's done. Needs notifications turned on below.</span></span></label>
   <div id="pushBox">${pushBox()}</div>
   <p class="muted" style="margin-top:12px"><b>Or use calendar reminders</b> (backup option):</p>
   <a class="btn alt" id="calLink" href="${calURL()}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">📅 Add reminders to my calendar</a>
   <div class="hint" style="margin-top:10px"><b>iPhone:</b> tap the button above. Safari opens a calendar preview with 4 events. Tap <b>Add All</b> (top right), pick your calendar, then come back to the app.<br><b>Android:</b> open the downloaded file and choose your Calendar app to import it.</div>
   <a class="btn alt" id="calSub" href="${calURL().replace(/^https?:/,'webcal:')}" style="text-align:center;text-decoration:none">🔁 Or subscribe (webcal)</a>
   <p class="muted">Subscribe also works. On iPhone, open Settings → Calendar → Accounts → Subscribed Calendars → FightReady and turn <b>off</b> "Remove Alerts", or the alarms won't ring.</p>
   <button class="btn alt" id="icsShare">📤 Share / save the calendar file</button>
   <p class="muted">The calendar file adds 4 repeating events with alarms: a daily morning log, a Mon/Thu weigh-in, a daily evening log, and a Sunday 6 PM reminder to send the weekly report to ${Weekly.CONFIG.ADMIN_NAME}. <b>Already added reminders before? Tap the button again to get the new Sunday reminder</b> (delete the old duplicates in your calendar). If you change the times, tap the button again and delete the old events in your calendar.</p></div>
  <div class="card"><h3>Backup & import</h3>
   <button class="btn" data-send="1">🖼️ Send report with charts to ${Weekly.CONFIG.ADMIN_NAME}</button><button class="btn alt" id="exportBtn">⬇️ Export backup (JSON)</button><button class="btn alt" id="csvBtn">📊 Export log as CSV (Excel / Google Sheets)</button><button class="btn alt" data-sharefile="1">📎 Share full log file (CSV)</button>
   <label>Restore backup (JSON) or import FightLog CSV</label><input type="file" id="importFile" accept=".json,.csv,application/json,text/csv">
   <p class="muted">CSV columns: Date, Nutrition, Training, Sleep_Hours, Screen_Hours, Family_Friends, [Sleep_Score, Screen_Score,] Weight, Notes, plus optional Energy, Soreness, Mood, Stress, RPE, Session_Min. Existing dates are overwritten.</p>
   <button class="btn alt" id="wipeBtn" style="background:#5d1010">🗑️ Erase all data on this phone</button></div>
  <div class="card"><button class="btn alt" id="updBtn">🔄 Check for update</button><p class="muted" style="text-align:center;font-size:12px">Version ${APP_VERSION}</p></div>`;
 },
 help() {
  return `<div class="card"><h3>How to use</h3>
  <p><b>Install:</b> open the link in Safari (iPhone: Share → Add to Home Screen) or Chrome (Android: menu → Install app). Works offline after first load.</p>
  <p><b>First week:</b> from your first log you see a daily score, an early FightReady Score (same weights, based on the days logged so far), badges and mini charts. The full 21-day score, weight trend and consistency bonus unlock 7 days after you finish Setup. Only days since then count.</p>
  <p><b>Day 1:</b> your sign-up day is Day 1. Finish that day's log that night to get your first score.</p>
  <p><b>Profile:</b> on first open, sign up with your name (required) and optional team, weight, fight date and safety details. Edit it anytime in Setup → Edit profile. Your starting weight becomes your first weigh-in. The Dashboard shows your fight countdown and lbs to go.</p>
  <p><b>Daily log (about 30 sec):</b> tap Log. You see a menu of 4 tiles: 🌅 <b>Morning check-in</b> (sleep, weight on Mon/Thu, how you feel), 🍽️ <b>Nutrition</b>, 🥊 <b>Training</b> (each session, plus any extra session) and 🌙 <b>Evening</b> (screen time, family/friends, notes). <b>Light blue</b> tiles aren't logged yet. Tap one to open it, fill it in and tap <b>Done</b> (or swipe back / press Back) to return to the menu. When a section is complete its tile turns <b>grey with a ✓</b>. Everything you enter <b>saves automatically</b> on your phone as you go, so nothing is lost if you close the app. When all 4 tiles are grey your day is complete; the <b>💾 Save today's log</b> button at the bottom confirms it, or lists exactly what's missing (tap an item to jump to it). Nutrition = followed your plan (macros, timing, hydration). <b>Training:</b> for each session on your schedule today, answer "Did you complete session N?" and, if yes, its effort (RPE 1–10) and minutes (both required). Rest days need nothing. Add an unscheduled extra session if you did one. Sleep = hours slept last night. Screen = recreational screen time only (not film study or school). Family/Friends = real quality time without heavy screens. <b>How you feel</b> (required daily, 1–5): Energy (5 = fresh), Soreness (5 = no soreness), Mood (5 = great), Stress (5 = no stress).</p>
  <p><b>Training schedule:</b> set at sign-up (once or twice a day, then Rest / 1 / 2 sessions per weekday with optional labels). Edit it in Setup → Edit profile & training schedule. Saving it updates this week's and future Weekly Outlines.</p>
  <p><b>Reminders:</b> Setup → Reminders → pick a morning (5:00–10:00) and evening (18:00–23:00) time in 30-min steps → tap <i>Add reminders to my calendar</i>. <b>On iPhone</b> Safari opens a calendar preview: tap <b>Add All</b>. This works from the home-screen app too. You get a daily morning and evening alarm, a Mon/Thu weigh-in, and a Sunday 6 PM weekly-report reminder, even when the app is closed. (Push notifications, which you turn on in the same Reminders card, also follow up until your log is finished; calendar alarms can't.) Alternatives: <i>Subscribe (webcal)</i> (then turn off "Remove Alerts" in Settings → Calendar → Accounts → Subscribed Calendars) or <i>Share / save the calendar file</i>. The app also shows a banner if today's morning or evening items aren't logged after those times.</p>
  <p><b>Weight:</b> weigh Monday & Thursday mornings: fasted, after the bathroom, same scale, minimal clothing.</p>
  <p><b>Streak:</b> 🔥 counts days in a row with a full log (nutrition, every scheduled session with effort + minutes, sleep, screen, family, and all 4 wellness ratings). Today not done yet doesn't break it. Miss a whole day and it resets.</p>
  <p><b>How you feel (Hooper-style check-in):</b> four quick 1–5 ratings modelled on the Hooper Index used by pro teams: fatigue/energy, muscle soreness, stress and mood (5 = best). Sleep is logged separately as hours. It's 15% of the score.</p>
  <p><b>Weight verdict:</b> the Dashboard shows one line every day. 🟢 <b>On track</b> = losing at roughly the pace you need, within the safe ~1%/week. 🔴 <b>Too fast</b> = losing more than 1.5%/week. 🟠 <b>Too slow</b> = well under the pace you need. ⚪ <b>No target</b> = set a target weight in your profile.</p>
  <p><b>Impossible-cut check:</b> with a target weight and fight date set, the app works out the weekly loss needed. Over 1%/week of bodyweight shows a caution and over 1.5% says the plan is unsafe. It shows the weight a safe pace reaches by fight day and how far short that is, so you can talk to your coach about a higher weight class or a later date.</p>
  <p><b>Fight week:</b> in the last 7 days before your fight date (used as weigh-in day) the Dashboard and Report show a day-by-day card covering taper, water, salt and carbs. It's general, conservative guidance based on the ISSN 2025 combat-sports position stand, not medical advice. Follow your coach and dietitian. No saunas, diuretics or fluid restriction for minors.</p>
  <p><b>Weekly review:</b> the Coach Report, weekly email and share text include an automatic "What went well / What was missed / Focus for next week" from your last 7 days (best and worst categories, missed sessions, 🚩 flags, weight verdict).</p>
  <p><b>Wellness & load:</b> wellness ratings of 1–2 get a 🚩 flag for your coach, and a drop below your normal is highlighted. Session load = RPE × minutes summed over all sessions (two-a-days add up). It's shown on the Dashboard and Coach Report and doesn't change the score.</p>
  <p><b>Safe weight cut:</b> the app warns if you lose more than 1%/week of bodyweight (caution) or 1.5%/week (warning), or if your target and fight date would need a faster pace. Sports-nutrition guidance for combat sports is a gradual ~0.5–1 kg (1–2 lbs) per week. Never cut by skipping meals or dehydrating without coach supervision.</p>
  <p><b>Weekly report (testing phase):</b> every Sunday (and on the first open after, until it's sent) the Score screen shows a <i>Send weekly report to ${Weekly.CONFIG.ADMIN_NAME}</i> card. Tap <i>🖼️ Send report with charts</i>: the app makes a one-page report image (score, category bars, daily score, weight vs target, sleep and training load charts, flags) and opens the share sheet. Pick Mail: the report is attached and the text starts with the subject (your name + report dates, e.g. "Pablo – FightReady weekly report – Oct 19 to Oct 25, 2026") and To (${Weekly.CONFIG.ADMIN_EMAIL}). If Mail leaves the To or Subject blank, copy them from the first lines. To send the full log as a file, use <i>Share full log file (CSV)</i>. You can send anytime from Setup or the Report screen. A calendar reminder fires Sundays at 6 PM.</p>
  <p><b>Notes:</b> injuries, illness, soreness, bad sleep causes, low energy. These show up on the Coach Report.</p></div>
  <div class="card"><h3>Scoring</h3><p>Score 0–100 from the last 3 weeks of logs. Nutrition 25%, Training 25%, Sleep 15%, Wellness 15%, Screen 10%, Family 10% (editable in Setup, must add up to 100).</p>
  <p>• Nutrition / Family = % of logged days marked Yes.<br>• Training = average daily % of scheduled sessions completed (rest day = 100%; older days: Yes = 100).<br>• Wellness = average of Energy, Soreness, Mood, Stress mapped 1→0, 2→25, 3→50, 4→75, 5→100 (days with all 4 rated).<br>• Sleep: 100 at 8h, −25 per hour off (6h or 10h = 50).<br>• Screen: 100 if ≤2h, −40 per extra hour (3h = 60, 4h = 20).<br>
  • Consistency bonus: +5 if ≥90% of days had Nutrition = Yes AND all scheduled sessions done, +3 if ≥75%, +1 if ≥60%. Capped at 100.<br>• 85+ Elite • 70+ Solid • below 70 Building.</p>
  <p><b>Weight trend</b> = average weight of the last 7 days minus the previous 7 days:<br>🔴 > +1.5 rapid gain • 🟠 +0.5 to +1.5 gaining • 🟡 −0.5 to +0.5 stable • 🟢 −0.5 to −1.5 good cut • 🔵 below −1.5 aggressive cut. A steady 0.75–1.5 lbs/week loss is ideal in the final 8–12 weeks.</p></div>
  <div class="card"><h3>Your data</h3><p>Everything stays on this phone only. Nothing is uploaded. Use Setup → Export backup regularly (e.g. weekly), and before you switch phones or clear browser data. Share the Coach Report as a PDF or text.</p></div>`;
 }
};
let cur = 'dash';
function blankOr(ex, d) { const e = JSON.parse(JSON.stringify(ex || {date:d, v:2, nutrition:null, training:null, family:null, sleep:'', screen:'', weight:'', notes:''}));
  if (!(ex && !Array.isArray(ex.sessions) && ex.v !== 2) && !Array.isArray(e.sessions)) { e.sessions = Profile.sessionsFor(S.profile && S.profile.schedule, d) || []; e.v = 2; }
  return e; }
// ---- Log menu: one tile per section; tapping opens that section full-screen, Done / back returns to the menu ----
function tileSummary(x, e) { const has = k => x.items.some(i => k.test(i.key));
  if (x.key === 'morning') { if (x.done) { const w = Insights.dayWellness(e); return [e.sleep + 'h sleep', +e.weight > 0 ? e.weight + ' lbs' : '', w != null ? 'feel ' + w.toFixed(1) + '/5' : ''].filter(Boolean).join(' · '); }
    return 'To log: ' + [has(/^sleep$/) ? 'sleep' : '', has(/^well-/) ? 'how you feel' : ''].filter(Boolean).join(' + '); }
  if (x.key === 'nutrition') return x.done ? (e.nutrition ? 'Followed plan ✅' : 'Plan not followed ❌') : 'Tap Yes or No';
  if (x.key === 'training') { const ss = Array.isArray(e.sessions) ? e.sessions : [], ex = e.extra && e.extra.label ? ' + extra' : '';
    if (x.done) return (ss.length ? ss.filter(s => s.done === true).length + ' of ' + ss.length + ' sessions done' : (e.v >= 2 ? 'Rest day' : e.training ? 'Session done' : 'Session skipped')) + ex;
    const ok = ss.filter(s => s.done === false || (s.done === true && +s.rpe > 0 && +s.mins > 0)).length; return ss.length ? ok + ' of ' + ss.length + ' sessions logged' : 'Tap Yes or No'; }
  return x.done ? [e.screen + 'h screen', e.family ? 'family time ✅' : 'no family time'].join(' · ') : 'To log: ' + [has(/^screen$/) ? 'screen time' : '', has(/^family$/) ? 'family/friends' : ''].filter(Boolean).join(' + '); }
function tileHtml(x, e) { const sm = tileSummary(x, e);
  return `<button class="tile ${x.done ? 'done' : 'todo'}" data-sec="${x.key}" role="listitem" aria-label="${esc(x.title)}: ${x.done ? 'done' : 'not logged yet'}. ${esc(sm)}">
   <span class="ti">${x.icon}</span><span class="tt"><b>${esc(x.title)}</b><span class="ts">${esc(sm)}</span></span><span class="tk">${x.done ? '✓' : '›'}</span></button>`; }
const allDoneHtml = d => `<div class="hint ok" id="saveOk">✅ <b>${d === today() ? "Today's log is complete" : 'This day is complete'} and saved.</b> Great work. Your score is below.</div>`;
function sectionView(key, card, d, e) { const m = Insights.SECTION_META.find(x => x[0] === key);
  return `<div class="secbar"><button class="btn alt secback" id="secBack" data-back="1">‹ Back to menu</button></div>
   ${d !== today() ? `<div class="hint">✏️ Editing <b>${d}</b></div>` : ''}${card}
   <div class="card"><button class="btn big-save" id="secDone">✓ Done, back to menu</button></div>`; }
function openSection(key) { V._sec = key; try { history.pushState({ frSec:key }, ''); } catch (e) {} show('log'); }
function leaveSection() { autosave(); V._sec = null; show('log'); sendStatusNow(); }
function closeSection() { if (history.state && history.state.frSec) return history.back(); leaveSection(); } // popstate does the rest
window.addEventListener('popstate', () => { if (cur === 'log' && V._sec) leaveSection(); });
try { if (history.state && history.state.frSec) history.replaceState(null, ''); } catch (e) {}
// ---- Log screen: every field autosaves silently; one Save button validates and reports what's missing ----
const hasData = b => ['nutrition','training','family'].some(k => b[k] === true || b[k] === false) || ['sleep','screen','weight'].some(k => b[k] !== '' && b[k] != null) || Scoring.WELL_KEYS.some(k => +b[k] > 0)
  || !!(b.notes && String(b.notes).trim()) || !!b.extra || (Array.isArray(b.sessions) && b.sessions.some(x => x.done != null));
// Build the day's entry from what is on screen + the taps held in V._e. Out-of-range numbers keep the last good value (and show up at Save).
function readDraft() { const u = V._e; if (!u) return null;
  const d = u.date, b = blankOr(S.entries.find(x => x.date === d), d), has = id => !!$(id), nv = id => { const v = $(id).value; return v === '' ? '' : (isNaN(+v) ? NaN : +v); };
  const rng = (v, old, lo, hi) => v === '' ? '' : (v >= lo && v <= hi ? v : old);
  // Only one section is on screen at a time: fields that aren't on screen keep their stored value.
  if (has('#f_sleep')) b.sleep = rng(nv('#f_sleep'), b.sleep, 0, 24); if (has('#f_screen')) b.screen = rng(nv('#f_screen'), b.screen, 0, 24); if (has('#f_weight')) b.weight = rng(nv('#f_weight'), b.weight, 60, 400);
  if (has('#f_notes')) b.notes = $('#f_notes').value; b.nutrition = u.nutrition ?? null; b.family = u.family ?? null; Scoring.WELL_KEYS.forEach(k => { b[k] = u[k] ?? ''; });
  if (V._legacy) b.training = u.training ?? null;
  else if (Array.isArray(b.sessions)) { b.v = 2; b.sessions = b.sessions.map((x, i) => { const us = (u.sessions || [])[i] || {}, done = us.done == null ? null : us.done;
    const r = document.querySelector(`[data-srpe="${i}"]`), m = document.querySelector(`[data-smin="${i}"]`);
    if (!r && !m) return { label: x.label, done, rpe: done ? (x.rpe > 0 ? x.rpe : '') : '', mins: done ? (x.mins > 0 ? x.mins : '') : '' };
    return { label: x.label, done, rpe: done ? (+(r && r.value) > 0 ? +r.value : '') : '', mins: done ? (+(m && m.value) > 0 ? +m.value : '') : '' }; }); }
  if (has('#f_xlabel')) { const xl = $('#f_xlabel').value.trim(), xr = $('#f_xrpe').value, xm = $('#f_xmin').value;
    if (!xl && !xr && !xm) b.extra = null; else if (+xr > 0 && +xm > 0) b.extra = { label: xl || 'Extra session', rpe:+xr, mins:+xm }; }
  if (Array.isArray(b.sessions) && !V._legacy) b.training = b.sessions.some(x => x.done == null) ? null : Scoring.trainingPct(b) === 100;
  return b; }
function autosave() { const b = readDraft(); if (!b) return null;
  if (!S.entries.some(x => x.date === b.date) && !hasData(b)) return b;
  upsert([b]); refreshProgress(b); if (b.date === today()) scheduleStatus(); return b; }
function refreshProgress(b) { const st = Insights.sections(b), n = Object.values(st).filter(Boolean).length, left = Insights.missing(b);
  Object.keys(st).forEach(k => { const el = $('#ok_' + k); if (el) { el.classList.toggle('on', !!st[k]); el.textContent = st[k] ? '✓ Done' : '…'; } });
  const pr = $('#progress'); if (pr) pr.textContent = (n === 4 ? '✅ ' : '') + n + ' of 4 sections done';
  const sl = $('#stillToLog'); if (sl) sl.textContent = left.length ? 'Still to log: ' + left.join(', ') : 'All done for this day 🎉';
  (b.sessions || []).forEach((x, i) => { const q = $('#sessq_' + i); if (!q) return; const ok = x.done === false || (x.done === true && +x.rpe > 0 && +x.mins > 0), m = q.querySelector('.secok');
    if (ok && !m) q.insertAdjacentHTML('beforeend', ' <span class="secok on">✓</span>'); else if (!ok && m) m.remove(); }); }
// Where each missing item lives on the screen (tap in the checklist to jump there)
function fieldFor(key) { const q = s => document.querySelector(s);
  if (key.startsWith('sessfx-')) { const i = key.slice(7), r = q(`[data-srpe="${i}"]`); return r && r.value === '' ? r : q(`[data-smin="${i}"]`); }
  if (key.startsWith('sess-')) return q('#' + key.replace('-', '_'));
  if (key.startsWith('well-')) return q(`.sc[data-k="${key.slice(5)}"]`);
  if (key === 'extra') return q('#f_xrpe');
  return q({ nutrition:'.yn[data-k="nutrition"]', training:'.yn[data-k="training"]', family:'.yn[data-k="family"]', sleep:'#f_sleep', screen:'#f_screen', weight:'#f_weight' }[key]); }
function jumpTo(key) { const el = fieldFor(key); if (!el) return; const det = el.closest('details'); if (det) det.open = true;
  el.scrollIntoView({ behavior:'smooth', block:'center' }); const box = el.closest('.yn,.sc,.step,.row') || el; box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 2200);
  if (el.focus && /INPUT|SELECT|TEXTAREA/.test(el.tagName)) setTimeout(() => el.focus({ preventScroll:true }), 400); }
function saveDay() { const b = autosave(); if (!b) return; const date = b.date;
  const items = Insights.checklist(b).slice(), bad = (id, lo, hi) => { const el = $(id); return el && el.value !== '' && !(+el.value >= lo && +el.value <= hi); };
  if (bad('#f_weight', 60, 400)) items.push({ key:'weight', label:'Weight: should be between 60 and 400 lbs' });
  if (bad('#f_sleep', 0, 24) && !items.some(x => x.key === 'sleep')) items.push({ key:'sleep', label:'Sleep: enter hours between 0 and 24' });
  if (bad('#f_screen', 0, 24) && !items.some(x => x.key === 'screen')) items.push({ key:'screen', label:'Screen time: enter hours between 0 and 24' });
  const xlE = $('#f_xlabel'), xl = xlE ? xlE.value.trim() : '', xr = xlE ? $('#f_xrpe').value : '', xm = xlE ? $('#f_xmin').value : ''; if ((xl || xr || xm) && !(+xr > 0 && +xm > 0)) items.push({ key:'extra', label:'Extra session: add effort (RPE) and minutes, or clear it' });
  sendStatusNow();
  const box = $('#saveResult'), w = $('#todayWrap'); if (w) w.innerHTML = todayCard(date === today() ? "Today's score" : 'Score for ' + date); { const ts = $('#topScore'), dd = Early.daily(b, S.params); if (ts && dd) ts.textContent = dd.score; }
  if (!items.length) box.innerHTML = `<div class="hint ok" id="saveOk">✅ <b>${date === today() ? "Today's log is complete" : 'This day is complete'} and saved.</b> Great work. Your score is below.</div>`;
  else box.innerHTML = `<div class="hint warn" id="saveMissing">💾 <b>Saved, but ${items.length} thing${items.length === 1 ? ' is' : 's are'} still missing.</b> Tap one to jump to it:<ul class="chk">${items.map(x => `<li><a href="#" data-jump="${x.key}">${esc(x.label)}</a></li>`).join('')}</ul></div>`;
  (items.length ? box : (w && w.firstElementChild) || box).scrollIntoView({ behavior:'smooth', block: items.length ? 'center' : 'start' }); }
// Tell the reminder server only whether today's log is complete (plus how many items are open). Never any log data.
let _stTimer = null, _stSent = '';
function statusNow() { return Object.assign({ date: today() }, Insights.dayStatus(S.entries.find(e => e.date === today()))); }
function sendStatusNow() { clearTimeout(_stTimer); if (!S.push) return; const st = statusNow(), key = JSON.stringify(st); if (key === _stSent) return; _stSent = key; Push.setDayStatus(st).catch(() => { _stSent = ''; }); }
function scheduleStatus() { if (!S.push) return; clearTimeout(_stTimer); _stTimer = setTimeout(sendStatusNow, 3000); }
function refreshCut() { const b = $('#cutBox'); if (!b) return; const lw = res().latestWeight, sw = $('#p_startWeight');
  b.innerHTML = planBox(lw ? lw.weight : sw && sw.value, $('#p_targetWeight').value, $('#p_fightDate').value); }
function refreshSched() { const sc = V._sched; if (!sc || !$('#schedCard')) return;
  document.querySelectorAll('#perDay button').forEach(b => b.classList.toggle('on', +b.dataset.perday === sc.perDay));
  sc.days.forEach((d,i) => { document.querySelectorAll(`[data-sd="${i}"]`).forEach(b => b.classList.toggle('on', +b.dataset.n === d.n));
    [0,1].forEach(j => { const inp = document.querySelector(`[data-sl="${i}-${j}"]`); inp.value = d.labels[j] || ''; inp.style.display = d.n > j ? '' : 'none'; }); }); }
function show(v) { if (!S.profile && v !== 'help') v = 'profile';
  if (v === 'profile' && !V._sched) V._sched = JSON.parse(JSON.stringify((S.profile && S.profile.schedule) || Profile.scheduleFromWeek(S.weeks[S.weekIdx])));
  if (v !== 'profile') V._sched = null; if (v !== 'log') V._sec = null; cur = v; $('#view').innerHTML = V[v](); document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.v===(v==='profile'?'setup':v)));
  $('#title').textContent = 'FightReady' + (S.fighter ? ' — ' + S.fighter : ''); if (v === 'profile') { refreshSched(); refreshCut(); } window.scrollTo(0,0); }
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
  if (r.locked) return `🥊 FightReady: ${S.fighter||'Fighter'} (${today()})\n${lockMsg(r)}\nDays logged so far: ${r.daysLogged}`;
  return `🥊 FightReady: ${S.fighter||'Fighter'} (${today()})${S.profile&&S.profile.gym?' • '+S.profile.gym:''}${S.profile&&Profile.countdown(S.profile.fightDate)?'\n'+Profile.countdown(S.profile.fightDate).text:''}\nScore: ${r.score}/100, ${r.verdict}\n` +
   CATS.map(([k,l])=>`${l}: ${r.cats[k].toFixed(0)}`).join(' | ') + `\nConsistency: ${r.consistency.toFixed(0)}% (+${r.bonus})\n` +
   `Weight: ${r.latestWeight?r.latestWeight.weight+' lbs':'—'}, trend ${r.delta==null?'—':r.delta+' lbs/wk'} ${r.trend.emoji}\nWeight verdict: ${Insights.weightVerdict(S.entries, S.profile||{}).word}\nTraining (7 days): ${tr7()}\n${Insights.reviewText(Insights.weekReview(S.entries, new Date(), S.params, S.profile||{}))}\nDays logged: ${r.daysLogged} (last 3 weeks) • Streak: ${Insights.streak(S.entries).current} days`; }

document.addEventListener('click', async ev => {
  const t = ev.target.closest('button,a'); if (!t) return;
  if (t.dataset.sec) return openSection(t.dataset.sec);
  if (t.id === 'secDone' || t.dataset.back) return closeSection();
  if (t.dataset.v === 'log' && cur === 'log' && V._sec) return closeSection();
  if (t.dataset.v) return show(t.dataset.v);
  if (t.dataset.goto) { ev.preventDefault(); V._date = null; return show(t.dataset.goto); }
  if (t.closest('.yn') && t.closest('.yn').dataset.k === 'sess') { const i = +t.closest('.yn').dataset.i, on = t.dataset.val==='1'; V._e.sessions[i].done = on;
    t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t)); $('#sx_'+i).style.display = on ? '' : 'none'; autosave(); return; }
  if (t.dataset.sd != null) { const i = +t.dataset.sd, n = +t.dataset.n, sd = V._sched.days[i]; sd.n = n; refreshSched(); return; }
  if (t.dataset.perday) { V._sched.perDay = +t.dataset.perday; V._sched.days.forEach(d => { if (d.n) d.n = V._sched.perDay; }); refreshSched(); return; }
  if (t.closest('.yn')) { const k = t.closest('.yn').dataset.k; V._e[k] = t.dataset.val==='1'; t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t)); autosave(); return; }
  if (t.closest('.sc')) { const k = t.closest('.sc').dataset.k, n = +t.dataset.val; V._e[k] = V._e[k]===n ? '' : n; t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t && V._e[k]!=='')); autosave(); return; }
  if (t.dataset.chip) { $('#f_'+t.dataset.chip).value = t.dataset.val; t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===t)); autosave(); return; }
  if (t.dataset.step) { const i = $('#f_'+t.dataset.step); i.value = Math.max(0, Math.min(24, (+i.value||0) + +t.dataset.d)); autosave(); return; }
  if (t.dataset.jump) { ev.preventDefault(); const k = t.dataset.jump; if (!fieldFor(k)) { openSection(Insights.sectionOf(k)); setTimeout(() => jumpTo(k), 60); return; } return jumpTo(k); }
  if (t.dataset.edit) { ev.preventDefault(); V._date = t.dataset.edit; return show('log'); }
  if (t.dataset.send || false) return sendWeekly();
  if (t.dataset.sharefile) return shareWeeklyFile();
  const w = S.weeks[S.weekIdx];
  switch (t.id) {
    case 'showAll': V._all = true; return show('log');
    case 'updBtn': { t.textContent='Checking…'; try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) await r.update(); } catch (e) {} setTimeout(() => location.reload(), 1500); return; }
    case 'csvBtn': return download(`FightReady-log-${(S.fighter||'fighter').replace(/\W+/g,'-')}-${today()}.csv`, Insights.toCSV(S.entries), 'text/csv;charset=utf-8');
    case 'saveDay': return saveDay();
    case 'delLog': if (confirm('Delete this day?')) { S.entries = S.entries.filter(x=>x.date!==V._e.date); save(); V._date=null; show('log'); sendStatusNow(); } return;
    case 'wkPrev': S.weekIdx = Math.max(0, S.weekIdx-1); save(); return show('plan');
    case 'wkNext': S.weekIdx = Math.min(S.weeks.length-1, S.weekIdx+1); save(); return show('plan');
    case 'wkDup': { const c = JSON.parse(JSON.stringify(w)); const d = new Date(w.start+'T12:00'); d.setDate(d.getDate()+7); c.start = Scoring.ymd(d); c.coachNotes=''; c.days.forEach(x=>x.notes='');
      S.weeks.splice(S.weekIdx+1, 0, c); S.weekIdx++; save(); return show('plan'); }
    case 'wkDel': if (S.weeks.length>1 && confirm('Delete this week?')) { S.weeks.splice(S.weekIdx,1); S.weekIdx=Math.max(0,S.weekIdx-1); save(); show('plan'); } else if (S.weeks.length===1) alert('Keep at least one week.'); return;
    case 'icsBtn': return addToCalendar();
    case 'icsShare': return shareICS();
    case 'pushOn': { const b = t; b.disabled = true; b.textContent = 'Turning on…';
      try { await Push.enable(S.reminders, (S.profile&&S.profile.name)||S.fighter); S.push = true; S.notify = true; save(); sendStatusNow(); alert('🔔 Notifications are on. You\'ll get your morning and evening check-ins, follow-ups if today\'s log isn\'t finished, the Mon/Thu weigh-in, and the Sunday 6 PM report reminder, even when the app is closed.'); }
      catch (e) { alert(e.message==='denied' ? 'Notifications were blocked. To allow them: iPhone Settings → Notifications → FightReady. Calendar reminders below still work.' : 'Could not turn on notifications (' + e.message + '). Check your connection and try again, or use the calendar reminders.'); }
      return show('setup'); }
    case 'pushOff': await Push.disable(); S.push = false; save(); alert('Notifications are off.'); return show('setup');
    case 'pushTest': if (!navigator.serviceWorker) return; (await navigator.serviceWorker.ready).showNotification('🥊 FightReady', { body:'Test: notifications work on this phone.', icon:'icons/icon-192.png', tag:'fr-test' }); return;
    case 'notifBtn': if (!('Notification' in window)) return alert('Notifications are not supported here. Use the calendar reminders.');
      { const p = await Notification.requestPermission(); S.notify = p==='granted'; save(); alert(p==='granted'?'OK. You\'ll get a notification if the app is open at reminder time.':'Notifications are off. The calendar reminders still work.'); } return;
    case 'printBtn': return window.print();
    case 'shareBtn': { const txt = shareText();
      if (navigator.share) { try { await navigator.share({ title:'FightReady Report', text:txt }); } catch (e) {} }
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
    case 'exportBtn': return download(`FightReady-backup-${(S.fighter||'fighter').replace(/\W+/g,'-')}-${today()}.json`, JSON.stringify(Object.assign({app:'fight-readiness',version:1,exported:new Date().toISOString()}, S), null, 1), 'application/json');
    case 'wipeBtn': if (confirm('Erase ALL data on this phone? Export a backup first!') && confirm('Really erase?')) { localStorage.removeItem(KEY); S = load(); show('setup'); } return;
  }
});
const LOGF = ['f_sleep','f_screen','f_weight','f_notes','f_xlabel','f_xrpe','f_xmin'];
document.addEventListener('input', ev => { const t = ev.target, w = S.weeks[S.weekIdx];
  if (cur === 'log' && (LOGF.includes(t.id) || t.dataset.srpe != null || t.dataset.smin != null)) return void autosave();
  if (['p_startWeight','p_targetWeight','p_fightDate'].includes(t.id)) refreshCut();
  if (t.dataset.sl && V._sched) { const [i,j] = t.dataset.sl.split('-').map(Number); V._sched.days[i].labels[j] = t.value; return; }
  if (t.dataset.d !== undefined && t.dataset.k) { w.days[+t.dataset.d][t.dataset.k] = t.value; save(); }
  else if (t.id && t.id.startsWith('w_')) { w[t.id.slice(2)] = t.value; save(); }
});
document.addEventListener('change', async ev => { const t = ev.target;
  if (cur === 'log' && (LOGF.includes(t.id) || t.dataset.srpe != null || t.dataset.smin != null)) return void autosave();
  if (t.id === 'r_untilDone') { S.reminders.untilDone = t.checked; save(); if (S.push) Push.update(S.reminders, (S.profile&&S.profile.name)||S.fighter).catch(()=>{}); return; }
  if (t.id === 'r_morning' || t.id === 'r_evening') { if (t.value) { S.reminders[t.id.slice(2)] = t.value; save(); if (S.push) Push.update(S.reminders, (S.profile&&S.profile.name)||S.fighter).catch(()=>{}); $('#calLink').href = calURL(); $('#calSub').href = calURL().replace(/^https?:/,'webcal:'); } return; }
  if (t.id === 'wkSel') { S.weekIdx = +t.value; save(); return show('plan'); }
  if (t.id === 'w_start') return show('plan');
  if (t.id === 'f_date') { V._date = t.value; return show('log'); }
  if (t.id === 'importFile' && t.files[0]) { const text = await t.files[0].text();
    try { if (/\.json$/i.test(t.files[0].name) || text.trim().startsWith('{')) { const d = JSON.parse(text); if (!Array.isArray(d.entries)) throw new Error('Not a FightReady backup');
        if (!confirm(`Restore backup for "${d.fighter||'fighter'}" with ${d.entries.length} days? This replaces data on this phone.`)) return;
        delete d.app; delete d.version; delete d.exported; S = Object.assign(load(), d); S.params = Object.assign({}, Scoring.DEFAULT_PARAMS, d.params); save(); alert('Restored ✔'); }
      else { const rows = parseCSV(text); upsert(rows); alert(`Imported ${rows.length} days ✔`); }
      show('dash'); } catch (e) { alert('Import failed: ' + e.message); } }
});
function pushBox() { const st = Push.status();
  if (st === 'not-configured') return '<p class="muted">🔔 Push notifications are coming soon. Use the calendar reminders for now.</p>';
  if (st === 'ios-install') return '<div class="hint">🔔 <b>Want notifications?</b> On iPhone they only work from the Home Screen app. In Safari tap Share → <b>Add to Home Screen</b>, open FightReady from the new icon, then come back to Setup and tap <i>Turn on notifications</i>. (Needs iOS 16.4 or newer.)</div>';
  if (st === 'unsupported') return '<p class="muted">🔔 This browser can\'t receive notifications. Use the calendar reminders below.</p>';
  if (S.push && typeof Notification !== 'undefined' && Notification.permission === 'granted') return '<p>🔔 <b>Notifications are on.</b> Changing the times above updates them automatically.</p><button class="btn alt" id="pushTest">Send a test notification</button><button class="btn alt" id="pushOff">Turn off notifications</button>';
  return '<button class="btn" id="pushOn">🔔 Turn on notifications</button><p class="muted">Recommended. Sends your morning and evening check-ins, follow-ups until today\'s log is done, the Mon/Thu weigh-in, and the Sunday 6 PM weekly-report reminder, even when the app is closed. Only your reminder times, time zone, first name and whether today\'s log is finished (yes/no) are sent to the reminder server; your logs stay on this phone.</p>'; }
function calURL() { return new URL(Reminders.calFile(S.reminders.morning, S.reminders.evening), location.href.replace(/[#?].*$/,'')).href; }
async function shareICS() { const url = calURL(), name = 'FightReady-reminders.ics';
  try { const txt = await (await fetch(url, { cache:'no-store' })).text(); const f = new File([txt], name, { type:'text/calendar' });
    if (navigator.canShare && navigator.canShare({ files:[f] })) { try { await navigator.share({ files:[f], title:'FightReady reminders' }); } catch (e) {} return; }
    download(name, txt, 'text/calendar;charset=utf-8'); } catch (e) { location.href = url; } }
function addToCalendar() {
  const ics = Reminders.buildICS({ morning:S.reminders.morning, evening:S.reminders.evening, fighter:S.fighter, url: location.origin + location.pathname.replace(/[^/]*$/, '') });
  const name = 'FightReady-reminders.ics', ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if (ios) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; } // Safari opens the "Add to Calendar" sheet
  download(name, ics, 'text/calendar;charset=utf-8');
}
let lastNotified = {};
function reminderTick() {
  const d = Reminders.due(S.entries.find(e=>e.date===today()), new Date(), S.reminders.morning, S.reminders.evening);
  if (cur === 'dash' && d.length !== document.querySelectorAll('#view .hint a[data-goto]').length) show('dash');
  if (S.notify && 'Notification' in window && Notification.permission === 'granted') d.forEach(k => { const key = today()+k; if (!lastNotified[key]) { lastNotified[key] = 1;
    try { new Notification('FightReady', { body: k==='morning' ? 'Morning log: sleep + nutrition' : 'Evening log: training, screen, family, notes', icon:'icons/icon-192.png' }); } catch (e) {} } });
}
setInterval(reminderTick, 60000); document.addEventListener('visibilitychange', () => { if (document.hidden) { if (_stTimer) sendStatusNow(); } else reminderTick(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadCtl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadCtl || reloaded || sessionStorage.getItem('frReload')===APP_VERSION) return; reloaded = true; sessionStorage.setItem('frReload', APP_VERSION); location.reload(); });
  navigator.serviceWorker.register('sw.js', { updateViaCache:'none' }).then(reg => { reg.update().catch(()=>{}); document.addEventListener('visibilitychange', () => { if (document.visibilityState==='visible') reg.update().catch(()=>{}); }); }).catch(()=>{});
}
if (!S.profile && S.fighter) S.profile = { name:S.fighter, coach:S.coach||'', targetWeight:S.targetWeight||'', startWeight:'' }; // migrate older installs
{ const q = new URLSearchParams(location.search).get('tab'); show(['dash','log','plan','report','setup','help'].includes(q) ? q : 'dash'); }
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.tab) { V._date = null; V._sec = null; show(e.data.tab); } });
if (S.push) Push.update(S.reminders, (S.profile&&S.profile.name)||S.fighter).then(sendStatusNow).catch(()=>{});
