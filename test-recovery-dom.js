// DOM-unit tests only: no browser, network, user storage or notifications.
const {parseHTML}=require('linkedom'),vm=require('vm'),fs=require('fs'),assert=require('assert');
function app(seed){
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const storage=new Map(seed?[['fightReady.v1',JSON.stringify(seed)]]:[]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit test'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Date,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert:msg=>{throw Error(msg)},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;
 window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);
 for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,storage,run:s=>vm.runInContext(s,c),doc:ctx.document};
}
let a=app();assert.ok(a.doc.querySelector('#saveProfile'),'new install still has signup');
a.run(`S.profile={name:'UNIT Fighter',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT Fighter';show('dash')`);
assert.ok(a.doc.querySelector('.recoveryHero'));assert.ok(a.doc.body.textContent.includes('MAINTENANCE'));
a.run("show('log')");assert.ok(a.doc.querySelector('#tiles'));assert.ok(!a.doc.querySelector('#topScore'));
a.run("V._sec='morning';show('log')");assert.ok(a.doc.querySelector('#f_sleep'));assert.ok(!a.doc.querySelector('#waterAff'));
a.run("V._sec=null;show('setup')");assert.ok(a.doc.querySelector('#rcFight'));assert.ok(a.doc.querySelector('#exportBtn'),'original backup controls kept');assert.ok(!a.doc.querySelector('#c_fight'),'legacy date editor removed');
a.run("S.recovery.bouts=[{id:'unit-bout',fightDate:Recovery.addDays(today(),-2),status:'scheduled',recoveryDays:7}];show('dash')");
assert.ok(a.doc.body.textContent.includes('Recovery day 2'));assert.ok(!a.doc.querySelector('#heroScore'));assert.ok(a.doc.querySelector('.rc-logo-crown'));
a.run("V._sec='training';show('log')");assert.ok(a.doc.querySelector('#f_xlabel'));assert.ok(!a.doc.body.textContent.includes('Rest day: training counts 100%'));
a.run("V._sec=null;show('report')");assert.ok(a.doc.querySelector('#rcEditedSummary'));assert.ok(a.doc.querySelector('#shareBtn'));assert.ok(a.run('shareText()').includes('Recovery: no score'));
a.run("show('profile')");assert.ok(a.doc.querySelector('#cutCard').hasAttribute('hidden'),'no cut controls outside camp');
const snapshot=a.run('JSON.stringify(S)');const restored=a.run(`Recovery.migrate(Profile.fromBackup(${JSON.stringify(snapshot)},load(),Scoring),today())`);assert.equal(restored.schemaVersion,3);assert.equal(restored.recovery.bouts.length,1);
assert.ok(a.storage.has('fightReady.v1'));
const legacy={fighter:'UNIT legacy',profile:{name:'UNIT legacy',fightDate:'2026-12-01'},entries:[{date:'2026-10-01',weight:190,v:2}],weeks:JSON.parse(a.run('JSON.stringify(S.weeks)')),params:JSON.parse(a.run('JSON.stringify(S.params)')),weekIdx:0,startDate:'2026-10-01'};
a=app(legacy);assert.equal(a.run('S.entries[0].weight'),190);assert.equal(a.run('S.schemaVersion'),3);assert.equal(a.run('S.recovery.bouts.length'),1);assert.ok(a.storage.has('fightReady.beforeRecovery.v56'));
// A confirmed new bout creates one skippable reduced-motion celebration; reschedule does not.
a=app();a.run(`S.profile={name:'UNIT Fighter',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT Fighter';show('setup')`);
a.doc.querySelector('#rcFight').value='2026-12-20';a.doc.querySelector('#rcDays').value='7';a.doc.querySelector('[data-rc="schedule"]').click();
assert.equal(a.run('S.recovery.bouts.length'),1);assert.ok(a.doc.querySelector('#fightCelebration'));a.doc.querySelector('#fightCelebrationSkip').click();assert.ok(!a.doc.querySelector('#fightCelebration'));
a.run("show('setup')");a.doc.querySelector('#rcFight').value='2026-12-21';a.doc.querySelector('[data-rc="schedule"]').click();assert.equal(a.run('S.recovery.bouts.length'),1);assert.ok(!a.doc.querySelector('#fightCelebration'));
console.log('Recovery DOM units: boot, migrated legacy, regular logs, phase UI, scheduler, report/share draft, cut hiding, backup round-trip pass');
