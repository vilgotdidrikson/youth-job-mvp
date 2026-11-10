"use client";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseClient} from "@/lib/supabase";
import {parseAccountCvDraft,cvDraftFingerprint,type AccountCvDraftRow,type AccountCvDraft} from "./account-cv-draft";
export class AccountCvDraftError extends Error {constructor(message:string,public readonly kind:"read"|"conflict"|"uncertain"="read"){super(message);}}
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
async function wait<T>(fn:()=>PromiseLike<T>,signal:AbortSignal){signal.throwIfAborted();let cancel=()=>{};try{return await Promise.race([fn(),new Promise<never>((_,reject)=>{cancel=()=>reject(new AccountCvDraftError("Tidsgränsen nåddes. Försök kontrollera sparningen igen."));signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();})]);}finally{signal.removeEventListener("abort",cancel);signal.throwIfAborted();}}
async function current(ownerId:string,signal:AbortSignal){const result=await wait(()=>getSupabaseClient().auth.getUser(),signal);if(result.error||result.data.user?.id!==ownerId||result.data.user.is_anonymous)throw new AccountCvDraftError("Kontot har ändrats. Öppna CV-sidan för rätt konto igen.");}
async function bind(ownerId:string,signal:AbortSignal){
 await current(ownerId,signal);const result=await wait(()=>getSupabaseClient().auth.getSession(),signal),session=result.data.session;
 if(result.error||session?.user.id!==ownerId||!session.access_token)throw new AccountCvDraftError("Din session kunde inte verifieras.");
 const token=session.access_token,client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:`mnw-cv-draft-${crypto.randomUUID()}`},global:{headers:{Authorization:`Bearer ${token}`}}});
 const identity=await wait(()=>client.auth.getUser(token),signal);if(identity.error||identity.data.user?.id!==ownerId)throw new AccountCvDraftError("Din session kunde inte verifieras.");return client;
}
function row(value:unknown,ownerId:string):AccountCvDraftRow{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new AccountCvDraftError("Det sparade utkastet kunde inte verifieras.");
 const r=value as Record<string,unknown>;
 if(r.user_id!==ownerId||!uuid(r.revision)||typeof r.updated_at!=="string"||!Number.isFinite(Date.parse(r.updated_at)))throw new AccountCvDraftError("Det sparade utkastet kunde inte verifieras.");
 try{return{userId:ownerId,revision:r.revision,updatedAt:r.updated_at,content:r.content===null?null:parseAccountCvDraft(r.content)};}
 catch{return{userId:ownerId,revision:r.revision,updatedAt:r.updated_at,content:null,invalid:true};}
}
export async function loadAccountCvDraft(ownerId:string,signal:AbortSignal):Promise<AccountCvDraftRow>{
 const active=AbortSignal.any([signal,AbortSignal.timeout(15_000)]),client=await bind(ownerId,active);
 const result=await wait(()=>client.from("youth_cv_drafts").select("user_id,revision,content,updated_at").eq("user_id",ownerId).abortSignal(active).maybeSingle(),active);
 if(result.error)throw new AccountCvDraftError("Utkastet på kontot kunde inte hämtas. Ditt lokala arbete finns kvar.");await current(ownerId,active);
 return result.data===null?{userId:ownerId,revision:null,content:null,updatedAt:null}:row(result.data,ownerId);
}
export async function saveAccountCvDraft(ownerId:string,revision:string|null,content:AccountCvDraft|null,signal:AbortSignal):Promise<AccountCvDraftRow>{
 if(revision!==null&&!uuid(revision))throw new AccountCvDraftError("Läs in aktuell utkastversion innan du sparar.");
 const snapshot=content===null?null:parseAccountCvDraft(content),active=AbortSignal.any([signal,AbortSignal.timeout(20_000)]),client=await bind(ownerId,active);await current(ownerId,active);active.throwIfAborted();
 let result;
 try{result=await wait(()=>client.rpc("save_my_cv_draft",{p_expected_revision:revision,p_content:snapshot}).abortSignal(active),active);}catch{throw new AccountCvDraftError("Sparningen kunde inte bekräftas. Kontrollera sparningen innan du försöker igen.","uncertain");}
 if(result.error){if(result.error.code==="PT409")throw new AccountCvDraftError("Utkastet har ändrats på en annan enhet. Läs in aktuell version innan du väljer att spara igen.","conflict");throw new AccountCvDraftError("Sparningen kunde inte bekräftas. Kontrollera sparningen innan du försöker igen.","uncertain");}
 if(!Array.isArray(result.data)||result.data.length!==1)throw new AccountCvDraftError("Sparningen kunde inte bekräftas. Kontrollera sparningen innan du försöker igen.","uncertain");
 const saved=row(result.data[0],ownerId);if(saved.invalid||saved.revision===revision||cvDraftFingerprint(saved.content)!==cvDraftFingerprint(snapshot))throw new AccountCvDraftError("Sparningen kunde inte bekräftas. Kontrollera sparningen innan du försöker igen.","uncertain");
 await current(ownerId,active);return saved;
}
