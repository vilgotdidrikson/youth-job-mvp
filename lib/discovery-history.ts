"use client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
export type DiscoveryHistoryTable = "youth_job_impressions" | "youth_job_dismissals" | "swipe_actions" | "youth_application_drafts";
export async function readDiscoveryIds(table: DiscoveryHistoryTable, youthId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor = "";
  while (true) {
    let query = getSupabaseClient().from(table).select("job_id").eq("youth_user_id", youthId).order("job_id").limit(200);
    if (cursor) query = query.gt("job_id", cursor);
    const { data, error } = await query;
    if (error) throw new Error("Kunde inte hämta dina tidigare jobbval. Försök igen.");
    const rows = data ?? [];
    for (const row of rows) ids.add(String(row.job_id));
    if (rows.length < 200) return ids;
    cursor = String(rows[rows.length - 1].job_id);
  }
}
async function record(table: "youth_job_impressions" | "youth_job_dismissals", jobId: string) {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);
  if (!user || profile?.role !== "youth") throw new Error("Endast ungdomskonton kan spara jobbval.");
  const { error } = await getSupabaseClient().from(table).upsert({ youth_user_id: user.id, job_id: jobId }, { onConflict: "youth_user_id,job_id", ignoreDuplicates: true });
  if (error) throw new Error("Kunde inte spara jobbvalet.");
}
export const recordJobImpression = (jobId: string) => record("youth_job_impressions", jobId);
export const dismissDiscoveryJob = (jobId: string) => record("youth_job_dismissals", jobId);
