// M1 (fr-v61): fight day, fight checklist/check-in, Setup boxes, won/lost, shorter log list, Maintenance baseline + yes/no training, fight-week plan.
const assert=require('assert'),vm=require('vm'),fs=require('fs'),{parseHTML}=require('linkedom');
const FILES=['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','coachreport.js','push.js','tutorial.js','recovery-ui.js','fightday.js','fightweek.js','photo.js','setuphub.js','maint.js','app.js'];
function boot(seed,now='2026-11-05T12:00:00-05:00'){
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const UnitDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return Date.parse(now);}};
 const storage=new Map([['fightReady.v1',JSON.stringify(seed)]]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert(){},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.Event=window.Event;ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);for(const f of FILES)vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,doc:ctx.document,run:s=>vm.runInContext(s,c),storage};
}
const day=(d,i)=>{const x=new Date(d+'T12:00');x.setDate(x.getDate()+i);return x.toISOString().slice(0,10);};
const full=(date,extra={})=>Object.assign({date,v:2,sessions:[],context:{mode:'camp'},nutrition:true,training:true,family:true,sleep:8,screen:1,weight:'',notes:'',energy:4,soreness:4,stress:4,mood:4,sleepq:4,motivation:4,appetite:4,hydration:2,injury:'none',ill:false},extra);
const base=(fightDate,opts={})=>({fighter:'UNIT',startDate:'2026-10-20',profile:{name:'UNIT',discipline:'MMA',fightDate,targetWeight:'',schedule:{days:Array(7).fill({n:1,labels:['Pads','']})}},
 entries:Array.from({length:16},(_,i)=>full(day('2026-10-20',i))),weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{},reminders:{morning:'07:00',evening:'21:00',untilDone:true},tutorial:'skipped',
 recovery:{bouts:fightDate?[{id:'b1',fightDate,status:'scheduled',recoveryDays:7,campStart:'2026-10-20'}]:[],holds:[],reviews:{},goals:[],events:[],camps:[],style:'gentle',maintenance:{sessions:4}},...opts});

// 1. Fight-day score page
let a=boot(base('2026-11-05'));
a.run("show('dash')");
let hero=a.doc.querySelector('#heroScore'),txt=a.doc.querySelector('#view').textContent;
assert.ok(hero&&hero.className.includes('fightday'),'fight-day hero styling');
assert.ok(hero.textContent.includes("It's fight day!"),'hero says It\'s fight day!');
assert.ok(a.doc.querySelector('#fightDayBanner'),'fight-day notification on the score card');
assert.ok(!/0 days to fight/.test(txt),'no "0 days to fight"');
assert.ok(!a.doc.querySelector('#todayTrain'),'no today\'s training on fight day');
assert.ok(!/Logging streak/.test(txt)&&!/streak/i.test(txt),'no streak mentions on fight day');
assert.ok(!/momentum/i.test(txt),'no momentum on fight day');
assert.ok(a.doc.querySelector('#fdCheck'),'fight-day check-in on Score');
assert.ok(a.doc.querySelector('#fightChecklist'),'checklist on fight day while incomplete');
assert.ok(a.doc.querySelector('#view').textContent.includes('Categories'),'rest of score summary stays');
// check-in: yes needs details
a.run("document.querySelector('[data-fdq=\"injury\"] [data-val=\"1\"]').click()");
let e=JSON.parse(a.run("JSON.stringify(S.entries.find(x=>x.date==='2026-11-05'))"));
assert.equal(e.fightCheck.injury,true); assert.equal(e.fightDay,true); assert.deepEqual(e.sessions,[]);
assert.ok(a.doc.querySelector('#fdn_injury'),'yes opens a detailed report field');
assert.ok(a.run("Insights.missing(S.entries.find(x=>x.date==='2026-11-05')).some(m=>m.startsWith('fight-day'))"));
a.run("Object.assign(S.entries.find(x=>x.date==='2026-11-05').fightCheck,{injuryNote:'Left knee sore since Tuesday',pain:false,ill:false})");
// only wellness + hydration (+ check-in) required on fight day
a.run("Object.assign(S.entries.find(x=>x.date==='2026-11-05'),{energy:4,soreness:3,stress:3,mood:5,sleepq:4,motivation:5,appetite:4})");
assert.deepEqual(JSON.parse(a.run("JSON.stringify(Insights.missing(S.entries.find(x=>x.date==='2026-11-05')))")),['hydration (first pee colour)']);
a.run("S.entries.find(x=>x.date==='2026-11-05').hydration=2");
assert.ok(a.run("Insights.isComplete(S.entries.find(x=>x.date==='2026-11-05'))"),'no sleep, food, training, screen or family needed');
assert.ok(a.run("Insights.sections(S.entries.find(x=>x.date==='2026-11-05')).evening"));
assert.ok(a.run("FightDay.checkLines().some(l=>l.includes('YES — Left knee'))"),'check-in reaches the coach report');
// log on fight day
a.run("show('log')"); assert.ok(a.doc.querySelector('#fdLogBanner'));
a.run("openSection('training')"); assert.ok(a.doc.querySelector('#schedToday').textContent.includes('Fight day'));
// scoring: fight-day entry does not drag nutrition/training
a.run("S.entries.find(x=>x.date==='2026-11-05').nutrition=null");
const cats=JSON.parse(a.run("JSON.stringify(Scoring.compute(S.entries,new Date('2026-11-06T12:00'),Object.assign({},S.params,{startDate:'2026-10-20'})).cats)"));
assert.equal(Math.round(cats.nutrition),100,'fight day skipped for nutrition');

