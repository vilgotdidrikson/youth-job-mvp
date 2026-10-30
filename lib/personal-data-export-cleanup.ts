import type { SupabaseClient } from "@supabase/supabase-js";

export const EXPORT_STORAGE_BUCKET = "personal-data-exports";
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);

/** Service-only worker. Database leases supply all paths, never request bodies.
 * Metadata is finished ONLY after Storage.remove; never DELETE storage.objects.
 * A scheduler must invoke this worker repeatedly; exporting stays disabled until
 * that scheduler and physical Storage deletion have been verified separately.
 */
export async function processPersonalDataExportCleanup(client: SupabaseClient) {
  const { error: reconcileError } = await client.rpc("reconcile_personal_data_export_orphans", { p_limit: 20 });
  if (reconcileError) throw new Error("Export cleanup reconciliation failed");
  const { data, error } = await client.rpc("claim_personal_data_export_cleanup", { p_limit: 10 });
  if (error || !Array.isArray(data) || data.length > 10) throw new Error("Export cleanup claim failed");
  const totals = { claimed: 0, deleted: 0, retry: 0 };
  for (const job of data) {
    if (!job || !uuid(job.id) || !uuid(job.subjectId) || !uuid(job.lockToken) || job.path !== `${job.subjectId}/${job.id}.zip`) throw new Error("Invalid export cleanup job");
    totals.claimed++;
    let removed = false;
    try { const result = await client.storage.from(EXPORT_STORAGE_BUCKET).remove([job.path]); removed = !result.error; }
    catch { /* Retry physical deletion, retaining metadata and denied access. */ }
    const { data: finished, error: finishError } = await client.rpc("finish_personal_data_export_cleanup", { p_export_id: job.id, p_lock_token: job.lockToken, p_success: removed });
    if (finishError || finished !== true) throw new Error("Export cleanup lease could not be finished");
    if (removed) totals.deleted++; else totals.retry++;
  }
  return totals;
}
