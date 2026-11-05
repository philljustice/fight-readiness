// Representative synthetic backups only. Never reads real logs or private source sheets.
const assert=require('assert'),fs=require('fs'),R=require('./recovery'),P=require('./profile'),Sc=require('./scoring');
const schedule=P.scheduleFromWeek({days:[]});
const templates=[
 {label:'v1 legacy name-only no date',data:{app:'fight-readiness',version:1,fighter:'UNIT v1',entries:[{date:'2026-10-01',v:1,weight:180,energy:3,soreness:4,stress:4,mood:3,sleep:7}],startDate:'2026-10-01'}},
 {label:'v2 complete camp with all log fields',data:{app:'fight-readiness',version:1,profile:{name:'UNIT v2',fightDate:'2026-11-03',schedule},fighter:'UNIT v2',wellScale:Sc.WELL_SCALE,startDate:'2026-10-01',entries:[{date:'2026-10-01',v:2,sessions:[{label:'UNIT drills',done:true,rpe:4,mins:30}],hydration:2,weight:180,sleep:8,energy:3,soreness:4,stress:4,mood:2,sleepq:4,motivation:4,appetite:4,injury:'none',ill:false,nmode:'macros',ntarget:{protein:140,carbs:200,fat:60},protein:140,carbs:200,fat:60,nutrition:true,notes:'UNIT note'}]}},
 {label:'v3 recovery hold, edited report, goals, unknown future fields',data:{app:'fight-readiness',version:3,schemaVersion:3,profile:{name:'UNIT v3',fightDate:'2026-11-03',schedule},fighter:'UNIT v3',wellScale:Sc.WELL_SCALE,entries:[{date:'2026-11-04',v:2,context:{mode:'recovery',boutId:'unit-bout'},sleep:8,mood:2,soreness:5,stress:5,hydration:3,extra:{label:'UNIT rest',rpe:1,mins:5}}],customRetained:{example:1},recovery:{adoptedDate:'2026-11-01',bouts:[{id:'unit-bout',fightDate:'2026-11-03',weighInDate:'2026-11-02',status:'scheduled',recoveryDays:7}],holds:[{date:'2026-11-04',reason:'UNIT illness concern',cleared:false}],reviews:{'unit-bout':{answers:{cardio:'Not sure'},notes:{cardio:'UNIT'},editedSummary:'UNIT editable draft',discipline:'MMA'}},goals:['UNIT goal'],goalsConfirmed:true,events:[],camps:[],maintenance:{sessions:2,checkins:3}}}},
 ];
templates[1].data.entries=Array.from({length:7},(_,i)=>({...templates[1].data.entries[0],date:'2026-10-'+String(i+1).padStart(2,'0')}));
templates[2].data.entries=Array.from({length:3},(_,i)=>({...templates[2].data.entries[0],date:'2026-11-'+String(i+3).padStart(2,'0')}));
function restore(data){return R.migrate(P.fromBackup(JSON.stringify(data),{weeks:[{start:'2026-11-02',days:[]}],weekIdx:0,params:{...Sc.DEFAULT_PARAMS}},Sc),'2026-11-05');}
const results=[];
for(const f of templates){
 const before=JSON.stringify(f.data),a=restore(f.data),count=a.entries.length,dates=a.entries.map(e=>e.date),versions=a.entries.map(e=>e.v);
 assert.equal(JSON.stringify(f.data),before,'source backup immutable');assert.equal(count,f.data.entries.length);assert.deepEqual(dates,f.data.entries.map(e=>e.date));assert.deepEqual(versions,f.data.entries.map(e=>e.v));
 assert.equal(a.schemaVersion,3);assert.equal(a.push,false);assert.equal(a.notify,false);
 R.sync(a,'2026-11-05');const roundtrip=restore({...a,app:'fight-readiness',version:3});
 assert.equal(roundtrip.entries.length,count);assert.deepEqual(roundtrip.entries.map(e=>e.date),dates);assert.deepEqual(roundtrip.entries.map(e=>e.v),versions);assert.deepEqual(roundtrip.recovery,a.recovery);
 if(f.label.startsWith('v1')){assert.equal(R.phase(a.recovery,'2026-11-05').mode,'maintenance');assert.equal(a.entries[0].weight,180);}
 if(f.label.startsWith('v2')){assert.deepEqual(a.entries[0],f.data.entries[0]);assert.equal(a.recovery.camps.length,1);assert.equal(a.recovery.camps[0].entries[0].notes,'UNIT note');}
 if(f.label.startsWith('v3')){assert.equal(R.phase(a.recovery,'2026-12-01').mode,'recovery');assert.equal(a.recovery.reviews['unit-bout'].editedSummary,'UNIT editable draft');assert.deepEqual(a.customRetained,{example:1});assert.equal(a.entries[0].soreness,5);assert.equal(a.entries[0].stress,5);}
 results.push({fixture:f.label,count,dates,versions,roundtrip:true});
}
assert.throws(()=>restore({app:'fight-readiness',schemaVersion:999,fighter:'UNIT',entries:[]}));
console.log('Synthetic backup acceptance passed:',JSON.stringify(results));
