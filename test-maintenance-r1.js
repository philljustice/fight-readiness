// Phase 1 Maintenance: scoring, copy, report, no-fight-date chrome. No network.
const assert = require('assert');
const {parseHTML, Event} = require('linkedom');
const vm = require('vm');
const fs = require('fs');
const Scoring = require('./scoring');
const Recovery = require('./recovery');

function weeklyRate() {
  assert.equal(Scoring.weeklyTrainingScore(0), 0);
  assert.equal(Scoring.weeklyTrainingScore(1), 30);
  assert.equal(Scoring.weeklyTrainingScore(2), 60);
  assert.equal(Scoring.weeklyTrainingScore(3), 90);
  assert.equal(Scoring.weeklyTrainingScore(4), 100);
  assert.equal(Scoring.weeklyTrainingScore(5), 100);
  assert.ok(Scoring.weeklyTrainingScore(3.5) > 90 && Scoring.weeklyTrainingScore(3.5) < 100);
}
weeklyRate();

function qualifying() {
  assert.equal(Scoring.qualifyingSession({label:'Technique', rpe:6, done:true}), true);
  assert.equal(Scoring.qualifyingSession({comment:'Easy roll', rpe:4}), true);
  assert.equal(Scoring.qualifyingSession({label:'Technique', rpe:''}), false, 'intensity required');
  assert.equal(Scoring.qualifyingSession({rpe:7, label:''}), false, 'comment required');
  assert.equal(Scoring.qualifyingSession({label:'X', rpe:5, mins:''}), true, 'minutes optional');
  assert.equal(Scoring.qualifyingSession({label:'X', rpe:5, done:false}), false);
}
qualifying();

function maintScore() {
  const start = '2026-10-01';
  const days = ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08'];
  const sess = i => ({date:days[i], v:2, context:{mode:'maintenance'}, nutrition:true, sessions:[{label:'Technique', rpe:6, mins:40, done:true}]});
  // 4 sessions across a 7-day window ending Nov 8 inclusive
  const four = [0,1,2,3].map(sess);
  const r4 = Scoring.compute(four, new Date('2026-11-08T12:00:00-05:00'), {startDate:start, trainingPlan:'maintenance', includeToday:true, noMomentum:true, unlockDays:7});
  assert.equal(Math.round(r4.cats.training), 100, '4 sessions / week = 100');
  assert.equal(r4.locked, false);
  const three = [0,1,2].map(sess);
  const r3 = Scoring.compute(three, new Date('2026-11-08T12:00:00-05:00'), {startDate:start, trainingPlan:'maintenance', includeToday:true, noMomentum:true, unlockDays:7});
  assert.equal(Math.round(r3.cats.training), 90, '3 sessions / week = 90');
  // Camp formula is unchanged when trainingPlan is omitted
  const campDay = {date:'2026-11-07', v:2, nutrition:true, sessions:[{label:'A', done:true, rpe:6, mins:40},{label:'B', done:false}]};
  const camp = Scoring.compute([campDay], new Date('2026-11-08T12:00:00-05:00'), {startDate:start, unlockDays:7});
  assert.equal(camp.cats.training, 50);
}
maintScore();

