// Phase 2 Maintenance: outline & goals, review goals copy, weekly ratings, FightReady report, weigh-in reminders.
const assert = require('assert');
const {parseHTML} = require('linkedom');
const vm = require('vm');
const fs = require('fs');
const Scoring = require('./scoring');
const Recovery = require('./recovery');
const Profile = require('./profile');

function app(seed){
 const UnitDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const storage=new Map(seed?[['fightReady.v1',JSON.stringify(seed)]]:[]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit test'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert:msg=>{throw Error(msg)},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;ctx.Event=window.Event;ctx.CustomEvent=window.CustomEvent;
 window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);
 for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,storage,run:s=>vm.runInContext(s,c),doc:ctx.document};
}

function seedMaint(extra){
  return Object.assign({
    name:"S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';S.startDate='2026-10-01';S.entries=[];"
  }, extra||{});
}

// Defaults and migrate: 4 sessions, 1 weigh-in; do not overwrite a coach-saved 2
{
  const fresh={profile:{name:'UNIT'},entries:[],params:{...Scoring.DEFAULT_PARAMS},weeks:[]};
  Recovery.migrate(fresh,'2026-11-05');
  assert.equal(fresh.schemaVersion,3);
  assert.equal(fresh.recovery.maintenance.sessions,4);
  assert.equal(fresh.recovery.maintenance.weighInsPerWeek,1);
  assert.deepEqual(fresh.recovery.goalRatings,{});
  const kept={profile:{name:'UNIT'},entries:[{date:'2026-11-01',v:2,notes:'UNIT keep',weight:186}],recovery:{goals:['Stay sharp'],goalsConfirmed:true,maintenance:{sessions:2,checkins:3},bouts:[],holds:[],events:[],camps:[],reviews:{}}};
  Recovery.migrate(kept,'2026-11-05');
  assert.equal(kept.recovery.maintenance.sessions,2,'coach-saved sessions must not be overwritten');
  assert.equal(kept.recovery.goalsConfirmed,true);
  assert.equal(kept.recovery.maintenance.weighInsPerWeek,1);
  assert.equal(kept.entries[0].notes,'UNIT keep');
  assert.equal(kept.schemaVersion,3);
}

// weekMonday, ratings ready, weekly training log
{
  assert.equal(Recovery.weekMonday('2026-11-05'),'2026-11-02');
  assert.equal(Recovery.weekMonday('2026-11-02'),'2026-11-02');
  assert.equal(Recovery.weekMonday('2026-11-08'),'2026-11-02');
  const r={goals:['A','B'],goalRatings:{}};
  assert.equal(Recovery.goalRatingsReady(r,'2026-11-05'),false);
  r.goalRatings={'2026-11-02':{0:{value:4,comment:'moved'},1:{value:3,comment:'still working'}}};
  assert.equal(Recovery.goalRatingsReady(r,'2026-11-05'),true);
  r.goalRatings={'2026-11-02':{0:{value:4,comment:'moved'},1:{value:3,comment:'  '}}};
  assert.equal(Recovery.goalRatingsReady(r,'2026-11-05'),false,'comment required');
  assert.equal(Recovery.goalRatingsReady({goals:[]},'2026-11-05'),true,'no goals means ratings not required');
  const S={entries:[
    {date:'2026-11-03',v:2,sessions:[{label:'Technique',rpe:6,mins:40,done:true}]},
    {date:'2026-11-04',v:2,sessions:[{comment:'Easy roll',rpe:4,done:true}]},
    {date:'2026-11-05',v:2,sessions:[{label:'No intensity',done:true}]},
    {date:'2026-10-30',v:2,sessions:[{label:'Last week',rpe:5,done:true}]}
  ]};
  const log=Recovery.weeklyTrainingLog(S,'2026-11-05');
  assert.equal(log.week,'2026-11-02');
  assert.equal(log.count,2);
  assert.ok(log.sessions.some(s=>s.comment==='Technique' && s.rpe===6 && s.mins===40));
  assert.equal(Recovery.weighInsThisWeek({entries:[{date:'2026-11-03',weight:186},{date:'2026-10-30',weight:190}]},'2026-11-05'),1);
}

