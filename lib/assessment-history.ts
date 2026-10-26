import type { SupabaseClient } from "@supabase/supabase-js";
import type { CriterionStatus } from "./candidate-assessment";

export interface AssessmentHistoryEntry {
  id: string;
  version: number;
  createdAt: string;
  explanation: string;
  criteria: { id: string; label: string; status: CriterionStatus; evidence: string | null }[];
}

/** Keep the query scoped as before; RLS remains the authorization boundary. */
export async function readAssessmentHistory(client: Pick<SupabaseClient, "from">, jobId: string, youthId: string, signal: AbortSignal): Promise<AssessmentHistoryEntry[]> {
  const { data, error } = await client.from("candidate_assessments")
    .select("id,job_id,youth_user_id,job_profile_version,result,created_at")
    .eq("job_id", jobId).eq("youth_user_id", youthId)
    .order("created_at", { ascending: false }).limit(20).abortSignal(signal);
  if (error || !Array.isArray(data)) throw new Error("Historiken kunde inte läsas.");
  return data.map((row) => {
    if (!row || row.job_id !== jobId || row.youth_user_id !== youthId || typeof row.id !== "string"
      || !Number.isInteger(row.job_profile_version) || typeof row.created_at !== "string"
      || !Number.isFinite(Date.parse(row.created_at)) || typeof row.result?.explanation !== "string"
      || !Array.isArray(row.result?.criteria)) throw new Error("Historiken saknade giltigt underlag.");
    return {
      id: row.id, version: row.job_profile_version, createdAt: row.created_at, explanation: row.result.explanation,
      criteria: row.result.criteria.map((item: Record<string, unknown>) => {
        if (!item || typeof item.id !== "string" || typeof item.label !== "string"
          || typeof item.status !== "string" || !["fulfilled", "unfulfilled", "unknown"].includes(item.status)
          || !(item.evidence == null || typeof item.evidence === "string")) throw new Error("Historiken saknade giltigt underlag.");
        return { id: item.id, label: item.label, status: item.status as CriterionStatus, evidence: typeof item.evidence === "string" ? item.evidence : null };
      }),
    };
  });
}