function campEntriesCarry() {
  const S = {schemaVersion:3, startDate:'2026-10-20', profile:{name:'UNIT', fightDate:'2026-11-04'}, entries:[
    {date:'2026-11-01', v:2, nutrition:true, context:{mode:'camp'}, sessions:[{label:'Camp', rpe:7, mins:60, done:true}]},
    {date:'2026-11-05', v:2, context:{mode:'recovery'}, energy:3, mood:3},
    {date:'2026-11-08', v:2, context:{mode:'maintenance'}, nutrition:true, sessions:[{label:'Easy', rpe:4, done:true}]}
  ], recovery:{bouts:[{id:'b1', fightDate:'2026-11-04', status:'scheduled', recoveryDays:3, campStart:'2026-10-20'}], holds:[], events:[], camps:[], reviews:{}, goals:[]}};
  Recovery.migrate(S, '2026-11-08');
  const scored = Recovery.campEntries(S, '2026-11-08');
  assert.ok(scored.some(e=>e.date==='2026-11-01'), 'camp history carries into Maintenance');
  assert.ok(scored.some(e=>e.date==='2026-11-08'), 'everyday Maintenance logs count');
  assert.ok(!scored.some(e=>e.date==='2026-11-05'), 'Recovery check-ins excluded');
  assert.equal(Recovery.phase(S.recovery,'2026-11-08').mode, 'maintenance');
  // Diego: no fight date
  const D = {schemaVersion:3, startDate:'2026-11-08', profile:{name:'Diego', fightDate:''}, entries:[
    {date:'2026-11-08', v:2, context:{mode:'maintenance'}, nutrition:true, energy:4, soreness:2, mood:4, stress:2, sleep:8, sessions:[{label:'Wrestling', rpe:6, mins:50, done:true}]}
  ], recovery:{bouts:[], holds:[], events:[], camps:[], reviews:{}, goals:[]}};
  Recovery.migrate(D,'2026-11-08');
  const de = Recovery.campEntries(D,'2026-11-08');
  assert.equal(de.length, 1);
  const r = Scoring.compute(de, new Date('2026-11-08T12:00:00-05:00'), {startDate:'2026-11-08', trainingPlan:'maintenance', includeToday:true, noMomentum:true, unlockDays:7});
  assert.ok(r.daysLogged >= 1, 'early score from day 1');
  assert.equal(r.locked, true);
  assert.equal(r.unlockIn, 7);
  assert.equal(Recovery.historyLabel(D, D.entries[0]), 'Maintenance');
  assert.equal(Recovery.neverInCamp(D), true);
  assert.equal(Recovery.historyLabel(D, {date:'2026-11-08', weight:180}), 'Log');
}
campEntriesCarry();

function startDateKept() {
  const r = {bouts:[], holds:[], events:[], camps:[], reviews:{}, goals:[], maintenance:{sessions:4,checkins:3,weighInsPerWeek:1}, reminders:{optIn:false,quietStart:'21:00',quietEnd:'08:00'}};
  const out = Recovery.schedule(r, '2026-11-08', {fightDate:'2026-12-20', recoveryDays:7});
  assert.ok(out.fresh);
}
startDateKept();

function reviewFormat() {
  const review = {answers:{injury:'No', head:'No', suspension:'No', cardio:'Yes'}, notes:{cardio:'Held up late', 'What went right?':'Pace'}, completedAt:'2026-11-06', status:'complete'};
  const html = Recovery.reviewHtml(review, 'MMA');
  assert.ok(html.includes('<b>Did your cardio hold up in the later rounds?</b>'));
  assert.ok(html.includes('class="rc-a">Yes</'));
  assert.equal(Recovery.daysAfterFight('2026-11-06','2026-11-04'), 2);
  assert.equal(Recovery.daysAfterFight('2026-11-04','2026-11-04'), 0);
  const text = Recovery.summary(review, 'MMA');
  assert.ok(text.includes('Did your cardio hold up in the later rounds?'));
  assert.ok(text.indexOf('Did your cardio hold up in the later rounds?') < text.indexOf('\nYes'));
}
reviewFormat();

function app(seed){
 const UnitDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const storage=new Map(seed?[['fightReady.v1',JSON.stringify(seed)]]:[]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit test'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert:msg=>{throw Error(msg)},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;
 window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);
 for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,storage,run:s=>vm.runInContext(s,c),doc:ctx.document};
}

