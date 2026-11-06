const assert=require('assert'),fs=require('fs'),vm=require('vm'),{parseHTML}=require('linkedom'),R=require('./recovery');
function boot(seed, session={}){
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const UnitDate=class extends Date{constructor(...a){super(...(a.length?a:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const storage=new Map([['fightReady.v1',JSON.stringify(seed)]]);
 const sess=new Map(Object.entries(session));
 let scrollCalls=[];
 const ctx={console,document:window.document,navigator:{userAgent:'Unit'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:k=>sess.has(k)?sess.get(k):null,setItem:(k,v)=>sess.set(k,String(v)),removeItem:k=>sess.delete(k)},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:cb=>cb(),cancelAnimationFrame(){},matchMedia:()=>({matches:false}),history:{pushState(){},replaceState(){},state:null},alert(){},confirm:()=>false,scrollTo(...a){scrollCalls.push(a);},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393,scrollY:0};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){this._focused=true;};
 const c=vm.createContext(ctx);for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,doc:ctx.document,run:s=>vm.runInContext(s,c),sess,storage,scrollCalls,ctx};
}
const base={fighter:'UNIT',profile:{name:'UNIT',discipline:'MMA',fightDate:'2026-11-04',schedule:{days:Array(7).fill({n:1,labels:['x','']})}},entries:[{date:'2026-11-01',v:2,nutrition:true,sleep:8,screen:1,family:true,energy:4,mood:4,soreness:2,stress:2,sessions:[{label:'Pads',done:true,rpe:5,mins:40}]},{date:'2026-11-04',v:2,nutrition:true,sleep:8,screen:1,family:true,energy:4,mood:4,soreness:2,stress:2,sessions:[{label:'Fight',done:true,rpe:6,mins:30}]},{date:'2026-11-05',v:2,context:{mode:'recovery'},sleep:8,mood:3,energy:3,soreness:2,stress:2}],weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{},reminders:{morning:'07:00',evening:'21:00',untilDone:true},tutorial:'skipped',startDate:'2026-10-20',recovery:{bouts:[{id:'b',fightDate:'2026-11-04',status:'scheduled',recoveryDays:7,campStart:'2026-10-20'}],holds:[{date:'2026-11-04',reason:'UNIT existing hold',cleared:false}],reviews:{},goals:[],events:[],style:null,styleChosen:false,maintenance:{sessions:2,checkins:3}}};

let x=boot(base);x.run("show('dash')");
let html=x.doc.getElementById('view').innerHTML;
assert.ok(html.includes('Post fight - day 1'));
assert.ok(html.includes('You put the work into camp'));
assert.ok(x.doc.querySelector('#rcPostFightTitle'));
assert.ok(!html.includes('id="rcDay1Welcome"'));
assert.ok(!html.toLowerCase().includes('medical hold'));
assert.ok(html.includes('Care note on file'));
assert.ok(html.includes('Start Fight Review'));
assert.ok(html.includes('Camp scores — for reference'));
assert.ok(html.indexOf('rcFightReviewCard')<html.indexOf('rcCampScore'));
assert.ok(html.includes('id="rcOptionalIdea"'));
assert.ok(html.indexOf('rcFightReviewCard')<html.indexOf('rcOptionalIdea'));
assert.ok(html.indexOf('rcOptionalIdea')<html.indexOf('Recovery check-in'));
assert.ok(!html.includes('class="rc-idea"')); // no longer nested inside hero
assert.ok(html.includes('Rest or a quiet conversation')||html.includes('Rest and keep the day simple')); // hold uses care-safe copy


// Dedicated screen opens at top with focusable heading
x.scrollCalls.length=0;
x.doc.querySelector('#rcFightReviewCta').click();
assert.equal(x.run('cur'),'fightReview');
assert.ok(x.doc.querySelector('#rcFightReviewScreen'));
assert.ok(x.doc.querySelector('#rcFightReviewFormLead'));
assert.ok(x.doc.querySelector('#rcFightReviewBack'));
assert.ok(x.scrollCalls.some(a=>a[0]===0&&a[1]===0)||x.scrollCalls.some(a=>a[0]&&a[0].top===0));
assert.ok(x.doc.querySelector('#rcPaceFields'));
assert.ok(x.doc.querySelector('#rcReviewDays'));

// Draft back preserves answers, returns Score with Resume
x.doc.querySelector('[data-rc="break"]').click();
x.doc.querySelector('#rcReviewDays').value='10';
x.doc.querySelector('[data-rc-answer="injury"][data-answer="Skip"]').click();
x.doc.querySelector('#rcFightReviewBack').click();
assert.equal(x.run('cur'),'dash');
assert.equal(x.run('S.recovery.reviews.b.status'),'draft');
assert.equal(x.run('S.recovery.style'),'break');
html=x.doc.getElementById('view').innerHTML;
assert.ok(html.includes('Resume Fight Review')||html.includes('Draft saved'));
assert.ok(!html.includes('id="rcFightReviewScreen"'));
assert.ok(!html.includes('id="rcOptionalIdea"')); // Taking a break hides optional idea; Fight Review stay deferred-independent

// Resume keeps answers; Complete returns with checkmark; holds unchanged
x.doc.querySelector('#rcFightReviewCta').click();
assert.ok(x.doc.querySelector('#rcPaceFields [data-rc="break"].selected'));
assert.equal(x.doc.querySelector('#rcReviewDays').value,'10');
x.doc.querySelector('#rcFightReviewComplete').click();
assert.equal(x.run('cur'),'dash');
assert.equal(x.run('S.recovery.reviews.b.status'),'complete');
assert.equal(x.run('S.recovery.reviews.b.completedAt'),'2026-11-05');
assert.ok(x.doc.querySelector('#rcFightReviewDone'));
assert.ok(x.doc.body.textContent.includes('Edit Fight Review'));
assert.equal(x.run('S.recovery.holds.filter(h=>h.reason==="UNIT existing hold"&&!h.cleared).length'),1);

// Edit completed still available; optional incomplete answers allowed
x.doc.querySelector('#rcFightReviewCta').click();
assert.equal(x.run('cur'),'fightReview');
x.doc.querySelector('#rcFightReviewBack').click();
assert.equal(x.run('S.recovery.reviews.b.status'),'complete'); // back after complete stays complete unless we mark draft on back always
// Actually markDraft sets draft if not complete - for complete, markDraft keeps complete. Good.

// Per-bout isolation
x.run("S.recovery.reviews['other']={answers:{injury:'Yes'},status:'draft'};save()");
assert.equal(x.run('S.recovery.reviews.b.status'),'complete');
assert.equal(x.run('S.recovery.reviews.other.status'),'draft');

assert.ok(fs.readFileSync('styles.css','utf8').includes('rc-brand-title'));
assert.ok(fs.readFileSync('styles.css','utf8').includes('prefers-reduced-motion'));
console.log('Fight Review dedicated screen, draft/complete, plain restriction copy, brand styles pass');

// Deferred Fight Review still leaves Optional idea below its normal slot (no resurrect)
{
 const y=boot(base);y.run("show('dash')");
 y.doc.querySelector('[data-rc="defer"]').click();
 const h=y.doc.getElementById('view').innerHTML;
 assert.ok(!h.includes('id="rcFightReviewCard"'));
 assert.ok(h.includes('id="rcOptionalIdea"'));
 assert.ok(h.indexOf('rcOptionalIdea')<h.indexOf('Recovery check-in'));
 assert.ok(h.includes('Rest or a quiet conversation')||h.includes('Rest and keep the day simple'));
}
console.log('Optional idea order + defer placement pass');
