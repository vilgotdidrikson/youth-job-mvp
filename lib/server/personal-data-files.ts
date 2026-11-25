import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportFile } from "../personal-data-export";

export interface ReviewedCvReference { ownerId: string; path: string }
export const CV_EXPORT_LIMITS = Object.freeze({ files: 10, fileBytes: 8 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, milliseconds: 30_000 });
export class PersonalDataFileError extends Error {
  constructor(public readonly code: "invalid_manifest" | "identity_changed" | "cancelled") {
    super("Dokumentunderlaget kunde inte hämtas säkert.");
  }
}
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;

/** Internal only. References must already be matched to actual owned CV records
 * by a trusted reviewer. An owner-prefixed path alone does NOT prove ownership.
 * Use the requesting user's client, never service_role or arbitrary URL fetching.
 * The result covers this manifest only, not the complete file inventory.
 */
export async function collectReviewedCvFiles(client: SupabaseClient, subjectId: string, references: readonly ReviewedCvReference[], signal?: AbortSignal) {
  const invalid = () => { throw new PersonalDataFileError("invalid_manifest"); };
  if (typeof subjectId !== "string" || !uuid.test(subjectId) || !Array.isArray(references) || references.length > CV_EXPORT_LIMITS.files || Reflect.ownKeys(references).length !== references.length + 1) invalid();
  const seen = new Set<string>();
  const manifest = Array.from({ length: references.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(references, String(index));
    if (!descriptor || !("value" in descriptor)) return invalid();
    const input = descriptor.value;
    if (!input || Object.getPrototypeOf(input) !== Object.prototype) return invalid();
    const fields = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(fields).length !== 2 || !fields.ownerId || !fields.path || !("value" in fields.ownerId) || !("value" in fields.path)) return invalid();
    const ownerId = fields.ownerId.value, path = fields.path.value;
    if (ownerId !== subjectId || typeof path !== "string" || path.length > 512 || /[\x00-\x1f\x7f\\%?#:]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..") || !path.startsWith(subjectId + "/") || seen.has(path)) return invalid();
    seen.add(path);
    return { ownerId: subjectId, path };
  });
  const deadline = Date.now() + CV_EXPORT_LIMITS.milliseconds;
  const check = () => { if (signal?.aborted || Date.now() >= deadline) throw new PersonalDataFileError("cancelled"); };
  async function wait<T>(operation: () => PromiseLike<T>): Promise<T> {
    check();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    try {
      const stopped = new Promise<never>((_, reject) => {
        cancel = () => reject(new PersonalDataFileError("cancelled"));
        timer = setTimeout(cancel, Math.max(1, deadline - Date.now()));
        signal?.addEventListener("abort", cancel, { once: true });
      });
      const result = await Promise.race([operation(), stopped]);
      check(); return result;
    } finally { clearTimeout(timer); if (cancel) signal?.removeEventListener("abort", cancel); }
  }
  async function identity() {
    try {
      const { data, error } = await wait(() => client.auth.getUser());
      if (error || !data.user || data.user.is_anonymous || data.user.id !== subjectId) throw new PersonalDataFileError("identity_changed");
    } catch (error) {
      if (error instanceof PersonalDataFileError) throw error;
      throw new PersonalDataFileError("identity_changed");
    }
  }
  await identity();
  const files: ExportFile[] = [], unavailable: { index: number; reason: "read_failed" | "invalid_pdf" | "size_limit" }[] = [];
  let bytes = 0;
  for (const [index, reference] of manifest.entries()) {
    const metadata = { ownerId: subjectId, bucketId: "youth-documents", name: `dokument-${index + 1}.pdf`, mimeType: "application/pdf" };
    try {
      const { data, error } = await wait(() => client.storage.from("youth-documents").download(reference.path));
      if (error || !(data instanceof Blob)) throw new Error();
      let reason: "invalid_pdf" | "size_limit" | undefined;
      if (data.size > CV_EXPORT_LIMITS.fileBytes || data.size > CV_EXPORT_LIMITS.totalBytes - bytes) reason = "size_limit";
      else if (await wait(() => data.slice(0, 5).text()) !== "%PDF-") reason = "invalid_pdf";
      if (reason) { files.push({ ...metadata, status: "unavailable" }); unavailable.push({ index, reason }); continue; }
      const content = new Uint8Array(await wait(() => data.arrayBuffer()));
      bytes += content.byteLength;
      files.push({ ...metadata, status: "included", bytes: content });
    } catch (error) {
      if (error instanceof PersonalDataFileError) throw error;
      files.push({ ...metadata, status: "unavailable" }); unavailable.push({ index, reason: "read_failed" });
    }
  }
  await identity();
  return { files, unavailable, scope: "reviewed_manifest_only" as const };
}