// One-time copy of Fight Review goals; lists stay separate
{
  const S={profile:{name:'UNIT',fightDate:''},entries:[],recovery:{bouts:[{id:'b1',fightDate:'2026-10-28',status:'scheduled',recoveryDays:7}],holds:[],events:[],camps:[],reviews:{b1:{status:'complete',completedAt:'2026-10-30',goals:['Sharpen takedowns','Sleep 8 hours']}},goals:[],maintenance:{sessions:4,checkins:3,weighInsPerWeek:1}}};
  Recovery.migrate(S,'2026-11-05');
  const first=Recovery.maybeCopyReviewGoals(S,'2026-11-05');
  assert.equal(first.copied,true);
  assert.deepEqual(S.recovery.goals,['Sharpen takedowns','Sleep 8 hours']);
  const again=Recovery.maybeCopyReviewGoals(S,'2026-11-05');
  assert.equal(again.copied,false);
  S.recovery.goals=['Edited outline goal'];
  Recovery.maybeCopyReviewGoals(S,'2026-11-05');
  assert.deepEqual(S.recovery.goals,['Edited outline goal'],'later outline edits stay');
  assert.deepEqual(S.recovery.reviews.b1.goals,['Sharpen takedowns','Sleep 8 hours'],'review list stays separate');
  const already={profile:{name:'UNIT'},entries:[],recovery:{bouts:[{id:'b1',fightDate:'2026-10-28',status:'scheduled',recoveryDays:7}],holds:[],events:[],camps:[],reviews:{b1:{goals:['From review']}},goals:['Already on outline'],maintenance:{sessions:4}}};
  Recovery.migrate(already,'2026-11-05');
  const skip=Recovery.maybeCopyReviewGoals(already,'2026-11-05');
  assert.equal(skip.copied,false);
  assert.deepEqual(already.recovery.goals,['Already on outline']);
  const savedEmpty={profile:{name:'UNIT'},entries:[],recovery:{bouts:[{id:'b1',fightDate:'2026-10-28',status:'scheduled',recoveryDays:7}],holds:[],events:[],camps:[],reviews:{b1:{goals:['From review']}},goals:[],maintenance:{sessions:4,outlineSaved:true}}};
  Recovery.migrate(savedEmpty,'2026-11-05');
  const noCopy=Recovery.maybeCopyReviewGoals(savedEmpty,'2026-11-05');
  assert.equal(noCopy.copied,false);
  assert.deepEqual(savedEmpty.recovery.goals,[]);
}

// Holds / safety unchanged: active hold blocks leaving Recovery early
{
  const S={profile:{name:'UNIT'},entries:[],recovery:{bouts:[{id:'b1',fightDate:'2026-11-03',status:'scheduled',recoveryDays:7}],holds:[],events:[],camps:[],reviews:{},goals:[]}};
  Recovery.migrate(S,'2026-11-05');
  Recovery.addHold(S.recovery,'2026-11-04','UNIT restriction','unit');
  assert.equal(Recovery.phase(S.recovery,'2026-11-05').mode,'recovery');
  assert.equal(Recovery.restricted(S.recovery,'2026-11-05'),true);
  assert.throws(()=>Recovery.requestEarlyMaint(S.recovery,'2026-11-05',{confirmed:true}));
}

