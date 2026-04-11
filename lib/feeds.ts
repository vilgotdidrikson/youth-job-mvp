"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getMyConversations as getChatConversations } from "@/lib/chat";
import { getCompanyJobs as getOwnedCompanyJobs, getJobs } from "@/lib/jobs";
import { getSupabaseClient } from "@/lib/supabase";
import type { CandidateFeedItem, JobInterest, JobPost, YouthProfile } from "@/lib/types";

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function scoreJobForYouth(job: JobPost, profile: YouthProfile | null): number {
  if (!profile) {
    return 0;
  }

  const desiredRoles = normalizeStringArray(profile.desired_roles);
  const desiredLocations = normalizeStringArray(profile.desired_locations);
  const preferences = normalizeStringArray(profile.employment_preferences);
  const haystack = `${job.title} ${job.category ?? ""} ${job.description ?? ""}`.toLowerCase();

  let score = 0;

  for (const role of desiredRoles) {
    if (haystack.includes(role.toLowerCase())) {
      score += 3;
    }
  }

  if (job.city && desiredLocations.some((location) => location.toLowerCase() === job.city?.toLowerCase())) {
    score += 2;
  }

  if (job.job_type && preferences.some((preference) => preference.toLowerCase().includes(job.job_type!.toLowerCase()))) {
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
    supabase.from("job_interests").select("job_id").eq("youth_user_id", user.id),
    supabase.from("youth_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    getJobs(false),
  ]);

  if (interestError) {
    console.error("Failed to fetch existing job interests.", interestError);
    throw new Error(interestError.message);
  }

  if (youthProfileResult.error) {
    console.error("Failed to fetch youth profile for feed ranking.", youthProfileResult.error);
    throw new Error(youthProfileResult.error.message);
  }

  const swipedJobIds = new Set((interestRows ?? []).map((row) => String(row.job_id)));
  const youthProfile = (youthProfileResult.data ?? null) as YouthProfile | null;

  return jobs
    .filter((job) => !swipedJobIds.has(job.id))
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
      .from("job_interests")
      .select("*")
      .eq("job_id", jobId)
      .eq("decision", "interested"),
    supabase
      .from("candidate_reviews")
      .select("youth_user_id")
      .eq("job_id", jobId)
      .eq("company_user_id", user.id),
  ]);

  if (jobResult.error) {
    console.error("Failed to fetch job for candidate feed.", jobResult.error);
    throw new Error(jobResult.error.message);
  }

  if (interestsResult.error) {
    console.error("Failed to fetch interested youth.", interestsResult.error);
    throw new Error(interestsResult.error.message);
  }

  if (reviewsResult.error) {
    console.error("Failed to fetch existing candidate reviews.", reviewsResult.error);
    throw new Error(reviewsResult.error.message);
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
    console.error("Failed to fetch youth profiles for candidate feed.", youthProfileError);
    throw new Error(youthProfileError.message);
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
