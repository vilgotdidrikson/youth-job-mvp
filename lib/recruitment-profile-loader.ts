import type { SupabaseClient } from "@supabase/supabase-js";
import { readRecruitmentProfile } from "./recruitment-profile";

// Only select columns supported by youth_profiles in staging.
export const RECRUITMENT_PROFILE_COLUMNS = "recruitment_profile,recruitment_profile_version,languages,certificates,employment_preferences,strengths,cv_structured";

function existingCvFacts(data: Record<string, unknown>) {
  const structured = (data.cv_structured ?? {}) as Record<string, unknown>;
  const names=(value:unknown):string[]=>Array.isArray(value)?value.flatMap(item=>typeof item==='string'?[item]:item&&typeof item==='object'&&'name' in item&&typeof item.name==='string'?[item.name+('level' in item&&typeof item.level==='string'?` – ${item.level}`:'')]:[]):typeof value==='string'?[value]:[];
  return [
    ['Språk',names(Array.isArray(structured.languages)?structured.languages:data.languages)],
    ['Kunskaper',names(Array.isArray(structured.skills)?structured.skills:data.strengths)],
    ['Meriter',names(Array.isArray(structured.certifications)?structured.certifications:data.certificates)],
    ['Tidigare jobbönskemål',names(data.employment_preferences)],
  ].flatMap(([label,items])=>Array.isArray(items)&&items.length?[`${label}: ${[...new Set(items)].join(', ')}`]:[]).join('\n').slice(0,3000);
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
    cvLanguages: Array.isArray(data.cv_structured?.languages) ? data.cv_structured.languages.flatMap((item: {name?:unknown;level?:unknown})=>typeof item?.name==='string'?[{language:item.name,level:typeof item.level==='string'?item.level:''}]:[]) : [],
  };
}
