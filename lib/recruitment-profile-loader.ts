import type { SupabaseClient } from "@supabase/supabase-js";
import { readRecruitmentProfile } from "./recruitment-profile";

// Only select columns supported by youth_profiles in staging.
export const RECRUITMENT_PROFILE_COLUMNS = "recruitment_profile,recruitment_profile_version,languages,certificates,employment_preferences,strengths,cv_structured";

function existingCvFacts(data: Record<string, unknown>) {
  const structured = (data.cv_structured ?? {}) as Record<string, unknown>;
  return [data.languages, data.certificates, data.employment_preferences, data.strengths, structured.languages, structured.skills]
    .filter(value => value && (!Array.isArray(value) || value.length))
    .map(value => typeof value === "string" ? value : JSON.stringify(value, (field, item) => ["sourceNotes", "evidence", "textBasis"].includes(field) ? undefined : item))
    .join("\n")
    .slice(0, 3000);
}

/** Authenticated, ownership-filtered read shared by initial load and retry. */
export async function loadRecruitmentProfile(client: SupabaseClient, userId: string, signal: AbortSignal) {
  const { data, error } = await client.from("youth_profiles")
    .select(RECRUITMENT_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .abortSignal(signal)
    .single();
  if (error || !data) throw new Error("Profiluppgifterna kunde inte hämtas. Försök igen.");
  return {
    profile: readRecruitmentProfile(data.recruitment_profile),
    version: data.recruitment_profile_version ?? 0,
    cvFacts: existingCvFacts(data),
  };
}