// Fresh no-fight-date Maintenance dash: copy, no camp nags, no Fight Review, logs count
{
  const a = app();
  a.run(`S.profile={name:'UNIT Diego',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT Diego';S.startDate=today();S.entries=[{date:today(),v:2,context:{mode:'maintenance'},nutrition:true,energy:4,soreness:2,mood:4,stress:2,sleep:8,sessions:[{label:'Wrestling',rpe:6,mins:45,done:true}]}];save();show('dash')`);
  const t = a.doc.body.textContent;
  assert.ok(a.doc.querySelector('#rcMaintIntro') || t.includes('All dated logs are kept.'));
  assert.ok(!/Interim/i.test(t));
  assert.ok(!t.includes('lands next week'));
  assert.ok(!t.includes('colour thresholds'));
  assert.ok(!t.includes('To do'));
  assert.ok(!t.includes('second weekend of camp'));
  assert.ok(!t.includes('camp history'));
  assert.ok(!t.includes('Fight Review'));
  assert.ok(!t.includes("it's a weigh-in day (Mon/Thu)") && !t.includes("It's a weigh-in day (Mon/Thu)"));
  const days = a.run('res().daysLogged');
  assert.ok(days >= 1, 'Maintenance log counts in FightReady score, got '+days);
  a.run("show('log')");
  const hist = a.doc.body.textContent;
  assert.ok(!hist.includes('camp history'));
  a.run("V._sec='training';show('log')");
  assert.ok(a.doc.querySelector('#maintSessions') || a.doc.querySelector('[data-mlabel="0"]'));
  assert.ok(a.doc.body.textContent.includes('Estimated intensity'));
}

// Fight Review hidden in Maintenance setup; present in Recovery
{
  const a = app();
  a.run(`S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';show('setup')`);
  assert.ok(!a.doc.body.textContent.includes('Open Fight Review') && !a.doc.body.textContent.includes('Edit Fight Review'));
  a.run(`S.recovery.bouts=[{id:'unit-bout',fightDate:Recovery.addDays(today(),-2),status:'scheduled',recoveryDays:7}];show('dash')`);
  assert.ok(a.doc.querySelector('#rcFightReviewCard') || a.doc.body.textContent.includes('Start Fight Review'));
  a.run("show('setup')");
  assert.ok(a.doc.body.textContent.includes('Fight Review'));
  a.run("show('report')");
  assert.ok(!a.doc.querySelector('#rcCoachNotes'));
  assert.ok(!a.doc.body.textContent.includes('wellness check-ins') && !a.doc.body.textContent.includes('sessions recorded'));
  // complete a review dated 2 days after the fight (today is Nov 5, fight Nov 3)
  a.run(`(function(){const v=S.recovery.reviews[S.recovery.bouts[0].id]||(S.recovery.reviews[S.recovery.bouts[0].id]={answers:{},notes:{}});v.status='complete';v.completedAt=today();v.answers={injury:'No',head:'No',suspension:'No',cardio:'Yes'};v.summary=Recovery.summary(v,'MMA');show('report');})()`);
  assert.ok(a.doc.body.textContent.includes('Filled out 2 days after the fight') || a.run('shareText()').includes('2 days after the fight'));
  assert.ok(a.doc.querySelector('#rcReviewQa') && a.doc.querySelector('#rcReviewQa').innerHTML.includes('<b>'));
}

// Booking a new fight does not reset an existing startDate
{
  const a = app();
  a.run(`S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';S.startDate='2026-10-01';show('setup')`);
  a.doc.querySelector('#rcFight').value='2026-12-20';
  a.doc.querySelector('#rcDays').value='7';
  a.doc.querySelector('[data-rc="schedule"]').click();
  assert.equal(a.run('S.startDate'), '2026-10-01');
}

// Post-recovery Maintenance landing still keeps camp history in the score
{
  const a = app();
  a.run(`S.profile={name:'UNIT Pablo',fightDate:'2026-10-28'};S.fighter='UNIT Pablo';S.startDate='2026-10-01';
    S.entries=[
      {date:'2026-10-25',v:2,context:{mode:'camp'},nutrition:true,family:true,sleep:8,screen:1,energy:4,soreness:2,mood:4,stress:2,sessions:[{label:'Spar',rpe:8,mins:60,done:true}]},
      {date:'2026-10-29',v:2,context:{mode:'recovery'},energy:3,mood:3},
      {date:'2026-11-05',v:2,context:{mode:'maintenance'},nutrition:true,energy:4,soreness:2,mood:4,stress:2,sleep:8,sessions:[{label:'Technique',rpe:5,mins:40,done:true}]}
    ];
    S.recovery.bouts=[{id:'pb',fightDate:'2026-10-28',status:'scheduled',recoveryDays:7,campStart:'2026-10-01'}];
    show('dash')`);
  assert.equal(a.run("Recovery.phase(S.recovery,today()).mode"), 'maintenance');
  assert.ok(a.doc.body.textContent.includes('All dated logs are kept.'));
  const dates = a.run("Recovery.campEntries(S,today()).map(e=>e.date).join(',')");
  assert.ok(dates.includes('2026-10-25') && dates.includes('2026-11-05') && !dates.includes('2026-10-29'));
  assert.ok(a.run('res().daysLogged') >= 2);
}