// Outline page defaults, prompt, checkbox persists immediately, logging never blocked
{
  const a=app();
  a.run(`S.profile={name:'UNIT Diego',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT Diego';S.startDate=today();S.entries=[];save();show('dash')`);
  assert.equal(a.run("Recovery.phase(S.recovery,today()).mode"),'maintenance');
  assert.ok(a.doc.querySelector('#rcOutlinePrompt'),'Score shows a gentle outline prompt');
  assert.ok(/keep logging today either way/i.test(a.doc.querySelector('#rcOutlinePrompt').textContent));
  a.run("show('report')");
  assert.ok(a.doc.querySelector('#rcOutlinePrompt'),'Report also prompts until the outline is saved');
  a.run("show('log')");
  assert.ok(a.doc.querySelector('#view') && a.doc.body.textContent.includes('Morning'),'daily logging is still available without a saved outline');
  a.run("show('plan')");
  const freq=a.doc.querySelector('#rcFrequency');
  const weigh=a.doc.querySelector('#rcWeighIns');
  assert.ok(freq && weigh, 'outline editor is on the Schedule tab in Maintenance');
  assert.equal(freq.value,'4');
  assert.equal(weigh.value,'1');
  assert.ok(/starting fresh or coming off a camp/i.test(a.doc.querySelector('#rcOutlineIntro').textContent));
  const box=a.doc.querySelector('#rcGoalsApproved');
  assert.ok(box && !box.checked);
  box.checked=true;
  box.dispatchEvent(new a.c.Event('change',{bubbles:true}));
  assert.equal(a.run('S.recovery.goalsConfirmed'),true,'Agreed checkbox persists on change without Save');
  a.doc.querySelector('[data-rc-outline-goal="0"]').value='Stay mobile';
  freq.value='3';
  weigh.value='2';
  a.doc.querySelector('[data-rc="goals"]').click();
  assert.equal(a.run('S.recovery.maintenance.sessions'),3);
  assert.equal(a.run('S.recovery.maintenance.weighInsPerWeek'),2);
  assert.equal(a.run('S.recovery.maintenance.outlineSaved'),true);
  assert.deepEqual(a.run('S.recovery.goals'),['Stay mobile']);
  a.run("show('dash')");
  assert.ok(!a.doc.querySelector('#rcOutlinePrompt'),'prompt leaves once the outline is saved');
}

// Previously coach-saved sessions stay in the outline field
{
  const a=app();
  a.run(`S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';S.recovery.goalsConfirmed=true;S.recovery.maintenance.sessions=2;S.recovery.maintenance.outlineSaved=true;save();show('plan')`);
  assert.equal(a.doc.querySelector('#rcFrequency').value,'2');
}

// Fight Review Goals block is Recovery-only; copy on first Maintenance show
{
  const a=app();
  a.run(`S.profile={name:'UNIT Pablo',fightDate:'2026-10-28',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT Pablo';S.startDate='2026-10-01';
    S.recovery.bouts=[{id:'pb',fightDate:'2026-10-28',status:'scheduled',recoveryDays:7,campStart:'2026-10-01'}];
    show('fightReview')`);
  const box=a.doc.querySelector('#rcReviewGoalsBox');
  assert.ok(box,'labelled optional Goals block is on Fight Review');
  assert.ok(/Goals \(optional\)/.test(box.textContent));
  a.doc.querySelector('[data-rc-review-goal="0"]').value='Build an aerobic base';
  a.doc.querySelector('[data-rc-review-goal="0"]').dispatchEvent(new a.c.Event('input',{bubbles:true}));
  assert.deepEqual(a.run("S.recovery.reviews[S.recovery.bouts[0].id].goals"),['Build an aerobic base']);
  // Jump past Recovery into Maintenance with an empty outline
  a.run(`S.recovery.goals=[];delete S.recovery.maintenance.goalsCopiedFromReview;S.recovery.maintenance.outlineSaved=false;show('dash')`);
  assert.equal(a.run("Recovery.phase(S.recovery,today()).mode"),'maintenance');
  assert.deepEqual(a.run('S.recovery.goals'),['Build an aerobic base']);
  assert.equal(a.run('S.recovery.maintenance.goalsCopiedFromReview'),true);
  a.run("show('plan')");
  assert.ok(/After Recovery/.test(a.doc.querySelector('#rcOutlineIntro').textContent));
  a.doc.querySelector('[data-rc-outline-goal="0"]').value='Edited after copy';
  a.doc.querySelector('[data-rc="goals"]').click();
  assert.deepEqual(a.run('S.recovery.goals'),['Edited after copy']);
  assert.deepEqual(a.run("S.recovery.reviews.pb.goals"),['Build an aerobic base']);
}

