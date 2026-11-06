// Pure VM mocks only; no browser, real subscription, network request or permission prompt.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),R=require('./recovery');
(async()=>{
 const requests=[],sub={endpoint:'https://unit.invalid',toJSON:()=>({endpoint:'https://unit.invalid',keys:{auth:'UNIT',p256dh:'UNIT'}})},S={push:true,profile:{name:'UNIT'},entries:[]};R.migrate(S,'2026-11-05');R.schedule(S.recovery,'2026-11-01',{fightDate:'2026-11-03',recoveryDays:7});
 const boutId=S.recovery.bouts.find(b=>b.fightDate==='2026-11-03').id;
 S.recovery.reviews={[boutId]:{status:'draft',notes:'NOT FOR NETWORK'}};
 const ctx=vm.createContext({navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>sub}})}},window:{PushManager:{},Notification:{}},Intl,fetch:async(u,o)=>{requests.push({url:u,body:JSON.parse(o.body)});return {ok:true,json:async()=>({ok:true})};}});
 vm.runInContext(fs.readFileSync('push.js','utf8')+';globalThis.P=Push',ctx);
 await ctx.P.update({morning:'07:00',evening:'21:00'},'UNIT',R.pushMetadata(S,'2026-11-05'));
 assert.equal(requests.length,1);
 const life=requests[0].body.lifecycle;
 assert.equal(life.mode,'recovery');
 assert.equal(life.recoveryUntil,'2026-11-10');
 assert.equal(life.recoveryOptIn,true);
 assert.equal(life.reviewComplete,false);
 assert.equal(life.reviewBoutId,boutId);
 assert.ok(!JSON.stringify(requests).includes('NOT FOR NETWORK'));
 S.recovery.reviews[boutId]={status:'complete',completedAt:'2026-11-05'};
 await ctx.P.update({morning:'07:00',evening:'21:00'},'UNIT',R.pushMetadata(S,'2026-11-05'));
 assert.equal(requests[1].body.lifecycle.reviewComplete,true);
 assert.equal(requests[1].body.lifecycle.reviewCompletedAt,'2026-11-05');
 S.recovery.holds.push({date:'2026-11-05',reason:'PRIVATE illness',cleared:false});await ctx.P.update({morning:'07:00',evening:'21:00'},'UNIT',R.pushMetadata(S,'2026-11-15'));
 assert.equal(requests[2].body.lifecycle.restrictionPause,true);assert.ok(!JSON.stringify(requests).includes('PRIVATE'));
 S.push=false;S.recovery.holds=[];
 await ctx.P.update({morning:'07:00',evening:'21:00'},'UNIT',R.pushMetadata(S,'2026-11-15'));
 assert.equal(requests[3].body.lifecycle.recoveryOptIn,false);
 console.log('Client synchronizes recovery review/check-in metadata using mocked existing subscription; no health/log/review answers in payload');
})().catch(e=>{console.error(e);process.exitCode=1});
