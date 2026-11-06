/* Local recovery prototype: pure lifecycle; no notifications or clinical decisions. */
(function(root){
 const DAY=86400000, n=d=>Date.parse(d+'T12:00:00Z')/DAY;
 const dateOK=d=>typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(n(d)) && new Date(n(d)*DAY).toISOString().slice(0,10)===d;
 const addDays=(d,k)=>new Date((n(d)+k)*DAY).toISOString().slice(0,10);
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 function migrate(S,today){
  if(S.schemaVersion>3)throw new Error('This backup needs a newer FightReady version. Your saved data was not changed.');
  const r=S.recovery || {};
  if(!S.recovery && dateOK(S.profile?.fightDate))r.bouts=[{id:'legacy-'+S.profile.fightDate,fightDate:S.profile.fightDate,status:'scheduled',recoveryDays:7,campStart:S.startDate||S.entries.map(e=>e.date).sort()[0]||(S.profile.fightDate<today?S.profile.fightDate:today),created:today}];
  if(r.bouts && !Array.isArray(r.bouts))throw new Error('Damaged bout history');
  for(const b of r.bouts||[])if(!dateOK(b.fightDate)||!b.id||!['scheduled','cancelled','postponed'].includes(b.status))throw new Error('Damaged bout schedule');
  for(const k of ['holds','events','camps','goals'])if(r[k]!=null&&!Array.isArray(r[k]))throw new Error('Damaged recovery '+k);
  for(const b of r.bouts||[])b.recoveryDays=clamp(+b.recoveryDays||7,3,14);
  Object.assign(r,{bouts:r.bouts||[],holds:r.holds||[],events:r.events||[],camps:r.camps||[],reviews:r.reviews||{},goals:r.goals||[],style:['gentle','break'].includes(r.style)?r.style:null,styleChosen:r.styleChosen===true,adoptedDate:r.adoptedDate||today,earlyMaintRequested:r.earlyMaintRequested===true,maintenance:r.maintenance||{sessions:2,checkins:3,minRPE:null},reminders:r.reminders||{optIn:false,quietStart:'21:00',quietEnd:'08:00',snoozeUntil:'',paused:false}});
  delete r.previewDate; // production never trusts fixture clocks from a restored file
  S.recovery=r;S.schemaVersion=3;return S;
 }
 function isCleared(h,today){return h.cleared===true&&['Clinician','Commission'].includes(h.clearance?.authority)&&dateOK(h.clearance?.date)&&(!today||h.clearance.date<=today)&&!!String(h.clearance?.note||'').trim();}
 function restricted(r,today){return (r.holds||[]).some(h=>(!h.date||h.date<=today)&&(!isCleared(h) || h.clearance.date>today));}
 function addHold(r,today,reason,source){const h={id:'hold-'+Date.now()+'-'+r.holds.length,date:today,reason,source,cleared:false};r.holds.push(h);return h;}
 function clearHolds(r,today,{authority,note,confirmed}){
  if(!confirmed||!['Clinician','Commission'].includes(authority)||!String(note||'').trim())throw new Error('Record qualified clinician or commission clearance, not a coach override.');
  r.holds.filter(h=>!isCleared(h,today)).forEach(h=>{h.cleared=true;h.clearance={date:today,authority,note:String(note).trim()};});
 }
 function schedule(r,today,input){
  const {fightDate,weighInDate='',recoveryDays=7,opponent='',id}=input;
  if(!dateOK(fightDate)||fightDate<today||!Number.isInteger(+recoveryDays)||+recoveryDays<3||+recoveryDays>14 || weighInDate && (!dateOK(weighInDate)||weighInDate>fightDate))throw new Error('Use a future fight date, a separate weigh-in no later than the fight, and 3–14 recovery days.');
  let b=id?r.bouts.find(x=>x.id===id&&x.fightDate>=today&&x.status==='scheduled'):null;
  const fresh=!b;
  if(b)r.events.push({date:today,action:'Rescheduled',previous:JSON.parse(JSON.stringify(b))});
  else {b={id:'bout-'+Date.now()+'-'+r.bouts.length,status:'scheduled',created:today,campStart:today};r.bouts.push(b);}
  Object.assign(b,{fightDate,weighInDate,recoveryDays:+recoveryDays,opponent:String(opponent).slice(0,80)});
  r.events.push({date:today,action:fresh?'Bout confirmed':'Date updated',boutId:b.id});return {bout:b,fresh};
 }
 function cancel(r,today,id,status){const b=r.bouts.find(x=>x.id===id);if(!b||b.fightDate<today||!['cancelled','postponed'].includes(status))throw new Error('Only an upcoming bout can be cancelled or postponed.');r.events.push({date:today,action:status,previous:JSON.parse(JSON.stringify(b))});b.status=status;}
 function extend(r,today,id,until){const b=r.bouts.find(x=>x.id===id);if(!b||!dateOK(until)||until<today||until<addDays(b.fightDate,b.recoveryDays||7)||b.extendUntil&&until<b.extendUntil)throw new Error('An extension must keep or lengthen the current recovery window.');b.extendUntil=until;}
 function sync(S,today){const r=S.recovery;
  for(const b of r.bouts.filter(b=>b.fightDate<today))if(!r.camps.some(c=>c.boutId===b.id))r.camps.push({boutId:b.id,fightDate:b.fightDate,status:b.status,captured:today,params:JSON.parse(JSON.stringify(S.params||{})),profile:JSON.parse(JSON.stringify(S.profile||{})),entries:JSON.parse(JSON.stringify(S.entries.filter(e=>e.date<=b.fightDate && (!b.campStart||e.date>=b.campStart))))});
  return phase(r,today);
 }
 function entryMode(S,date){if(restricted(S.recovery,date))return 'recovery';const e=S.entries.find(e=>e.date===date);return e?.context?.mode || (date<S.recovery.adoptedDate?'camp':phase(S.recovery,date).mode);}
 function campEntries(S,today){
  if(!S.recovery)return S.entries;
  const p=phase(S.recovery,today),campish=e=>!e.context||e.context.mode==='camp';
  // Active next camp: only logs after the previous bout (new camp window).
  if(p.mode==='camp'){
   const previous=(S.recovery.bouts||[]).filter(b=>b.fightDate<today&&b.status==='scheduled').sort((a,b)=>b.fightDate.localeCompare(a.fightDate))[0];
   return S.entries.filter(e=>campish(e)&&(!previous||e.date>previous.fightDate));
  }
  // Recovery / Maintenance after a bout: keep that camp's dated logs so the genuine rolling
  // FightReady score stays visible. Optional recovery check-ins (context.mode=recovery) are excluded
  // and never create score/streak pressure. As those camp days age out of the score window, readiness
  // can drop from freshness alone — not from an invented recovery penalty.
  if(p.past){
   const start=p.past.campStart||null;
   return S.entries.filter(e=>campish(e)&&e.date<=p.past.fightDate&&(!start||e.date>=start));
  }
  return S.entries.filter(campish);
 }
 function maintenanceReport(S,today){
  const r=S.recovery, p=phase(r,today);
  const start=p.mode==='recovery'?(p.past?addDays(p.past.fightDate,1):r.adoptedDate):p.past?addDays(p.past.fightDate,Math.max(p.past.recoveryDays||7, p.past.extendUntil?n(p.past.extendUntil)-n(p.past.fightDate):0)+1):r.adoptedDate;
  const entries=S.entries.filter(e=>e.date>=start&&e.date<=today&&n(today)-n(e.date)<7&&(e.context?.mode===p.mode || p.mode==='recovery'&&!e.context));
  const sessions=entries.flatMap(e=>(e.sessions||[]).concat(e.extra?.label?[{...e.extra,done:true}]:[])).filter(x=>x.done===true&&+x.mins>0);
  const configured=r.goalsConfirmed;
  const target=configured?clamp(+r.maintenance.sessions||2,1,7):null;
  const checkins=entries.filter(e=>['energy','mood','soreness','stress','sleepq','motivation','appetite'].some(k=>+e[k]>0)).length;
  // Process score: honest check-ins and agreed frequency only. Symptoms, intensity and weight never earn points.
  const score=p.mode==='maintenance'&&(checkins||sessions.length)?Math.round(configured?50*Math.min(1,checkins/(+r.maintenance.checkins||3))+50*Math.min(1,sessions.length/target):100*Math.min(1,checkins/3)):null;
  const hydrated=entries.filter(e=>+e.weight>0&&+e.hydration>=1&&+e.hydration<=3).sort((a,b)=>a.date.localeCompare(b.date));
  const band=p.mode==='maintenance'&&r.band?.approved&&+r.band.low>0&&+r.band.high>=+r.band.low?r.band:null;
  const last=hydrated.slice(-3), direction=band&&last.length===3&&last.every(e=>+e.weight>+band.high)?'above':band&&last.length===3&&last.every(e=>+e.weight<+band.low)?'below':null;
  const concern=entries.some(e=>e.injury&&e.injury!=='none'||e.ill===true);
  const restrictedNow=p.hold||concern||p.mode!=='maintenance';
  const nudges=[];
  if(!restrictedNow && direction)nudges.push('Three hydrated weigh-ins are '+direction+' your agreed band. Discuss the trend with your coach; no cutting or restriction.');
  if(!restrictedNow&&configured&&sessions.length<target&&n(today)-n(start)>=6)nudges.push('Your light plan has '+sessions.length+' of '+target+' sessions logged this week. Want to adjust the plan with your coach?');
  if(!restrictedNow&&configured&&r.maintenance.intensityApproved&&+r.maintenance.minRPE>0&&sessions.length>=3&&sessions.every(s=>+s.rpe>0&&+s.rpe<+r.maintenance.minRPE))nudges.push('Recent sessions were easier than your agreed light plan. Discuss whether the plan still fits; do not add hard sessions to chase a score.');
  const flags=entries.flatMap(e=>[e.injury&&e.injury!=='none'?e.date+': injury '+e.injury:null,e.ill?e.date+': illness reported':null,+e.mood>0&&+e.mood<=2?e.date+': low mood':null,+e.stress>=4?e.date+': higher stress':null,+e.soreness>=4?e.date+': higher soreness':null].filter(Boolean));
  return {entries,sessions: sessions.length,target,checkins,score,nudges,flags,band,hydrated,direction,restricted:restrictedNow};
 }
 function pushMetadata(S,today){const r=S.recovery,p=phase(r,today),o=r.reminders||{},past=p.past||null,revKey=past?(past.id||past.fightDate):null,rev=(revKey&&r.reviews&&r.reviews[revKey])||{};const quietOn=p.mode==='camp'?o.applyToCamp===true:true;return {version:1,mode:p.mode,asOf:today,campOptIn:S.push===true,recoveryOptIn:S.push===true&&p.mode==='recovery',fightDate:p.next?.fightDate||null,previousFightDate:past?.fightDate||null,recoveryUntil:p.end?new Date(p.end*DAY).toISOString().slice(0,10):null,recoveryDay:p.mode==='recovery'&&p.day!=null?p.day:null,restrictionPause:p.hold,paused:o.paused===true,snoozeUntil:o.snoozeUntil||null,quietStart:quietOn?(o.quietStart||null):null,quietEnd:quietOn?(o.quietEnd||null):null,reviewComplete:rev.status==='complete',reviewCompletedAt:rev.completedAt||null,reviewBoutId:revKey||null};}
 function reminderAllowed(r,today,time){const o=r.reminders||{};if(!o.optIn||o.paused||o.snoozeUntil&&o.snoozeUntil>=today)return false;const a=o.quietStart||'21:00',b=o.quietEnd||'08:00';return !(a<b?time>=a&&time<b:time>=a||time<b);}

 const choices=['Yes','No','Not sure','N/A'];
 const CARE=[['injury','Is there an injury needing care?'],['head','Was there a head knock or concussion concern?'],['suspension','Is a suspension or medical restriction in place?']];
 const PREFER=[['returnTrain','If you are not injured, would you prefer to return to light training sooner? (This is not clearance. Unanswered care questions never mean you are injury-free.)']];
 const CORE=[['cardio','Did your cardio hold up in the later rounds?'],['pacing','Did you pace yourself as planned?'],['breathing','Could you keep steady breathing under pressure?'],['plan','Did you stick to the game plan?'],['rounds','Did you recover enough between rounds?'],['energy','Did your energy on the day feel ready?']];
 const BANK={MMA:['Did your striking defense hold under pressure?','Did you land the striking you trained?','Could you control the clinch?','Did your takedown work hold up?','Could you work your ground plan?'],Boxing:['Did your jab and range work?','Did your head movement hold up?','Could you build combinations?','Did your ring craft work?'], 'Muay Thai':['Did your kicks and teeps work?','Could you use clinch and knees?','Did your checks hold up?'],BJJ:['Could you retain or pass guard?','Could you find submissions or escapes?','Did your pace hold up?'],Wrestling:['Were your shots effective?','Could you chain attacks?','Did your sprawl hold up?']};
 function phase(r,today){
  const bouts=(r.bouts||[]).filter(b=>b.status==='scheduled'&&b.fightDate);
  const past=bouts.filter(b=>n(b.fightDate)<n(today)).sort((a,b)=>n(b.fightDate)-n(a.fightDate))[0];
  const next=bouts.filter(b=>n(b.fightDate)>=n(today)).sort((a,b)=>n(a.fightDate)-n(b.fightDate))[0];
  const hold=restricted(r,today);
  const days=past?Math.floor(n(today)-n(past.fightDate)):null;
  const duration=past?Math.max(3,Math.min(14,+past.recoveryDays||7)):7;
  const end=past?Math.max(n(past.fightDate)+duration,n(past.extendUntil||past.fightDate)):null;
  const remaining=past&&end!=null?Math.max(0,Math.ceil(end-n(today))):null;
  // Early Maintenance from Setup/review preference: never while a care hold is active; does not clear holds.
  if(hold || (past&&n(today)<=end&&!r.earlyMaintRequested))return {mode:'recovery',past,next,day:days,duration,hold,end,remaining};
  if(past&&n(today)<=end&&r.earlyMaintRequested&&!hold)return {mode:'maintenance',past,next,day:days,duration,hold:false,end,remaining:0,early:true};
  return {mode:next?'camp':'maintenance',past,next,day:days,duration,end,hold:false,remaining:0};
 }
 function questions(discipline){return CORE.concat((BANK[discipline]||[]).map((q,i)=>['skill'+i,q]));}
 function summary(review,discipline){
  const lines=['DRAFT — athlete answers, not a diagnosis. Review before sharing.'];
  CARE.concat(PREFER).concat(questions(discipline)).forEach(([k,q])=>{const a=(review.answers||{})[k];if(choices.includes(a))lines.push(q+' '+a);});
  Object.entries(review.notes||{}).forEach(([k,v])=>{if(String(v).trim())lines.push(k+': '+String(v).trim());});
  return lines.join('\n');
 }
 const COMMENTS=['Take the rest. You earned it.','The people who backed you this camp would like to see you. Recovery counts too.','A big event can leave you feeling flat. Keep a little rhythm if it helps.','Do something you enjoy today that isn’t training.','Who helped you get here? Today is a good day to reach out.','One small idea for the future is enough.','Steady is fine. Look at your next chapter when you feel ready.'];
 const IDEAS=['Rest and keep the day simple.','A family meal or a catch-up with a friend, if you feel like it.','An easy walk only if pain-free and your clinician’s restrictions allow it.','A hobby, a game or some music.','A social gym visit to talk fights, not work out, only if restrictions allow. A quiet call is equally good.','An optional coach conversation, not a training deadline.','Look at a gentle Maintenance outline with your coach.'];
 function daily(p,style){const i=(Math.max(1,p.day||1)-1)%7;
  const comment=p.hold? (i===1||i===4?'Your people are in your corner. A quiet call or visit is enough.':'No deadline to hit. Following your clinician’s plan is progress.'):COMMENTS[i];
  return {comment,idea:style==='break'?null:p.hold?'Rest or a quiet conversation, only if your care plan allows. No physical activity suggestion.':IDEAS[i],social:i===1||i===4};}
 function applyReviewShape(r,today,review){
  const a=review.answers||{}, past=(r.bouts||[]).filter(b=>b.status==='scheduled'&&b.fightDate&&n(b.fightDate)<n(today)).sort((x,y)=>n(y.fightDate)-n(x.fightDate))[0];
  if(!past)return null;
  const injuryYes=['injury','head','suspension'].some(k=>a[k]==='Yes');
  // Never infer "not injured" from unanswered; only act when care answers are explicitly No/N/A and returnTrain=Yes.
  const careAnswered=['injury','head','suspension'].every(k=>['No','N/A'].includes(a[k]));
  if(a.returnTrain==='Yes'&&careAnswered&&!injuryYes){
    past.recoveryDays=Math.max(3,Math.min(+past.recoveryDays||7,5));
    return {shaped:true,recoveryDays:past.recoveryDays,reason:'prefer-return'};
  }
  if(injuryYes){
    past.recoveryDays=Math.max(+past.recoveryDays||7,10);
    return {shaped:true,recoveryDays:past.recoveryDays,reason:'care-yes'};
  }
  return null;
 }
 function requestEarlyMaint(r,today,{preferReturn,confirmed}={}){
  if(restricted(r,today))throw new Error('A care note is on file. Talk with your coach before returning to training, and keep any clinician or commission plan. Early Maintenance is not available while a hold is active.');
  if(!confirmed)throw new Error('Confirm you understand this does not clear medical restrictions.');
  r.earlyMaintRequested=true;
  r.events.push({date:today,action:'Early Maintenance requested',preferReturn:!!preferReturn});
  return phase(r,today);
 }
 function clearEarlyMaint(r,today){r.earlyMaintRequested=false;r.events.push({date:today,action:'Early Maintenance cancelled'});return phase(r,today);}
 function day1Welcome(p){
  if(!p||p.mode!=='recovery'||p.day!==1)return null;
  return {
   title:'Camp complete',
   congrats:'You put the work into camp. Take a moment to recognise that.',
   intro:'The next few days are for rest and recovery. Stay connected with the people who backed you. Activity is optional and only if appropriate for how you feel and any medical restrictions. Morning and evening logs and the optional review stay available, but nothing here earns points or streaks.'
  };
 }
 const api={dateOK,addDays,migrate,sync,entryMode,campEntries,maintenanceReport,pushMetadata,reminderAllowed,isCleared,restricted,addHold,clearHolds,schedule,cancel,extend,phase,summary,questions,choices,CARE,PREFER,daily,day1Welcome,applyReviewShape,requestEarlyMaint,clearEarlyMaint};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Recovery=api;
})(typeof window==='undefined'?globalThis:window);
