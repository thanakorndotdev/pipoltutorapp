import {and,asc,eq} from "drizzle-orm";
import {db} from "../db";
import {attempts} from "../db/schema";
import {attemptActivityStreams} from "../db/features";
import {fail,hash,type Tx} from "./common";
import {refreshRanking} from "./ranking";
export type ActivityReport={sequence:number;elapsedMs:number;activeMs:number;offlineMs:number};
const reportOf=(r:ActivityReport)=>({sequence:r.sequence,elapsedMs:r.elapsedMs,activeMs:r.activeMs,offlineMs:r.offlineMs});
/** Submission may finish before the exam deadline. Neither late evidence nor
 * manual review can extend the server's recorded working window. */
export const activityEnd=(a:{expiresAt:Date;submittedAt:Date|null},now=new Date())=>
 Math.min(now.getTime(),a.expiresAt.getTime(),a.submittedAt?.getTime()??Infinity);
export async function openActivity(userId:string,attemptId:string,clientId:string,now=new Date()) {
 return db.transaction(async tx=>{
  const [a]=await tx.select().from(attempts).where(and(eq(attempts.id,attemptId),eq(attempts.userId,userId))).for("update");
  if(!a)fail("ไม่พบการสอบ",404);
  const [existing]=await tx.select().from(attemptActivityStreams).where(and(eq(attemptActivityStreams.attemptId,attemptId),eq(attemptActivityStreams.clientId,clientId)));
  if(existing)return {stream:existing};
  if(a!.status!=="in_progress"||a!.expiresAt<=now)fail("การสอบสิ้นสุดแล้ว",409);
  const streams=await tx.select({id:attemptActivityStreams.id}).from(attemptActivityStreams).where(eq(attemptActivityStreams.attemptId,attemptId));
  if(streams.length>=16)fail("มีบันทึกเวลาหลายแท็บ กรุณาใช้แท็บสอบเดิม",429);
  const [stream]=await tx.insert(attemptActivityStreams).values({attemptId,clientId,startedAt:now,updatedAt:now}).returning();
  if(streams.length)await tx.update(attempts).set({activeVerified:false}).where(eq(attempts.id,attemptId));
  return {stream:stream!};
 });
}
export async function recordActivity(userId:string,attemptId:string,streamId:string,body:ActivityReport,now=new Date()) {
 const result=await db.transaction(async tx=>{
  const [a]=await tx.select().from(attempts).where(and(eq(attempts.id,attemptId),eq(attempts.userId,userId))).for("update");
  if(!a)fail("ไม่พบการสอบ",404);
  const [s]=await tx.select().from(attemptActivityStreams).where(and(eq(attemptActivityStreams.id,streamId),eq(attemptActivityStreams.attemptId,attemptId))).for("update");
  if(!s)fail("ไม่พบบันทึกเวลา",404);
  if(body.sequence===s!.sequence){if(hash(reportOf(s!))!==hash(body))fail("คำขอเดิมมีข้อมูลต่างกัน",409);return {duplicate:true,sequence:s!.sequence,packId:a!.packId,refresh:false};}
  if(a!.activeReviewedAt)fail("เวลานี้ตรวจรับแล้ว ไม่รับการเปลี่ยนหลักฐานย้อนหลัง",409);
  const available=Math.max(0,activityEnd(a!,now)-s!.startedAt.getTime());
  if(now.getTime()>activityEnd(a!,now)+86400000)fail("พ้นระยะส่งบันทึกเวลาสำหรับตรวจรับ",409);
  const elapsed=body.elapsedMs-s!.elapsedMs, active=body.activeMs-s!.activeMs, offline=body.offlineMs-s!.offlineMs;
  if(body.sequence!==s!.sequence+1)fail("ลำดับบันทึกเปลี่ยนแล้ว กรุณาส่งคำขอเดิมก่อน",409);
  if(elapsed<0||active<0||offline<0||active>elapsed||offline>active||body.elapsedMs>available+1000)
    fail("เวลาที่รายงานเกินขอบเขตที่เซิร์ฟเวอร์ตรวจรับได้");
  const point={...body,receivedAt:now.toISOString()};
  await tx.update(attemptActivityStreams).set({...body,updatedAt:now,checkpoints:[...s!.checkpoints,point].slice(-512)}).where(eq(attemptActivityStreams.id,streamId));
  // Offline/multiple-tab evidence requires a human decision. Never add the
  // browser's claimed duration to the trusted ranking field automatically.
  const streams=await tx.select({id:attemptActivityStreams.id}).from(attemptActivityStreams).where(eq(attemptActivityStreams.attemptId,attemptId));
  const unverified=body.offlineMs>0||streams.length>1;
  if(unverified)await tx.update(attempts).set({activeVerified:false}).where(eq(attempts.id,attemptId));
  return {sequence:body.sequence,duplicate:false,packId:a!.packId,refresh:unverified&&a!.activeVerified&&a!.status!=="in_progress"};
 });
 if(result.refresh)await refreshRanking(result.packId);
 return {sequence:result.sequence,duplicate:result.duplicate,requiresReview:true};
}
export async function activityEvidence(tx:Tx,packId:string,attemptId:string) {
 const [a]=await tx.select().from(attempts).where(and(eq(attempts.id,attemptId),eq(attempts.packId,packId)));
 if(!a)fail("ไม่พบการสอบ",404);
 const streams=await tx.select().from(attemptActivityStreams).where(eq(attemptActivityStreams.attemptId,attemptId)).orderBy(asc(attemptActivityStreams.startedAt),asc(attemptActivityStreams.id));
 const attempt={id:a!.id,status:a!.status,activeSeconds:a!.activeSeconds,activeRemainderMs:a!.activeRemainderMs,activeVerified:a!.activeVerified,activeCheckpointAt:a!.activeCheckpointAt,activeReviewedAt:a!.activeReviewedAt,startedAt:a!.startedAt,expiresAt:a!.expiresAt,submittedAt:a!.submittedAt,resetAt:a!.resetAt};
 return {attempt,streams,maxActiveSeconds:Math.max(0,Math.floor((activityEnd(a!)-a!.startedAt.getTime())/1000)),multipleStreams:streams.length>1,version:hash({attempt,streams}),note:"เวลาที่เบราว์เซอร์รายงานเป็นหลักฐานประกอบ ต้องทบทวนก่อนรับรอง ไม่รวมเวลาของหลายแท็บเข้าด้วยกันอัตโนมัติ"};
}
