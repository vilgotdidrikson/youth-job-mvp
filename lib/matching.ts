"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getOrCreateConversation } from "@/lib/chat";
import { getJobById } from "@/lib/jobs";
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase-errors";
import { getSupabaseClient } from "@/lib/supabase";
import { hasCompletedCv } from "@/lib/cv-completion";
import type { CandidateReview, JobInterest, MatchRecord, SwipeDecision } from "@/lib/types";

export type MatchStatus = "matched" | "in_contact" | "interview" | "hired" | "rejected" | "cancelled";

async function getAuthenticatedUser(requiredRole?: "youth" | "company" | "private") {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  if (requiredRole && profile?.role !== requiredRole) {
    throw new Error(`This action requires a ${requiredRole} account.`);
  }

  return { user, profile };
}

async function upsertJobInterestRecord(payload: JobInterest) {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("swipe_actions")
    .select("id")
    .eq("youth_user_id", payload.youth_user_id)
    .eq("job_id", payload.job_id)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("swipe_actions.select.existing", existingError, payload);
    throw new Error(getSupabaseErrorMessage(existingError, "Unable to load existing swipe action."));
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("swipe_actions")
      .update({ decision: payload.decision })
      .eq("id", existing.id);

    if (error) {
      logSupabaseError("swipe_actions.update", error, {
        id: existing.id,
        decision: payload.decision,
      });
      throw new Error(getSupabaseErrorMessage(error, "Unable to update swipe action."));
    }

    return;
  }

  const { error } = await supabase.from("swipe_actions").insert(payload);

  if (error) {
    logSupabaseError("swipe_actions.insert", error, payload);
    throw new Error(getSupabaseErrorMessage(error, "Unable to create swipe action."));
  }
}

async function upsertCandidateReviewRecord(payload: CandidateReview) {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("company_interest_actions")
    .select("id")
    .eq("company_user_id", payload.company_user_id)
    .eq("youth_user_id", payload.youth_user_id)
    .eq("job_id", payload.job_id)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("company_interest_actions.select.existing", existingError, payload);
    throw new Error(getSupabaseErrorMessage(existingError, "Unable to load existing company interest action."));
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("company_interest_actions")
      .update({ decision: payload.decision })
      .eq("id", existing.id);

    if (error) {
      logSupabaseError("company_interest_actions.update", error, {
        id: existing.id,
        decision: payload.decision,
      });
      throw new Error(getSupabaseErrorMessage(error, "Unable to update company interest action."));
    }

    return;
  }

  const { error } = await supabase.from("company_interest_actions").insert(payload);

  if (error) {
    logSupabaseError("company_interest_actions.insert", error, payload);
    throw new Error(getSupabaseErrorMessage(error, "Unable to create company interest action."));
  }
}

async function getInterestMatch(jobId: string, youthUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("swipe_actions")
    .select("*")
    .eq("job_id", jobId)
    .eq("youth_user_id", youthUserId)
    .eq("decision", "interested")
    .maybeSingle();

  if (error) {
    logSupabaseError("swipe_actions.select.interested", error, { jobId, youthUserId });
    throw new Error(getSupabaseErrorMessage(error, "Unable to load swipe action."));
  }

  return data;
}

async function getExistingMatch(jobId: string, youthUserId: string, companyUserId: string): Promise<MatchRecord | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("job_id", jobId)
    .eq("youth_user_id", youthUserId)
    .eq("company_user_id", companyUserId)
    .maybeSingle();

  if (error) {
    logSupabaseError("matches.select.existing", error, {
      jobId,
      youthUserId,
      companyUserId,
    });
    throw new Error(getSupabaseErrorMessage(error, "Unable to load existing match."));
  }

  return (data ?? null) as MatchRecord | null;
}

