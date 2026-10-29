import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import inventory from "../../docs/privacy/personal-data-inventory.json";

// Internal review material only: never send this result directly to a client or
// the package builder. Ownership does not settle third-party rights in free text.
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
interface SourceSpec { table: string; owner: string; cursor: string; columns: string; scope?: "participants"; parent?: "ai_onboarding_sessions" | "conversations" | "jobs"; cursorType?: "integer"; schema?: "private"; transport?: "review_rpc"; }
interface ReadScope { owner: string; participants?: readonly string[]; }
const SOURCES: readonly SourceSpec[] = [
  {"table": "profiles", "owner": "id", "cursor": "id", "columns": "id,role"},
  {"table": "youth_profiles", "owner": "user_id", "cursor": "user_id", "columns": "user_id,full_name,age,city,desired_roles,strengths,merits,work_experience,education,languages,desired_locations,employment_preferences,cv_text,cover_letter_template,onboarding_completed,cv_generated,updated_at,documents,date_of_birth,address,additional_addresses,certificates,extracurriculars,profile_image_url,postal_code,cv_uploaded,cv_structured,short_onboarding_completed,recruitment_profile,recruitment_profile_version"},
  {"table": "company_profiles", "owner": "user_id", "cursor": "user_id", "columns": "user_id,company_name,administrator,description,city,updated_at,industry,address,employee_count,common_roles,hiring_priorities,logo_url,website_url,linkedin_url,instagram_url,facebook_url,tiktok_url,x_url,organization_number,verification_status,verification_submitted_at,verified_at,verification_rejection_reason"},
  {"table": "private_profiles", "owner": "user_id", "cursor": "user_id", "columns": "user_id,display_name,city,updated_at"},
  {"table": "admin_users", "owner": "user_id", "cursor": "user_id", "columns": "user_id,created_at"},
  {"table": "company_billing_details", "owner": "user_id", "cursor": "user_id", "columns": "user_id,invoice_email,address_line1,address_line2,postal_code,city,reference,country_code,version,updated_at"},
  {"table": "ai_onboarding_sessions", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,status,completed_at,created_at"},
  {"table": "ai_onboarding_messages", "parent": "ai_onboarding_sessions", "owner": "session_id", "cursor": "id", "columns": "id,session_id,sender,message_text,created_at"},
  {"table": "youth_application_drafts", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,job_id,created_at,updated_at"},
  {"table": "youth_saved_jobs", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,job_id,created_at"},
  {"table": "youth_job_impressions", "owner": "youth_user_id", "cursor": "job_id", "columns": "youth_user_id,job_id,first_seen_at"},
  {"table": "youth_job_dismissals", "owner": "youth_user_id", "cursor": "job_id", "columns": "youth_user_id,job_id,dismissed_at"},
  {"table": "swipe_actions", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,job_id,decision,created_at"},
  {"table": "application_workplace_preferences", "owner": "youth_user_id", "cursor": "job_id", "columns": "job_id,youth_user_id,workplace_id,workplace_snapshot,updated_at"},
  {"table": "notifications", "owner": "user_id", "cursor": "id", "columns": "id,user_id,type,title,body,href,read_at,created_at,match_id"},
  {"table": "application_completions", "owner": "youth_user_id", "cursor": "job_id", "columns": "youth_user_id,job_id,job_title,company_name,profile_version,questions,answers,status,created_at,submitted_at,omitted_question_ids,supplemented_at,question_batch_version,withdrawn_at"},
  {"table": "application_followups", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,job_id,criterion_key,criterion_label,question,job_profile_version,status,answer,created_at,answered_at,question_source"},
  {"table": "company_interest_actions", "owner": "youth_user_id", "cursor": "id", "columns": "id,company_user_id,youth_user_id,job_id,decision,created_at", "scope": "participants"},
  {"table": "matches", "owner": "youth_user_id", "cursor": "id", "columns": "id,youth_user_id,company_user_id,job_id,status,created_at,hire_completed_at", "scope": "participants"},
  {"table": "conversations", "owner": "youth_user_id", "cursor": "id", "columns": "id,match_id,youth_user_id,company_user_id,job_id,last_message_at,created_at", "scope": "participants"},
  {"table": "messages", "owner": "conversation_id", "cursor": "id", "columns": "id,conversation_id,sender_user_id,message_text,created_at,video_kind,video_id", "parent": "conversations"},
  {"table": "employment_records", "owner": "youth_user_id", "cursor": "match_id", "columns": "match_id,youth_user_id,company_user_id,company_name,role_name,start_date,response,approved_at,show_on_profile,include_in_cv,registered_at,updated_at,paid_at", "scope": "participants"},
  {"table": "company_match_profiles", "owner": "company_user_id", "cursor": "company_user_id", "columns": "company_user_id,culture_summary,company_values,valued_traits,work_environment,onboarding_support,employee_offer,source_notes,profile_version,created_at,updated_at"},
  {"table": "company_recruitment_controls", "owner": "company_user_id", "cursor": "company_user_id", "columns": "company_user_id,restriction,reason,changed_at"},
  {"table": "jobs", "owner": "company_user_id", "cursor": "id", "columns": "id,company_user_id,company_name,title,description,city,salary_per_hour,employment_type,category,requirements,benefits,image_url,is_active,created_at,min_age,max_age,address,postal_code,longitude,latitude,status,open_positions,job_kind,schedule,publication_status,workplaces,job_category_ids,job_category_manual,first_published_at,practical_details"},
  {"table": "recruitment_outcomes", "owner": "company_user_id", "cursor": "job_id", "columns": "job_id,company_user_id,outcome,recorded_at"},
  {"table": "recruitment_rewards", "owner": "company_user_id", "cursor": "match_id", "columns": "match_id,company_user_id,status,discount_percent,expires_at,redeemed_at"},
  {"table": "premium_orders", "owner": "company_user_id", "cursor": "id", "columns": "id,company_user_id,product_id,job_id,status,source,created_at,activated_at,cancelled_at,cancellation_reason"},
  {"table": "premium_entitlements", "owner": "company_user_id", "cursor": "id", "columns": "id,order_id,company_user_id,product_id,job_id,state,starts_at,ends_at,activated_at,ended_at,end_reason,created_by_source,created_at,updated_at"},
  {"table": "youth_videos", "owner": "owner_id", "cursor": "id", "columns": "id,owner_id,conversation_id,storage_path,mime_type,size_bytes,duration_seconds,revoked_at,created_at,first_sent_at,expires_at,cleanup_started_at,deleted_at"},
  {"table": "moderation_reports", "owner": "reporter_user_id", "cursor": "id", "columns": "id,reporter_user_id,target_type,target_id,reason,details,status,created_at,reviewed_at"},
  {"table": "user_blocks", "owner": "blocker_user_id", "cursor": "blocked_user_id", "columns": "blocker_user_id,blocked_user_id,created_at"},
  {"table": "job_match_profiles", "owner": "job_id", "cursor": "job_id", "columns": "job_id,status,role_summary,must_haves,trainable_requirements,top_traits,weighted_criteria,candidate_questions,inherited_company_version,profile_version,ai_generated,created_at,updated_at", "parent": "jobs"},
  {"table": "job_match_profile_versions", "owner": "job_id", "cursor": "profile_version", "columns": "job_id,profile_version,snapshot,created_at", "parent": "jobs", "cursorType": "integer"},
  {"table": "application_disclosures", "owner": "youth_user_id", "cursor": "job_id", "columns": "job_id,youth_user_id,revision,selected_keys,packet,matching_input,created_at,updated_at", "schema": "private", "transport": "review_rpc"},
  {"table": "candidate_assessments", "owner": "youth_user_id", "cursor": "id", "columns": "id,job_id,youth_user_id,company_user_id,job_profile_version,result,criteria_snapshot,created_at", "transport": "review_rpc"},
];
export const COLLECTION_LIMITS = Object.freeze({ pageSize: 100, requests: 500, sourceRows: 10000, bytes: 8 * 1024 * 1024, nodes: 50000, depth: 24, milliseconds: 120000, concurrency: 4 });
type Reason = "query_failed" | "invalid_response" | "limit_exceeded" | "dependency_unavailable";
export type CollectedSource = { relation: string; status: "collected"; rows: { [key: string]: Json }[] }
  | { relation: string; status: "unavailable"; reason: Reason }
  | { relation: string; status: "not_collected" };
export interface PersonalDataCollection {
  version: 1; subjectId: string; startedAt: string; finishedAt: string;
  visibility: "caller_rls" | "subject_review"; consistency: "non_transactional"; reviewState: "pending";
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
 * Optional reviewClient is a separately server-created service client, used ONLY
 * for the fixed review RPC after user verification. Its output is still pending
 * rights review; do not expose this function from a public export endpoint.
 * An empty RLS result means only "no visible rows", not proof of global absence.
 */
export async function collectPersonalDataForReview(client: SupabaseClient, expectedSubjectId: string, signal?: AbortSignal, reviewClient?: SupabaseClient): Promise<PersonalDataCollection> {
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
  async function read(spec: SourceSpec, scopes: readonly ReadScope[]): Promise<CollectedSource> {
    const relation = `${spec.schema ?? "public"}.${spec.table}`;
    const rows: { [key: string]: Json }[] = [];
    const columns = spec.columns.split(","), seen = new Set<string>();
    try {
      for (const scope of scopes) {
        const owner = scope.owner;
        let cursor: string | number | undefined;
        // Always request a terminal empty page, including when the server caps
        // responses BELOW pageSize. Never infer completion from a short page.
        while (true) {
          checkCancellation();
          if (++requests > COLLECTION_LIMITS.requests) throw new ReadFailure("limit_exceeded");
          let query;
          if (spec.transport === "review_rpc") {
            // This optional client is server-created with service credentials,
            // never a replacement for verifying the requesting user above.
            if (!reviewClient) throw new ReadFailure("dependency_unavailable");
            query = reviewClient.rpc("read_personal_data_review_page", {
              p_source: relation, p_subject_id: expectedSubjectId,
              p_after_id: cursor ?? null, p_limit: COLLECTION_LIMITS.pageSize,
            });
          } else {
            query = client.from(spec.table).select(spec.columns);
            // UUIDs were validated at Auth or in the fully collected parent.
            query = spec.scope === "participants"
              ? query.or(`youth_user_id.eq.${owner},company_user_id.eq.${owner}`)
              : query.eq(spec.owner, owner);
            query = query.order(spec.cursor, { ascending: true }).limit(COLLECTION_LIMITS.pageSize);
            if (cursor !== undefined) query = query.gt(spec.cursor, cursor);
          }
          const timeout = AbortSignal.timeout(Math.max(1, COLLECTION_LIMITS.milliseconds - (Date.now() - start)));
          query = query.abortSignal(AbortSignal.any([activeSignal, timeout]));
          const response = await query;
          checkCancellation();
          if (response.error) throw new ReadFailure("query_failed");
          if (!Array.isArray(response.data) || response.data.length > COLLECTION_LIMITS.pageSize) throw new ReadFailure("invalid_response");
          if (!response.data.length) break;
          for (const input of response.data) {
            const row = snapshot(input);
            if (!row || Array.isArray(row) || typeof row !== "object" || Object.keys(row).length !== columns.length || columns.some(key => !Object.hasOwn(row, key))) throw new ReadFailure("invalid_response");
            if (spec.scope === "participants") {
              if (row.youth_user_id !== owner && row.company_user_id !== owner) throw new PersonalDataCollectionError("account_changed");
              if (typeof row.youth_user_id !== "string" || !uuid.test(row.youth_user_id) || typeof row.company_user_id !== "string" || !uuid.test(row.company_user_id)) throw new ReadFailure("invalid_response");
            } else if (row[spec.owner] !== owner) throw new PersonalDataCollectionError("account_changed");
            // A message belongs to a collected conversation AND one of its two
            // participants. Merely knowing a conversation ID proves neither.
            if (spec.parent === "conversations" && (!scope.participants || typeof row.sender_user_id !== "string" || !scope.participants.includes(row.sender_user_id))) throw new PersonalDataCollectionError("account_changed");
            const next = row[spec.cursor];
            if (typeof next !== "string" && typeof next !== "number") throw new ReadFailure("invalid_response");
            const validCursor = spec.cursorType === "integer"
              ? typeof next === "number" && Number.isInteger(next) && next >= -2147483648 && next <= 2147483647
              : typeof next === "string" && uuid.test(next);
            // Version numbers are only unique within a job; message UUIDs are
            // globally unique and still detect duplicates across conversations.
            const rowKey = spec.cursorType === "integer" ? `${owner}:${next}` : String(next);
            if (!validCursor || (cursor !== undefined && next <= cursor) || seen.has(rowKey)) throw new ReadFailure("invalid_response");
            cursor = next;
            if (rows.length >= COLLECTION_LIMITS.sourceRows) throw new ReadFailure("limit_exceeded");
            seen.add(rowKey);
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
    const roots = SOURCES.filter(spec => !spec.parent && (spec.transport !== "review_rpc" || reviewClient));
    let nextSource = 0;
    await Promise.all(Array.from({ length: COLLECTION_LIMITS.concurrency }, async () => {
      while (nextSource < roots.length) {
        checkCancellation();
        const spec = roots[nextSource++];
        const result = await read(spec, [{ owner: expectedSubjectId }]);
        collected.set(`${spec.schema ?? "public"}.${spec.table}`, result);
        for (const child of SOURCES.filter(source => source.parent === spec.table)) {
          collected.set(`public.${child.table}`, result.status === "collected"
            ? await read(child, result.rows.map(row => ({
              owner: row.id as string,
              ...(child.parent === "conversations" ? { participants: [row.youth_user_id as string, row.company_user_id as string] } : {}),
            })))
            : { relation: `public.${child.table}`, status: "unavailable", reason: "dependency_unavailable" });
        }
      }
    }));
    await identity();
    return {
      version: 1, subjectId: expectedSubjectId, startedAt, finishedAt: new Date().toISOString(),
      visibility: reviewClient ? "subject_review" : "caller_rls", consistency: "non_transactional", reviewState: "pending",
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
