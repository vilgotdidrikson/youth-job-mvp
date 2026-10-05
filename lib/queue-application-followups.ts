import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateAssessment } from "./candidate-assessment";
import { missingApplicationCriteria } from "./application-followup-rules";

export async function queueApplicationFollowups(client: SupabaseClient, jobId: string, youthId: string, version: number, assessment: CandidateAssessment, hash: string, sourceUpdatedAt?: string) {
  const { data: existing } = await client.from("application_followups").select("criterion_label").eq("job_id", jobId).eq("youth_user_id", youthId);
  const { data, error } = await client.rpc("queue_application_followups", {
    p_job_id: jobId, p_youth_user_id: youthId, p_profile_version: version,
    p_labels: missingApplicationCriteria(assessment, (existing ?? []).map((item) => item.criterion_label)), p_input_hash: hash, p_source_updated_at: sourceUpdatedAt ?? null,
  });
  // Supplementation must not make an existing assessment unavailable.
  return error ? { queued: 0, unavailable: true } : { queued: Number(data?.queued ?? 0), pending: Number(data?.pending ?? 0), stale: data?.reason === "source_changed" };
}
