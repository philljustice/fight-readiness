
const assert=require('assert'),P=require('./profile'),R=require('./recovery'),vm=require('vm'),fs=require('fs'),{parseHTML}=require('linkedom');
const today='2026-11-05';
const past='2026-11-04';
assert.ok(P.validate({name:'UNIT',fightDate:past}, new Date(today+'T12:00')).fightDate, 'new past fight date still rejected');
assert.deepEqual(P.validate({name:'UNIT',fightDate:past}, new Date(today+'T12:00'), {allowPastFightDate:past}), {}, 'unchanged recorded past fight date allowed for Recovery edits');
assert.ok(P.validate({name:'UNIT',fightDate:'2026-10-01'}, new Date(today+'T12:00'), {allowPastFightDate:past}).fightDate, 'cannot swap in a different past date via allow flag');
assert.deepEqual(P.validate({name:'UNIT',fightDate:'2026-12-01'}, new Date(today+'T12:00')), {});
// Fixture defaults validate cleanly with allowPastFightDate for day1
vm.runInContext(fs.readFileSync('/workspace/fr-recovery-preview-support/preview-fixtures.js','utf8'), vm.createContext({Scoring:{DEFAULT_PARAMS:{},WELL_SCALE:2},localStorage:{getItem:()=>null,setItem(){},removeItem(){}}}));
// load via require path differently
const ctx={Scoring:{DEFAULT_PARAMS:{wNutrition:25},WELL_SCALE:2},localStorage:{getItem:()=>null,setItem(){},removeItem(){},key:()=>null,length:0}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('/workspace/fr-recovery-preview-support/preview-fixtures.js','utf8'),ctx);
const day1=ctx.FRTester.build('day1');
assert.deepEqual(P.validate(day1.profile, new Date(today+'T12:00'), {allowPastFightDate:day1.profile.fightDate}), {});
assert.equal(R.phase(R.migrate(day1,today).recovery,today).day,1);
console.log('Past-fight profile edit allowance and SAMPLE day1 fixture validity pass');

function boot(seed){
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const UnitDate=class extends Date{constructor(...a){super(...(a.length?a:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const storage=new Map([['fightReady.v1',JSON.stringify(seed)]]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert:m=>{ctx._alert=m},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,doc:ctx.document,run:s=>vm.runInContext(s,c),ctx};
}
const seed=JSON.parse(JSON.stringify(day1));
seed.recovery=R.migrate(seed,today).recovery;
let x=boot(seed);x.run("show('profile')");
x.doc.querySelector('#p_name').value='SAMPLE Fighter edited';
x.doc.querySelector('#saveProfile').click();
assert.ok(!x.doc.body.textContent.includes('Please fix the highlighted fields'), 'Recovery profile save must not fail solely because recorded fight date is past');
assert.equal(x.run('S.profile.name'),'SAMPLE Fighter edited');
assert.equal(x.run('S.profile.fightDate'),'2026-11-04');
console.log('DOM profile save during Recovery with recorded past fight date passes');
