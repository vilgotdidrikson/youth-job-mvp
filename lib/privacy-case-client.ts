"use client";
import { getSupabaseClient } from "./supabase";
import { parsePrivacyCase, parsePrivacyCasePage, parsePrivacyCaseHistory, type CaseAction, type CaseCursor, type PrivacyCaseKind, type PrivacyCase } from "./privacy-cases";
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
    if (!r.ok) throw new PrivacyCaseRequestError(r.status === 403 ? "Åtgärden nekades. Kontrollera behörighet och tvåfaktorskod." : r.status === 409 ? "Ärendet har ändrats. Läs aktuell status innan du fortsätter." : r.status === 429 ? "För många försök. Försök igen senare." : r.status === 503 ? "Ärendetjänsten är inte tillgänglig. Använd kontaktvägen på hjälpsidan." : "Begäran kunde inte slutföras.", writes && r.status >= 500, r.status);
    const value: unknown = await r.json(); await own(owner, active); return value;
  } catch (e) {
    if (e instanceof PrivacyCaseRequestError) throw e;
    throw new PrivacyCaseRequestError(writes ? "Resultatet är okänt. Läs dina ärenden innan du försöker igen." : "Ärenden kunde inte läsas. Försök igen.", writes);
  }
}
export async function readOwnPrivacyCases(owner: string, cursor: CaseCursor | null, signal: AbortSignal) {
  return parsePrivacyCasePage(await request(owner, { action: "list", cursor }, signal, false, false), owner);
}
export async function createOwnPrivacyCase(owner: string, id: string, kind: PrivacyCaseKind, body: string, signal: AbortSignal) {
  try { const result = parsePrivacyCase(await request(owner, { action: "create", id, kind, body }, signal, false, true), owner); if (result.id !== id || result.kind !== kind || result.body !== body.trim()) throw Error("Receipt mismatch"); return result; }
  catch(e) { if(e instanceof PrivacyCaseRequestError) throw e; throw new PrivacyCaseRequestError("Sparningen kunde inte bekräftas. Läs dina ärenden innan du fortsätter.", true); }
}
export async function adminPrivacyCases(owner: string, input: { action: "list"; cursor: CaseCursor | null } | { action: CaseAction; id: string; revision: string; eventId: string; message: string }, password: string, totpCode: string, signal: AbortSignal) {
  const value = await request(owner, { ...input, password, totpCode }, signal, true, input.action !== "list");
  return input.action === "list" ? parsePrivacyCasePage(value) : parsePrivacyCase(value);
}
export async function replyToOwnPrivacyCase(owner: string, item: PrivacyCase, message: string, eventId: string, signal: AbortSignal) {
  const result = parsePrivacyCase(await request(owner, { action: "reply", id: item.id, revision: item.revision, eventId, message }, signal, false, true), owner);
  if (result.id !== item.id) throw new PrivacyCaseRequestError("Kompletteringen kunde inte bekräftas. Läs aktuell status igen.", true);
  return result;
}
export async function readPrivacyCaseHistory(owner: string, item: PrivacyCase, cursor: CaseCursor, signal: AbortSignal, credentials?: { password: string; totpCode: string }) {
  const input = { action: "history", id: item.id, revision: item.revision, cursor, ...credentials };
  return parsePrivacyCaseHistory(await request(owner, input, signal, !!credentials, false), item, cursor);
}
