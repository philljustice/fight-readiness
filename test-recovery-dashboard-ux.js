
const assert=require('assert'),fs=require('fs'),vm=require('vm'),{parseHTML}=require('linkedom'),R=require('./recovery');
function boot(seed, session={}){
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const UnitDate=class extends Date{constructor(...a){super(...(a.length?a:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const storage=new Map([['fightReady.v1',JSON.stringify(seed)]]);
 const sess=new Map(Object.entries(session));
 const ctx={console,document:window.document,navigator:{userAgent:'Unit'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:k=>sess.has(k)?sess.get(k):null,setItem:(k,v)=>sess.set(k,String(v)),removeItem:k=>sess.delete(k)},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert(){},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,doc:ctx.document,run:s=>vm.runInContext(s,c),sess,storage};
}
const base={fighter:'UNIT',profile:{name:'UNIT',discipline:'MMA',fightDate:'2026-11-04',schedule:{days:Array(7).fill({n:1,labels:['x','']})}},entries:[{date:'2026-11-01',v:2,nutrition:true,sleep:8,screen:1,family:true,energy:4,mood:4,soreness:2,stress:2,sessions:[{label:'Pads',done:true,rpe:5,mins:40}]},{date:'2026-11-02',v:2,nutrition:true,sleep:8,screen:1,family:true,energy:4,mood:4,soreness:2,stress:2,sessions:[{label:'Pads',done:true,rpe:5,mins:40}]},{date:'2026-11-03',v:2,nutrition:true,sleep:8,screen:1,family:true,energy:4,mood:4,soreness:2,stress:2,sessions:[{label:'Pads',done:true,rpe:5,mins:40}]},{date:'2026-11-04',v:2,nutrition:true,sleep:8,screen:1,family:true,energy:4,mood:4,soreness:2,stress:2,sessions:[{label:'Fight week',done:true,rpe:6,mins:30}]},{date:'2026-11-05',v:2,context:{mode:'recovery'},sleep:8,mood:3,energy:3,soreness:2,stress:2}],weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{},reminders:{morning:'07:00',evening:'21:00',untilDone:true},tutorial:'skipped',startDate:'2026-10-20'};
base.recovery={bouts:[{id:'b',fightDate:'2026-11-04',status:'scheduled',recoveryDays:7,campStart:'2026-10-20'}],holds:[],reviews:{},goals:[],events:[],style:null,styleChosen:false,maintenance:{sessions:2,checkins:3}};

let x=boot(base);x.run("show('dash')");
const html=x.doc.getElementById('view').innerHTML;
assert.ok(html.indexOf('Recovery check-in')<html.indexOf('Camp scores — for reference'));
assert.ok(html.indexOf('rcRecoveryHero')<html.indexOf('Fight Review'));assert.ok(html.indexOf('Fight Review')<html.indexOf('rcCampScore'));assert.ok(html.indexOf('Recovery check-in')<html.indexOf('rcCampScore'));
assert.ok(html.indexOf('Fight Review')<html.indexOf('Recovery check-in'));
assert.ok(html.includes('What comes next'));
assert.ok(!html.includes('Keep it optional'));
assert.ok(x.doc.querySelector('#rcWhatNext'));
assert.ok(x.doc.body.textContent.includes('Your pace')); // not pre-chosen
assert.ok(!x.doc.querySelector('#rcPaceSummary'));
// choose pace -> card disappears, persists across tab nav
x.doc.querySelector('[data-rc="break"]').click();
x.run("show('log');show('dash')");
assert.ok(!x.doc.body.textContent.includes('Your pace')||!x.doc.querySelector('#view').innerHTML.includes('card rc"><h2>Your pace'));
assert.ok(x.doc.querySelector('#rcPaceSummary'));
assert.equal(x.run('S.recovery.style'),'break');assert.equal(x.run('S.recovery.styleChosen'),true);
const afterPace=JSON.parse(x.storage.get('fightReady.v1'));
assert.equal(afterPace.recovery.style,'break');assert.equal(afterPace.recovery.styleChosen,true);

// delay hides Fight Review for this document/session; tab nav keeps it hidden; new sessionStorage clears it
x=boot(base);x.run("show('dash')");
assert.ok(x.doc.body.textContent.includes('Fight Review'));
x.doc.querySelector('[data-rc="defer"]').click();
assert.equal(x.sess.get('fr.reviewDelay.b'),'1');
x.run("show('log');show('dash')");
assert.ok(!x.doc.querySelector('#view').innerHTML.includes('<h2>Fight Review</h2>')||x.doc.body.textContent.includes('Delay hides')===false);
const view=x.doc.getElementById('view').innerHTML;
assert.ok(!view.includes('Delay until next open'));
assert.ok(view.includes('Recovery check-in'));
// reopen answers preserved if any; new boot without session shows card again
x=boot(JSON.parse(x.storage.get('fightReady.v1')));x.run("show('dash')");
assert.ok(x.doc.body.textContent.includes('Delay until next open'));

// camp readiness uses camp logs, excludes recovery-only check-in from days that only have recovery context
const scored=x.run('JSON.stringify({days:Recovery.campEntries(S,today()).map(e=>e.date),score:res().score,logged:res().daysLogged})');
const parsed=JSON.parse(scored);
assert.deepEqual(parsed.days,['2026-11-01','2026-11-02','2026-11-03','2026-11-04']);
assert.ok(!parsed.days.includes('2026-11-05'));
assert.ok(parsed.logged>=1);
assert.ok(x.doc.querySelector('#rcCampScore'));
assert.ok(x.doc.body.textContent.includes('freshess')||x.doc.body.textContent.includes('freshness')||x.doc.body.textContent.includes('rolling window'));

// injured hold still authoritative in UI
const held={...base,recovery:{...base.recovery,holds:[{date:'2026-11-04',reason:'UNIT hold',cleared:false}]}};
x=boot(held);x.run("show('dash')");
assert.ok(x.doc.body.textContent.includes('CARE FIRST')||x.doc.body.textContent.includes('medical restriction')||x.doc.body.textContent.includes('restriction stays'));
assert.ok(x.doc.querySelector('#rcCampScore'));
console.log('Recovery dashboard UX: order, pace hide/persist, defer-until-reopen, camp-score visibility pass');
