"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { reviewedCvPayload, syncRecruitmentCvLanguages } from "./cv-fact-review";
import { uploadedCvPath } from "./cv-document-path";
import type { StructuredCvData } from "./structured-cv";
import type { YouthDocument, YouthProfile } from "./types";
import type { ApplicationDraftSubmissionResult } from "./youth-job-flow";

export class CvWorkflowError extends Error {}
export class CvUploadUnconfirmed extends CvWorkflowError {
  constructor(public readonly document: YouthDocument) { super("Uppladdningen kunde inte bekräftas. Kontrollera filen innan du laddar upp igen."); }
}
export class CvSaveUnconfirmed extends CvWorkflowError {
  constructor() { super("Sparningen kunde inte bekräftas. Kontrollera ditt sparade CV innan du försöker igen."); }
}
async function wait<T>(action: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted(); let cancel = () => {};
  try { return await Promise.race([action(),new Promise<never>((_,reject)=>{cancel=()=>reject(new CvWorkflowError("Tidsgränsen nåddes. Kontrollera resultatet innan du försöker igen."));signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();})]); }
  finally { signal.removeEventListener("abort",cancel); signal.throwIfAborted(); }
}
async function current(ownerId: string, signal: AbortSignal) {
  const result = await wait(()=>getSupabaseClient().auth.getUser(),signal);
  if (result.error || result.data.user?.id !== ownerId || result.data.user.is_anonymous) throw new CvWorkflowError("Kontot har ändrats. Öppna CV-sidan för rätt konto igen.");
}
async function bind(ownerId: string, signal: AbortSignal) {
  await current(ownerId,signal);
  const snapshot = await wait(()=>getSupabaseClient().auth.getSession(),signal), token=snapshot.data.session?.access_token;
  if (snapshot.error || !token || snapshot.data.session?.user.id !== ownerId) throw new CvWorkflowError("Din session kunde inte verifieras. Logga in igen.");
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:`mnw-cv-${crypto.randomUUID()}`},
    global:{headers:{Authorization:`Bearer ${token}`},fetch:(url,init)=>fetch(url,{...init,signal:init?.signal?AbortSignal.any([signal,init.signal]):signal}).catch(()=>{throw new CvWorkflowError("CV-anropet kunde inte genomföras.");})},
  });
  const identity=await wait(()=>client.auth.getUser(token),signal);
  if(identity.error||identity.data.user?.id!==ownerId)throw new CvWorkflowError("Din session kunde inte verifieras.");
  const profile=await wait(()=>client.from("profiles").select("role").eq("id",ownerId).abortSignal(signal).single(),signal);
  if(profile.error||profile.data?.role!=="youth")throw new CvWorkflowError("CV-funktionen är endast tillgänglig för ditt ungdomskonto.");
  return {client,token};
}
export async function ownedCvHeaders(ownerId:string,signal:AbortSignal){
  const active=AbortSignal.any([signal,AbortSignal.timeout(15_000)]),{token}=await bind(ownerId,active);await current(ownerId,active);return {Authorization:`Bearer ${token}`};
}
async function profile(client:SupabaseClient,ownerId:string,signal:AbortSignal):Promise<YouthProfile>{
  const result=await wait(()=>client.from("youth_profiles").select("*").eq("user_id",ownerId).abortSignal(signal).single(),signal);
  if(result.error||result.data?.user_id!==ownerId)throw new CvWorkflowError("Din CV-profil kunde inte läsas. Försök igen.");
  return result.data as YouthProfile;
}
function documentPath(ownerId:string,document:YouthDocument){
  if(document.type!=="cv"||uploadedCvPath([document],ownerId)!==document.url||/[?#%\x00-\x1f]/.test(document.url))throw new CvWorkflowError("PDF-filen saknar en giltig privat filreferens för ditt konto.");
  return document.url;
}
async function verifyFile(client:SupabaseClient,document:YouthDocument,ownerId:string,signal:AbortSignal){
  const path=documentPath(ownerId,document),result=await wait(()=>client.storage.from("youth-documents").info(path),signal);
  if(result.error||!result.data||result.data.contentType!=="application/pdf"||typeof result.data.size!=="number"||!Number.isSafeInteger(result.data.size)||result.data.size<5||result.data.size>5*1024*1024)throw new CvWorkflowError("PDF-filen kunde inte verifieras. Kontrollera uppladdningen eller välj filen igen.");
}
export async function verifyOwnedCvUpload(ownerId:string,document:YouthDocument,signal:AbortSignal){
  const active=AbortSignal.any([signal,AbortSignal.timeout(15_000)]),{client}=await bind(ownerId,active);
  await verifyFile(client,document,ownerId,active);await current(ownerId,active);
}
export async function uploadOwnedCvPdf(ownerId:string,file:File,signal:AbortSignal):Promise<YouthDocument>{
  const active=AbortSignal.any([signal,AbortSignal.timeout(30_000)]);
  if(!file.size||file.size>5*1024*1024||!file.name.toLowerCase().endsWith(".pdf")||(file.type&&file.type!=="application/pdf"))throw new CvWorkflowError("Välj en PDF-fil på högst 5 MB.");
  const signature=await wait(()=>file.slice(0,5).text(),active);
  if(signature!=="%PDF-")throw new CvWorkflowError("Filen verkar inte vara en PDF. Välj originalfilen i PDF-format.");
  const pdf=file.type==="application/pdf"?file:new File([file],file.name,{type:"application/pdf",lastModified:file.lastModified});
  const {client}=await bind(ownerId,active),path=`${ownerId}/${crypto.randomUUID()}.pdf`,document:YouthDocument={name:file.name,url:path,type:"cv"};
  await current(ownerId,active);
  try{
    const result=await wait(()=>client.storage.from("youth-documents").upload(path,pdf,{contentType:"application/pdf",cacheControl:"3600",upsert:false}),active);
    if(result.error||result.data?.path!==path)throw new CvUploadUnconfirmed(document);
    await verifyFile(client,document,ownerId,active);await current(ownerId,active);
    return document;
  }catch{throw new CvUploadUnconfirmed(document);}
}
function canonical(value:unknown):string{
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value)??"null";
}
export type CvSaveInput={kind:"reviewed";text:string;structured:StructuredCvData;approval:string|null}|{kind:"uploaded";document:YouthDocument};
/** One save attempt, then read-only recovery. No implicit resave, file deletion or AI. */
export function createCvSave(ownerId:string,input:CvSaveInput){
  const snapshot=structuredClone(input),reviewed=snapshot.kind==="reviewed"?reviewedCvPayload(snapshot.text,snapshot.structured,snapshot.approval):null;
  if(snapshot.kind==="uploaded")documentPath(ownerId,snapshot.document);
  let expected:Record<string,unknown>|null=null,attempted=false,draftsAttempted=false,confirmed=false;
  return {
    async save(signal:AbortSignal){
      if(attempted)throw new CvSaveUnconfirmed();
      const active=AbortSignal.any([signal,AbortSignal.timeout(20_000)]),{client}=await bind(ownerId,active),before=await profile(client,ownerId,active);
      if(snapshot.kind==="reviewed"&&reviewed){
        for(const key of Object.keys(reviewed))if(!(key in before))throw new CvWorkflowError("Profilen saknar stöd för samordnade CV-fakta. Din text finns kvar.");
        expected={...reviewed,documents:(before.documents??[]).filter(d=>d.type!=="generated_cv"),...("recruitment_profile" in before?{recruitment_profile:syncRecruitmentCvLanguages(before.recruitment_profile,before.cv_structured,snapshot.structured)}:{})};
      }else if(snapshot.kind==="uploaded"){
        await verifyFile(client,snapshot.document,ownerId,active);
        expected={documents:[...(before.documents??[]).filter(d=>d.type!=="cv"),snapshot.document],cv_uploaded:true,onboarding_completed:true,cv_generated:false};
      }
      if(!expected)throw new CvWorkflowError("CV:t kunde inte förberedas för sparning.");
      await current(ownerId,active);active.throwIfAborted();attempted=true;
      try{
        const result=await wait(()=>client.from("youth_profiles").update(expected!).eq("user_id",ownerId).select("*").abortSignal(active).single(),active);
        if(result.error||result.data?.user_id!==ownerId)throw new CvSaveUnconfirmed();
      }catch{throw new CvSaveUnconfirmed();}
    },
    async read(signal:AbortSignal){
      if(!attempted||!expected)throw new CvWorkflowError("Ingen påbörjad sparning finns att kontrollera.");
      const active=AbortSignal.any([signal,AbortSignal.timeout(15_000)]),{client}=await bind(ownerId,active),value=await profile(client,ownerId,active);
      await current(ownerId,active);
      confirmed=Object.entries(expected).every(([key,wanted])=>key in value&&canonical(value[key])===canonical(wanted));
      return {profile:value,confirmed};
    },
    async submitDrafts(signal:AbortSignal):Promise<ApplicationDraftSubmissionResult>{
      if(!confirmed||!attempted)throw new CvWorkflowError("Kontrollera det sparade CV:t först.");
      if(draftsAttempted)throw new CvWorkflowError("Kontrollera dina ansökningar för aktuell status.");
      const active=AbortSignal.any([signal,AbortSignal.timeout(15_000)]),{token}=await bind(ownerId,active);
      await current(ownerId,active);active.throwIfAborted();draftsAttempted=true;
      const response=await wait(()=>fetch("/api/youth/applications/submit",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"drafts"}),signal:active}),active);
      const data=await wait(()=>response.json(),active),result=Array.isArray(data.application)?data.application[0]:data.application;
      if(!response.ok||![result?.sent_count,result?.unavailable_count,result?.pending_count].every(v=>Number.isSafeInteger(v)&&v>=0))throw new CvWorkflowError("CV:t är sparat. Kontrollera dina ansökningar för aktuell status.");
      await current(ownerId,active);
      return {sent:result.sent_count,unavailable:result.unavailable_count,pending:result.pending_count};
    },
  };
}