// 2. Camp day 5 out: checklist first under the score, normal hero, today's training present; 10 out: no checklist
a=boot(base('2026-11-10'));a.run("show('dash')");
assert.ok(a.doc.querySelector('#fightChecklist')&&a.doc.querySelector('#todayTrain'));
assert.ok(!a.doc.querySelector('#heroScore').className.includes('fightday'));
const kids=[...a.doc.querySelectorAll('#view > *')].map(n=>n.id); assert.equal(kids[kids.indexOf('heroScore')+1],'fightChecklist','checklist is the first card under the score');
a.run("for(let i=0;i<4;i++)FightDay.items(FightDay.fightDate())&&(S.fightPrep=S.fightPrep||{});S.fightPrep['2026-11-10']={items:FightDay.DEFAULT_ITEMS.map(label=>({label,done:true}))};show('dash')");
assert.ok(!a.doc.querySelector('#fightChecklist'),'checklist hides once every item is ticked');
a=boot(base('2026-11-15'));a.run("show('dash')");assert.ok(!a.doc.querySelector('#fightChecklist'));
assert.ok(a.run("Profile.countdown('2026-11-05').text")==="It's fight day! 🥊");

// 3. Training log shows the day's schedule (camp)
a.run("show('log');openSection('training')");assert.ok(a.doc.querySelector('#schedToday').textContent.includes('Pads'));

// 4. Setup boxes
a.run("show('setup')");
const boxes=[...a.doc.querySelectorAll('#setupHub [data-sharea]')].map(b=>b.dataset.sharea);
assert.ok(boxes.includes('fight')&&boxes.includes('reminders')&&boxes.includes('profile')&&boxes.includes('data'),boxes.join());
assert.ok([...a.doc.querySelectorAll('#setupHub .sh-d')].every(d=>d.textContent.length>10),'each box has a description');
assert.ok(a.doc.querySelector('#remCard').hasAttribute('hidden'));
a.run("document.querySelector('[data-sharea=\"reminders\"]').click()");
assert.ok(!a.doc.querySelector('#remCard').hasAttribute('hidden')&&a.doc.querySelector('#exportBtn').closest('[data-sarea]').hasAttribute('hidden'));
assert.ok(!a.doc.querySelector('#setupHub')&&a.doc.querySelector('#setupAreaTitle'));
a.run("document.querySelector('[data-sharea=\"\"]').click()");assert.ok(a.doc.querySelector('#setupHub'));
a.run("SetupHub.area='fight';show('setup')");assert.ok(!a.doc.querySelector('#fightChecklistSetup').hasAttribute('hidden'));
a.run("SetupHub.area='profile';show('setup')");assert.ok(a.doc.querySelector('#photoCard')&&!a.doc.querySelector('#photoCard').hasAttribute('hidden'));
assert.equal(a.doc.querySelector('[data-sarea="profile"] h3').textContent.trim().length>0,true);
// goal checkbox in Setup saves immediately (maintenance outline area)
let m=boot(base('',{entries:[]}));m.run("SetupHub.area='outline';show('setup')");
const box=m.doc.querySelector('#rcGoalsApproved');assert.ok(box&&!box.closest('[data-sarea]').hasAttribute('hidden'));
m.run("const gb=document.querySelector('#rcGoalsApproved');gb.checked=true;gb.dispatchEvent(new Event('change',{bubbles:true}))");
assert.equal(JSON.parse(m.storage.get('fightReady.v1')).recovery.goalsConfirmed,true,'Agreed tick saved without pressing Save');

