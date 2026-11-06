const assert=require('assert'),R=require('./recovery');
const today='2026-11-05';
function S(){
  const s={entries:[{date:'2026-11-01',v:2,nutrition:true,sleep:8,energy:4,mood:4,soreness:2,stress:2,sessions:[{done:true,mins:40,rpe:5,label:'Pads'}]}],profile:{fightDate:'2026-11-04'},params:{}};
  R.migrate(s,today);
  s.recovery.bouts=[{id:'b',fightDate:'2026-11-04',status:'scheduled',recoveryDays:7,campStart:'2026-10-20'}];
  s.recovery.holds=[]; s.recovery.reviews={}; s.recovery.earlyMaintRequested=false;
  return s;
}
let s=S(), p=R.phase(s.recovery,today);
assert.equal(p.mode,'recovery'); assert.equal(p.day,1); assert.equal(p.remaining,6);
const meta=R.pushMetadata(s,today); assert.equal(meta.recoveryDay,1); assert.equal(meta.mode,'recovery');

// Prefer return shapes only with explicit No/N/A care answers
s.recovery.reviews.b={answers:{injury:'No',head:'No',suspension:'No',returnTrain:'Yes'},status:'draft'};
const shaped=R.applyReviewShape(s.recovery,today,s.recovery.reviews.b);
assert.ok(shaped&&shaped.reason==='prefer-return'); assert.equal(s.recovery.bouts[0].recoveryDays,5);

// Unanswered care never implies not injured — returnTrain alone does not shorten
s=S(); s.recovery.reviews.b={answers:{returnTrain:'Yes'},status:'draft'};
assert.equal(R.applyReviewShape(s.recovery,today,s.recovery.reviews.b),null);
assert.equal(s.recovery.bouts[0].recoveryDays,7);

// Care Yes lengthens
s=S(); s.recovery.reviews.b={answers:{injury:'Yes',head:'No',suspension:'No'},status:'draft'};
assert.equal(R.applyReviewShape(s.recovery,today,s.recovery.reviews.b).reason,'care-yes');
assert.equal(s.recovery.bouts[0].recoveryDays,10);

// Early maint blocked by hold
s=S(); R.addHold(s.recovery,today,'UNIT hold','manual');
assert.throws(()=>R.requestEarlyMaint(s.recovery,today,{confirmed:true}),/care note|hold/i);
assert.equal(R.phase(s.recovery,today).mode,'recovery');
assert.equal(s.recovery.holds.filter(h=>!h.cleared).length,1);

// Early maint without hold
s=S();
R.requestEarlyMaint(s.recovery,today,{confirmed:true,preferReturn:true});
assert.equal(R.phase(s.recovery,today).mode,'maintenance');
assert.equal(R.phase(s.recovery,today).early,true);

// Auto maintenance after window (no hold)
s=S(); s.recovery.bouts[0].recoveryDays=3;
assert.equal(R.phase(s.recovery,'2026-11-08').mode,'maintenance'); // fight+3 end inclusive? end=fight+3, today<=end recovery; day 4 after
// end = fightDate + duration = Nov4+3=Nov7; Nov8 > end => maintenance
assert.equal(R.phase(s.recovery,'2026-11-07').mode,'recovery');
assert.equal(R.phase(s.recovery,'2026-11-08').mode,'maintenance');

// Camp entries preserved into maintenance window scoring inputs
s=S();
const camp=R.campEntries(s,'2026-11-08');
assert.ok(camp.some(e=>e.date==='2026-11-01'));
assert.ok(!camp.some(e=>e.context&&e.context.mode==='recovery'));

console.log('t210u phase/earlyMaint/prefer/shape/campEntries pass');
