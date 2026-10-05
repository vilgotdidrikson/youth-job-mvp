"use client";

import { getSupabaseClient } from "@/lib/supabase";

export type ActivityStatus = "draft" | "needs_completion" | "submitted" | "unavailable" | "matched" | "in_contact" | "interview" | "hired" | "rejected" | "cancelled";
export interface YouthActivity { jobId: string; title: string; company: string; createdAt: string; status: ActivityStatus; pendingQuestions?: number }
type Row = { job_id: string; created_at: string; status?: string; job_title?: string; company_name?: string; jobs?: { title: string; company_name: string } | { title: string; company_name: string }[] | null };
const matchStatuses: ActivityStatus[] = ["matched", "in_contact", "interview", "hired", "rejected", "cancelled"];

/** Show each job once, with the furthest real stage taking precedence. */
export async function getYouthActivity(userId: string): Promise<YouthActivity[]> {
  const client = getSupabaseClient();
  const results = await Promise.all([
    client.from("youth_application_drafts").select("job_id,created_at,jobs(title,company_name)").eq("youth_user_id", userId).order("created_at", { ascending: false }).limit(50),
    client.from("swipe_actions").select("job_id,created_at,jobs(title,company_name)").eq("youth_user_id", userId).eq("decision", "interested").order("created_at", { ascending: false }).limit(50),
    client.from("application_completions").select("job_id,job_title,company_name,status,created_at").eq("youth_user_id", userId).order("created_at", { ascending: false }).limit(50),
    client.from("matches").select("job_id,status,created_at,jobs(title,company_name)").eq("youth_user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (results.some(result => result.error)) throw new Error("Kunde inte läsa dina ansökningar. Försök igen om en stund.");
  const byJob = new Map<string, YouthActivity>();
  results.forEach((result, source) => {
    for (const row of (result.data ?? []) as unknown as Row[]) {
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      const status: ActivityStatus = source === 0 ? "draft" : source === 1 ? "submitted" : source === 2
        ? row.status === "needs_completion" || row.status === "unavailable" ? row.status : "submitted"
        : matchStatuses.includes(row.status as ActivityStatus) ? row.status as ActivityStatus : "matched";
      byJob.set(row.job_id, { jobId: row.job_id, title: row.job_title || job?.title || "Jobbannons", company: row.company_name || job?.company_name || "Arbetsgivare", createdAt: row.created_at, status });
    }
  });
  const { data: followups, error: followupError } = await client.from("application_followups").select("job_id").eq("youth_user_id", userId).eq("status", "pending");
  if (followupError) throw new Error("Kunde inte läsa dina kompletteringsfrågor.");
  for (const question of followups ?? []) {
    const item = byJob.get(question.job_id);
    if (item) item.pendingQuestions = (item.pendingQuestions ?? 0) + 1;
  }
  return [...byJob.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
