"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getOrCreateConversation } from "@/lib/chat";
import { getJobById } from "@/lib/jobs";
import { getSupabaseClient } from "@/lib/supabase";
import type { CandidateReview, JobInterest, MatchRecord, SwipeDecision } from "@/lib/types";

async function getAuthenticatedUser(requiredRole?: "youth" | "company") {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user) {
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
    .from("job_interests")
    .select("id")
    .eq("youth_user_id", payload.youth_user_id)
    .eq("job_id", payload.job_id)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to query existing job interest.", existingError);
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("job_interests")
      .update({ decision: payload.decision, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) {
      console.error("Failed to update job interest.", error);
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase.from("job_interests").insert(payload);

  if (error) {
    console.error("Failed to create job interest.", error);
    throw new Error(error.message);
  }
}

async function upsertCandidateReviewRecord(payload: CandidateReview) {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("candidate_reviews")
    .select("id")
    .eq("company_user_id", payload.company_user_id)
    .eq("youth_user_id", payload.youth_user_id)
    .eq("job_id", payload.job_id)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to query existing candidate review.", existingError);
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("candidate_reviews")
      .update({ decision: payload.decision, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) {
      console.error("Failed to update candidate review.", error);
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase.from("candidate_reviews").insert(payload);

  if (error) {
    console.error("Failed to create candidate review.", error);
    throw new Error(error.message);
  }
}

async function getInterestMatch(jobId: string, youthUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("job_interests")
    .select("*")
    .eq("job_id", jobId)
    .eq("youth_user_id", youthUserId)
    .eq("decision", "interested")
    .maybeSingle();

  if (error) {
    console.error("Failed to load job interest.", error);
    throw new Error(error.message);
  }

  return data;
}

async function getReviewMatch(jobId: string, youthUserId: string, companyUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("candidate_reviews")
    .select("*")
    .eq("job_id", jobId)
    .eq("youth_user_id", youthUserId)
    .eq("company_user_id", companyUserId)
    .eq("decision", "interested")
    .maybeSingle();

  if (error) {
    console.error("Failed to load candidate review.", error);
    throw new Error(error.message);
  }

  return data;
}

async function ensureMatch(jobId: string, youthUserId: string, companyUserId: string): Promise<MatchRecord> {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("matches")
    .select("*")
    .eq("job_id", jobId)
    .eq("youth_user_id", youthUserId)
    .eq("company_user_id", companyUserId)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to query existing match.", existingError);
    throw new Error(existingError.message);
  }

  const conversation = await getOrCreateConversation(youthUserId, companyUserId);

  if (existing) {
    if (!existing.conversation_id) {
      const { error } = await supabase
        .from("matches")
        .update({ conversation_id: conversation.id, status: "matched" })
        .eq("id", existing.id);

      if (error) {
        console.error("Failed to update existing match.", error);
        throw new Error(error.message);
      }
    }

    return {
      ...(existing as MatchRecord),
      conversation_id: existing.conversation_id ?? conversation.id,
    };
  }

  const { data, error } = await supabase
    .from("matches")
    .insert({
      job_id: jobId,
      youth_user_id: youthUserId,
      company_user_id: companyUserId,
      conversation_id: conversation.id,
      status: "matched",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create match.", error);
    throw new Error(error.message);
  }

  return data as MatchRecord;
}

export async function swipeJob(jobId: string, direction: SwipeDecision): Promise<MatchRecord | null> {
  const { user } = await getAuthenticatedUser("youth");
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

  const review = await getReviewMatch(jobId, user.id, job.company_user_id);
  return review ? ensureMatch(jobId, user.id, job.company_user_id) : null;
}

export async function reviewCandidate(
  jobId: string,
  youthUserId: string,
  direction: SwipeDecision,
): Promise<MatchRecord | null> {
  const { user } = await getAuthenticatedUser("company");
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
  const column = profile?.role === "company" ? "company_user_id" : "youth_user_id";
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq(column, user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch matches.", error);
    throw new Error(error.message);
  }

  return (data ?? []) as MatchRecord[];
}
