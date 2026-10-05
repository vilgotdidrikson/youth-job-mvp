"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { analyzeApplications } from "@/lib/application-completions";
import { hasCompletedCv } from "@/lib/cv-completion";
import { getSupabaseClient } from "@/lib/supabase";
import { getJobById } from "@/lib/jobs";
import type { JobPost } from "@/lib/types";

export interface YouthFlowState {
  shortOnboardingCompleted: boolean;
  cvCompleted: boolean;
}

export interface ApplicationDraftSubmissionResult {
  sent: number;
  unavailable: number;
  pending: number;
}

export async function getYouthFlowState(userId: string): Promise<YouthFlowState> {
  const { data, error } = await getSupabaseClient()
    .from("youth_profiles")
    .select("short_onboarding_completed, cv_text, cv_generated, cv_uploaded, documents")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { shortOnboardingCompleted: data?.short_onboarding_completed === true, cvCompleted: hasCompletedCv(data) };
}

async function requireYouth() {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);
  if (!user?.id || profile?.role !== "youth") throw new Error("Den här funktionen är bara för ungdomskonton.");
  return user;
}

export async function getSavedJobs(): Promise<JobPost[]> {
  const user = await requireYouth();
  const { data, error } = await getSupabaseClient()
    .from("youth_saved_jobs")
    .select("job_id, jobs(*)")
    .eq("youth_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => row.jobs ? [row.jobs as unknown as JobPost] : []);
}

export async function getSavedJobIds(): Promise<Set<string>> {
  const user = await requireYouth();
  const { data, error } = await getSupabaseClient().from("youth_saved_jobs").select("job_id").eq("youth_user_id", user.id);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String(row.job_id)));
}

export async function setJobSaved(jobId: string, saved: boolean): Promise<void> {
  const user = await requireYouth();
  const supabase = getSupabaseClient();
  const result = saved
    ? await supabase.from("youth_saved_jobs").upsert({ youth_user_id: user.id, job_id: jobId }, { onConflict: "youth_user_id,job_id" })
    : await supabase.from("youth_saved_jobs").delete().eq("youth_user_id", user.id).eq("job_id", jobId);
  if (result.error) throw new Error(result.error.message);
}

export async function saveApplicationDraft(jobId: string): Promise<void> {
  const user = await requireYouth();
  const job = await getJobById(jobId);
  if (!job || job.status !== "active" || job.is_active === false) {
    throw new Error("Den här annonsen tar inte emot nya ansökningar.");
  }
  const { error } = await getSupabaseClient().from("youth_application_drafts").upsert(
    { youth_user_id: user.id, job_id: jobId, updated_at: new Date().toISOString() },
    { onConflict: "youth_user_id,job_id" },
  );
  if (error) {
    const latestJob = await getJobById(jobId).catch(() => null);
    if (latestJob && (latestJob.status !== "active" || latestJob.is_active === false)) {
      throw new Error("Den här annonsen tar inte emot nya ansökningar.");
    }
    throw new Error(error.message);
  }
}

export async function getApplicationDraftCount(): Promise<number> {
  const user = await requireYouth();
  const { count, error } = await getSupabaseClient()
    .from("youth_application_drafts")
    .select("id", { count: "exact", head: true })
    .eq("youth_user_id", user.id);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Atomically submits every available private draft after CV completion. The
 * database also removes drafts for closed listings and creates one consolidated
 * in-app notification for the youth. */
export async function submitApplicationDraftsAfterCv(): Promise<ApplicationDraftSubmissionResult> {
  await requireYouth();
  const { data, error } = await getSupabaseClient().rpc("submit_my_application_drafts");
  if (error) throw new Error(error.message);
  const result = Array.isArray(data) ? data[0] : data;
  const automaticallySent = Number(result?.pending_count ?? 0) > 0 ? await analyzeApplications() : 0;
  return {
    sent: Number(result?.sent_count ?? 0) + automaticallySent,
    unavailable: Number(result?.unavailable_count ?? 0),
    pending: Math.max(0, Number(result?.pending_count ?? 0) - automaticallySent),
  };
}