// Weekly ratings gate the Maintenance coach report; report uses FightReady score not process score
{
  const a=app();
  a.run(`S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';S.startDate='2026-10-01';
    S.entries=[
      {date:'2026-11-02',v:2,context:{mode:'maintenance'},nutrition:true,energy:4,soreness:2,mood:4,stress:2,sleep:8,screen:1,family:true,sessions:[{label:'Technique',rpe:6,mins:40,done:true}]},
      {date:'2026-11-03',v:2,context:{mode:'maintenance'},nutrition:true,energy:4,soreness:2,mood:4,stress:2,sleep:8,screen:1,family:true,sessions:[{comment:'Wrestling',rpe:7,mins:50,done:true}]},
      {date:'2026-11-04',v:2,context:{mode:'maintenance'},nutrition:true,energy:4,soreness:2,mood:4,stress:2,sleep:8,screen:1,family:true,sessions:[{label:'Strength',rpe:5,mins:30,done:true}]}
    ];
    S.recovery.goals=['Stay mobile','Sleep well'];
    S.recovery.maintenance.sessions=4;S.recovery.maintenance.outlineSaved=true;S.recovery.goalsConfirmed=true;
    save();show('report')`);
  assert.ok(a.doc.querySelector('#rcGoalRatings'),'weekly rating card is on the report');
  assert.ok(a.doc.querySelector('#rcRatingsPending'));
  assert.ok(a.doc.querySelector('#shareBtn').disabled && a.doc.querySelector('#printBtn').disabled,'share/print wait until ratings are done');
  assert.ok(a.doc.querySelector('#rcReportNotReady'));
  assert.ok(!/process score/i.test(a.doc.body.textContent));
  assert.ok(a.doc.querySelector('#rcMaintFrScore'),'FightReady score is on the Maintenance report');
  assert.ok(/3 sessions/.test(a.doc.querySelector('#rcWeekTrainTotal').textContent));
  assert.ok(/Technique/.test(a.doc.querySelector('#rcWeekSessions').textContent) && /RPE 6/.test(a.doc.querySelector('#rcWeekSessions').textContent));
  const scale=a.doc.querySelector('[data-goal-rate="0"]');
  assert.equal(scale.querySelectorAll('button').length,5,'same 1–5 icon scale as daily logs');
  scale.querySelector('[data-val="4"]').click();
  a.doc.querySelector('[data-goal-comment="0"]').value='Moved well in technique';
  a.doc.querySelector('[data-goal-comment="0"]').dispatchEvent(new a.c.Event('input',{bubbles:true}));
  a.doc.querySelector('[data-goal-rate="1"] [data-val="3"]').click();
  a.doc.querySelector('[data-goal-comment="1"]').value='Sleep is still patchy';
  a.doc.querySelector('[data-goal-comment="1"]').dispatchEvent(new a.c.Event('input',{bubbles:true}));
  // clicking the second rating persist()s and should keep flushed comments
  a.run("show('report')");
  // comments may need a second persist if the last action was only input
  if(a.doc.querySelector('#rcRatingsPending')){
    a.doc.querySelector('[data-goal-rate="1"] [data-val="3"]').click();
  }
  assert.ok(a.doc.querySelector('#rcRatingsReady'),'report is marked ready once every goal has a rating and comment');
  assert.ok(!a.doc.querySelector('#shareBtn').disabled && !a.doc.querySelector('#printBtn').disabled);
  const html=a.doc.body.textContent;
  assert.ok(/4\/5/.test(html) && /Moved well in technique/.test(html));
  assert.ok(/3\/5/.test(html) && /Sleep is still patchy/.test(html));
  const text=a.run('shareText()');
  assert.ok(/FightReady score:/.test(text));
  assert.ok(/Stay mobile · 4\/5/.test(text));
  assert.ok(!/process score/i.test(text));
  const draft=a.doc.querySelector('#rcAthleteDraft');
  assert.ok(draft && draft.classList.contains('noprint'),'athlete draft stays hidden in print');
}

// Weigh-in reminders follow the outline setting (in-app only; never points)
{
  const a=app();
  a.run(`S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';S.startDate='2026-10-01';
    S.entries=[{date:today(),v:2,context:{mode:'maintenance'},nutrition:true,energy:4,soreness:2,mood:4,stress:2,sleep:8,sessions:[]}];
    S.recovery.maintenance.weighInsPerWeek=2;S.recovery.maintenance.outlineSaved=true;save();show('dash')`);
  const nag=a.doc.querySelector('#maintWeighNag');
  assert.ok(nag,'nag appears when this week is short of the outline target');
  assert.ok(/2 weigh-ins this week/.test(nag.textContent));
  assert.ok(/does not change your score/.test(nag.textContent));
  a.run(`S.entries[0].weight=186;show('dash')`);
  assert.ok(a.doc.querySelector('#maintWeighNag'),'still nagging after 1 of 2');
  a.run(`S.entries.push({date:'2026-11-03',v:2,context:{mode:'maintenance'},weight:185});show('dash')`);
  assert.ok(!a.doc.querySelector('#maintWeighNag'),'nag clears once the weekly target is met');
  a.run(`S.recovery.maintenance.weighInsPerWeek=0;S.entries=[{date:today(),v:2,context:{mode:'maintenance'},nutrition:true,sessions:[]}];show('dash')`);
  assert.ok(!a.doc.querySelector('#maintWeighNag'),'0 turns the reminder off');
}

