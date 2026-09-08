"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { hasCompletedCv } from "@/lib/cv-completion";
import { getSupabaseClient } from "@/lib/supabase";
import { swipeJob } from "@/lib/matching";
import type { JobPost } from "@/lib/types";

export interface YouthFlowState {
  shortOnboardingCompleted: boolean;
  cvCompleted: boolean;
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
  const { error } = await getSupabaseClient().from("youth_application_drafts").upsert(
    { youth_user_id: user.id, job_id: jobId, updated_at: new Date().toISOString() },
    { onConflict: "youth_user_id,job_id" },
  );
  if (error) throw new Error(error.message);
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

/** Sends only the owner's private drafts after their CV has been saved. Failed
 * drafts remain private and can be retried on the next completed-CV visit. */
export async function submitApplicationDraftsAfterCv(): Promise<number> {
  const user = await requireYouth();
  const state = await getYouthFlowState(user.id);
  if (!state.cvCompleted) return 0;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("youth_application_drafts").select("id, job_id").eq("youth_user_id", user.id);
  if (error) throw new Error(error.message);
  let sent = 0;
  for (const draft of data ?? []) {
    try {
      await swipeJob(String(draft.job_id), "interested");
      const { error: deleteError } = await supabase.from("youth_application_drafts").delete().eq("id", draft.id).eq("youth_user_id", user.id);
      if (deleteError) throw deleteError;
      sent += 1;
    } catch (reason) {
      console.error("Could not send saved application draft.", { draftId: draft.id, reason });
    }
  }
  return sent;
}
