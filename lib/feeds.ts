"use client";

import { orderDiscoveryJobs, prepareDiscoveryJob, type DiscoveryFilters } from "./job-discovery";
import { readDiscoveryIds } from "./discovery-history";
export type { DiscoveryFilters } from "./job-discovery";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getMyConversations as getChatConversations } from "@/lib/chat";
import { getCompanyJobs as getOwnedCompanyJobs, getDiscoveryJobs } from "@/lib/jobs";
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase-errors";
import { getSupabaseClient } from "@/lib/supabase";
import type { CandidateFeedItem, JobInterest, JobPost, YouthProfile } from "@/lib/types";

export async function getSwipeJobs(filters: DiscoveryFilters = {}): Promise<JobPost[]> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);
  if (!user || profile?.role !== "youth") throw new Error("Swipe jobs is only available for youth accounts.");
  const [swipes, drafts, dismissed, seen, youth, jobs] = await Promise.all([
    readDiscoveryIds("swipe_actions", user.id), readDiscoveryIds("youth_application_drafts", user.id),
    readDiscoveryIds("youth_job_dismissals", user.id), readDiscoveryIds("youth_job_impressions", user.id),
    getSupabaseClient().from("youth_profiles").select("age,city,desired_roles,employment_preferences,recruitment_profile").eq("user_id", user.id).maybeSingle(),
    getDiscoveryJobs(),
  ]);
  if (youth.error) throw new Error("Kunde inte hämta dina jobbönskemål.");
  const youthProfile = youth.data as YouthProfile | null;
  return orderDiscoveryJobs(jobs.filter(job => {
    if (swipes.has(job.id) || drafts.has(job.id) || dismissed.has(job.id)) return false;
    const age = youthProfile?.age;
    return typeof age !== "number" || !((typeof job.min_age === "number" && age < job.min_age) || (typeof job.max_age === "number" && age > job.max_age));
  }).map(job => prepareDiscoveryJob(job, youthProfile, seen.has(job.id))), filters);
}

export async function getCandidatesForJob(jobId: string, options?: { includeReviewed?: boolean; signal?: AbortSignal; ownerId?: string }): Promise<CandidateFeedItem[]> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user || (profile?.role !== "company" && profile?.role !== "private")) {
    throw new Error("Candidate review is only available for task owners.");
  }

  if (options?.ownerId && user.id !== options.ownerId) throw new Error("Kontot har ändrats. Läs om ansökningarna.");
  const signal = options?.signal ?? new AbortController().signal;
  const supabase = getSupabaseClient();
  const [jobResult, interestsResult, reviewsResult] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).abortSignal(signal).maybeSingle(),
    supabase
      .from("swipe_actions")
      .select("*")
      .eq("job_id", jobId)
      .eq("decision", "interested").abortSignal(signal),
    supabase
      .from("company_interest_actions")
      .select("youth_user_id,decision")
      .eq("job_id", jobId)
      .eq("company_user_id", user.id).abortSignal(signal),
  ]);

  if (jobResult.error) {
    logSupabaseError("jobs.select.by_id", jobResult.error, { jobId });
    throw new Error(getSupabaseErrorMessage(jobResult.error, "Unable to fetch job."));
  }

  if (interestsResult.error) {
    logSupabaseError("swipe_actions.select.interested_for_job", interestsResult.error, { jobId });
    throw new Error(getSupabaseErrorMessage(interestsResult.error, "Unable to fetch interested youth."));
  }

  if (reviewsResult.error) {
    logSupabaseError("company_interest_actions.select.reviewed_for_job", reviewsResult.error, {
      jobId,
      companyUserId: user.id,
    });
    throw new Error(getSupabaseErrorMessage(reviewsResult.error, "Unable to fetch company interest actions."));
  }

  const job = jobResult.data as JobPost | null;

  if (!job) {
    return [];
  }

  if (job.company_user_id !== user.id) {
    throw new Error("You can only review candidates for your own jobs.");
  }

  const reviewed = new Map((reviewsResult.data ?? []).map((row) => [String(row.youth_user_id), row.decision]));
  const interestedIds = (interestsResult.data ?? [])
    .map((row) => String((row as JobInterest).youth_user_id))
    .filter((id) => options?.includeReviewed || !reviewed.has(id));

  if (!interestedIds.length) {
    return [];
  }

  const { data: youthProfiles, error: youthProfileError } = await supabase
    .rpc("get_company_candidates", { p_job_id: jobId }).abortSignal(signal);

  if (youthProfileError) {
    logSupabaseError("youth_cv_profiles.select.by_ids", youthProfileError, {
      userCount: interestedIds.length,
    });
    throw new Error(getSupabaseErrorMessage(youthProfileError, "Unable to fetch youth profiles."));
  }

  const { data: completions, error: completionError } = await supabase.from("application_completions").select("*").eq("job_id", jobId).eq("status", "submitted").abortSignal(signal);
  if (completionError) throw new Error("Kunde inte hämta kompletteringssvaren.");
  const completionMap = new Map((completions ?? []).map((item) => [String(item.youth_user_id), item]));
  const profileMap = new Map<string, YouthProfile>();
  for (const row of (youthProfiles ?? []) as YouthProfile[]) {
    profileMap.set(row.user_id, row);
  }

  return interestedIds.filter((id) => profileMap.has(id) && completionMap.has(id)).map((youthUserId) => ({
    youthUserId,
    reviewDecision: reviewed.get(youthUserId) === "interested" ? "interested" : reviewed.get(youthUserId) === "skip" ? "skip" : undefined,
    profile: profileMap.get(youthUserId) ?? null,
    application: completionMap.get(youthUserId) ?? null,
    job,
  }));
}

export async function getCompanyJobs(): Promise<JobPost[]> {
  return getOwnedCompanyJobs(undefined, true);
}

export async function getMyConversations() {
  return getChatConversations();
}
