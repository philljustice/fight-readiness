import test from 'node:test';import assert from 'node:assert/strict';
import {cleanLifecycle,campNotificationsAllowed,recoveryNotificationsAllowed,mergeLifecycle,recoverySendsThisWeek} from '../src/phase-policy.js';
import {dueReminders} from '../src/schedule.js';import {clean,runCron} from '../src/index.js';

const life={version:1,mode:'camp',asOf:'2026-11-05',fightDate:'2026-11-07',campOptIn:true,paused:false,recoveryOptIn:false};
const rec={tz:'America/New_York',morning:'07:00',evening:'21:00',remind:true,lifecycle:life};

test('closed client: known fight date suppresses all old categories from next local calendar day onward',()=>{
 assert.equal(campNotificationsAllowed(rec,'2026-11-07',420),true);
 for(const iso of ['2026-11-08T12:00:00Z','2026-11-09T02:00:00Z','2026-11-09T02:30:00Z','2026-11-09T04:00:00Z','2026-11-08T23:00:00Z','2027-01-01T12:00:00Z'])assert.deepEqual(dueReminders(rec,new Date(iso)),[]);
 assert.equal(campNotificationsAllowed({...rec,tz:'Pacific/Auckland'},'2026-11-08',420),false);
});

test('legacy records without known phase dates silence at release; known legacy future fight supports conservative fallback only',()=>{
 const old={tz:'America/New_York',morning:'07:00',evening:'21:00',remind:true};
 assert.deepEqual(dueReminders(old,new Date('2026-11-09T12:00Z')),[]);
 assert.equal(campNotificationsAllowed({...old,fightDate:'2026-11-07'},'2026-11-06',420),true);
 assert.equal(campNotificationsAllowed({...old,fightDate:'2026-11-07'},'2026-11-08',420),false);
 assert.equal(campNotificationsAllowed({...old,fightDate:'bad'},'2026-11-08',420),false);
});

test('camp hold, opt-out, pause, snooze, quiet windows suppress camp categories',()=>{
 for(const update of [{restrictionPause:true},{campOptIn:false},{paused:true},{snoozeUntil:'2026-11-07'},{fightDate:null},{asOf:'2027-01-01'}])assert.equal(campNotificationsAllowed({...rec,lifecycle:{...life,...update}},'2026-11-06',420),false);
 const quiet={...rec,lifecycle:{...life,quietStart:'21:00',quietEnd:'08:00'}};assert.equal(campNotificationsAllowed(quiet,'2026-11-06',420),false);assert.equal(campNotificationsAllowed(quiet,'2026-11-06',600),true);
 assert.equal(campNotificationsAllowed({...rec,lifecycle:{...life,mode:'recovery',recoveryOptIn:true}},'2026-11-06',420),false);
});

test('metadata is a minimal allowlist; no symptoms, questionnaire, weight, coach details or log data',()=>{
 const l=cleanLifecycle({...life,weight:180,notes:'private',injury:'example',summary:'example',reviewComplete:true,reviewCompletedAt:'2026-11-05',reviewBoutId:'2026-11-04'});assert.ok(l);for(const k of ['weight','notes','injury','summary'])assert.ok(!(k in l));
 assert.equal(l.reviewComplete,true);assert.equal(l.reviewBoutId,'2026-11-04');
 const x=clean({subscription:{endpoint:'https://push.example.invalid/unit',keys:{p256dh:'unit',auth:'unit'}},lifecycle:{...life,notes:'not stored'}});assert.equal(x.lifecycle.mode,'camp');assert.ok(!JSON.stringify(x).includes('not stored'));assert.equal(cleanLifecycle({mode:'camp'}),null);
});

const recLife={version:1,mode:'recovery',asOf:'2026-11-05',campOptIn:true,recoveryOptIn:true,paused:false,previousFightDate:'2026-11-04',recoveryUntil:'2026-11-11',reviewComplete:false,reviewBoutId:'2026-11-04'};
const rRec={tz:'America/New_York',morning:'10:00',evening:'19:00',remind:false,lifecycle:recLife,sent:{}};

test('recovery day1 incomplete: camp morning+evening slots (rec-day1-am/pm); no camp weigh-in/diet/shame kinds',()=>{
 const due=dueReminders(rRec,new Date('2026-11-05T15:00:00Z')); // 10:00 ET morning
 assert.equal(due.length,1);assert.equal(due[0].kind,'rec-day1-am');
 assert.ok(/fight|review|activities|food|wellbeing/i.test(due[0].title+' '+due[0].body));
 assert.ok(!/weigh|diet|Last call|Weekly report/i.test(due[0].title+' '+due[0].body));
 const eve=dueReminders(rRec,new Date('2026-11-06T00:00:00Z')); // 19:00 ET evening same day1
 assert.equal(eve.length,1);assert.equal(eve[0].kind,'rec-day1-pm');
});

test('recovery review complete: day1 still uses day1 slots; later days allow evening check-in',()=>{
 const done={...rRec,lifecycle:{...recLife,reviewComplete:true,reviewCompletedAt:'2026-11-05',recoveryDay:1}};
 const am=dueReminders(done,new Date('2026-11-05T15:00:00Z'));
 assert.equal(am.length,1);assert.equal(am[0].kind,'rec-day1-am');
 assert.ok(/log activities|food|wellbeing|optional/i.test(am[0].body));
 const eve=dueReminders(done,new Date('2026-11-06T00:00:00Z'));
 assert.equal(eve.length,1);assert.equal(eve[0].kind,'rec-day1-pm');
 // Day 2 (not day1): evening check-in after complete
 const d2={...rRec,lifecycle:{...recLife,asOf:'2026-11-06',previousFightDate:'2026-11-04',recoveryUntil:'2026-11-11',reviewComplete:true,reviewCompletedAt:'2026-11-05',recoveryDay:2},morning:'10:00',evening:'19:00'};
 const d2eve=dueReminders(d2,new Date('2026-11-07T00:00:00Z')); // 19:00 ET Nov6
 assert.equal(d2eve.length,1);assert.equal(d2eve[0].kind,'rec-checkin');
 assert.ok(/optional/i.test(d2eve[0].body));
 assert.deepEqual(dueReminders(d2,new Date('2026-11-07T00:00:00Z'),{date:'2026-11-06',complete:false,recoveryCheckin:true}),[]);
});

