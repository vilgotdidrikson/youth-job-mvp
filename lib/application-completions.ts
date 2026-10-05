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

export async function prepareApplication(jobId: string): Promise<ApplicationCompletion> {
  const { data, error } = await getSupabaseClient().rpc("prepare_my_application", { p_job_id: jobId });
  if (error) throw new Error(error.message);
  const application = data as ApplicationCompletion;
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
  const { data, error } = await getSupabaseClient().rpc("save_my_application_answers", {
    p_job_id: jobId, p_answers: answers, p_submit: submit,
  });
  if (error) throw new Error(error.message);
  return data as ApplicationCompletion;
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
