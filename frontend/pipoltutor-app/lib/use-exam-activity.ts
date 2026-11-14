"use client";
import {useCallback,useEffect,useRef} from "react";
import {ActivityClock,acknowledgeActivity,replayActivities,sendActivity,storeActivity,type PendingActivity} from "./activity-journal";
/** Persistence never controls the exam deadline or answer eligibility. */
export function useExamActivity(attemptId:string,enabled:boolean){
 const flushRef=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  if(!attemptId||!enabled)return;
  let disposed=false,streamId="",sequence=0,offline=!navigator.onLine;
  let clock:ActivityClock|null=null,pending:PendingActivity|null=null;
  let inFlight:Promise<void>|null=null;
  const clientId=crypto.randomUUID();
  const sample=()=>clock?.sample(performance.now(),!document.hidden,offline);
  async function flush(){
   sample();
   if(!clock||!streamId)return;
   if(inFlight)return inFlight;
   if(!pending){pending={attemptId,streamId,sequence:sequence+1,...clock.counters};storeActivity(pending);}
   if(!navigator.onLine)return;
   const report=pending;
   const task=(async()=>{try{
    const accepted=await sendActivity(report);
    if(accepted){sequence=report.sequence;pending=acknowledgeActivity(report);}
    else {pending=null;streamId="";}
    sample();offline=false;sample();
   }catch{sample();offline=true;sample();}})();
   inFlight=task;try{await task;}finally{if(inFlight===task)inFlight=null;}
  }
  flushRef.current=flush;
  void(async()=>{
   // Finish outboxes from a prior reload before opening this page's stream.
   await replayActivities(attemptId);
   if(disposed)return;
   try{
    const response=await fetch(`/api/attempts/${attemptId}/activity/streams`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId}),signal:AbortSignal.timeout(5000)});
    if(!response.ok)return;
    const data=await response.json() as {stream:{id:string}};
    if(disposed)return;
    streamId=data.stream.id;clock=new ActivityClock(performance.now(),!document.hidden,offline);
   }catch{/* A missing server anchor cannot establish an offline interval. */}
  })();
  const tick=()=>{sample();if(clock&&streamId){const report=pending??{attemptId,streamId,sequence:sequence+1,...clock.counters};storeActivity(report,clock.counters);}};
  const visibility=()=>{sample();void flush();};
  const connection=()=>{sample();offline=!navigator.onLine;sample();if(!offline)void flush();};
  const unload=()=>{sample();tick();void flush();};
  const sampling=setInterval(tick,1000),syncing=setInterval(()=>void flush(),10000);
  document.addEventListener("visibilitychange",visibility);window.addEventListener("online",connection);window.addEventListener("offline",connection);window.addEventListener("pagehide",unload);
  return()=>{disposed=true;sample();tick();void flush();clearInterval(sampling);clearInterval(syncing);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("online",connection);window.removeEventListener("offline",connection);window.removeEventListener("pagehide",unload);flushRef.current=async()=>{};};
 },[attemptId,enabled]);
 return useCallback(()=>flushRef.current(),[]);
}
