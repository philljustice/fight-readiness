const assert=require('assert'),fs=require('fs'),vm=require('vm'),{parseHTML}=require('linkedom'),R=require('./recovery');
function boot(seed){
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const UnitDate=class extends Date{constructor(...a){super(...(a.length?a:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const storage=new Map([['fightReady.v1',JSON.stringify(seed)]]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:cb=>cb(),cancelAnimationFrame(){},matchMedia:()=>({matches:false}),history:{pushState(){},replaceState(){},state:null},alert(){},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393,scrollY:0};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,doc:ctx.document,run:s=>vm.runInContext(s,c),storage,ctx};
}
const base={fighter:'UNIT',profile:{name:'UNIT',discipline:'MMA',fightDate:'2026-11-04',schedule:{days:Array(7).fill({n:1,labels:['x','']})}},entries:[{date:'2026-11-04',v:2,nutrition:true,sleep:8,screen:1,family:true,energy:4,mood:4,soreness:2,stress:2,sessions:[{label:'Fight',done:true,rpe:6,mins:30}]}],weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{},reminders:{morning:'07:00',evening:'21:00',untilDone:true},tutorial:'skipped',startDate:'2026-10-20',recovery:{bouts:[{id:'b',fightDate:'2026-11-04',status:'scheduled',recoveryDays:7,campStart:'2026-10-20'}],holds:[],reviews:{},goals:[],events:[],style:null,styleChosen:false,maintenance:{sessions:2,checkins:3}}};

// CSS blue hero wins specificity
const css=fs.readFileSync('styles.css','utf8');
assert.ok(css.includes('.rc-page .card.rc.recoveryHero.rc-hero-blue'));
assert.ok(css.includes('background:linear-gradient(150deg,#0b1730 0%,#12345e 55%,#1e6fb8 100%)!important'));

let x=boot(base);x.run("show('dash')");
assert.ok(x.doc.querySelector('#rcRecoveryHero').className.includes('rc-hero-blue'));
assert.ok(!x.doc.body.innerHTML.includes('Not now')); // single Later postpone
assert.ok(x.doc.querySelector('#rcFightReviewLater')||x.doc.querySelector('[data-rc="defer"]'));

function reopen(sec){
 x.run("show('dash')");
 x.doc.querySelector('#rcCheckTile_'+sec).click();
 assert.equal(x.run('cur'),'log');
 assert.equal(x.run('V._sec'),sec);
}

// Morning: sleep persists after leave+reopen
reopen('morning');
x.doc.querySelector('#f_sleep').value='7';
x.run('autosave()');
x.run("V._sec=null; show('log')");
const raw1=JSON.parse(x.storage.get('fightReady.v1'));
assert.equal(+raw1.entries.find(e=>e.date==='2026-11-05').sleep,7);
reopen('morning');
assert.equal(x.doc.querySelector('#f_sleep').value,'7');

// Nutrition: note + Yes persist (editable, not copy-only)
reopen('nutrition');
assert.ok(x.doc.querySelector('#f_nutritionNote'));
x.doc.querySelector('#f_nutritionNote').value='Ate with family, no cut';
x.doc.querySelector('.yn[data-k="nutrition"] button[data-val="1"]').click();
x.run('autosave()');
x.run("V._sec=null; show('log')");
const raw2=JSON.parse(x.storage.get('fightReady.v1'));
const e2=raw2.entries.find(e=>e.date==='2026-11-05');
assert.equal(e2.nutrition,true);
assert.equal(e2.nutritionNote,'Ate with family, no cut');
reopen('nutrition');
assert.equal(x.doc.querySelector('#f_nutritionNote').value,'Ate with family, no cut');

// Training: label-only soft save persists without RPE/mins
reopen('training');
x.doc.querySelector('#f_xlabel').value='Easy walk with teammate';
x.run('autosave()');
x.run("V._sec=null; show('log')");
const raw3=JSON.parse(x.storage.get('fightReady.v1'));
const e3=raw3.entries.find(e=>e.date==='2026-11-05');
assert.equal(e3.extra.label,'Easy walk with teammate');
reopen('training');
assert.equal(x.doc.querySelector('#f_xlabel').value,'Easy walk with teammate');

// Evening notes persist
reopen('evening');
x.doc.querySelector('#f_notes').value='Felt calm after rest';
x.run('autosave()');
x.run("V._sec=null; show('log')");
const raw4=JSON.parse(x.storage.get('fightReady.v1'));
assert.equal(raw4.entries.find(e=>e.date==='2026-11-05').notes,'Felt calm after rest');
reopen('evening');
assert.equal(x.doc.querySelector('#f_notes').value,'Felt calm after rest');

// Clear draft vs save: empty training clears soft extra when all fields cleared
reopen('training');
x.doc.querySelector('#f_xlabel').value='';
x.doc.querySelector('#f_xrpe').value='';
x.doc.querySelector('#f_xmin').value='';
x.run('autosave()');
const raw5=JSON.parse(x.storage.get('fightReady.v1'));
assert.ok(!raw5.entries.find(e=>e.date==='2026-11-05').extra);

// Injured hold fixture persists and shows on Score + Setup
const injured={...base,recovery:{...base.recovery,bouts:[{id:'sample-bout',fightDate:'2026-10-16',weighInDate:'2026-10-15',recoveryDays:7,status:'scheduled',campStart:'2026-10-01'}],holds:[{date:'2026-10-17',reason:'SAMPLE medical restriction — professional clearance not recorded',cleared:false,source:'sample'}]}};
let y=boot(injured);y.run("show('dash')");
assert.ok(y.doc.body.textContent.includes('SAMPLE medical restriction'));
assert.ok(y.doc.querySelector('#rcRestrictionBanner'));
y.run("show('setup')");
assert.ok(y.doc.querySelector('#rcActiveHoldList').textContent.includes('SAMPLE medical restriction'));
assert.equal(y.doc.querySelector('#rcHoldReason').value,''); // new-note field stays empty

console.log('Recovery optional log save/reload + blue CSS + hold visibility pass');
