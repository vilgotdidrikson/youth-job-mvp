"use client";

import { getSupabaseClient } from "@/lib/supabase";

export interface CompanyMatchProfile {
  company_user_id: string;
  culture_summary: string;
  company_values: string[];
  valued_traits: string[];
  work_environment: string;
  onboarding_support: string;
  employee_offer: string;
  source_notes: string;
  profile_version: number;
}

export type CompanyMatchProfileDraft = Omit<CompanyMatchProfile, "company_user_id" | "profile_version" | "source_notes">;

export async function getCompanyMatchProfile(userId: string): Promise<CompanyMatchProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from("company_match_profiles")
    .select("company_user_id, culture_summary, company_values, valued_traits, work_environment, onboarding_support, employee_offer, source_notes, profile_version")
    .eq("company_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as CompanyMatchProfile | null;
}

export async function saveCompanyMatchProfile(userId: string, draft: CompanyMatchProfileDraft): Promise<CompanyMatchProfile> {
  const { data, error } = await getSupabaseClient()
    .from("company_match_profiles")
    .upsert({ company_user_id: userId, ...draft }, { onConflict: "company_user_id" })
    .select("company_user_id, culture_summary, company_values, valued_traits, work_environment, onboarding_support, employee_offer, source_notes, profile_version")
    .single();
  if (error) throw new Error(error.message);
  return data as CompanyMatchProfile;
}

interface InitialJobMatchProfileInput {
  jobId: string;
  roleSummary: string;
  mustHaves: string[];
  trainableRequirements: string[];
  topTraits: string[];
}

export async function createInitialJobMatchProfile(input: InitialJobMatchProfileInput): Promise<void> {
  const { data: companyProfile, error: companyError } = await getSupabaseClient()
    .from("company_match_profiles")
    .select("profile_version")
    .maybeSingle();
  if (companyError) throw new Error(companyError.message);

  const criteria = [
    ...input.mustHaves.map((label) => ({ label, category: "must_have", weight: 40, required: true })),
    ...input.topTraits.map((label) => ({ label, category: "trait", weight: 35, required: false })),
    ...input.trainableRequirements.map((label) => ({ label, category: "trainable", weight: 15, required: false })),
  ];

  const { error } = await getSupabaseClient().from("job_match_profiles").upsert({
    job_id: input.jobId,
    status: "ready",
    role_summary: input.roleSummary.trim(),
    must_haves: input.mustHaves,
    trainable_requirements: input.trainableRequirements,
    top_traits: input.topTraits.slice(0, 5),
    weighted_criteria: criteria,
    candidate_questions: [],
    inherited_company_version: Number(companyProfile?.profile_version ?? 1),
    ai_generated: false,
  }, { onConflict: "job_id" });
  if (error) throw new Error(error.message);
}
