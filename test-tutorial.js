const assert = require('assert');
const fs = require('fs');
const Tour = require('./tutorial.js');
assert.equal(Tour.STEPS.length, 7);
assert.deepEqual(Tour.STEPS.map(s=>s[0]), ['dash','dash','log','plan','report','setup','help']);
for (const state of [undefined,'completed','skipped','restored']) assert.equal(Tour.shouldStart({name:'A'},state,false),false);
assert.equal(Tour.shouldStart(null,'pending',false),false);
assert.equal(Tour.shouldStart({},'pending',true),false);
assert.equal(Tour.shouldStart({},'pending',false),true);
// Tiny DOM double: exercise lifecycle, controls, focus trap and state without a browser or changing real logs.
class El {
 constructor(){this.listeners={};this.isConnected=true;this.style={};this.children=[];this.inert=false;this.id='';this.tagName='BUTTON';this.offsetWidth=360;}
 setAttribute(){} append(...els){this.children.push(...els);}
 addEventListener(k,f){this.listeners[k]=f;}
 remove(){this.isConnected=false;}
 scrollIntoView(){} getBoundingClientRect(){return {left:12,top:60,right:378,bottom:160,height:260};}
 focus(){document.activeElement=this;}
 set innerHTML(s){this.html=s;this.heading=new El();this.heading.tagName='H2';this.text=new El();this.buttons=['skip','back','next'].map(action=>{const b=new El();b.dataset={tour:action};return b;});this.buttons[1].disabled=s.includes('disabled');}
 querySelector(s){return s==='h2'?this.heading:this.text;}
 querySelectorAll(){return this.buttons.filter(b=>!b.disabled);}
}
const background=[new El(),new El(),new El()];background[0].inert=true;
const body=new El(), target=new El(), origin=new El();origin.id='replayTutorial';
global.document={body,activeElement:origin,createElement:()=>new El(),querySelectorAll:()=>background,querySelector:()=>target};
global.innerWidth=390;global.innerHeight=844;global.requestAnimationFrame=f=>f();
global.window={scrollY:20,scrollBy(){},scrollTo(){},addEventListener(){},removeEventListener(){}};
async function run(){
 let state,profile={},blocked=false,tab='help',readyResolve;
 const calls=[], marks=[], model={profile:{name:'A'},entries:[{weight:186,hydration:2}],weeks:[{days:[]}]}, before=JSON.stringify({profile:{name:'A'},entries:[{weight:186,hydration:2}],weeks:[{days:[]}]});
 const api={profile:()=>profile,state:()=>state,blocked:()=>blocked,tab:()=>tab,mark:s=>{marks.push(s);state=s;model.tutorial=s;},navigate:t=>{calls.push(t);tab=t;},ready:()=>Promise.resolve()};
 const tour=Tour.create(api);
 await tour.start(false);assert.equal(tour.active,false,'existing installs not interrupted');
 profile=null;await tour.start(true);assert.equal(tour.active,false,'no tour before setup');
 profile={};blocked=true;await tour.start(true);assert.equal(tour.active,false,'do not cover setup dialog');blocked=false;
 state='pending';api.ready=()=>new Promise(r=>{readyResolve=r;});const start=tour.start(false);assert.equal(tour.active,false,'wait for splash');readyResolve();await start;
 assert.equal(tour.active,true);assert.equal(state,'skipped','refresh cannot restart interrupted tour');
 assert.ok(background.every(x=>x.inert),'background cannot receive input');
 let layer=body.children.at(-1), panel=layer.children[1];
 const click=a=>layer.listeners.click({target:{closest:()=>({dataset:{tour:a}})},stopPropagation(){}});
 click('next');assert.equal(calls.at(-1),'dash');click('back');assert.ok(panel.heading.textContent.includes('readiness'));
 const last=panel.buttons[2];last.focus();let prevented=false;
 layer.listeners.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(document.activeElement,panel.buttons[0]);
 for(let i=0;i<6;i++)click('next');assert.equal(calls.at(-1),'help');click('next');
 assert.equal(tour.active,false);assert.equal(state,'completed');assert.equal(background[0].inert,true);assert.equal(background[1].inert,false);assert.equal(calls.at(-1),'dash','Finish returns Score');assert.equal(document.activeElement,target,'Score tab gets focus');
 api.ready=()=>Promise.resolve();await tour.start(false);assert.equal(tour.active,false,'completion suppresses repeat');
 await tour.start(true);assert.equal(tour.active,true,'manual replay allowed');layer=body.children.at(-1);
 layer.listeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(state,'skipped');assert.equal(tour.active,false);
 await tour.start(false);assert.equal(tour.active,false,'skip suppresses repeat');
 const {tutorial:ignored,...healthAndProfile}=model;assert.equal(JSON.stringify(healthAndProfile),before,'tour state only; no profile, log or schedule changes');
 assert.equal(calls.at(-1),'dash','Skip restores replay origin');
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 assert.ok(app.includes("if (first) S.tutorial = 'pending'"));assert.ok(app.includes("S.tutorial = 'restored'"));
 assert.ok(app.includes('window.__frSplashDone'));assert.ok(app.includes('case \'replayTutorial\''));
 assert.ok(html.includes('src="tutorial.js"'));assert.ok(sw.includes("'tutorial.js'"));
 assert.ok(!/autosave\(|upsert\(|fetch\(|localStorage/.test(fs.readFileSync('tutorial.js','utf8')),'tour only calls adapter for tutorial state');
 console.log('Tutorial: lifecycle, replay, navigation, splash gate, controls, focus, persistence and integration pass');
}
run().catch(e=>{console.error(e);process.exitCode=1;});

// Zoomed/narrow view: reserve a target strip rather than covering the heading.
{ const v={x:0,y:0,w:512,h:340}, r={top:90,bottom:180,height:90};
 const fit=Tour.layout(v,r,280);
 assert.ok(fit.top>=12 && fit.top+fit.height<=v.h-12);
 assert.ok(r.bottom-fit.scroll<=fit.top-16,'target is above tooltip after scrolling');
 assert.ok(fit.height<280,'tooltip scrolls internally when space is tight');
 assert.equal(Tour.STEPS[4][1],'#coachReportTitle','spotlight the concise report heading');
 const roomy=Tour.layout({x:0,y:0,w:390,h:844},{top:60,bottom:120,height:60},260);
 assert.equal(roomy.scroll,0);assert.equal(roomy.top,136);
}
