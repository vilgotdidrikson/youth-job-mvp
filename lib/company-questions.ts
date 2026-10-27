"use client";
import { getSupabaseClient } from "@/lib/supabase";
import type { ApplicationFollowup } from "@/lib/application-completions";

export const COMPANY_QUESTION_MAX_LENGTH = 500;
export function normalizedCompanyQuestion(text: string): string { return text.trim(); }
export async function getCompanyQuestions(jobId: string, youthId: string, signal: AbortSignal): Promise<ApplicationFollowup[]> {
  const { data, error } = await getSupabaseClient().from("application_followups").select("*")
    .eq("job_id", jobId).eq("youth_user_id", youthId).eq("question_source", "company").order("created_at").order("id").abortSignal(signal);
  if (error || !Array.isArray(data) || data.some(row => row.job_id !== jobId || row.youth_user_id !== youthId || row.question_source !== "company")) throw new Error("Frågorna kunde inte hämtas.");
  return data as ApplicationFollowup[];
}
export async function sendCompanyQuestion(jobId: string, youthId: string, text: string, requestKey: string): Promise<ApplicationFollowup> {
  const question = normalizedCompanyQuestion(text);
  if (!question || question.length > COMPANY_QUESTION_MAX_LENGTH) throw new Error("Skriv en fråga på högst 500 tecken.");
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Frågan kunde inte bekräftas i tid. Försök igen med samma text.")); }, 15_000); });
  try {
    const { data, error } = await Promise.race([getSupabaseClient().rpc("create_company_application_question", {
      p_job_id: jobId, p_youth_user_id: youthId, p_question: question, p_request_key: requestKey,
    }).abortSignal(controller.signal), expired]);
    if (error) throw new Error(error.code === "PT409" || error.code === "22023" ? error.message : "Frågan kunde inte skickas. Läs om ansökan och försök igen.");
    if (!data || data.job_id !== jobId || data.youth_user_id !== youthId || data.request_key !== requestKey || data.question !== question || data.question_source !== "company") throw new Error("Frågan kunde inte bekräftas. Försök igen med samma text.");
    return data as ApplicationFollowup;
  } finally { clearTimeout(timer!); }
}
