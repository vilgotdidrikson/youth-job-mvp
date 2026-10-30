import "server-only";
import { buildPersonalDataExport, ExportPackageError, EXPORT_CATEGORY_IDS, type ExportCategory, type ExportPackageInput } from "../personal-data-export";
import { personalDataReviewFingerprint } from "./reviewed-personal-data-export";
import type { preparePersonalDataReview } from "./personal-data-review";

type Bundle = Awaited<ReturnType<typeof preparePersonalDataReview>>;
type Scalar = string | boolean | number | null;
type Validator = (value: unknown) => value is Scalar;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
const timestamp: Validator = (v): v is string | null => v === null || typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const boolean: Validator = (v): v is boolean | null => v === null || typeof v === "boolean";
const version: Validator = (v): v is number | null => v === null || typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 2147483647;
const role: Validator = (v): v is string => v === "youth" || v === "company" || v === "private";
interface Policy { category: string; owner: string; key: string; youthOnly?: boolean; fields: Record<string, Validator> }
// A closed list of scalar fields. Never spread a source row or stringify nested
// data: extra columns, text, URLs, snapshots and third-party profiles stay out.
const POLICIES: Record<string, Policy> = {
  "public.profiles": { category: "account", owner: "id", key: "id", fields: { id: uuid, role } },
  "public.youth_profiles": { category: "account", owner: "user_id", key: "user_id", youthOnly: true, fields: { user_id: uuid, onboarding_completed: boolean, cv_generated: boolean, cv_uploaded: boolean, short_onboarding_completed: boolean, recruitment_profile_version: version, updated_at: timestamp } },
  "public.youth_application_drafts": { category: "own-discovery", owner: "youth_user_id", key: "id", youthOnly: true, fields: { id: uuid, youth_user_id: uuid, job_id: uuid, created_at: timestamp, updated_at: timestamp } },
  "public.youth_saved_jobs": { category: "own-discovery", owner: "youth_user_id", key: "id", youthOnly: true, fields: { id: uuid, youth_user_id: uuid, job_id: uuid, created_at: timestamp } },
  "public.youth_job_impressions": { category: "own-discovery", owner: "youth_user_id", key: "job_id", youthOnly: true, fields: { youth_user_id: uuid, job_id: uuid, first_seen_at: timestamp } },
  "public.youth_job_dismissals": { category: "own-discovery", owner: "youth_user_id", key: "job_id", youthOnly: true, fields: { youth_user_id: uuid, job_id: uuid, dismissed_at: timestamp } },
  "public.swipe_actions": { category: "own-discovery", owner: "youth_user_id", key: "id", youthOnly: true, fields: { id: uuid, youth_user_id: uuid, job_id: uuid, decision: (v): v is string => v === "interested" || v === "skip", created_at: timestamp } },
  "public.application_workplace_preferences": { category: "own-discovery", owner: "youth_user_id", key: "job_id", youthOnly: true, fields: { youth_user_id: uuid, job_id: uuid, workplace_id: uuid, updated_at: timestamp } },
};

export class StructuredExportError extends Error {
  constructor() { super("Det strukturerade exportunderlaget kunde inte valideras."); this.name = "StructuredExportError"; }
}
function fail(): never { throw new StructuredExportError(); }

/** Internal automatic policy, not a complete access-request response. Supply
 * only server-owned output from preparePersonalDataReview, never request JSON.
 * The future delivery endpoint must recheck the active identity before release.
 * No legal approval is fabricated, and no original file is automatically shared.
 */
export function buildStructuredPersonalDataExport(bundle: Bundle, metadata: Omit<ExportPackageInput, "subjectId" | "categories">) {
  try {
    // Bounds and plain-data validation run before touching nested properties.
    personalDataReviewFingerprint(bundle);
    personalDataReviewFingerprint(metadata);
    const { collection, subjectId } = bundle;
    if (!uuid(subjectId) || collection.subjectId !== subjectId || bundle.reviewState !== "pending" || collection.reviewState !== "pending" || collection.version !== 1 || collection.consistency !== "non_transactional" || bundle.consistency !== "non_transactional" || !["caller_rls", "subject_review"].includes(collection.visibility)) fail();
    const started = Date.parse(collection.startedAt), finished = Date.parse(collection.finishedAt), created = Date.parse(metadata.createdAt);
    if (![started, finished, created].every(Number.isFinite) || started > finished || finished > created) fail();
    const categories = new Map<string, ExportCategory>();
    const seenSources = new Set<string>();
    let accountRole: Scalar = null;
    const profileSources = collection.categories.flatMap(c => c.sources).filter(s => s.relation === "public.profiles");
    if (profileSources.length !== 1) fail();
    const profile = profileSources[0];
    if (profile.status !== "collected" || profile.rows.length !== 1 || profile.rows[0].id !== subjectId || !role(profile.rows[0].role)) fail();
    accountRole = profile.rows[0].role;
    for (const category of collection.categories) {
      if (!EXPORT_CATEGORY_IDS.includes(category.id) || categories.has(category.id) || category.reviewState !== "pending") fail();
      const records: NonNullable<ExportCategory["records"]> = [];
      for (const source of category.sources) {
        if (seenSources.has(source.relation)) fail();
        seenSources.add(source.relation);
        const policy = Object.hasOwn(POLICIES, source.relation) ? POLICIES[source.relation] : undefined;
        if (!policy) continue;
        if (policy.category !== category.id) fail();
        if (source.status !== "collected") continue;
        if (policy.youthOnly && accountRole !== "youth") {
          if (source.rows.length) fail();
          continue;
        }
        const seenRows = new Set<string>();
        for (const row of source.rows) {
          if (row[policy.owner] !== subjectId) fail();
          const data: Record<string, Scalar> = { source: source.relation };
          for (const [key, validate] of Object.entries(policy.fields)) {
            const value = row[key];
            if (!validate(value)) fail();
            data[key] = value as Scalar;
          }
          const key = data[policy.key];
          if (typeof key !== "string" || seenRows.has(key)) fail();
          seenRows.add(key);
          records.push({ subjectId, data });
        }
      }
      categories.set(category.id, records.length ? {
        id: category.id, subjectId, status: "partially_included", records,
        summary: [{ label: "Urval", value: "Automatiskt validerade strukturerade uppgifter. Fritext, filer och övrigt underlag återstår." }],
      } : { id: category.id, subjectId, status: "requires_review" });
    }
    if (categories.size !== EXPORT_CATEGORY_IDS.length) fail();
    return buildPersonalDataExport(subjectId, { ...metadata, subjectId, categories: EXPORT_CATEGORY_IDS.map(id => categories.get(id)!) });
  } catch (error) {
    if (error instanceof ExportPackageError || error instanceof StructuredExportError) throw error;
    return fail();
  }
}
