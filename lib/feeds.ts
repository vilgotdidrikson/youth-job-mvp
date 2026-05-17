"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getMyConversations as getChatConversations } from "@/lib/chat";
import { getCompanyJobs as getOwnedCompanyJobs, getJobs } from "@/lib/jobs";
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase-errors";
import { getSupabaseClient } from "@/lib/supabase";
import type { CandidateFeedItem, JobInterest, JobPost, YouthProfile } from "@/lib/types";

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function scoreJobForYouth(job: JobPost, profile: YouthProfile | null): number {
  if (!profile) {
    return 0;
  }

  const desiredRoles = normalizeStringArray(profile.target_roles ?? profile.desired_roles);
  const preferences = normalizeStringArray(profile.working_time ?? profile.employment_preferences);
  const haystack = [
    job.title,
    job.description,
    job.employment_type,
    job.category,
    job.requirements,
    job.benefits,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;

  for (const role of desiredRoles) {
    if (haystack.includes(role.toLowerCase())) {
      score += 3;
    }
  }

  if (profile.city && profile.city.toLowerCase() === job.city.toLowerCase()) {
    score += 2;
  }

  const employmentTypes = job.employment_type
    .toLowerCase()
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (employmentTypes.some((empType) => preferences.some((p) => p.toLowerCase().includes(empType)))) {
    score += 1;
  }

  return score;
}

export async function getSwipeJobs(): Promise<JobPost[]> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user || profile?.role !== "youth") {
    throw new Error("Swipe jobs is only available for youth accounts.");
  }

  const supabase = getSupabaseClient();
  const [{ data: interestRows, error: interestError }, youthProfileResult, jobs] = await Promise.all([
    supabase.from("swipe_actions").select("job_id").eq("youth_user_id", user.id),
    supabase.from("youth_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    getJobs(false),
  ]);

  if (interestError) {
    logSupabaseError("swipe_actions.select.mine", interestError, { userId: user.id });
    throw new Error(getSupabaseErrorMessage(interestError, "Unable to fetch existing swipe actions."));
  }

  if (youthProfileResult.error) {
    logSupabaseError("youth_cv_profiles.select.mine", youthProfileResult.error, { userId: user.id });
    throw new Error(getSupabaseErrorMessage(youthProfileResult.error, "Unable to fetch youth profile."));
  }

  const swipedJobIds = new Set((interestRows ?? []).map((row) => String(row.job_id)));
  const youthProfile = (youthProfileResult.data ?? null) as YouthProfile | null;

  return jobs
    .filter((job) => {
      if (swipedJobIds.has(job.id)) return false;
      const age = youthProfile?.age;
      if (typeof age === "number") {
        if (typeof job.min_age === "number" && age < job.min_age) return false;
        if (typeof job.max_age === "number" && age > job.max_age) return false;
      }
      return true;
    })
    .sort((a, b) => scoreJobForYouth(b, youthProfile) - scoreJobForYouth(a, youthProfile));
}

export async function getCandidatesForJob(jobId: string): Promise<CandidateFeedItem[]> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user || profile?.role !== "company") {
    throw new Error("Candidate review is only available for company accounts.");
  }

  const supabase = getSupabaseClient();
  const [jobResult, interestsResult, reviewsResult] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
    supabase
      .from("swipe_actions")
      .select("*")
      .eq("job_id", jobId)
      .eq("decision", "interested"),
    supabase
      .from("company_interest_actions")
      .select("youth_user_id")
      .eq("job_id", jobId)
      .eq("company_user_id", user.id),
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

  const reviewedIds = new Set((reviewsResult.data ?? []).map((row) => String(row.youth_user_id)));
  const interestedIds = (interestsResult.data ?? [])
    .map((row) => String((row as JobInterest).youth_user_id))
    .filter((id) => !reviewedIds.has(id));

  if (!interestedIds.length) {
    return [];
  }

  const { data: youthProfiles, error: youthProfileError } = await supabase
    .from("youth_profiles")
    .select("*")
    .in("user_id", interestedIds);

  if (youthProfileError) {
    logSupabaseError("youth_cv_profiles.select.by_ids", youthProfileError, {
      userCount: interestedIds.length,
    });
    throw new Error(getSupabaseErrorMessage(youthProfileError, "Unable to fetch youth profiles."));
  }

  const profileMap = new Map<string, YouthProfile>();
  for (const row of (youthProfiles ?? []) as YouthProfile[]) {
    profileMap.set(row.user_id, row);
  }

  return interestedIds.map((youthUserId) => ({
    youthUserId,
    profile: profileMap.get(youthUserId) ?? null,
    job,
  }));
}

export async function getCompanyJobs(): Promise<JobPost[]> {
  return getOwnedCompanyJobs(undefined, true);
}

export async function getMyConversations() {
  return getChatConversations();
}
