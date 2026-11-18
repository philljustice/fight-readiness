// fr-v60 CornerReady release: rebrand + cleanup items 1–5. Run: node test-cornerready.js
const assert = require('assert');
const {parseHTML} = require('linkedom');
const vm = require('vm');
const fs = require('fs');
const Scoring = require('./scoring');
const Recovery = require('./recovery');
const Profile = require('./profile');
const CoachReport = require('./coachreport');

function app(seed){
 const UnitDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-11-05T12:00:00-05:00']));}static now(){return Date.parse('2026-11-05T12:00:00-05:00');}};
 const {window}=parseHTML(fs.readFileSync('index.html','utf8'));
 const storage=new Map(seed?[['fightReady.v1',JSON.stringify(seed)]]:[]);
 const ctx={console,document:window.document,navigator:{userAgent:'Unit test'},location:{href:'http://unit.test/index.html?nosplash',search:'?nosplash',protocol:'http:',origin:'http://unit.test',pathname:'/index.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Date:UnitDate,Math,JSON,Intl,Blob,structuredClone,TextEncoder,TextDecoder,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),history:{pushState(){},replaceState(){},state:null},alert:msg=>{throw Error(msg)},confirm:()=>false,scrollTo(){},scrollBy(){},addEventListener(){},removeEventListener(){},performance:{now:()=>0},innerHeight:852,innerWidth:393};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.document.defaultView=ctx;ctx.HTMLElement=window.HTMLElement;ctx.Event=window.Event;ctx.CustomEvent=window.CustomEvent;
 window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const c=vm.createContext(ctx);
 for(const f of ['recovery.js','scoring.js','reminders.js','profile.js','insights.js','weightplan.js','early.js','cheat.js','weekly.js','report.js','coachreport.js','push.js','tutorial.js','recovery-ui.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {c,storage,run:s=>vm.runInContext(s,c),doc:ctx.document};
}

// --- Rebrand: no user-facing FightReady left in shipped files; storage keys stay so saved data still loads
{
  const shipped = fs.readFileSync('sw.js','utf8').match(/ASSETS=\[([^\]]*)\]/)[1].split(',').map(x=>x.replace(/'/g,'').trim()).filter(f=>/\.(js|html|css|webmanifest)$/.test(f));
  shipped.push('sw.js');
  for (const f of shipped) {
    const t = fs.readFileSync(f,'utf8').replace(/fightReady\.(v1|beforeRecovery\.v56|recoveryPreview\.v1|preview\.[A-Za-z0-9.]+)/g,'').replace(/fightReadyReportHtml/g,'').replace(/fight-readiness(-push)?/g,'');
    assert.ok(!/FightReady|FIGHTREADY|Fightready/.test(t), f+' still says FightReady');
  }
  const m = JSON.parse(fs.readFileSync('manifest.webmanifest','utf8')); assert.equal(m.name,'CornerReady'); assert.equal(m.short_name,'CornerReady');
  const idx = fs.readFileSync('index.html','utf8'); assert.ok(idx.includes('<title>CornerReady</title>') && idx.includes('apple-mobile-web-app-title" content="CornerReady"'));
  assert.ok(fs.readFileSync('app.js','utf8').includes("const KEY = 'fightReady.v1'"), 'storage key unchanged so existing logs load');
  for (const f of fs.readdirSync('cal')) assert.ok(!/FightReady/.test(fs.readFileSync('cal/'+f,'utf8')), 'calendar '+f);
}
// --- Rebrand: approved concept 1b art, exact brand colours, no old FR art referenced
{
  for (const f of ['brand/cr/mark.png','brand/cr/word.png','brand/cr/mark-print.png','brand/splash/c.webp','brand/splash/r.webp','brand/splash/crown.webp','icons/icon-512.png','icons/icon-192.png','icons/icon-512-maskable.png','icons/apple-touch-icon.png','icons/favicon-32.png']) assert.ok(fs.existsSync(f), f);
  assert.ok(!fs.existsSync('brand/mark-white-gold.png') && !fs.existsSync('brand/mark-red-gold.png') && !fs.existsSync('brand/splash/f.webp'), 'old FightReady art removed');
  const all = ['styles.css','splash.css','app.js','recovery-ui.js','index.html','sw.js','splash.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
  assert.ok(!/mark-white-gold|mark-red-gold|splash\/f\.webp/.test(all), 'no references to old art');
  assert.ok(!/#E8A828/i.test(all), 'old gold #E8A828 replaced by brand gold #E1A42B');
  const css = fs.readFileSync('styles.css','utf8'); assert.ok(/\.brand-c\{color:#DEDEDE\}/.test(css) && /\.brand-r\{color:#E1A42B\}/.test(css), 'header wordmark colours');
  const icon = fs.readFileSync('icons/icon-512.png'), src = fs.readFileSync('/workspace/fr-landing/brand/cr/v3/final/concept-1b-icon-512.png', {flag:'r'});
  assert.ok(icon.equals(src), 'icon-512 is the approved concept 1b icon byte-for-byte');
}
// --- Item 1: Maintenance Score screen puts the score ring first; Maintenance note follows it
{
  const a = app(null);
  a.run("S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';save();show('dash')");
  const page = a.doc.querySelector('#rcInterimMaintPage'); assert.ok(page, 'maintenance page');
  const html = page.innerHTML; assert.ok(html.indexOf('id="heroScore"') > -1 && html.indexOf('id="heroScore"') < html.indexOf('rcMaintIntro'), 'score ring comes before the Maintenance note');
  assert.ok(html.indexOf('rcMaintIntro') < html.indexOf('todayTrain') || html.indexOf('todayTrain') === -1, 'note sits right under the ring');
  const t = a.doc.getElementById('title').innerHTML; assert.ok(/brand-c">Corner<\/span><span class="brand-r">Ready/.test(t), 'header shows CornerReady');
}
// --- Item 2: Fight Review Goals box sits above the coach-draft button, with the reflections
{
  const s = fs.readFileSync('recovery-ui.js','utf8');
  assert.ok(/\$\{goalsBox\}\$\{button\('summary','Build \/ save coach draft'\)\}/.test(s), 'Goals box placed before Build / save coach draft');
  assert.equal((s.match(/id="rcReviewGoalsBox"/g)||[]).length, 1, 'one Goals box');
}
// --- Item 3: printout hides the goal check-in form and the dark ratings-complete banner; outline prompt card does not print
{
  const css = fs.readFileSync('styles.css','utf8'); const pr = css.slice(css.lastIndexOf('fr-v60 CornerReady'));
  assert.ok(/#rcGoalRatingsCard,#rcRatingsReady\{display:none!important\}/.test(pr));
  const s = fs.readFileSync('recovery-ui.js','utf8'); assert.ok(s.includes('<div id="rcGoalRatingsCard">') && s.includes('class="noprint" id="rcOutlinePromptCard"'));
}
// --- Item 4: push weigh-in days follow the Maintenance outline; camp keeps Mon/Thu
{
  assert.deepEqual(Recovery.weighDays(0), []); assert.deepEqual(Recovery.weighDays(1), [1]); assert.deepEqual(Recovery.weighDays(2), [1,4]); assert.deepEqual(Recovery.weighDays(3), [1,3,5]); assert.deepEqual(Recovery.weighDays(7), [0,1,2,3,4,5,6]);
  assert.equal(Recovery.weighInsPerWeek({maintenance:{weighInsPerWeek:0}}), 0); assert.equal(Recovery.weighInsPerWeek({}), 1); assert.equal(Recovery.weighInsPerWeek({maintenance:{weighInsPerWeek:9}}), 1);
  const ctx = { Recovery, navigator:{userAgent:'unit'}, window:{}, Intl, atob:s=>Buffer.from(s,'base64').toString('binary'), Uint8Array }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('push.js','utf8')+';this.Push=Push;', ctx);
  const sub = { endpoint:'https://push.example/x', keys:{p256dh:'a',auth:'b'} };
  const camp = ctx.Push.payload(sub, {morning:'07:00',evening:'21:00'}, 'UNIT', {version:1,mode:'camp',asOf:'2026-11-18',campOptIn:true,paused:false,weighInsPerWeek:3});
  assert.deepEqual([...camp.weighDays], [1,4], 'camp stays Mon/Thu');
  const maint = ctx.Push.payload(sub, {morning:'07:00',evening:'21:00'}, 'UNIT', {version:1,mode:'maintenance',asOf:'2026-11-18',campOptIn:true,paused:false,weighInsPerWeek:3});
  assert.deepEqual([...maint.weighDays], [1,3,5], 'maintenance follows outline (3 a week)');
  const off = ctx.Push.payload(sub, {}, 'UNIT', {version:1,mode:'maintenance',asOf:'2026-11-18',campOptIn:true,paused:false,weighInsPerWeek:0});
  assert.deepEqual([...off.weighDays], [], '0 turns push weigh-ins off');
  const S = {push:true,recovery:Recovery.migrate({profile:{name:'U'},entries:[],params:{...Scoring.DEFAULT_PARAMS},weeks:[]},'2026-11-18').recovery};
  S.recovery.maintenance.weighInsPerWeek = 2; assert.equal(Recovery.pushMetadata(S,'2026-11-18').weighInsPerWeek, 2, 'lifecycle carries the outline setting');
}
// --- Item 5: weekly coach report follows the Nov 16 layout, phone-friendly, self-contained HTML
{
  const d = { name:'UNIT <b>', meta:'Gym: G', period:'Week Nov 12 to Nov 18, 2026', score:89, scoreLabel:'3 weeks', badge:'FIGHT READY', verdict:'Strong base', countdown:'5 days to fight (0w 5d)', daysLogged:'7/7', weightVsTarget:'145.5 lbs • 1 lb to cut', flags:['Low energy (1/5) on 11-15'], loadAlert:'Training load up 47% vs last week',
    cats:[['Nutrition',90,25],['Training',85,25],['Sleep',87,15],['Wellness',65,15],['Screen Time',76,10],['Family/Friends',55,10]], daily:[{date:'2026-10-25',y:80},{date:'2026-10-26',y:70}], weight:[{date:'2026-10-25',y:150},{date:'2026-11-14',y:145.5}], target:144.5, sleep:[{date:'2026-11-01',y:7},{date:'2026-11-02',y:8}], idealSleep:8,
    hydration:{days:[{date:'2026-11-09',color:'#f1d36b'}],summary:'Latest: Hydrated'}, nutrition:'Plan followed 6/7 days', training:'5/6 scheduled sessions done', loadWeeks:[3450,2725,3000,4410], missed:['1 of 6 sessions missed (11-14 MMA class)'], focus:['Plan real time with family or friends'] };
  const h = CoachReport.html(d, { standalone:true });
  const order = ['CORNERREADY SCORE','5 days to fight','Days logged this week','Weight vs target','Flags:','Training load up 47%','Scores by category','Daily CornerReady score','Weight vs target</h3>','Sleep hours','Hydration','Nutrition','Training</h3>','Missed','Focus next week'];
  let last = -1; for (const k of order) { const i = h.indexOf(k, last + 1); assert.ok(i > last, 'section order: '+k); last = i; }
  assert.ok(h.startsWith('<!doctype html>') && h.includes('width=device-width'), 'standalone phone page');
  assert.ok(!/<script|<link /i.test(h), 'no scripts or external CSS (email-template friendly)');
  assert.ok(h.includes('UNIT &lt;b&gt;') && !h.includes('UNIT <b>'), 'escapes fighter text');
  assert.ok(h.includes('color:#DEDEDE">CORNER') || h.includes('color:#DEDEDE">CORNER'.replace('"','"')), 'brand wordmark colours');
  assert.ok(/background:#2e7d32/.test(h) && /background:#F5A623/.test(h) && /background:#C62828/.test(h), 'category bars coloured green/amber/red');
  assert.equal(CoachReport.fileName('Pablo R','2026-11-15'), 'CornerReady-report-Pablo-R-2026-11-15.html');
  const empty = CoachReport.html({}, {}); assert.ok(empty.includes('Not enough data yet') && empty.includes('—'), 'renders with no data');
}
// Report tab shows the new layout in camp and Maintenance
{
  const a = app(null);
  a.run("S.profile={name:'UNIT',schedule:Profile.scheduleFromWeek(S.weeks[0])};S.fighter='UNIT';save();show('report')");
  assert.ok(a.doc.querySelector('.coach-report'), 'Maintenance report shows the coach report panel');
  assert.ok(a.doc.querySelector('#rcMaintFrScore'), 'maintenance score block kept');
  a.run("Recovery.schedule(S.recovery, today(), {fightDate:'2026-12-12',recoveryDays:7});save();show('report')");
  assert.ok(a.doc.querySelector('.coach-report') && a.doc.querySelector('#coachReportTitle') && a.doc.querySelector('[data-send]'), 'camp report: panel, title, send button');
  assert.ok(/days to fight/i.test(a.doc.querySelector('.coach-report').textContent), 'camp report shows days to fight');
}
console.log('CornerReady rebrand + cleanup items 1–5 pass');
