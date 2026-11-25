import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "youth-profile-videos";
interface CleanupJob { video_id: string; storage_path: string; lock_token: string }

/** Leases and fixed bucket/path come from service-only RPCs, never HTTP input. */
export async function processVideoCleanup(client: SupabaseClient) {
  const { data, error } = await client.rpc("claim_video_cleanup", { p_limit: 10 });
  if (error) throw new Error("Could not claim cleanup");
  const totals = { claimed: 0, deleted: 0, retry: 0 };
  for (const job of (data ?? []) as CleanupJob[]) {
    totals.claimed++;
    let success = false;
    try {
      // Storage remove is idempotent: an already-absent object is also removed.
      const { error: removeError } = await client.storage.from(BUCKET).remove([job.storage_path]);
      success = !removeError;
    } catch { /* Keep access revoked and retry the object deletion later. */ }
    const { data: finished, error: finishError } = await client.rpc("finish_video_cleanup", {
      p_video_id: job.video_id, p_lock_token: job.lock_token, p_success: success,
    });
    if (finishError || !finished) throw new Error("Could not finish cleanup lease");
    if (success) totals.deleted++; else totals.retry++;
  }
  return totals;
}