{
  const Early = require('./early');
  const weighOnly = {date:'2026-11-08', v:2, context:{mode:'maintenance'}, weight:170, sessions:[]};
  const d = Early.daily(weighOnly, {});
  assert.equal(d.scorable, false, 'weigh-in-only is not a scorable day');
  assert.equal(d.score, null, 'weigh-in-only today score is blank, not 0, got '+d.score);
  assert.equal(d.trainingRest, true);
  const rest = {date:'2026-11-08', v:2, context:{mode:'maintenance'}, nutrition:true, family:true, sleep:8, screen:1, energy:5, soreness:1, mood:5, stress:1, sessions:[]};
  const rd = Early.daily(rest, {});
  assert.equal(rd.trainingRest, true);
  assert.equal(rd.weights.training, 0, 'rest day omits training from today\'s score');
  assert.equal(rd.score, 100, 'Maintenance rest day is neutral, not a Training 0 penalty, got '+rd.score);
  const mid = {date:'2026-11-08', v:2, context:{mode:'maintenance'}, nutrition:true, family:true, sleep:8, screen:1, energy:4, soreness:2, mood:4, stress:2, sessions:[]};
  const md = Early.daily(mid, {});
  assert.equal(md.score, 95, 'rest day renormalizes remaining categories, got '+md.score);
  const fbRest = Early.feedback(md, mid);
  assert.ok(fbRest.fix !== 'training', 'rest day does not treat unlogged training as the thing to fix');
  const trained = {date:'2026-11-08', v:2, context:{mode:'maintenance'}, nutrition:true, sessions:[{label:'Technique', rpe:5, done:true}]};
  const tr = Early.daily(trained, {});
  assert.equal(Math.round(tr.cats.training), 100);
  const fb = Early.feedback(tr, trained);
  assert.ok(!fb.text.includes('scheduled session'));
  // weekly FightReady training is unchanged: 4=100, 3=90 even when some days are rest
  const days = ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08'];
  const sess = i => ({date:days[i], v:2, context:{mode:'maintenance'}, nutrition:true, sessions:[{label:'Technique', rpe:6, done:true}]});
  const restDay = {date:'2026-11-08', v:2, context:{mode:'maintenance'}, nutrition:true, family:true, sleep:8, screen:1, energy:5, soreness:1, mood:5, stress:1, sessions:[]};
  const week = [0,1,2].map(sess).concat([restDay]);
  const wr = Scoring.compute(week, new Date('2026-11-08T12:00:00-05:00'), {startDate:'2026-10-01', trainingPlan:'maintenance', includeToday:true, noMomentum:true, unlockDays:7});
  assert.equal(Math.round(wr.cats.training), 90, 'weekly training still 3/week = 90 when today is rest');
  const onlyW = Scoring.compute([weighOnly], new Date('2026-11-08T12:00:00-05:00'), {startDate:'2026-11-08', trainingPlan:'maintenance', includeToday:true, noMomentum:true});
  assert.equal(onlyW.scorable, false);
  assert.equal(onlyW.daysLogged, 1);
}

