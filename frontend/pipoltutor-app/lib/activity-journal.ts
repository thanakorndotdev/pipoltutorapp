/** Monotonic counters. Large timer gaps are unobserved, never counted as work. */
export type ActivityCounters={elapsedMs:number;activeMs:number;offlineMs:number};
export class ActivityClock {
  private last:number;
  private visible:boolean;
  private disconnected:boolean;
  readonly counters:ActivityCounters={elapsedMs:0,activeMs:0,offlineMs:0};
  constructor(now:number,visible:boolean,offline:boolean){this.last=now;this.visible=visible;this.disconnected=offline;}
  sample(now:number,visible=this.visible,offline=this.disconnected){
    const delta=Math.max(0,Math.round(now-this.last));
    this.counters.elapsedMs+=delta;
    if(this.visible&&delta<=5000){this.counters.activeMs+=delta;if(this.disconnected)this.counters.offlineMs+=delta;}
    this.last=Math.max(this.last,now);this.visible=visible;this.disconnected=offline;
    return {...this.counters};
  }
}
export type PendingActivity={attemptId:string;streamId:string;sequence:number;latest?:ActivityCounters}&ActivityCounters;
const prefix="pipol.exam-activity.v1.";
const validCounters=(r:ActivityCounters)=>r&&Number.isInteger(r.elapsedMs)&&r.elapsedMs>=0&&r.elapsedMs<=86400000&&Number.isInteger(r.activeMs)&&r.activeMs>=0&&r.activeMs<=r.elapsedMs&&Number.isInteger(r.offlineMs)&&r.offlineMs>=0&&r.offlineMs<=r.activeMs;
/** Small outbox contains durations only, never questions, answers or identity. */
export function storeActivity(report:PendingActivity,latest?:ActivityCounters){try{localStorage.setItem(prefix+report.streamId,JSON.stringify({...report,...(latest?{latest}:{} )}));}catch{/* Server counters still work if storage is unavailable. */}}
export function clearActivity(streamId:string){try{localStorage.removeItem(prefix+streamId);}catch{}}
export function pendingActivities(attemptId:string):PendingActivity[]{
  try{return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>{try{return JSON.parse(localStorage.getItem(k)??"null") as PendingActivity|null;}catch{return null;}}).filter((r):r is PendingActivity=>Boolean(r&&r.attemptId===attemptId&&typeof r.streamId==="string"&&Number.isInteger(r.sequence)&&r.sequence>0&&validCounters(r))).slice(0,16);}catch{return [];}
}
/** Read the durable latest sample AFTER the request is acknowledged: sampling
 * can advance while fetch is in flight. Persist its successor before retiring
 * the old checkpoint, so a reload cannot lose the offline tail. */
export function acknowledgeActivity(report:PendingActivity):PendingActivity|null{
  const saved=pendingActivities(report.attemptId).find(r=>r.streamId===report.streamId);
  // Another tab may already have advanced this same outbox.
  if(saved&&saved.sequence>report.sequence)return saved;
  const latest=saved?.latest??report.latest;
  if(latest&&validCounters(latest)&&latest.elapsedMs>report.elapsedMs&&latest.activeMs>=report.activeMs&&latest.offlineMs>=report.offlineMs&&latest.activeMs-report.activeMs<=latest.elapsedMs-report.elapsedMs&&latest.offlineMs-report.offlineMs<=latest.activeMs-report.activeMs){
    const next={attemptId:report.attemptId,streamId:report.streamId,sequence:report.sequence+1,...latest};
    storeActivity(next);return next;
  }
  clearActivity(report.streamId);return null;
}
export async function sendActivity(report:PendingActivity){
  const {attemptId,streamId,sequence,elapsedMs,activeMs,offlineMs}=report;
  const response=await fetch(`/api/attempts/${attemptId}/activity/${streamId}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({sequence,elapsedMs,activeMs,offlineMs}),keepalive:true,signal:AbortSignal.timeout(5000)});
  if(response.ok)return true;
  // Authentication loss can be temporary. Keep the outbox for the next login.
  if([404,409,422].includes(response.status)){clearActivity(streamId);return false;}
  throw new Error("Activity sync unavailable");
}
const replays=new Map<string,Promise<boolean>>();
/** Also called on the result page, where an expired attempt cannot open a new
 * stream but can still deliver observed pre-submit evidence for review. */
export function replayActivities(attemptId:string):Promise<boolean>{
  const running=replays.get(attemptId);if(running)return running;
  const task=(async()=>{
    let changed=false;
    for(const saved of pendingActivities(attemptId)){
      let report:PendingActivity|null=saved;
      try{for(let i=0;report&&i<2;i++){
        if(!await sendActivity(report))break;
        changed=true;
        report=acknowledgeActivity(report);
      }}catch{/* Retry the unchanged checkpoint after reconnection. */}
    }
    return changed;
  })();
  replays.set(attemptId,task);
  void task.finally(()=>{if(replays.get(attemptId)===task)replays.delete(attemptId);});
  return task;
}
