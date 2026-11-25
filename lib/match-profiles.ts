"use client";

import { jobMatchProfilePayload, type InitialJobMatchProfileInput } from "./job-match-criteria";
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

export interface JobMatchProfile {
  job_id: string;
  role_summary: string;
  must_haves: string[];
  trainable_requirements: string[];
  top_traits: string[];
  candidate_questions: { id: string; question: string }[];
  profile_version: number;
}

export async function getJobMatchProfile(jobId: string): Promise<JobMatchProfile | null> {
  const { data, error } = await getSupabaseClient().from("job_match_profiles").select("*").eq("job_id", jobId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as JobMatchProfile | null;
}

export async function saveJobMatchProfile(input: InitialJobMatchProfileInput, expectedVersion: number | null): Promise<void> {
  const payload = jobMatchProfilePayload(input);
  const query = expectedVersion === null
    ? getSupabaseClient().from("job_match_profiles").insert(payload)
    : getSupabaseClient().from("job_match_profiles").update(payload).eq("job_id", input.jobId).eq("profile_version", expectedVersion);
  const { data, error } = await query.select("profile_version").maybeSingle();
  if (error) throw new Error(error.code === "23505" ? "Matchprofilen har ändrats. Stäng och öppna redigeraren igen." : error.message);
  if (!data) throw new Error("Matchprofilen har ändrats. Stäng och öppna redigeraren igen innan du sparar.");
}

export async function createInitialJobMatchProfile(input: InitialJobMatchProfileInput): Promise<void> {
  const { data: companyProfile, error: companyError } = await getSupabaseClient()
    .from("company_match_profiles")
    .select("profile_version")
    .maybeSingle();
  if (companyError) throw new Error(companyError.message);

  const { error } = await getSupabaseClient().from("job_match_profiles").upsert({
    ...jobMatchProfilePayload(input),
    inherited_company_version: Number(companyProfile?.profile_version ?? 1),
    ai_generated: input.aiGenerated === true,
  }, { onConflict: "job_id" });
  if (error) throw new Error(error.message);
}
