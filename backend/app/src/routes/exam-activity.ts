import {Elysia,t} from "elysia";
import {currentUser} from "../auth";
import {fail} from "../features/common";
import {openActivity,recordActivity} from "../features/exam-activity";
const id=t.String({format:"uuid"}),ms=t.Integer({minimum:0,maximum:86400000});
export const examActivityRoutes=new Elysia()
 .post("/attempts/:id/activity/streams",async({headers,params,body})=>{
  const user=await currentUser(headers);if(!user)fail("กรุณาเข้าสู่ระบบ",401);
  return openActivity(user!.id,params.id,body.clientId);
 },{params:t.Object({id}),body:t.Object({clientId:id})})
 .put("/attempts/:id/activity/:streamId",async({headers,params,body})=>{
  const user=await currentUser(headers);if(!user)fail("กรุณาเข้าสู่ระบบ",401);
  return recordActivity(user!.id,params.id,params.streamId,body);
 },{params:t.Object({id,streamId:id}),body:t.Object({sequence:t.Integer({minimum:1,maximum:10000}),elapsedMs:ms,activeMs:ms,offlineMs:ms})});
