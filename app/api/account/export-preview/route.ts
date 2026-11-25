import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beginTemporaryPersonalDataExport, storeTemporaryPersonalDataExport, readTemporaryPersonalDataExport, TemporaryExportError } from "@/lib/server/temporary-personal-data-export";
import { AccountReauthenticationError } from "@/lib/server/account-reauthentication";
import { preparePersonalDataReview, PersonalDataReviewError } from "@/lib/server/personal-data-review";
import { verifyPersonalDataSession, PersonalDataSessionError } from "@/lib/server/personal-data-session";
import { buildStructuredPersonalDataExport } from "@/lib/server/structured-personal-data-export";
import type { ExportInformation } from "@/lib/personal-data-export";

export const runtime = "nodejs";
const DEV_URL = "https://vwcfjvwfeatvuisojwrh.supabase.co";
const BODY_BYTES = 8192;
const headers = {
  "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Expires: "0",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin", "X-Robots-Tag": "noindex, nofollow", Vary: "Authorization",
};
class PreviewError extends Error { constructor(readonly status: number) { super("Exportprovet kunde inte skapas."); } }
const errorResponse = (status: number, message: string) => Response.json({ error: message }, { status, headers });

// Explicit server configuration; no invented controller/rights information and
// no values accepted from the requesting account. Builder validates again.
function information(): ExportInformation | null {
  try {
    const value = JSON.parse(process.env.MATCHNWORK_EXPORT_INFORMATION ?? "null");
    const fields = ["purposes", "recipients", "retention", "sources", "rights", "automatedProcessing"];
    const text = (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.length <= 4000;
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== ["controller", "contact", ...fields].sort().join() || !text(value.controller) || !text(value.contact)) return null;
    if (fields.some(key => !Array.isArray(value[key]) || !value[key].length || value[key].length > 50 || !value[key].every(text))) return null;
    return value;
  } catch { return null; }
}

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

/** Disabled dev-only transport trial, NEVER a complete access-request response.
 * Stored delivery uses the verified private storage helpers. No signed URL or
 * public UI. Asynchronous jobs, monitored cleanup and full content remain pending.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (process.env.MATCHNWORK_EXPORT_PREVIEW_ENABLED !== "true" || url !== DEV_URL) return errorResponse(404, "Sidan finns inte.");
  if (process.env.MATCHNWORK_EXPORT_STORAGE_READY !== "true") return errorResponse(503, "Paketlagringen är inte aktiverad för exportprovet.");
  const info = information(), anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!info || !anonKey || !serviceKey) return errorResponse(503, "Exportprovet är inte konfigurerat.");
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || origin !== null && origin !== new URL(request.url).origin) return errorResponse(403, "Begäran kunde inte verifieras.");
  if (new URL(request.url).search) return errorResponse(400, "Använd begärans rubriker och innehåll.");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return errorResponse(415, "Skicka begäran som JSON.");
  const authorization = request.headers.get("authorization"), match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match || match[1].length > 16384) return errorResponse(401, "Du måste vara inloggad.");
  const accessToken = match[1], active = AbortSignal.any([request.signal, AbortSignal.timeout(120000)]);
  let pending: { client: SupabaseClient; subjectId: string; id: string } | undefined;
  try {
    const input = await body(request, active);
    if (!input || typeof input !== "object" || Array.isArray(input) || !["expectedUserId,password", "expectedUserId,password,totpCode"].includes(Object.keys(input).sort().join())) throw new PreviewError(400);
    const { expectedUserId, password, totpCode } = input as Record<string, unknown>;
    if (typeof expectedUserId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(expectedUserId) || typeof password !== "string" || !password || password.length > 1024 || totpCode !== undefined && (typeof totpCode !== "string" || !/^\d{6}$/.test(totpCode))) throw new PreviewError(400);
    const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
    const userClient = createClient(url, anonKey, { auth, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
    const verificationClient = createClient(url, anonKey, { auth });
    const sessionClient = createClient(url, serviceKey, { auth, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([active, init.signal]) : active }) } });
    const sessionId = await wait(() => verifyPersonalDataSession(userClient, sessionClient, expectedUserId, accessToken, active), active);
    const { data: allowed, error } = await wait(() => userClient.rpc("consume_api_quota", { p_endpoint: "personal-data-export-preview", p_limit: 3 }).abortSignal(active), active);
    if (error || typeof allowed !== "boolean") throw new PreviewError(503);
    if (!allowed) return errorResponse(429, "För många exportförsök. Försök igen senare.");
    const bundle = await wait(() => preparePersonalDataReview(userClient, verificationClient, expectedUserId, password, { accessToken, sessionClient, signal: active, reviewClient: sessionClient, includeCvFiles: false, totpCode: totpCode as string | undefined }), active);
    if (bundle.sessionId !== sessionId) throw new PreviewError(409);
    const exportId = randomUUID();
    const job = await wait(() => beginTemporaryPersonalDataExport(sessionClient, expectedUserId, exportId, active), active);
    pending = { client: sessionClient, subjectId: expectedUserId, id: exportId };
    const result = buildStructuredPersonalDataExport(bundle, { exportId, createdAt: new Date().toISOString(), information: info });
    await wait(() => storeTemporaryPersonalDataExport(sessionClient, job, result.bytes, active), active);
    const stored = await wait(() => readTemporaryPersonalDataExport(sessionClient, expectedUserId, exportId, active), active);
    // Packaging can take time: do not rely only on the collection's final check.
    const currentSession = await wait(() => verifyPersonalDataSession(userClient, sessionClient, expectedUserId, accessToken, active), active);
    if (currentSession !== sessionId || active.aborted) throw new PreviewError(409);
    if (Date.parse(job.expiresAt) <= Date.now()) throw new TemporaryExportError("unavailable");
    return new Response(new Uint8Array(stored), { status: 200, headers: {
      ...headers, "Content-Type": result.mimeType, "Content-Length": String(stored.length),
      "Content-Disposition": `attachment; filename="matchnwork-ofullstandigt-prov-${exportId}.zip"`,
      "X-MatchnWork-Export-Coverage": "needs_completion",
      "X-MatchnWork-Export-Expires": new Date(job.expiresAt).toISOString(),
    } });
  } catch (error) {
    if (pending && !active.aborted) {
      const cleanupSignal = AbortSignal.timeout(2000);
      try { await wait(() => pending!.client.rpc("finish_personal_data_export", { p_subject_id: pending!.subjectId, p_export_id: pending!.id, p_success: false }).abortSignal(cleanupSignal), cleanupSignal); }
      catch { /* The worker also reclaims abandoned builders and late uploads. */ }
    }
    if (error instanceof TemporaryExportError) return errorResponse(error.code === "busy" ? 409 : 503, error.message);
    if (error instanceof AccountReauthenticationError) return errorResponse(error.status, error.message);
    if (error instanceof PersonalDataSessionError) return errorResponse(error.code === "invalid_session" ? 401 : error.code === "cancelled" ? 408 : 503, error.message);
    if (error instanceof PersonalDataReviewError) return errorResponse(error.code === "identity_changed" ? 409 : error.code === "cancelled" ? 408 : 502, error.message);
    if (error instanceof PreviewError) return errorResponse(error.status, "Exportprovet kunde inte skapas. Kontrollera uppgifterna och försök igen.");
    return errorResponse(active.aborted ? 408 : 502, "Exportprovet kunde inte skapas just nu.");
  }
}
