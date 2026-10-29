import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import inventory from "../../docs/privacy/personal-data-inventory.json";

// Internal review material only: never send this result directly to a client or
// the package builder. Ownership does not settle third-party rights in free text.
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
interface SourceSpec { table: string; owner: string; cursor: string; columns: string; }
const SOURCES: readonly SourceSpec[] = [
  {"table": "profiles", "owner": "id", "cursor": "id", "columns": "id,role"},
  {"table": "youth_profiles", "owner": "user_id", "cursor": "user_id", "columns": "user_id,full_name,age,city,desired_roles,strengths,merits,work_experience,education,languages,desired_locations,employment_preferences,cv_text,cover_letter_template,onboarding_completed,cv_generated,updated_at,documents,date_of_birth,address,additional_addresses,certificates,extracurriculars,profile_image_url,postal_code,cv_uploaded,cv_structured,short_onboarding_completed,recruitment_profile,recruitment_profile_version"},
  {"table": "company_profiles", "owner": "user_id", "cursor": "user_id", "columns": "user_id,company_name,administrator,description,city,updated_at,industry,address,employee_count,common_roles,hiring_priorities,logo_url,website_url,linkedin_url,instagram_url,facebook_url,tiktok_url,x_url,organization_number,verification_status,verification_submitted_at,verified_at,verification_rejection_reason"},
  {"table": "private_profiles", "owner": "user_id", "cursor": "user_id", "columns": "user_id,display_name,city,updated_at"},
  {"table": "admin_users", "owner": "user_id", "cursor": "user_id", "columns": "user_id,created_at"},
  {"table": "company_billing_details", "owner": "user_id", "cursor": "user_id", "columns": "user_id,invoice_email,address_line1,address_line2,postal_code,city,reference,country_code,version,updated_at"},
  {"table": "ai_onboarding_sessions", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,status,completed_at,created_at"},
  {"table": "ai_onboarding_messages", "owner": "session_id", "cursor": "id", "columns": "id,session_id,sender,message_text,created_at"},
  {"table": "youth_application_drafts", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,job_id,created_at,updated_at"},
  {"table": "youth_saved_jobs", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,job_id,created_at"},
  {"table": "youth_job_impressions", "owner": "youth_user_id", "cursor": "job_id", "columns": "youth_user_id,job_id,first_seen_at"},
  {"table": "youth_job_dismissals", "owner": "youth_user_id", "cursor": "job_id", "columns": "youth_user_id,job_id,dismissed_at"},
  {"table": "swipe_actions", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,job_id,decision,created_at"},
  {"table": "application_workplace_preferences", "owner": "youth_user_id", "cursor": "job_id", "columns": "job_id,youth_user_id,workplace_id,workplace_snapshot,updated_at"},
  {"table": "notifications", "owner": "user_id", "cursor": "id", "columns": "id,user_id,type,title,body,href,read_at,created_at,match_id"},
];
export const COLLECTION_LIMITS = Object.freeze({ pageSize: 100, requests: 500, sourceRows: 10000, bytes: 8 * 1024 * 1024, nodes: 50000, depth: 24, milliseconds: 120000, concurrency: 4 });
type Reason = "query_failed" | "invalid_response" | "limit_exceeded" | "dependency_unavailable";
export type CollectedSource = { relation: string; status: "collected"; rows: { [key: string]: Json }[] }
  | { relation: string; status: "unavailable"; reason: Reason }
  | { relation: string; status: "not_collected" };
export interface PersonalDataCollection {
  version: 1; subjectId: string; startedAt: string; finishedAt: string;
  visibility: "caller_rls"; consistency: "non_transactional"; reviewState: "pending";
  categories: { id: string; reviewState: "pending"; sources: CollectedSource[] }[];
}
export class PersonalDataCollectionError extends Error {
  constructor(public readonly code: "invalid_subject" | "unauthenticated" | "account_changed" | "cancelled") {
    super("Underlaget kunde inte samlas in säkert. Försök igen senare.");
    this.name = "PersonalDataCollectionError";
  }
}
class ReadFailure extends Error { constructor(readonly reason: Reason) { super(reason); } }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The supplied client must carry the requesting user's token, never service_role.
 * getUser verifies account existence at both ends, not fresh reauthentication or
 * revocation of every old session. A future endpoint must enforce those separately.
 * An empty RLS result means only "no visible rows", not proof of global absence.
 */
export async function collectPersonalDataForReview(client: SupabaseClient, expectedSubjectId: string, signal?: AbortSignal): Promise<PersonalDataCollection> {
  if (typeof expectedSubjectId !== "string" || !uuid.test(expectedSubjectId)) throw new PersonalDataCollectionError("invalid_subject");
  const stop = new AbortController();
  const activeSignal = signal ? AbortSignal.any([signal, stop.signal]) : stop.signal;
  const start = Date.now(), startedAt = new Date(start).toISOString();
  let requests = 0, bytes = 0, nodes = 0;
  function checkCancellation() {
    if (activeSignal.aborted || Date.now() - start > COLLECTION_LIMITS.milliseconds) throw new PersonalDataCollectionError("cancelled");
  }
  async function identity() {
    checkCancellation();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    try {
      // Auth.getUser has no AbortSignal argument. Stop waiting even if its
      // transport hangs; the underlying SDK request may finish later, unused.
      const stopped = new Promise<never>((_, reject) => {
        cancel = () => reject(new PersonalDataCollectionError("cancelled"));
        timer = setTimeout(cancel, Math.max(1, COLLECTION_LIMITS.milliseconds - (Date.now() - start)));
        activeSignal.addEventListener("abort", cancel, { once: true });
      });
      const { data, error } = await Promise.race([client.auth.getUser(), stopped]);
      checkCancellation();
      if (error || !data.user || data.user.is_anonymous) throw new PersonalDataCollectionError("unauthenticated");
      if (data.user.id !== expectedSubjectId) throw new PersonalDataCollectionError("account_changed");
    } catch (error) {
      if (error instanceof PersonalDataCollectionError) throw error;
      throw new PersonalDataCollectionError("unauthenticated");
    } finally {
      clearTimeout(timer);
      if (cancel) activeSignal.removeEventListener("abort", cancel);
    }
  }
  // Snapshot only plain JSON without executing getters or user-controlled toJSON.
  // Limits apply across ALL reads, including work discarded after a failed page.
  function snapshot(value: unknown, depth = 0, ancestors = new Set<object>()): Json {
    if (++nodes > COLLECTION_LIMITS.nodes || depth > COLLECTION_LIMITS.depth) throw new ReadFailure("limit_exceeded");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)) && !Object.is(value, -0)) return value;
    if (typeof value === "string") {
      bytes += new TextEncoder().encode(value).length;
      if (bytes > COLLECTION_LIMITS.bytes) throw new ReadFailure("limit_exceeded");
      // Reject isolated surrogates instead of silently changing the user's text.
      if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw new ReadFailure("invalid_response");
      return value;
    }
    if (!value || typeof value !== "object" || ancestors.has(value)) throw new ReadFailure("invalid_response");
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new ReadFailure("invalid_response");
    ancestors.add(value);
    const result: Json[] | { [key: string]: Json } = array ? [] : Object.create(null);
    const keys = Reflect.ownKeys(value);
    if (array && keys.length !== (value as unknown[]).length + 1) throw new ReadFailure("invalid_response");
    for (const key of keys) {
      if (array && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || !descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new ReadFailure("invalid_response");
      if (array && !/^(0|[1-9][0-9]*)$/.test(key)) throw new ReadFailure("invalid_response");
      bytes += new TextEncoder().encode(key).length + 8;
      if (bytes > COLLECTION_LIMITS.bytes) throw new ReadFailure("limit_exceeded");
      Object.defineProperty(result, key, { value: snapshot(descriptor.value, depth + 1, ancestors), enumerable: true, writable: true, configurable: true });
    }
    ancestors.delete(value);
    return result;
  }
  async function read(spec: SourceSpec, owners: readonly string[]): Promise<CollectedSource> {
    const relation = `public.${spec.table}`;
    const rows: { [key: string]: Json }[] = [];
    try {
      for (const owner of owners) {
        let cursor: string | undefined;
        // Always request a terminal empty page, including when the server caps
        // responses BELOW pageSize. Never infer completion from a short page.
        while (true) {
          checkCancellation();
          if (++requests > COLLECTION_LIMITS.requests) throw new ReadFailure("limit_exceeded");
          let query = client.from(spec.table).select(spec.columns).eq(spec.owner, owner).order(spec.cursor, { ascending: true }).limit(COLLECTION_LIMITS.pageSize);
          if (cursor) query = query.gt(spec.cursor, cursor);
          const timeout = AbortSignal.timeout(Math.max(1, COLLECTION_LIMITS.milliseconds - (Date.now() - start)));
          query = query.abortSignal(AbortSignal.any([activeSignal, timeout]));
          const response = await query;
          checkCancellation();
          if (response.error) throw new ReadFailure("query_failed");
          if (!Array.isArray(response.data) || response.data.length > COLLECTION_LIMITS.pageSize) throw new ReadFailure("invalid_response");
          if (!response.data.length) break;
          for (const input of response.data) {
            const row = snapshot(input);
            if (!row || Array.isArray(row) || typeof row !== "object" || Object.keys(row).some(key => !spec.columns.split(",").includes(key)) || spec.columns.split(",").some(key => !Object.hasOwn(row, key))) throw new ReadFailure("invalid_response");
            if (row[spec.owner] !== owner) throw new PersonalDataCollectionError("account_changed");
            const next = row[spec.cursor];
            if (typeof next !== "string" || !uuid.test(next) || (cursor && next <= cursor)) throw new ReadFailure("invalid_response");
            cursor = next;
            if (rows.length >= COLLECTION_LIMITS.sourceRows) throw new ReadFailure("limit_exceeded");
            rows.push(row);
          }
          // An equality filter on the unique cursor already fixes the only
          // possible row (profiles/billing). No empty follow-up is needed.
          if (spec.owner === spec.cursor) break;
        }
      }
      return { relation, status: "collected", rows };
    } catch (error) {
      if (error instanceof PersonalDataCollectionError) throw error;
      return { relation, status: "unavailable", reason: error instanceof ReadFailure ? error.reason : "query_failed" };
    }
  }
  const collected = new Map<string, CollectedSource>();
  try {
    await identity();
    const roots = SOURCES.filter(spec => spec.table !== "ai_onboarding_messages");
    const child = SOURCES.find(spec => spec.table === "ai_onboarding_messages")!;
    let nextSource = 0;
    await Promise.all(Array.from({ length: COLLECTION_LIMITS.concurrency }, async () => {
      while (nextSource < roots.length) {
        checkCancellation();
        const spec = roots[nextSource++];
        const result = await read(spec, [expectedSubjectId]);
        collected.set(`public.${spec.table}`, result);
        if (spec.table === "ai_onboarding_sessions") {
          collected.set(`public.${child.table}`, result.status === "collected"
            ? await read(child, result.rows.map(row => row.id as string))
            : { relation: `public.${child.table}`, status: "unavailable", reason: "dependency_unavailable" });
        }
      }
    }));
    await identity();
    return {
      version: 1, subjectId: expectedSubjectId, startedAt, finishedAt: new Date().toISOString(),
      visibility: "caller_rls", consistency: "non_transactional", reviewState: "pending",
      categories: [
        ...inventory.groups.map(group => ({ id: group.id, reviewState: "pending" as const, sources: group.relations.map(relation => collected.get(relation) ?? { relation, status: "not_collected" as const }) })),
        ...inventory.outsideCatalog.map(group => ({ id: group.id, reviewState: "pending" as const, sources: [] })),
      ],
    };
  } finally {
    // Stop sibling reads too when any ownership/Auth check aborts the run.
    stop.abort();
  }
}
