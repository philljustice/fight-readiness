// Staged for Monday release only.
// Camp: existing reminders through fight day only.
// Recovery: optional gentle Fight Review + check-in nudges (max 3/week). Day-after-fight uses same morning+evening camp slots (t210u/t211u). Never camp weigh-in/diet/shame copy.
// Maintenance / legacy-unknown: fail closed (silent).
const DATE=/^\d{4}-\d{2}-\d{2}$/,TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
export function validDate(v){return typeof v==='string'&&DATE.test(v)&&Number.isFinite(Date.parse(v+'T12:00Z'))&&new Date(v+'T12:00Z').toISOString().slice(0,10)===v;}
export function cleanLifecycle(x){
 if(!x||x.version!==1||!['camp','recovery','maintenance'].includes(x.mode)||!validDate(x.asOf)||typeof x.campOptIn!=='boolean'||typeof x.paused!=='boolean')return null;
 return {
  version:1,mode:x.mode,asOf:x.asOf,campOptIn:x.campOptIn===true,paused:x.paused===true,
  recoveryOptIn:x.recoveryOptIn===true,
  fightDate:validDate(x.fightDate)?x.fightDate:null,
  previousFightDate:validDate(x.previousFightDate)?x.previousFightDate:null,
  recoveryUntil:validDate(x.recoveryUntil)?x.recoveryUntil:null,
  restrictionPause:x.restrictionPause===true,
  snoozeUntil:validDate(x.snoozeUntil)?x.snoozeUntil:null,
  quietStart:TIME.test(x.quietStart)?x.quietStart:null,quietEnd:TIME.test(x.quietEnd)?x.quietEnd:null,
  reviewComplete:x.reviewComplete===true,
  reviewCompletedAt:validDate(x.reviewCompletedAt)?x.reviewCompletedAt:null,
  reviewBoutId:typeof x.reviewBoutId==='string'&&x.reviewBoutId.length&&x.reviewBoutId.length<=80?x.reviewBoutId:null,
  recoveryDay:Number.isInteger(x.recoveryDay)&&x.recoveryDay>=1&&x.recoveryDay<=60?x.recoveryDay:null,
  // fr-v60: Maintenance outline weigh-ins per week (0–7). Only apps that send it get Maintenance weigh-in pushes.
  weighInsPerWeek:Number.isInteger(x.weighInsPerWeek)&&x.weighInsPerWeek>=0&&x.weighInsPerWeek<=7?x.weighInsPerWeek:null
 };
}
export function mergeLifecycle(prev,next){
 if(!next)return prev||null;
 if(!prev)return next;
 const out={...next};
 // Never regress a completed review from a stale/incomplete payload.
 if(prev.reviewComplete&&prev.reviewCompletedAt){
  const sameBout=!next.reviewBoutId||!prev.reviewBoutId||next.reviewBoutId===prev.reviewBoutId;
  const staleAsOf=next.asOf<prev.asOf||(next.reviewCompletedAt&&next.reviewCompletedAt<prev.reviewCompletedAt);
  if(sameBout&&(!next.reviewComplete||staleAsOf)){
   out.reviewComplete=true;out.reviewCompletedAt=prev.reviewCompletedAt;out.reviewBoutId=prev.reviewBoutId||next.reviewBoutId;
  }
 }
 // New bout id may reset completion intentionally from a fresh client payload.
 if(next.reviewBoutId&&prev.reviewBoutId&&next.reviewBoutId!==prev.reviewBoutId){
  out.reviewComplete=next.reviewComplete===true;
  out.reviewCompletedAt=next.reviewCompletedAt||null;
  out.reviewBoutId=next.reviewBoutId;
 }
 return out;
}
function inQuiet(l,minutes){
 if(!l.quietStart||!l.quietEnd)return false;
 const tm=s=>+s.slice(0,2)*60 + +s.slice(3),a=tm(l.quietStart),b=tm(l.quietEnd);
 return a===b||(a<b?minutes>=a&&minutes<b:minutes>=a||minutes<b);
}
export function campNotificationsAllowed(rec,date,minutes){
 const l=cleanLifecycle(rec.lifecycle);
 if(l){
  if(l.asOf>date||!l.campOptIn||l.paused||l.restrictionPause||l.mode!=='camp'||!l.fightDate||date>l.fightDate||l.recoveryUntil&&date<=l.recoveryUntil||l.snoozeUntil&&date<=l.snoozeUntil)return false;
  if(l.previousFightDate&&date>l.previousFightDate&&!l.recoveryUntil)return false;
  if(inQuiet(l,minutes))return false;
  return true;
 }
 if(rec.lifecycle!=null)return false;
 return validDate(rec.fightDate)&&date<=rec.fightDate&&rec.notificationsPaused!==true;
}
function isoWeekKey(date){
 const d=new Date(date+'T12:00:00Z');
 const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day+3);
 const week1=new Date(Date.UTC(d.getUTCFullYear(),0,4));
 const week=1+Math.round((d-week1)/864e5/7);
 return d.getUTCFullYear()+'-W'+String(week).padStart(2,'0');
}
export function recoverySendsThisWeek(rec,date){
 const week=isoWeekKey(date);
 const dates=Array.isArray(rec.recoverySendDates)?rec.recoverySendDates.filter(validDate):[];
 // Also accept last-kind marks for older in-memory test fixtures.
 const sent=rec.sent||{};
 for(const k of ['rec-review','rec-checkin','rec-day1-am','rec-day1-pm']) if(validDate(sent[k])) dates.push(sent[k]);
 return new Set(dates.filter(d=>isoWeekKey(d)===week)).size;
}
export function recoveryNotificationsAllowed(rec,date,minutes){
 const l=cleanLifecycle(rec.lifecycle);
 if(!l||l.mode!=='recovery')return false;
 if(l.asOf>date||!l.recoveryOptIn||l.paused||l.snoozeUntil&&date<=l.snoozeUntil)return false;
 if(l.recoveryUntil&&date>l.recoveryUntil)return false;
 if(inQuiet(l,minutes))return false;
 return true;
}
// Maintenance: weigh-in reminders only, on the outline's weigh-in days, for fighters who turned notifications on.
// Older apps (no weighInsPerWeek in the lifecycle) stay silent in Maintenance, as before.
export function maintenanceWeighAllowed(rec,date,minutes){
 const l=cleanLifecycle(rec.lifecycle);
 if(!l||l.mode!=='maintenance'||l.weighInsPerWeek==null||l.weighInsPerWeek<1)return false;
 if(l.asOf>date||!l.campOptIn||l.paused||l.restrictionPause||l.snoozeUntil&&date<=l.snoozeUntil)return false;
 if(inQuiet(l,minutes))return false;
 return true;
}
export {inQuiet,isoWeekKey};