// New fighter: ring and today's score show — not 0
{
  const a = app();
  a.run(`S.profile={name:'UNIT New',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT New';S.startDate=today();S.entries=[{date:today(),v:2,context:{mode:'maintenance'},weight:180,sessions:[]}];save();show('dash')`);
  assert.equal(a.run('res().scorable'), false);
  const hero = a.doc.querySelector('.hero-num');
  assert.ok(hero, 'hero ring exists');
  assert.equal(hero.textContent.trim(), '—', 'new fighter ring is a dash, got '+hero.textContent);
  const todayScore = a.doc.querySelector('#todayCard b');
  assert.ok(todayScore);
  assert.equal(todayScore.textContent.trim(), '—', 'today score is a dash for no scorable day, got '+todayScore.textContent);
  const cats = a.doc.querySelectorAll('#todayCard .row b');
  assert.ok([...cats].every(b => b.textContent.trim() === '—' || b.textContent.trim() === todayScore.textContent.trim()));
}

// Maintenance rest day: today's score is not Training 0; log shows the light-work note (and not under a hold)
{
  const a = app();
  a.run(`S.profile={name:'UNIT Rest',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT Rest';S.startDate='2026-10-01';
    S.entries=[
      {date:'2026-11-02',v:2,context:{mode:'maintenance'},nutrition:true,sessions:[{label:'Technique',rpe:6,done:true}]},
      {date:'2026-11-03',v:2,context:{mode:'maintenance'},nutrition:true,sessions:[{label:'Wrestling',rpe:6,done:true}]},
      {date:'2026-11-04',v:2,context:{mode:'maintenance'},nutrition:true,sessions:[{label:'Strength',rpe:6,done:true}]},
      {date:today(),v:2,context:{mode:'maintenance'},nutrition:true,family:true,sleep:8,screen:1,energy:4,soreness:2,mood:4,stress:2,sessions:[]}
    ];save();show('dash')`);
  const card = a.doc.querySelector('#todayCard');
  assert.ok(card);
  const n = +card.querySelector('h3 + b, .row b').textContent.trim();
  const todayNum = a.run(`Early.daily(S.entries.find(e=>e.date===today()), S.params).score`);
  assert.equal(todayNum, 95);
  assert.ok(card.textContent.includes('Rest'), 'today card marks training as Rest, not 0/25');
  assert.ok(!/Training[\s\S]{0,40}0\/25/.test(card.textContent.replace(/\s+/g,' ')), 'no Training 0/25 on a rest day');
  a.run("V._sec='training';show('log')");
  const note = a.doc.querySelector('#maintRestNote');
  assert.ok(note, 'rest-day encouragement is on the training log');
  assert.ok(/stretching|mobility|easy walk/i.test(note.textContent));
  assert.ok(a.doc.querySelector('#maintSessions'), 'can still log an activity on a rest day');
  a.run(`S.recovery.holds=[{id:'h1',date:today(),reason:'care',cleared:false,source:'unit'}];V._sec='training';show('log')`);
  const held = a.doc.body.textContent;
  assert.ok(!/stretching|mobility|easy walk/i.test(held), 'no physical-activity suggestion while a care hold is active');
}

// Print/PDF: athlete draft textarea and its label are hidden; Q/A list remains
{
  const a = app();
  a.run(`S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';
    S.recovery.bouts=[{id:'unit-bout',fightDate:Recovery.addDays(today(),-2),status:'scheduled',recoveryDays:7}];
    const v=S.recovery.reviews['unit-bout']={status:'complete',completedAt:today(),answers:{injury:'No',head:'No',cardio:'Yes'},notes:{},summary:Recovery.summary({answers:{injury:'No',head:'No',cardio:'Yes'},notes:{}},'MMA')};
    show('report')`);
  const draft = a.doc.querySelector('#rcAthleteDraft');
  const ta = a.doc.querySelector('#rcEditedSummary');
  assert.ok(draft && ta, 'editable draft remains on screen');
  assert.ok(draft.classList.contains('noprint'), 'draft wrapper is noprint so it is hidden in print/PDF');
  const qa = a.doc.querySelector('#rcReviewQa');
  assert.ok(qa && qa.innerHTML.includes('<b>'), 'clean Q/A list is still in the report');
  assert.ok(!qa.contains(ta), 'textarea is not inside the printed Q/A list');
}

console.log('Maintenance r1 scoring, history, copy, report typography, startDate, and dash chrome pass');