// 5. Won or lost in the post-fight review
a=boot(base('2026-11-03'));a.run("show('fightReview')");
assert.ok(a.doc.querySelector('#rcResultFields')&&a.doc.querySelector('#rcResultFields').textContent.includes('won or lost'));
a.run("document.querySelector('[data-rc-result=\"won\"]').click()");
assert.equal(a.run("S.recovery.reviews[Object.keys(S.recovery.reviews)[0]].result"),'won');
assert.ok(a.run("Recovery.summary(S.recovery.reviews[Object.keys(S.recovery.reviews)[0]],'MMA')").includes('Fight result\nWon'));

// 6. Shorter previous-days list after today's log is complete
const many=base('2026-12-20');many.entries=Array.from({length:30},(_,i)=>full(day('2026-10-07',i)));
a=boot(many);a.run("show('log')");assert.equal(a.doc.querySelectorAll('tr[data-date]').length,7,'about a week once today is complete');
many.entries.pop();a=boot(many);a.run("show('log')");assert.equal(a.doc.querySelectorAll('tr[data-date]').length,21,'unchanged while today is still open');

// 7. Maintenance: 14-day baseline for a fresh start, inherited with camp history; yes/no training with a comment
m=boot(base('',{entries:[],startDate:'2026-10-27'}));
assert.equal(m.run("Maint.unlockDays(S,'maintenance')"),14);assert.equal(m.run("res().locked"),true,'day 9 of a fresh Maintenance start is still building the baseline');
m=boot(base('',{startDate:'2026-10-20'}));assert.equal(m.run("Maint.unlockDays(S,'maintenance')"),7,'camp history is inherited');
m=boot(base('',{entries:[]}));m.run("show('log');openSection('training')");
assert.ok(m.doc.querySelector('[data-mtr]')&&m.doc.querySelector('#maintRestBox'));
m.run("document.querySelector('[data-mtr] [data-val=\"0\"]').click()");
assert.equal(m.run("S.entries.find(x=>x.date===today()).trained"),false);assert.deepEqual(JSON.parse(m.run("JSON.stringify(S.entries.find(x=>x.date===today()).sessions)")),[]);
// continuity into camp: Maintenance logs still count once a fight is booked
m=boot(base('',{entries:Array.from({length:10},(_,i)=>full(day('2026-10-26',i),{context:{mode:'maintenance'}})),startDate:'2026-10-26'}));
m.run("Recovery.schedule(S.recovery,today(),{fightDate:'2026-12-20',recoveryDays:7});S.profile.fightDate='2026-12-20'");
assert.equal(m.run("inCamp()"),true);assert.ok(m.run("res().daysLogged")>=9,'Maintenance history carries into camp');

// 8. Fight-week plan follows the weight-plan rules (under-18: no water steps)
const W=require('./weightplan.js');global.Scoring=require('./scoring.js');global.WeightPlan=W;const FW=require('./fightweek.js');
const prof={targetWeight:155,fightDate:'2026-11-21',weighIn:'day-before',waterCut:true,dob:'2000-01-01'},ents=[{date:'2026-11-12',weight:160}];
let s=W.status(ents,prof,new Date('2026-11-13T12:00'));let p=FW.plan(s,prof);
assert.equal(p.rows.length,9);assert.equal(p.rows[7].label,'Weigh-in day');assert.equal(p.rows[8].label,'Fight day');assert.ok(p.rows.some(r=>r.steps.some(x=>/Water loading/.test(x.text))));
s=W.status(ents,Object.assign({},prof,{dob:'2010-01-01'}),new Date('2026-11-13T12:00'));p=FW.plan(s,Object.assign({},prof,{dob:'2010-01-01'}));
assert.ok(!p.rows.some(r=>r.steps.some(x=>/Water loading|sauna|Fluid down/i.test(x.text))),'under-18: no water-cut steps');assert.ok(p.minor);

// 9. Old data still loads (no new fields needed)
a=boot({...base('2026-12-20'),fightPrep:undefined});a.run("show('dash');show('log');show('setup');show('report')");
console.log('M1 fight day, checklist, check-in, setup boxes, won/lost, log list, maintenance and fight-week plan pass');
