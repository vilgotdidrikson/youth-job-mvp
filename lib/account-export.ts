"use client";
import { getSupabaseClient } from "./supabase";

export class AccountExportError extends Error {
  constructor(message = "Exportprovet kunde inte hämtas. Försök igen senare.") { super(message); this.name = "AccountExportError"; }
}
const MAX = 64 * 1024 * 1024;
/** Local session is only a token snapshot; server verifies identity/password. */
export async function requestAccountExport(expectedUserId: string, password: string, signal: AbortSignal) {
  if (!expectedUserId || !password || password.length > 1024) throw new AccountExportError("Ange lösenordet för ditt konto.");
  const client = getSupabaseClient();
  async function wait<T>(operation: Promise<T>): Promise<T> {
    signal.throwIfAborted(); let cancel: (() => void) | undefined;
    try { return await Promise.race([operation,new Promise<never>((_,reject)=>{cancel=()=>reject(new DOMException("Aborted","AbortError"));signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();})]); } finally {if(cancel)signal.removeEventListener("abort",cancel);}
  }
  const snapshot = async () => {
    signal.throwIfAborted();
    const { data, error } = await wait(client.auth.getSession());
    signal.throwIfAborted();
    if (error || data.session?.user.id !== expectedUserId || !data.session.access_token) throw new AccountExportError("Kontot har ändrats. Logga in på rätt konto igen.");
    return data.session.access_token;
  };
  const token = await snapshot();
  const response = await fetch("/api/account/export-preview", { method: "POST", cache: "no-store", credentials: "omit", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ expectedUserId, password }), signal });
  if (!response.ok) {
    const messages: Record<number, string> = { 401: "Logga in igen och försök på nytt.", 403: "Kontrollera lösenordet.", 409: "Ett exportpaket finns redan eller kontot har ändrats.", 429: "För många försök. Försök igen senare.", 503: "Exportprovet är inte tillgängligt just nu." };
    throw new AccountExportError(messages[response.status]);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = /^attachment; filename="(matchnwork-ofullstandigt-prov-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.zip)"$/.exec(disposition)?.[1];
  const expiresAt = response.headers.get("x-matchnwork-export-expires") ?? "";
  const length = response.headers.get("content-length");
  if (!filename || response.headers.get("content-type") !== "application/zip" || response.headers.get("x-matchnwork-export-coverage") !== "needs_completion" || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now() || !length || !/^\d+$/.test(length) || Number(length) < 4 || Number(length) > MAX || !response.body) {
    void response.body?.cancel().catch(() => {}); throw new AccountExportError();
  }
  const reader = response.body.getReader(), chunks: Uint8Array<ArrayBuffer>[] = [];
  let count = 0, done = false; const prefix: number[] = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const part = await wait(reader.read());
      signal.throwIfAborted();
      if (part.done) { done = true; break; }
      count += part.value.length;
      if (count > MAX || count > Number(length)) throw new AccountExportError();
      for (const byte of part.value.subarray(0, 2-prefix.length)) prefix.push(byte);
      chunks.push(new Uint8Array(part.value));
    }
    if (count !== Number(length) || prefix[0] !== 80 || prefix[1] !== 75 || Date.parse(expiresAt) <= Date.now() || await snapshot() !== token) throw new AccountExportError();
    signal.throwIfAborted();
    return { blob: new Blob(chunks, { type: "application/zip" }), filename, expiresAt };
  } finally { if (!done) void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
