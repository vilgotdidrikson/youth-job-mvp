import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectReviewedCvFiles, PersonalDataFileError } from "./personal-data-files";

/** Internal original-file collection, not approval of the CV's contents for
 * disclosure. Reads actual account records instead of accepting caller paths.
 */
export async function collectAccountCvFiles(client: SupabaseClient, subjectId: string, signal?: AbortSignal) {
  if (typeof subjectId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(subjectId)) throw new PersonalDataFileError("invalid_manifest");
  const stop = new AbortController();
  const active = signal ? AbortSignal.any([signal, stop.signal]) : stop.signal;
  const timer = setTimeout(() => stop.abort(), 30_000);
  async function wait<T>(operation: () => PromiseLike<T>): Promise<T> {
    if (active.aborted) throw new PersonalDataFileError("cancelled");
    let cancel: (() => void) | undefined;
    try {
      const result = await Promise.race([operation(), new Promise<never>((_, reject) => {
        cancel = () => reject(new PersonalDataFileError("cancelled"));
        active.addEventListener("abort", cancel, { once: true });
        if (active.aborted) cancel();
      })]);
      if (active.aborted) throw new PersonalDataFileError("cancelled");
      return result;
    } finally { if (cancel) active.removeEventListener("abort", cancel); }
  }
  async function read() {
    const { data, error } = await wait<{ data: { user_id: string; documents: unknown } | null; error: unknown }>(() => client.from("youth_profiles").select("user_id,documents").eq("user_id", subjectId).abortSignal(active).maybeSingle());
    if (error || !data || data.user_id !== subjectId) throw new PersonalDataFileError("identity_changed");
    const documents: unknown = data.documents ?? [];
    if (!Array.isArray(documents) || documents.length > 100 || Reflect.ownKeys(documents).length !== documents.length + 1) throw new PersonalDataFileError("invalid_manifest");
    return Array.from({ length: documents.length }, (_, index) => {
      const item = Object.getOwnPropertyDescriptor(documents, String(index));
      if (!item || !("value" in item)) throw new PersonalDataFileError("invalid_manifest");
      const doc: unknown = item.value;
      if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new PersonalDataFileError("invalid_manifest");
      const fields = Object.getOwnPropertyDescriptors(doc);
      if (!fields.type || !("value" in fields.type) || typeof fields.type.value !== "string" || !fields.url || !("value" in fields.url) || typeof fields.url.value !== "string") throw new PersonalDataFileError("invalid_manifest");
      return { type: fields.type.value as string, url: fields.url.value as string };
    });
  }
  try {
    const { data, error } = await wait(() => client.auth.getUser());
    if (error || !data.user || data.user.is_anonymous || data.user.id !== subjectId) throw new PersonalDataFileError("identity_changed");
    const before = await read();
    const cv = before.filter(doc => doc.type === "cv" || doc.type === "generated_cv");
    const supported = cv.filter(doc => doc.url.toLowerCase().endsWith(".pdf"));
    const references = [...new Set(supported.map(doc => doc.url))].map(path => ({ ownerId: subjectId, path }));
    const result = await collectReviewedCvFiles(client, subjectId, references, active);
    const after = await read();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new PersonalDataFileError("invalid_manifest");
    return { ...result, reviewState: "pending" as const, unsupportedCvCount: cv.length - supported.length };
  } catch (error) {
    if (error instanceof PersonalDataFileError) throw error;
    throw new PersonalDataFileError("invalid_manifest");
  } finally { clearTimeout(timer); stop.abort(); }
}
