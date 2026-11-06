const assert=require('assert'),R=require('./recovery'),vm=require('vm'),fs=require('fs'),{parseHTML}=require('linkedom');
assert.equal(R.day1Welcome({mode:'recovery',day:1}).congrats.includes('You put the work into camp'),true);
assert.ok(R.day1Welcome({mode:'recovery',day:1}).intro.includes('rest and recovery'));
assert.equal(R.day1Welcome({mode:'recovery',day:2}),null);
assert.equal(R.day1Welcome({mode:'maintenance',day:1}),null);
assert.equal(R.day1Welcome({mode:'camp'}),null);
assert.ok(!R.day1Welcome({mode:'recovery',day:1}).congrats.toLowerCase().includes('won'));
assert.ok(!R.day1Welcome({mode:'recovery',day:1}).congrats.toLowerCase().includes('victory'));
// DOM: day1 card only on recovery day 1
function boot(seed){
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const UnitDate=class extends Date{constructor(...a){super(...(a.length?a:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const storage=new Map([['fightReady.v1',JSON.stringify(seed)]]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert(){},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,doc:ctx.document,run:s=>vm.runInContext(s,c)};
}
const base={fighter:'UNIT',profile:{name:'UNIT',discipline:'MMA',schedule:{days:Array(7).fill({n:1,labels:['x','']})}},entries:[],weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{},reminders:{morning:'07:00',evening:'21:00',untilDone:true},tutorial:'skipped'};
let a=boot({...base,recovery:{bouts:[{id:'b',fightDate:'2026-11-04',status:'scheduled',recoveryDays:7}],holds:[],reviews:{},goals:[],events:[],style:'gentle',maintenance:{sessions:2,checkins:3}}});
a.run("show('dash')");assert.ok(!a.doc.querySelector('#rcDay1Welcome'));assert.ok(a.doc.querySelector('#rcDay1Note')||a.doc.body.textContent.includes('You put the work into camp'));assert.ok(a.doc.querySelector('.rc-brand-title'));assert.ok(a.doc.body.textContent.includes('rest and recovery'));assert.ok(a.doc.body.textContent.includes('Post fight - day 1'));assert.ok(a.doc.querySelector('#rcCampScore'));assert.ok(a.doc.body.textContent.includes('Fight Review'));assert.ok(a.doc.body.textContent.includes('Recovery check-in'));assert.ok(a.doc.querySelector('#rcWhatNext'));assert.ok(!a.doc.body.textContent.includes('<h2>Your pace</h2>'));assert.ok(!a.doc.body.textContent.includes('fight-result claim'));assert.ok(!a.doc.body.textContent.includes('This note appears only'));
a=boot({...base,recovery:{bouts:[{id:'b',fightDate:'2026-11-03',status:'scheduled',recoveryDays:7}],holds:[],reviews:{},goals:[],events:[],style:'gentle',maintenance:{sessions:2,checkins:3}}});
a.run("show('dash')");assert.ok(!a.doc.querySelector('#rcDay1Welcome'));assert.ok(a.doc.body.textContent.includes('Post fight - day 2'));assert.ok(a.doc.querySelector('#rcCampScore'));
console.log('Day-1 welcome content and DOM gating pass');
