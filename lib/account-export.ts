"use client";
import { getSupabaseClient } from "./supabase";

export class AccountExportError extends Error {
  constructor(message = "Exportprovet kunde inte hämtas. Försök igen senare.") { super(message); this.name = "AccountExportError"; }
}
const MAX = 64 * 1024 * 1024;
export type AccountExportFile = { blob: Blob; filename: string; expiresAt: string };
export type AccountExportStatus = { status: "none" | "expired" | "failed" } | { status: "building"; expiresAt: string };
export async function requestAccountExport(expectedUserId: string, password: string, signal: AbortSignal, totpCode?: string): Promise<AccountExportFile> {
  const result = await requestExport(expectedUserId, password, signal, false, totpCode);
  if ("status" in result) throw new AccountExportError();
  return result;
}
export function recoverAccountExport(expectedUserId: string, password: string, signal: AbortSignal, totpCode?: string) {
  return requestExport(expectedUserId, password, signal, true, totpCode);
}
/** Local session is only a token snapshot; server verifies identity/password. */
async function requestExport(expectedUserId: string, password: string, signal: AbortSignal, recover: boolean, totpCode?: string): Promise<AccountExportFile | AccountExportStatus> {
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
  const response = await fetch(recover ? "/api/account/export-preview/recover" : "/api/account/export-preview", { method: "POST", cache: "no-store", credentials: "omit", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ expectedUserId, password, ...(totpCode ? { totpCode } : {}) }), signal });
  if (!response.ok) {
    const messages: Record<number, string> = { 401: "Logga in igen och försök på nytt.", 403: "Kontrollera lösenordet och eventuell tvåfaktorskod.", 409: "Ett exportpaket finns redan eller kontot har ändrats.", 429: "För många försök. Försök igen senare.", 503: "Exportprovet är inte tillgängligt just nu." };
    throw new AccountExportError(messages[response.status]);
  }
  if (recover && response.headers.get("content-type") === "application/json") {
    const length = response.headers.get("content-length");
    if (!length || !/^\d+$/.test(length) || Number(length) < 2 || Number(length) > 1024 || !response.body) {
      void response.body?.cancel().catch(() => {}); throw new AccountExportError();
    }
    const reader = response.body.getReader(), parts: Uint8Array[] = [];
    let count = 0, done = false;
    try {
      while (true) {
        const part = await wait(reader.read()); signal.throwIfAborted();
        if (part.done) { done = true; break; }
        count += part.value.length;
        if (count > Number(length)) throw new AccountExportError();
        parts.push(part.value);
      }
      if (count !== Number(length)) throw new AccountExportError();
      const bytes = new Uint8Array(count); let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.length; }
      let value;
      try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new AccountExportError(); }
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccountExportError();
      if (value.status === "building") {
        if (Object.keys(value).sort().join() !== "expiresAt,status" || typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) throw new AccountExportError();
      } else if (!["none", "expired", "failed"].includes(value.status) || Object.keys(value).join() !== "status") throw new AccountExportError();
      if (await snapshot() !== token) throw new AccountExportError();
      signal.throwIfAborted();
      return value.status === "building" ? { status: "building", expiresAt: value.expiresAt } : { status: value.status };
    } finally { if (!done) void reader.cancel().catch(() => {}); reader.releaseLock(); }
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
