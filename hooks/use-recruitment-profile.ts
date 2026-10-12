"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { emptyRecruitmentProfile, readRecruitmentProfile, type RecruitmentProfile } from "@/lib/recruitment-profile";

function existingCvFacts(data: Record<string,unknown> | null) {
 const structured=(data?.cv_structured ?? {}) as Record<string,unknown>;
 return [data?.languages,data?.certificates,data?.working_time,data?.employment_preferences,data?.strengths,structured.languages,structured.skills].filter(value=>value && (!Array.isArray(value) || value.length)).map(value=>typeof value === "string" ? value : JSON.stringify(value)).join("\n").slice(0,3000);
}

export function useRecruitmentProfile(userId?: string) {
  const [state, setState] = useState<{ owner: string; profile: RecruitmentProfile; version: number; cvFacts: string; error: string }>({ owner: "", profile: emptyRecruitmentProfile(), version: 0, cvFacts: "", error: "" });
  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await getSupabaseClient().from("youth_profiles").select("recruitment_profile,recruitment_profile_version,languages,certificates,working_time,employment_preferences,strengths,cv_structured").eq("user_id", userId).single();
    setState({ owner: userId, profile: readRecruitmentProfile(data?.recruitment_profile), version: data?.recruitment_profile_version ?? 0, cvFacts: existingCvFacts(data), error: error ? "Profiluppgifterna kunde inte hämtas. Försök igen." : "" });
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void getSupabaseClient().from("youth_profiles").select("recruitment_profile,recruitment_profile_version,languages,certificates,working_time,employment_preferences,strengths,cv_structured").eq("user_id", userId).single().then(({ data, error }) => {
      if (active) setState({ owner: userId, profile: readRecruitmentProfile(data?.recruitment_profile), version: data?.recruitment_profile_version ?? 0, cvFacts: existingCvFacts(data), error: error ? "Profiluppgifterna kunde inte hämtas. Försök igen." : "" });
    });
    return () => { active = false; };
  }, [userId]);
  return { ...state, loading: state.owner !== userId, reload: load };
}
