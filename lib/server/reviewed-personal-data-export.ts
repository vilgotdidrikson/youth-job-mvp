import "server-only";
import { createHash } from "node:crypto";
import { buildPersonalDataExport, ExportPackageError, EXPORT_LIMITS, type ExportPackageInput, type ExportFile, type ExportCategory } from "../personal-data-export";
import type { preparePersonalDataReview } from "./personal-data-review";

type ReviewBundle = Awaited<ReturnType<typeof preparePersonalDataReview>>;
export interface PersonalDataReviewApproval {
  subjectId: string; sourceFingerprint: string; reviewedBy: string; reviewedAt: string;
  categories: ExportCategory[]; files: ExportFile[];
}
export class ReviewedExportError extends Error {
  constructor(public readonly code: "invalid_review" | "stale_review" | "unread_source" | "file_mismatch") {
    super("Exportunderlaget behöver granskas på nytt.");
  }
}
const fail = (code: ReviewedExportError["code"]): never => { throw new ReviewedExportError(code); };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;

/** Internal fingerprint, not an authorization token or a legal review decision.
 * Deterministic across plain-object key order, bounded, never executes getters.
 * Proxy traps are not sandboxed: inputs must be trusted server-owned objects.
 */
export function personalDataReviewFingerprint(input: unknown): string {
  const hash = createHash("sha256"), active = new Set<object>();
  let nodes = 0, textBytes = 0, fileBytes = 0;
  const add = (text: string) => {
    const bytes = Buffer.from(text);
    if ((textBytes += bytes.length) > EXPORT_LIMITS.jsonBytes) fail("invalid_review");
    hash.update(String(bytes.length) + ":"); hash.update(bytes);
  };
  function visit(value: unknown, depth = 0) {
    if (++nodes > EXPORT_LIMITS.nodes || depth > 24) fail("invalid_review");
    if (value === null) { add("null"); return; }
    if (typeof value === "string" || typeof value === "boolean") {
      if (typeof value === "string" && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) fail("invalid_review");
      add(typeof value); add(String(value)); return;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || Object.is(value, -0) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail("invalid_review");
      add("number"); add(String(value)); return;
    }
    if (!value || typeof value !== "object" || active.has(value)) return fail("invalid_review");
    if (Object.getPrototypeOf(value) === Uint8Array.prototype) {
      const bytes = value as Uint8Array;
      if (["buffer", "byteLength", "byteOffset"].some(key => Object.hasOwn(bytes, key)) || Object.getOwnPropertySymbols(bytes).length) fail("invalid_review");
      if (!(bytes.buffer instanceof ArrayBuffer) || (fileBytes += bytes.byteLength) > EXPORT_LIMITS.totalBytes) fail("invalid_review");
      add("bytes"); add(String(bytes.byteLength)); hash.update(bytes); return;
    }
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail("invalid_review");
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string")) fail("invalid_review");
    if (array && keys.length !== value.length + 1) fail("invalid_review");
    active.add(value); add(array ? "array" : "object");
    const ordered = array ? Array.from({ length: value.length }, (_, i) => String(i)) : (keys as string[]).sort();
    add(String(ordered.length));
    for (const key of ordered) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return fail("invalid_review");
      add(key); visit(descriptor.value, depth + 1);
    }
    active.delete(value);
  }
  try { visit(input); return hash.digest("hex"); }
  catch { return fail("invalid_review"); }
}

/** Caller MUST authorize a trusted reviewer; never accept approval from a normal
 * user's request. This gate checks binding/coverage, not third-party rights.
 * Package identity/metadata/categories still pass the existing package validator.
 */
function buildReviewedPersonalDataExportInternal(bundle: ReviewBundle, approval: PersonalDataReviewApproval, metadata: Omit<ExportPackageInput, "subjectId" | "categories">) {
  const current = personalDataReviewFingerprint(bundle);
  personalDataReviewFingerprint(approval); personalDataReviewFingerprint(metadata);
  if (!uuid.test(bundle.subjectId) || bundle.collection.subjectId !== bundle.subjectId || bundle.reviewState !== "pending" || bundle.collection.reviewState !== "pending" || approval.subjectId !== bundle.subjectId || !uuid.test(approval.reviewedBy) || !Number.isFinite(Date.parse(approval.reviewedAt))) fail("invalid_review");
  const reviewed = Date.parse(approval.reviewedAt), finished = Date.parse(bundle.collection.finishedAt), created = Date.parse(metadata.createdAt);
  if (!Number.isFinite(finished) || !Number.isFinite(created) || new Date(reviewed).toISOString() !== approval.reviewedAt || reviewed < finished || reviewed > created) fail("invalid_review");
  if (approval.sourceFingerprint !== current) fail("stale_review");
  for (const category of approval.categories) {
    const original = bundle.collection.categories.find(source => source.id === category.id);
    if (!original) return fail("invalid_review");
    if ((category.status === "included" || category.status === "not_applicable") && (!original.sources.length || original.sources.some(source => source.status !== "collected"))) fail("unread_source");
  }
  const originals = bundle.cv?.files ?? [];
  if (approval.files.length !== originals.length) fail("file_mismatch");
  approval.files.forEach((file, index) => {
    const original = originals[index];
    if (original.ownerId !== bundle.subjectId || ["ownerId", "bucketId", "name", "mimeType"].some(key => file[key as keyof ExportFile] !== original[key as keyof ExportFile])) fail("file_mismatch");
    if (file.status === "included" && (original.status !== "included" || !Buffer.from(file.bytes).equals(Buffer.from(original.bytes)))) fail("file_mismatch");
  });
  return buildPersonalDataExport(bundle.subjectId, { ...metadata, subjectId: bundle.subjectId, categories: approval.categories }, approval.files);
}

export function buildReviewedPersonalDataExport(bundle: ReviewBundle, approval: PersonalDataReviewApproval, metadata: Omit<ExportPackageInput, "subjectId" | "categories">) {
  try { return buildReviewedPersonalDataExportInternal(bundle, approval, metadata); }
  catch (error) {
    if (error instanceof ReviewedExportError || error instanceof ExportPackageError) throw error;
    return fail("invalid_review");
  }
}
