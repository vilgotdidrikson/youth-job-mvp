"use client";
import { getSupabaseClient } from "./supabase";
import { parsePrivacyCase, parsePrivacyCasePage, parsePrivacyCaseHistory, matchesCaseQueue, type CaseQueueFilter, type CaseAction, type CaseCursor, type PrivacyCaseKind, type PrivacyCase } from "./privacy-cases";
export class PrivacyCaseRequestError extends Error {
  constructor(message: string, public readonly uncertain = false, public readonly status?: number) { super(message); }
}
async function wait<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted(); let cancel = () => {};
  try { return await Promise.race([promise,new Promise<never>((_,reject)=>{cancel=()=>reject(new PrivacyCaseRequestError("Sessionen kunde inte kontrolleras. Försök läsa igen."));signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();})]); }
  finally {signal.removeEventListener("abort",cancel);signal.throwIfAborted();}
}
async function own(owner: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const { data, error } = await wait(getSupabaseClient().auth.getUser(),signal);
  signal.throwIfAborted();
  if (error || data.user?.id !== owner || data.user.is_anonymous) throw new PrivacyCaseRequestError("Kontot har ändrats. Öppna sidan för rätt konto igen.");
}
async function request(owner: string, payload: object, signal: AbortSignal, admin: boolean, writes: boolean) {
  const active = AbortSignal.any([signal, AbortSignal.timeout(admin ? 55000 : 25000)]);
  await own(owner, active);
  const { data, error } = await wait(getSupabaseClient().auth.getSession(),active);
  if (error || data.session?.user.id !== owner || !data.session.access_token) throw new PrivacyCaseRequestError("Logga in igen.");
  await own(owner, active); active.throwIfAborted();
  try {
    const r = await fetch(admin ? "/api/admin/privacy-cases" : "/api/account/privacy-cases", { method: "POST", cache: "no-store", signal: active, headers: { "Authorization": `Bearer ${data.session.access_token}`, "X-Account-Id": owner, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) throw new PrivacyCaseRequestError(r.status === 404 ? "Ärendet kunde inte hittas eller är inte tillgängligt för det här kontot." : r.status === 403 ? "Åtgärden nekades. Kontrollera behörighet och tvåfaktorskod." : r.status === 409 ? "Ärendet har ändrats. Läs aktuell status innan du fortsätter." : r.status === 429 ? "För många försök. Försök igen senare." : r.status === 503 ? "Ärendetjänsten är inte tillgänglig. Använd kontaktvägen på hjälpsidan." : "Begäran kunde inte slutföras.", writes && (r.status >= 500 || r.status===408 || r.headers.get("X-Privacy-Case-Write")==="uncertain" || r.status===400&&r.headers.get("X-Privacy-Case-Write")!=="rejected"), r.status);
    const value: unknown = await r.json(); await own(owner, active); return value;
  } catch (e) {
    if (e instanceof PrivacyCaseRequestError) {if(writes&&e.status===undefined)throw new PrivacyCaseRequestError(e.message,true);throw e;}
    throw new PrivacyCaseRequestError(writes ? "Resultatet är okänt. Läs dina ärenden innan du försöker igen." : "Ärenden kunde inte läsas. Försök igen.", writes);
  }
}
export async function readOwnPrivacyCases(owner: string, cursor: CaseCursor | null, signal: AbortSignal) {
  return parsePrivacyCasePage(await request(owner, { action: "list", cursor }, signal, false, false), owner);
}
export async function findOwnPrivacyCase(owner:string,id:string,signal:AbortSignal) {
  return readReceipt(await request(owner,{action:"find",id},signal,false,false),id,owner);
}
function readReceipt(value:unknown,id:string,owner?:string) {
  const item=parsePrivacyCase(value,owner);if(item.id!==id.toLowerCase())throw Error("Ärendet kunde inte verifieras. Läs igen.");return item;
}
export async function createOwnPrivacyCase(owner: string, id: string, kind: PrivacyCaseKind, body: string, signal: AbortSignal) {
  try { const result = parsePrivacyCase(await request(owner, { action: "create", id, kind, body }, signal, false, true), owner); if (result.id !== id || result.kind !== kind || result.body !== body.trim()) throw Error("Receipt mismatch"); return result; }
  catch(e) { if(e instanceof PrivacyCaseRequestError) throw e; throw new PrivacyCaseRequestError("Sparningen kunde inte bekräftas. Läs dina ärenden innan du fortsätter.", true); }
}
export async function adminPrivacyCases(owner: string, input: { action: "list"; cursor: CaseCursor | null; filter?:CaseQueueFilter } | {action:"find";id:string} | { action: CaseAction; id: string; revision: string; eventId: string; message: string; reviewAfter?:string }, password: string, totpCode: string, signal: AbortSignal) {
  const value = await request(owner, { ...input, password, totpCode }, signal, true, input.action !== "list"&&input.action!=="find");
  if(input.action === "list"){const page=parsePrivacyCasePage(value);if(page.cases.some(c=>!matchesCaseQueue(c,input.filter??"all",page.as_of?Date.parse(page.as_of):Date.now())))throw Error("Kön kunde inte verifieras. Läs den igen.");return page;}
  if(input.action === "find")return readReceipt(value,input.id);
  return actionReceipt(value,input.id,input.eventId,input.action,input.message,undefined,input.reviewAfter);
}
export async function replyToOwnPrivacyCase(owner: string, item: PrivacyCase, message: string, eventId: string, signal: AbortSignal) {
  const value=await request(owner, { action: "reply", id: item.id, revision: item.revision, eventId, message }, signal, false, true);
  return actionReceipt(value,item.id,eventId,"user_reply",message,owner);
}
function actionReceipt(value:unknown,id:string,eventId:string,action:string,message:string,owner?:string,reviewAfter?:string) {
  try {
    const result=parsePrivacyCase(value,owner);
    if(result.id!==id||!result.events.some(e=>e.id===eventId&&e.action===action&&e.public_message===(message.trim()||null)&&(reviewAfter===undefined||e.review_after!=null&&Date.parse(e.review_after)===Date.parse(reviewAfter))))throw Error("Receipt mismatch");
    if(reviewAfter!==undefined&&(!result.review_after||Date.parse(result.review_after)!==Date.parse(reviewAfter)))throw Error("Review receipt mismatch");
    return result;
  }catch{throw new PrivacyCaseRequestError("Sparningen kunde inte bekräftas. Läs aktuell ärendestatus innan du fortsätter.",true);}
}
export async function readPrivacyCaseHistory(owner: string, item: PrivacyCase, cursor: CaseCursor, signal: AbortSignal, credentials?: { password: string; totpCode: string }) {
  const input = { action: "history", id: item.id, revision: item.revision, cursor, ...credentials };
  return parsePrivacyCaseHistory(await request(owner, input, signal, !!credentials, false), item, cursor, credentials?undefined:owner);
}
