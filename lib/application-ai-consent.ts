import type { SupabaseClient } from "@supabase/supabase-js";

export async function applicationAiAllowed(client: SupabaseClient, jobId: string, youthId: string) {
  try {
    const { data, error } = await client.rpc("application_ai_allowed", { p_job: jobId, p_youth: youthId });
    return !error && data === true;
  } catch {
    return false;
  }
}
