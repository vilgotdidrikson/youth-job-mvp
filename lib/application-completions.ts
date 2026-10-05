"use client";

import { authenticatedHeaders } from "@/lib/api-client";
import { getSupabaseClient } from "@/lib/supabase";

export interface ApplicationQuestion { id: string; question: string; answer_type?: string }
export interface ApplicationCompletion {
  youth_user_id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  profile_version: number;
  questions: ApplicationQuestion[];
  answers: Record<string, string>;
  status: "needs_completion" | "submitted" | "unavailable";
  analysis_source_hash?: string | null;
  created_at: string;
  submitted_at: string | null;
}

export async function submitApplicationAction(action: "prepare" | "answers" | "drafts", values: Record<string, unknown> = {}) {
  const response = await fetch("/api/youth/applications/submit", { method: "POST", headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) }, body: JSON.stringify({ action, ...values }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Kunde inte spara ansökan. Försök igen.");
  return result.application;
}
export async function prepareApplication(jobId: string): Promise<ApplicationCompletion> {
  const application = await submitApplicationAction("prepare", { jobId }) as ApplicationCompletion;
  if (application.status !== "needs_completion") return application;
  await analyzeApplications(jobId);
  const { data: updated } = await getSupabaseClient().from("application_completions").select("*").eq("job_id", jobId).eq("youth_user_id", application.youth_user_id).maybeSingle();
  return (updated ?? application) as ApplicationCompletion;
}

export async function getApplicationCompletions(): Promise<ApplicationCompletion[]> {
  const { data, error } = await getSupabaseClient().from("application_completions")
    .select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApplicationCompletion[];
}

export async function saveApplicationAnswers(jobId: string, answers: Record<string, string>, submit: boolean): Promise<ApplicationCompletion> {
  return await submitApplicationAction("answers", { jobId, answers, submit }) as ApplicationCompletion;
}

export async function analyzeApplications(jobId?: string): Promise<number> {
  try {
    const response = await fetch("/api/youth/applications/analyze", {
      method: "POST", headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
      body: JSON.stringify({ jobId }),
    });
    if (!response.ok) return 0;
    const result = await response.json();
    return Number(result.sent ?? 0);
  } catch { return 0; }
}


export interface ApplicationFollowup {
  id: string; job_id: string; youth_user_id: string; criterion_label: string; question: string;
  job_profile_version: number; status: "pending" | "answered" | "skipped"; answer: string; created_at: string; answered_at: string | null;
}
export async function getApplicationFollowups(jobId?: string): Promise<ApplicationFollowup[]> {
  let query = getSupabaseClient().from("application_followups").select("*").order("created_at");
  if (jobId) query = query.eq("job_id", jobId);
  const { data, error } = await query;
  if (error) throw new Error("Kunde inte läsa kompletteringsfrågorna.");
  return data ?? [];
}
export async function saveApplicationFollowups(jobId: string, answers: Record<string, string>, skipIds: string[] = []) {
  const { error } = await getSupabaseClient().rpc("save_my_application_followup_answers", { p_job_id: jobId, p_answers: answers, p_skip_ids: skipIds });
  if (error) throw new Error("Kunde inte skicka kompletteringen. Dina svar finns kvar här; försök igen.");
  return getApplicationFollowups(jobId);
}
export interface FollowupAnalysisResult { queued?: number; cached?: boolean; processing?: boolean; temporary?: boolean; unavailable?: boolean; stale?: boolean }
const followupRequests = new Map<string, Promise<FollowupAnalysisResult>>();
export function requestApplicationFollowups(jobId: string): Promise<FollowupAnalysisResult> {
  const existing = followupRequests.get(jobId);
  if (existing) return existing;
  const request = (async (): Promise<FollowupAnalysisResult> => {
    try {
      const response = await fetch("/api/youth/applications/followups", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) }, body: JSON.stringify({ jobId }) });
      if (!response.ok) return { temporary: true };
      const result = await response.json() as FollowupAnalysisResult;
      // The server may still be finishing a submission after its response.
      // Poll only the youth's own lease, without issuing additional AI requests.
      if (result.processing) for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const { data, error } = await getSupabaseClient().from("application_completions").select("followup_analysis_started_at").eq("job_id", jobId).maybeSingle();
        if (error) break;
        if (!data?.followup_analysis_started_at) return { ...result, processing: false };
      }
      return result;
    } catch { return { temporary: true }; }
    finally { followupRequests.delete(jobId); }
  })();
  followupRequests.set(jobId, request);
  return request;
}
