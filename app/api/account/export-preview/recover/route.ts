import { createClient } from "@supabase/supabase-js";
import { latestTemporaryPersonalDataExport, readTemporaryPersonalDataExport, TemporaryExportError } from "@/lib/server/temporary-personal-data-export";
import { reauthenticateAccount, AccountReauthenticationError } from "@/lib/server/account-reauthentication";
import { verifyPersonalDataSession, PersonalDataSessionError } from "@/lib/server/personal-data-session";

export const runtime = "nodejs";
const DEV_URL = "https://vwcfjvwfeatvuisojwrh.supabase.co";
const BODY_BYTES = 8192;
const headers = {
  "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Expires: "0",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin", "X-Robots-Tag": "noindex, nofollow", Vary: "Authorization",
};
class PreviewError extends Error { constructor(readonly status: number) { super("Exportprovet kunde inte hämtas."); } }
const errorResponse = (status: number, message: string) => Response.json({ error: message }, { status, headers });

async function wait<T>(operation: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new PreviewError(408);
  let cancel: (() => void) | undefined;
  try {
    const result = await Promise.race([operation(), new Promise<never>((_, reject) => {
      cancel = () => reject(new PreviewError(408));
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
    })]);
    if (signal.aborted) throw new PreviewError(408);
    return result;
  } finally { if (cancel) signal.removeEventListener("abort", cancel); }
}

async function body(request: Request, signal: AbortSignal) {
  const size = request.headers.get("content-length");
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > BODY_BYTES)) throw new PreviewError(413);
  if (!request.body) throw new PreviewError(400);
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0, complete = false;
  try {
    while (true) {
      const chunk = await wait(() => reader.read(), signal);
      if (chunk.done) { complete = true; break; }
      if ((length += chunk.value.length) > BODY_BYTES) throw new PreviewError(413);
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
    catch { throw new PreviewError(400); }
  } finally {
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Recover the latest OWN package, with fresh password and active session.
 * Never reserves, collects, uploads, extends expiry or mutates existing jobs.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (process.env.MATCHNWORK_EXPORT_PREVIEW_ENABLED !== "true" || url !== DEV_URL) return errorResponse(404, "Sidan finns inte.");
  if (process.env.MATCHNWORK_EXPORT_STORAGE_READY !== "true") return errorResponse(503, "Paketlagringen är inte aktiverad för exportprovet.");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anonKey || !serviceKey) return errorResponse(503, "Exportprovet är inte konfigurerat.");
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || origin !== null && origin !== new URL(request.url).origin) return errorResponse(403, "Begäran kunde inte verifieras.");
  if (new URL(request.url).search) return errorResponse(400, "Använd begärans rubriker och innehåll.");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return errorResponse(415, "Skicka begäran som JSON.");
  const authorization = request.headers.get("authorization"), match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match || match[1].length > 16384) return errorResponse(401, "Du måste vara inloggad.");
  const accessToken = match[1], active = AbortSignal.any([request.signal, AbortSignal.timeout(120000)]);
  try {
    const input = await body(request, active);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).sort().join() !== "expectedUserId,password") throw new PreviewError(400);
    const { expectedUserId, password } = input as Record<string, unknown>;
    if (typeof expectedUserId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(expectedUserId) || typeof password !== "string" || !password || password.length > 1024) throw new PreviewError(400);
    const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
    const userClient = createClient(url, anonKey, { auth, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
    const verificationClient = createClient(url, anonKey, { auth });
    const sessionClient = createClient(url, serviceKey, { auth, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([active, init.signal]) : active }) } });
    const sessionId = await wait(() => verifyPersonalDataSession(userClient, sessionClient, expectedUserId, accessToken, active), active);
    const { data: allowed, error } = await wait(() => userClient.rpc("consume_api_quota", { p_endpoint: "personal-data-export-recovery", p_limit: 3 }).abortSignal(active), active);
    if (error || typeof allowed !== "boolean") throw new PreviewError(503);
    if (!allowed) return errorResponse(429, "För många exportförsök. Försök igen senare.");
    await wait(() => reauthenticateAccount(userClient, verificationClient, expectedUserId, password), active);
    const job = await wait(() => latestTemporaryPersonalDataExport(sessionClient, expectedUserId, active), active);
    const stored = job.status === "ready" ? await wait(() => readTemporaryPersonalDataExport(sessionClient, expectedUserId, job.id, active), active) : null;
    // Recheck after password, status lookup and any Storage read, including non-file results.
    const currentSession = await wait(() => verifyPersonalDataSession(userClient, sessionClient, expectedUserId, accessToken, active), active);
    if (currentSession !== sessionId || active.aborted) throw new PreviewError(409);
    if (job.status !== "ready") {
      if (job.status === "building" && Date.parse(job.expiresAt) <= Date.now()) throw new TemporaryExportError("unavailable");
      const value = job.status === "building" ? { status: job.status, expiresAt: new Date(job.expiresAt).toISOString() } : { status: job.status };
      const json = JSON.stringify(value);
      return new Response(json, { headers: { ...headers, "Content-Type": "application/json", "Content-Length": String(new TextEncoder().encode(json).length) } });
    }
    if (!stored || Date.parse(job.expiresAt) <= Date.now()) throw new TemporaryExportError("unavailable");
    return new Response(new Uint8Array(stored), { status: 200, headers: {
      ...headers, "Content-Type": "application/zip", "Content-Length": String(stored.length),
      "Content-Disposition": `attachment; filename="matchnwork-ofullstandigt-prov-${job.id}.zip"`,
      "X-MatchnWork-Export-Coverage": "needs_completion",
      "X-MatchnWork-Export-Expires": new Date(job.expiresAt).toISOString(),
    } });
  } catch (error) {
    if (error instanceof TemporaryExportError) return errorResponse(error.code === "busy" ? 409 : 503, error.message);
    if (error instanceof AccountReauthenticationError) return errorResponse(error.status, error.message);
    if (error instanceof PersonalDataSessionError) return errorResponse(error.code === "invalid_session" ? 401 : error.code === "cancelled" ? 408 : 503, error.message);
    if (error instanceof PreviewError) return errorResponse(error.status, "Exportprovet kunde inte hämtas. Kontrollera uppgifterna och försök igen.");
    return errorResponse(active.aborted ? 408 : 502, "Exportprovet kunde inte hämtas just nu.");
  }
}
