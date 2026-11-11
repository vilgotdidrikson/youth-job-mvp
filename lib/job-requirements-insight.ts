"use client";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseClient} from "@/lib/supabase";
import {parseJobInsight,JobInsightError,type PublicJobInformationData} from "./job-requirements-information";
const uuid=(v:string)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
async function wait<T>(fn:()=>PromiseLike<T>,signal:AbortSignal):Promise<T>{
 signal.throwIfAborted();let abort=()=>{};
 try{return await Promise.race([fn(),new Promise<never>((_,reject)=>{abort=()=>reject(new JobInsightError());signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();})]);}
 finally{signal.removeEventListener("abort",abort);signal.throwIfAborted();}
}
export async function loadJobInsight(ownerId:string,jobId:string,signal:AbortSignal):Promise<PublicJobInformationData>{
 if(!uuid(ownerId)||!uuid(jobId))throw new JobInsightError();
 const active=AbortSignal.any([signal,AbortSignal.timeout(15_000)]),shared=getSupabaseClient();
 const verify=async()=>{const r=await wait(()=>shared.auth.getUser(),active);if(r.error||r.data.user?.id!==ownerId||r.data.user.is_anonymous)throw new JobInsightError();};
 try{
  await verify();const session=await wait(()=>shared.auth.getSession(),active),s=session.data.session;
  if(session.error||s?.user.id!==ownerId||!s.access_token)throw new JobInsightError();
  const token=s.access_token,client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:`mnw-insight-${crypto.randomUUID()}`},global:{headers:{Authorization:`Bearer ${token}`}}});
  const identity=await wait(()=>client.auth.getUser(token),active);if(identity.error||identity.data.user?.id!==ownerId)throw new JobInsightError();
  await verify();
  const result=await wait(()=>client.rpc("get_job_requirement_insight",{p_job_id:jobId}).abortSignal(active),active);
  if(result.error)throw new JobInsightError();const value=parseJobInsight(result.data,jobId);await verify();return value;
 }catch{throw new JobInsightError();}
}
