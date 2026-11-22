import { isCasePdfBase64, MAX_CASE_PDF_BASE64, parseCaseAttachmentReceipt, type CaseAttachmentInput } from "../privacy-case-attachments";
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { reauthenticateAccount, AccountReauthenticationError } from "./account-reauthentication";
import { verifyPersonalDataSession, PersonalDataSessionError } from "./personal-data-session";
import { caseText, isUuid, parseCaseCursor, parsePrivacyCase, parsePrivacyCasePage, parsePrivacyCaseHistory, privacyCaseRetentionEnabled, PRIVACY_CASE_KINDS, CASE_QUEUE_FILTERS,caseContactEmail,casePastTime,matchesEmailCase,matchesIncidentCase,type PrivacyCaseKind } from "../privacy-cases";

const headers = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Authorization, X-Account-Id", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
class CaseError extends Error { constructor(readonly status: number) { super("Ärendet kunde inte behandlas."); } }
async function readBody(request: Request, signal: AbortSignal, limit: number): Promise<Record<string, unknown>> {
  const size = request.headers.get("content-length");
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > limit)) throw new CaseError(413);
  if (!request.body) throw new CaseError(400);
  const reader = request.body.getReader(); let complete = false, length = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort",cancel,{once:true});
  if(signal.aborted)cancel();
  const chunks: Uint8Array[] = [];
  try {
    while (true) { const chunk = await reader.read(); signal.throwIfAborted(); if (chunk.done) { complete = true; break; } length += chunk.value.length; if (length > limit) throw new CaseError(413); chunks.push(chunk.value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const result: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new CaseError(400);
    return result as Record<string, unknown>;
  } finally { signal.removeEventListener("abort",cancel); if (!complete) void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
function rpcError(error: { code?: string } | null) {
  if (!error) return;
  throw new CaseError(error.code === "PT409" ? 409 : error.code === "PT429" ? 429 : error.code === "PT404" ? 404 : error.code === "42501" ? 403 : error.code === "22023" ? 400 : 503);
}
function fields(input: Record<string, unknown>, expected: string[]) {
  if (Object.keys(input).sort().join() !== expected.sort().join()) throw new CaseError(400);
}
/** Each request binds a live identity/session. Admin reads AND writes additionally
 * require a current handler grant and fresh password/TOTP. The verifier is signed
 * out before service-only data access; it never upgrades shared browser storage. */
export async function handlePrivacyCases(request: Request, admin = false, attachments = false, delivery = false): Promise<Response> {
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1], owner = request.headers.get("x-account-id");
  let writePending=false;
  const fail = (status: number) => Response.json({ error: status === 503 ? "Ärendetjänsten är inte tillgänglig. Använd kontaktvägen på hjälpsidan." : status === 409 ? "Ärendet har ändrats. Läs aktuell status igen." : "Begäran kunde inte slutföras." }, { status, headers:{...headers,"X-Privacy-Case-Write":writePending?"uncertain":"rejected"} });
  if (!token || token.length > 16384 || !isUuid(owner)) return fail(401);
  if (new URL(request.url).search || request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("origin") !== null && request.headers.get("origin") !== new URL(request.url).origin) return fail(403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail(415);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret) return fail(503);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50000)]);
  let cancel: (() => void) | undefined;
  try {
    return await Promise.race([new Promise<Response>((_, reject) => { cancel = () => reject(new CaseError(408)); signal.addEventListener("abort", cancel, { once: true }); if (signal.aborted) cancel(); }), (async () => {
      const input = await readBody(request, signal, attachments ? MAX_CASE_PDF_BASE64 + 8192 : 24576);
      const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
      const transport: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
      const user = createClient(url, key, { auth, global: { fetch: transport, headers: { Authorization: `Bearer ${token}` } } });
      const service = createClient(url, secret, { auth, global: { fetch: transport } });
      const session = await verifyPersonalDataSession(user, service, owner, token, signal);
      const action = input.action;
      if (admin) {
        if (typeof input.password !== "string" || !input.password || input.password.length > 1024 || typeof input.totpCode !== "string" || !/^\d{6}$/.test(input.totpCode)) throw new CaseError(400);
        const access = await service.rpc("privacy_case_access", { p_actor: owner }).abortSignal(signal); rpcError(access.error); if (access.data !== true) throw new CaseError(403);
        const quota = await user.rpc("consume_api_quota", { p_endpoint: "privacy-case-verification", p_limit: 20 }).abortSignal(signal); rpcError(quota.error); if (quota.data !== true) throw new CaseError(429);
        // The permission RPC also requires a confirmed email and a verified TOTP.
        const verification = createClient(url, key, { auth, global: { fetch: (input, init) => String(input).includes("/auth/v1/logout") ? fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(5000) }) : transport(input, init) } });
        const identity = await reauthenticateAccount(user, verification, owner, input.password, input.totpCode, signal);
        if (!identity.factors?.some(f => f.factor_type === "totp" && f.status === "verified")) throw new CaseError(403);
      }
      let result: unknown;
      if (delivery) {
        fields(input, ["action", "id", "password", "totpCode"]);
        if (admin || action !== "delivery" || !isUuid(input.id) ||
          typeof input.password !== "string" || !input.password || input.password.length>1024 ||
          typeof input.totpCode !== "string" || (input.totpCode!=="" && !/^\d{6}$/.test(input.totpCode))) throw new CaseError(400);
        const verification = createClient(url, key, { auth, global: { fetch: (input, init) => String(input).includes("/auth/v1/logout") ? fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(5000) }) : transport(input, init) } });
        const quota = await user.rpc("consume_api_quota", { p_endpoint: "privacy-delivery-verification", p_limit: 10 }).abortSignal(signal);
        rpcError(quota.error);
        if (quota.data !== true) throw new CaseError(429);
        await reauthenticateAccount(user, verification, owner, input.password, input.totpCode || undefined, signal);
        const response = await service.rpc("read_reviewed_privacy_case_delivery", {
          p_subject: owner, p_session: session, p_case: input.id,
        }).abortSignal(signal);
        rpcError(response.error);
        if (response.data?.caseId !== input.id.toLowerCase() || !isCasePdfBase64(response.data.content)) throw new CaseError(503);
        result = { caseId: response.data.caseId, content: response.data.content };
      } else if (attachments) {
        if (!admin || !isUuid(input.id) || !isUuid(input.revision) ||
          (action !== "list" && action !== "upload" && action !== "download" && action !== "publish" && action !== "revoke")) throw new CaseError(400);
        fields(input, ["action", "id", "revision", "password", "totpCode",
          ...(action === "list" ? [] : ["attachmentId"]), ...(action === "upload" ? ["content"] : []), ...(action === "publish" ? ["confirmed"] : [])]);
        if (action !== "list" && !isUuid(input.attachmentId) || action === "upload" && !isCasePdfBase64(input.content)) throw new CaseError(400);
        if (action === "publish" && input.confirmed !== true) throw new CaseError(400);
        writePending = action === "upload" || action === "publish" || action === "revoke";
        const response = await (action === "publish" || action === "revoke" ? service.rpc(action === "publish" ? "publish_reviewed_privacy_case_delivery" : "revoke_reviewed_privacy_case_delivery", {
          p_actor: owner, p_session: session, p_case: input.id, p_revision: input.revision, p_attachment: input.attachmentId,
        }) : service.rpc("manage_privacy_case_attachment", {
          p_actor: owner, p_session: session, p_case: input.id, p_revision: input.revision, p_action: action,
          p_attachment: input.attachmentId ?? null, p_content: input.content ?? null,
        })).abortSignal(signal);
        if (response.error) writePending = false;
        rpcError(response.error);
        try {
          result = { caseId: input.id.toLowerCase(), revision: input.revision.toLowerCase(),
            ...(typeof input.attachmentId === "string" ? { id: input.attachmentId.toLowerCase() } : {}),
            ...parseCaseAttachmentReceipt(response.data, input as CaseAttachmentInput) };
        } catch { throw new CaseError(503); }
      } else if (action === "list") {
        fields(input, admin ? ["action", "cursor", "password", "totpCode",...(input.filter===undefined?[]:["filter"])] : ["action", "cursor"]);
        const cursor = parseCaseCursor(input.cursor);
        if(admin&&input.filter!==undefined&&(typeof input.filter!=="string"||!Object.hasOwn(CASE_QUEUE_FILTERS,input.filter)))throw new CaseError(400);
        const response = await (admin&&input.filter!==undefined?service.rpc("list_privacy_case_queue",{p_admin:owner,p_session:session,p_filter:input.filter,p_before:cursor?.created_at??null,p_before_id:cursor?.id??null}):service.rpc("list_privacy_cases", { p_subject: admin ? null : owner, p_admin: admin ? owner : null, p_before: cursor?.created_at ?? null, p_before_id: cursor?.id ?? null })).abortSignal(signal); rpcError(response.error);
        result = parsePrivacyCasePage(response.data, admin ? undefined : owner);
      } else if(action==="find") {
        fields(input,admin?["action","id","password","totpCode"]:["action","id"]);
        if(!isUuid(input.id))throw new CaseError(400);
        const response=await service.rpc("read_privacy_case",{p_subject:admin?null:owner,p_admin:admin?owner:null,p_session:session,p_id:input.id}).abortSignal(signal);rpcError(response.error);
        const item=parsePrivacyCase(response.data,admin?undefined:owner);result=item;
        if(item.id!==input.id.toLowerCase())throw new CaseError(503);
      } else if (admin && action === "incident_create") {
        fields(input, ["action", "id", "body", "awareAt", "password", "totpCode"]);
        if (!isUuid(input.id)) throw new CaseError(400);
        const body = caseText(input.body), awareAt = casePastTime(input.awareAt);
        writePending = true;
        const response = await service.rpc("create_incident_privacy_case", {
          p_actor: owner, p_session: session, p_id: input.id, p_body: body, p_aware_at: awareAt,
        }).abortSignal(signal);
        if (response.error) writePending = false;
        rpcError(response.error);
        const incident = parsePrivacyCase(response.data);
        if (!matchesIncidentCase(incident, { action, id: input.id, body, awareAt })) throw new CaseError(503);
        result = incident;
      } else if(admin&&action==="email_create") {
        fields(input,["action","id","kind","body","contactEmail","receivedAt","password","totpCode"]);
        if(!isUuid(input.id)||typeof input.kind!=="string"||!Object.hasOwn(PRIVACY_CASE_KINDS,input.kind))throw new CaseError(400);
        const body=caseText(input.body),email=caseContactEmail(input.contactEmail),received=casePastTime(input.receivedAt);
        writePending=true;const response=await service.rpc("create_email_privacy_case",{p_actor:owner,p_session:session,p_id:input.id,p_kind:input.kind,p_body:body,p_contact_email:email,p_received_at:received}).abortSignal(signal);if(response.error)writePending=false;rpcError(response.error);const item=parsePrivacyCase(response.data);if(!matchesEmailCase(item,{action:"email_create",id:input.id.toLowerCase(),kind:input.kind as PrivacyCaseKind,body,contactEmail:email,receivedAt:received}))throw new CaseError(503);result=item;
      } else if (action === "history") {
        fields(input, admin ? ["action", "id", "revision", "cursor", "password", "totpCode"] : ["action", "id", "revision", "cursor"]);
        const cursor = parseCaseCursor(input.cursor);
        if (!isUuid(input.id) || !isUuid(input.revision) || !cursor) throw new CaseError(400);
        const response = await service.rpc("read_privacy_case_history", { p_subject: admin ? null : owner, p_admin: admin ? owner : null, p_session: session, p_id: input.id, p_revision: input.revision, p_before: cursor.created_at, p_before_id: cursor.id }).abortSignal(signal); rpcError(response.error);
        result = parsePrivacyCaseHistory(response.data, { id: input.id, revision: input.revision }, cursor,admin?undefined:owner);
      } else if (!admin && action === "create") {
        fields(input, ["action", "id", "kind", "body"]);
        if (!isUuid(input.id) || typeof input.kind !== "string" || !Object.hasOwn(PRIVACY_CASE_KINDS, input.kind)) throw new CaseError(400);
        const text = caseText(input.body);
        writePending=true;
        const response = await service.rpc("create_privacy_case", { p_subject: owner, p_id: input.id, p_kind: input.kind, p_body: text }).abortSignal(signal); if(response.error)writePending=false;rpcError(response.error);
        result = parsePrivacyCase(response.data, owner);
      } else if (!admin && action === "reply") {
        fields(input, ["action", "id", "revision", "eventId", "message"]);
        if (!isUuid(input.id) || !isUuid(input.revision) || !isUuid(input.eventId)) throw new CaseError(400);
        const message=caseText(input.message);writePending=true;
        const response = await service.rpc("reply_privacy_case", { p_subject: owner, p_id: input.id, p_revision: input.revision, p_event: input.eventId, p_message: message }).abortSignal(signal); if(response.error)writePending=false;rpcError(response.error);
        result = parsePrivacyCase(response.data, owner);
      } else if (admin && action === "purge") {
        if (!privacyCaseRetentionEnabled()) throw new CaseError(404);
        fields(input, ["action", "id", "revision", "confirmed", "password", "totpCode"]);
        if (input.confirmed !== true || !isUuid(input.id) || !isUuid(input.revision)) throw new CaseError(400);
        writePending = true;
        const response = await service.rpc("purge_reviewed_privacy_case", {
          p_admin: owner, p_session: session, p_case: input.id, p_revision: input.revision,
        }).abortSignal(signal);
        if (response.error || response.data === false) writePending = false;
        rpcError(response.error);
        if (response.data === false) throw new CaseError(409);
        if (response.data !== true) throw new CaseError(503);
        result = { purged: true, id: input.id.toLowerCase(), revision: input.revision.toLowerCase() };
      } else if(admin&&["review","schedule_review"].includes(String(action))) {
        fields(input,["action","id","revision","eventId","message","reviewAfter","password","totpCode"]);
        if(!isUuid(input.id)||!isUuid(input.revision)||!isUuid(input.eventId)||input.message!=="")throw new CaseError(400);
        // SQL also bounds a new review. An exact replay may have passed its date.
        if(typeof input.reviewAfter!=="string"||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.reviewAfter)||!Number.isFinite(Date.parse(input.reviewAfter)))throw new CaseError(400);
        writePending=true;const response=await service.rpc("record_privacy_case_review",{p_actor:owner,p_session:session,p_id:input.id,p_revision:input.revision,p_event:input.eventId,p_action:action,p_review_after:input.reviewAfter}).abortSignal(signal);if(response.error)writePending=false;rpcError(response.error);result=parsePrivacyCase(response.data);
      } else if (admin && ["claim", "reply", "waiting", "close", "reopen"].includes(String(action))) {
        fields(input, ["action", "id", "revision", "eventId", "message", "password", "totpCode",...(input.externalReplyConfirmed===undefined?[]:["externalReplyConfirmed"]),...(input.externalSentAt===undefined?[]:["externalSentAt"])]);
        if (!isUuid(input.id) || !isUuid(input.revision) || !isUuid(input.eventId)) throw new CaseError(400);
        if(input.externalReplyConfirmed!==undefined&&input.externalReplyConfirmed!==true)throw new CaseError(400);const sent=input.externalSentAt===undefined?null:casePastTime(input.externalSentAt);
        const message=caseText(input.message,false);writePending=true;
        const response = await service.rpc("update_privacy_case", { p_actor: owner, p_session: session, p_id: input.id, p_revision: input.revision, p_event: input.eventId, p_action: action, p_message: message,p_external_reply_confirmed:input.externalReplyConfirmed??false,p_external_sent_at:sent }).abortSignal(signal); if(response.error)writePending=false;rpcError(response.error);
        result = parsePrivacyCase(response.data);
      } else throw new CaseError(400);
      if (await verifyPersonalDataSession(user, service, owner, token, signal) !== session) throw new CaseError(401);
      if (admin) { const access = await service.rpc("privacy_case_access", { p_actor: owner }).abortSignal(signal); rpcError(access.error); if (access.data !== true) throw new CaseError(403); }
      signal.throwIfAborted();
      return Response.json(result, { headers });
    })()]);
  } catch (error) {
    return fail(error instanceof CaseError || error instanceof AccountReauthenticationError ? error.status : error instanceof PersonalDataSessionError ? error.code === "invalid_session" ? 401 : 503 : signal.aborted ? 408 : 400);
  } finally { if (cancel) signal.removeEventListener("abort", cancel); }
}
