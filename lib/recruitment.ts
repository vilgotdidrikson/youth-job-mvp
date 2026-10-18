"use client";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { RecruitmentRecord, VerifiedExperience } from "@/lib/recruitment-types";

export async function getRecruitmentRecords(): Promise<RecruitmentRecord[]> {
  const { data, error } = await getSupabaseClient().rpc("get_recruitment_records");
  if (error) throw new Error(getSupabaseErrorMessage(error, "Kunde inte hämta rekryteringsstatus."));
  return data ?? [];
}
export class RecruitmentConflictError extends Error {
  constructor() { super("Uppgifterna har ändrats sedan formuläret öppnades. Hämta de senaste uppgifterna och granska dem igen."); this.name = "RecruitmentConflictError"; }
}
export async function recruitmentAction(action: string, matchId: string | null, payload: Record<string, unknown> = {}) {
  const { data, error } = await getSupabaseClient().rpc("recruitment_action", { p_action: action, p_match_id: matchId, p_payload: payload });
  if (error?.code === "40001") throw new RecruitmentConflictError();
  if (error) throw new Error(getSupabaseErrorMessage(error, "Kunde inte spara rekryteringsuppgifterna."));
  window.dispatchEvent(new Event("mnw-navigation-refresh"));
  window.dispatchEvent(new Event("mnw-recruitment-refresh"));
  return data;
}
export async function getVerifiedExperience(youthUserId: string, jobId?: string): Promise<VerifiedExperience[]> {
  const { data, error } = await getSupabaseClient().rpc("get_verified_experience", { p_youth_user_id: youthUserId, p_job_id: jobId ?? null });
  if (error) throw new Error(getSupabaseErrorMessage(error, "Kunde inte läsa verifierad erfarenhet."));
  return data ?? [];
}