async function ensureMatch(jobId: string, youthUserId: string, companyUserId: string): Promise<MatchRecord> {
  const supabase = getSupabaseClient();
  const existing = await getExistingMatch(jobId, youthUserId, companyUserId);

  if (existing) {
    const conversation = await getOrCreateConversation({
      match_id: existing.id,
      youth_user_id: youthUserId,
      company_user_id: companyUserId,
      job_id: jobId,
    });

    return {
      ...(existing as MatchRecord),
      conversation_id: conversation.id,
    };
  }

  const { data, error } = await supabase
    .from("matches")
    .insert({
      job_id: jobId,
      youth_user_id: youthUserId,
      company_user_id: companyUserId,
      status: "matched",
    })
    .select("*")
    .single();

  if (error) {
    logSupabaseError("matches.insert", error, {
      jobId,
      youthUserId,
      companyUserId,
    });
    throw new Error(getSupabaseErrorMessage(error, "Unable to create match."));
  }

  const match = data as MatchRecord;
  const conversation = await getOrCreateConversation({
    match_id: match.id,
    youth_user_id: youthUserId,
    company_user_id: companyUserId,
    job_id: jobId,
  });

  return {
    ...match,
    conversation_id: conversation.id,
  };
}

export async function swipeJob(jobId: string, direction: SwipeDecision): Promise<MatchRecord | null> {
  const { user } = await getAuthenticatedUser("youth");
  const { data: youthProfile, error: profileError } = await getSupabaseClient()
    .from("youth_profiles")
    .select("cv_text, cv_generated, cv_uploaded, documents")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(getSupabaseErrorMessage(profileError, "Unable to verify CV completion."));
  }

  if (!hasCompletedCv(youthProfile)) {
    throw new Error("Complete your CV before swiping jobs.");
  }

  const job = await getJobById(jobId);

  if (!job) {
    throw new Error("Job not found.");
  }

  await upsertJobInterestRecord({
    youth_user_id: user.id,
    job_id: jobId,
    decision: direction,
    created_at: new Date().toISOString(),
  });

  if (direction !== "interested") {
    return null;
  }

  return getExistingMatch(jobId, user.id, job.company_user_id);
}

export async function reviewCandidate(
  jobId: string,
  youthUserId: string,
  direction: SwipeDecision,
): Promise<MatchRecord | null> {
  const { user, profile } = await getAuthenticatedUser();
  if (profile?.role !== "company" && profile?.role !== "private") {
    throw new Error("This action requires a task owner account.");
  }
  const job = await getJobById(jobId);

  if (!job) {
    throw new Error("Job not found.");
  }

  if (job.company_user_id !== user.id) {
    throw new Error("You can only review candidates for your own jobs.");
  }

  await upsertCandidateReviewRecord({
    company_user_id: user.id,
    youth_user_id: youthUserId,
    job_id: jobId,
    decision: direction,
    created_at: new Date().toISOString(),
  });

  if (direction !== "interested") {
    return null;
  }

  const interest = await getInterestMatch(jobId, youthUserId);
  return interest ? ensureMatch(jobId, youthUserId, user.id) : null;
}

export async function getMyMatches(): Promise<MatchRecord[]> {
  const { user, profile } = await getAuthenticatedUser();
  const supabase = getSupabaseClient();
  const column = profile?.role === "company" || profile?.role === "private" ? "company_user_id" : "youth_user_id";
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq(column, user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("matches.select.mine", error, {
      userId: user.id,
      role: profile?.role ?? "youth",
    });
    throw new Error(getSupabaseErrorMessage(error, "Unable to fetch matches."));
  }

  return (data ?? []) as MatchRecord[];
}

export async function updateMatchStatus(matchId: string, status: MatchStatus): Promise<MatchRecord> {
  const { user, profile } = await getAuthenticatedUser();
  if (profile?.role !== "company" && profile?.role !== "private") {
    throw new Error("Only task owners can update candidate status.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", matchId)
    .eq("company_user_id", user.id)
    .select("*")
    .single();
  if (error || !data) {
    logSupabaseError("matches.update.status", error ?? new Error("No match returned."), { matchId, status });
    throw new Error(getSupabaseErrorMessage(error, "Unable to update candidate status."));
  }
  return data as MatchRecord;
}