// Synthetic v3 backup (Pablo-like camp history + Diego-like no-date start) restores; logs preserved
{
  const pablo={app:'fight-readiness',version:3,schemaVersion:3,profile:{name:'UNIT Pablo',fightDate:'2026-10-28'},fighter:'UNIT Pablo',startDate:'2026-10-01',entries:[
    {date:'2026-10-25',v:2,context:{mode:'camp'},nutrition:true,sessions:[{label:'Spar',rpe:8,mins:60,done:true}],notes:'UNIT camp log'},
    {date:'2026-10-29',v:2,context:{mode:'recovery'},energy:3,mood:3,notes:'UNIT recovery check-in'},
    {date:'2026-11-05',v:2,context:{mode:'maintenance'},nutrition:true,sessions:[{label:'Technique',rpe:5,mins:40,done:true}],notes:'UNIT maint log'}
  ],recovery:{adoptedDate:'2026-10-29',bouts:[{id:'pb',fightDate:'2026-10-28',status:'scheduled',recoveryDays:7,campStart:'2026-10-01'}],holds:[],events:[],camps:[],reviews:{pb:{status:'complete',completedAt:'2026-10-30',goals:['Keep neck healthy']}},goals:[],goalsConfirmed:false,maintenance:{sessions:4,checkins:3}}};
  const diego={app:'fight-readiness',version:3,schemaVersion:3,profile:{name:'UNIT Diego',fightDate:''},fighter:'UNIT Diego',startDate:'2026-11-01',entries:[
    {date:'2026-11-01',v:2,context:{mode:'maintenance'},nutrition:true,weight:180,sessions:[{label:'Wrestling',rpe:6,mins:50,done:true}],notes:'UNIT diego day 1'}
  ],recovery:{bouts:[],holds:[],events:[],camps:[],reviews:{},goals:[],maintenance:{sessions:2,checkins:3}}};
  const outP=Recovery.migrate(Profile.fromBackup(JSON.stringify(pablo),{weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{...Scoring.DEFAULT_PARAMS}},Scoring),'2026-11-05');
  assert.equal(outP.schemaVersion,3);
  assert.equal(outP.entries.length,3);
  assert.equal(outP.entries[0].notes,'UNIT camp log');
  assert.equal(outP.entries[1].notes,'UNIT recovery check-in');
  assert.equal(outP.entries[2].notes,'UNIT maint log');
  Recovery.sync(outP,'2026-11-05');
  assert.deepEqual(outP.recovery.goals,['Keep neck healthy'],'review goals copy once on restore into Maintenance');
  const outD=Recovery.migrate(Profile.fromBackup(JSON.stringify(diego),{weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{...Scoring.DEFAULT_PARAMS}},Scoring),'2026-11-05');
  assert.equal(outD.entries[0].notes,'UNIT diego day 1');
  assert.equal(outD.recovery.maintenance.sessions,2,'Diego coach-saved 2 sessions kept');
  assert.equal(outD.recovery.maintenance.weighInsPerWeek,1);
  assert.equal(JSON.stringify(pablo.entries[0].notes),'\"UNIT camp log\"','source backup left unchanged');
}

// Push client still hardcodes Mon/Thu — worker is not part of this change
{
  const push=fs.readFileSync('push.js','utf8');
  assert.ok(/weighDays:\s*\[\s*1\s*,\s*4\s*\]/.test(push),'client payload still sends Mon/Thu weigh days; do not change the production worker');
}

console.log('Maintenance r2 outline, copy-once goals, weekly ratings, FightReady report, weigh-in reminders, and v3 restore pass');