test('day2+: no checkin same day as rec-review send; day1 may use both camp slots',()=>{
 const d2={...rRec,lifecycle:{...recLife,asOf:'2026-11-06',previousFightDate:'2026-11-04',recoveryUntil:'2026-11-11',reviewComplete:true,reviewCompletedAt:'2026-11-05',recoveryDay:2},sent:{'rec-review':'2026-11-06'},morning:'10:00',evening:'19:00'};
 assert.deepEqual(dueReminders(d2,new Date('2026-11-07T00:00:00Z')),[]); // same day as review send
 // Day1 AM already sent does not block PM
 const d1={...rRec,lifecycle:{...recLife,recoveryDay:1},sent:{'rec-day1-am':'2026-11-05'}};
 const pm=dueReminders(d1,new Date('2026-11-06T00:00:00Z'));
 assert.equal(pm.length,1);assert.equal(pm[0].kind,'rec-day1-pm');
});

test('weekly cap 3 total recovery push-days',()=>{
 const capped={...rRec,recoverySendDates:['2026-11-02','2026-11-03','2026-11-04'],lifecycle:{...recLife,reviewComplete:true,reviewCompletedAt:'2026-11-05',recoveryDay:1}};
 assert.equal(recoverySendsThisWeek(capped,'2026-11-05'),3);
 assert.deepEqual(dueReminders(capped,new Date('2026-11-06T00:00:00Z')),[]);
 const two={...rRec,recoverySendDates:['2026-11-02','2026-11-03'],lifecycle:{...recLife,reviewComplete:true,reviewCompletedAt:'2026-11-05',recoveryDay:1}};
 assert.equal(recoverySendsThisWeek(two,'2026-11-05'),2);
 assert.equal(dueReminders(two,new Date('2026-11-06T00:00:00Z'))[0].kind,'rec-day1-pm');
});

test('opt-out, pause, snooze, quiet, missing recoveryOptIn, maintenance, legacy silence',()=>{
 assert.equal(recoveryNotificationsAllowed({...rRec,lifecycle:{...recLife,recoveryOptIn:false}},'2026-11-05',600),false);
 assert.equal(recoveryNotificationsAllowed({...rRec,lifecycle:{...recLife,paused:true}},'2026-11-05',600),false);
 assert.equal(recoveryNotificationsAllowed({...rRec,lifecycle:{...recLife,snoozeUntil:'2026-11-06'}},'2026-11-05',600),false);
 assert.equal(recoveryNotificationsAllowed({...rRec,lifecycle:{...recLife,quietStart:'09:00',quietEnd:'11:00'}},'2026-11-05',600),false);
 assert.deepEqual(dueReminders({...rRec,lifecycle:{...recLife,mode:'maintenance',recoveryOptIn:true}},new Date('2026-11-05T15:00:00Z')),[]);
 assert.deepEqual(dueReminders({tz:'America/New_York',morning:'10:00',evening:'19:00'},new Date('2026-11-05T15:00:00Z')),[]);
});

test('mergeLifecycle never regresses completed review from stale incomplete payload; new bout may reset',()=>{
 const prev=cleanLifecycle({...recLife,reviewComplete:true,reviewCompletedAt:'2026-11-05',reviewBoutId:'2026-11-04',asOf:'2026-11-05'});
 const stale=cleanLifecycle({...recLife,reviewComplete:false,asOf:'2026-11-04',reviewBoutId:'2026-11-04'});
 const m=mergeLifecycle(prev,stale);assert.equal(m.reviewComplete,true);assert.equal(m.reviewCompletedAt,'2026-11-05');
 const fresh=cleanLifecycle({...recLife,reviewComplete:false,asOf:'2026-11-12',reviewBoutId:'2026-11-11',previousFightDate:'2026-11-11',recoveryUntil:'2026-11-18'});
 const m2=mergeLifecycle(prev,fresh);assert.equal(m2.reviewComplete,false);assert.equal(m2.reviewBoutId,'2026-11-11');
});

test('cron smoke: legacy silent; recovery without opt-in silent; opted recovery may schedule without contacting when slot empty',async()=>{
 const records=new Map([['legacy',JSON.stringify({sub:{endpoint:'https://unit.invalid'},morning:'07:00',tz:'America/New_York'})],['recovery-off',JSON.stringify({...rRec,lifecycle:{...recLife,recoveryOptIn:false},sub:{endpoint:'https://unit.invalid/2'}})],['held-camp',JSON.stringify({...rec,lifecycle:{...life,restrictionPause:true},sub:{endpoint:'https://unit.invalid/3'}})]]);
 let writes=0;
 const env={SUBS:{list:async()=>({keys:[...records.keys()].map(name=>({name})),list_complete:true}),get:async k=>JSON.parse(records.get(k)||'null'),put:async()=>writes++,delete:async()=>writes++}};
 const outcome=await runCron(env,new Date('2026-11-06T12:00Z'),async()=>assert.fail('must not contact any push service'));
 assert.deepEqual(outcome,{sent:0,removed:0});assert.equal(writes,0);
});
