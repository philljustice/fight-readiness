const assert=require('assert'),W=require('./weightplan'),R=require('./recovery');
const adult={dob:'1990-01-01',targetWeight:180,startWeight:186,cutExp:'experienced',waterCut:true,fightDate:'2026-11-20',weighIn:'day-before'};
assert.equal(W.weighInDate(adult),'2026-11-19');assert.equal(W.weighInDate({...adult,weighIn:'same-day'}),'2026-11-20');
const explicit={...adult,weighInDate:'2026-11-18'};assert.equal(W.weighInDate(explicit),'2026-11-18');
const st=W.status([],explicit,new Date('2026-11-16T12:00'));assert.equal(st.weighIn,'2026-11-18');assert.equal(st.daysToWeighIn,2);
assert.equal(W.status([],explicit,new Date('2026-11-19T12:00')).postWeighIn,true);
const same={...adult,weighInDate:adult.fightDate};assert.equal(W.allowance(same).pct,W.allowance({...adult,weighIn:'same-day'}).pct);assert.ok(W.allowance(same).pct<=W.allowance(adult).pct);
const alreadyConservative={...adult,weighIn:'same-day',weighInDate:'2026-11-19'};assert.equal(W.allowance(alreadyConservative).pct,W.allowance({...adult,weighIn:'same-day'}).pct,'date override never loosens the profile cap');
const S={profile:{name:'UNIT'},entries:[]};R.migrate(S,'2026-11-05');S.push=true;S.recovery.bouts=[{id:'old',fightDate:'2026-11-01',status:'scheduled',recoveryDays:7},{id:'next',fightDate:'2026-11-20',status:'scheduled',recoveryDays:7}];
assert.equal(R.pushMetadata(S,'2026-11-06').mode,'recovery');assert.equal(R.pushMetadata(S,'2026-11-06').recoveryUntil,'2026-11-08');assert.equal(R.pushMetadata(S,'2026-11-09').mode,'camp');assert.equal(R.pushMetadata(S,'2026-11-09').recoveryUntil,'2026-11-08');
assert.equal(R.pushMetadata(S,'2026-11-09').quietStart,null,'existing camp times unaffected until quiet-hour preference is explicit');
R.addHold(S.recovery,'2026-11-09','UNIT illness','unit');const meta=R.pushMetadata(S,'2026-11-10');assert.equal(meta.restrictionPause,true);assert.ok(!JSON.stringify(meta).includes('illness'),'only generic pause flag, no medical detail');
for(const c of [{cleared:true},{cleared:true,clearance:{date:'2026-11-10',authority:'Coach',note:'looks fine'}}]){Object.assign(S.recovery.holds[0],c);assert.equal(R.phase(S.recovery,'2027-01-01').hold,true);}
R.clearHolds(S.recovery,'2026-11-10',{authority:'Clinician',note:'UNIT recorded instruction',confirmed:true});assert.equal(R.phase(S.recovery,'2026-11-11').hold,false);
console.log('Explicit event-date timing, conservative same-day allowances, metadata phase boundaries and legacy invalid-clearance tests pass');

const I=require('./insights'),date=new Date('2026-11-16T12:00'),ents=[{date:'2026-11-16',weight:186}];
assert.equal(I.cutPlan(186,180,adult.fightDate,date).days,4);
assert.equal(I.cutPlan(186,180,adult.fightDate,date,explicit.weighInDate).days,2);
assert.ok(I.cutSafety(ents,date,explicit).pace.perWeek>I.cutSafety(ents,date,adult).pace.perWeek);
assert.ok(I.cutPlan(186,180,adult.fightDate,date,explicit.weighInDate).msg.includes('by weigh-in'));
assert.deepEqual(I.cutSafety(ents,date,{...adult,weighInDate:'bad'}),I.cutSafety(ents,date,adult));

S.recovery.holds[0].clearance.date='2026-11-15';assert.equal(R.phase(S.recovery,'2026-11-14').hold,true,'restored future clearance cannot lift a hold early');assert.equal(R.phase(S.recovery,'2026-11-15').hold,false);
