"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { emptyRecruitmentProfile, readRecruitmentProfile, type RecruitmentProfile } from "@/lib/recruitment-profile";

export function useRecruitmentProfile(userId?: string) {
  const [state, setState] = useState<{ owner: string; profile: RecruitmentProfile; version: number; error: string }>({ owner: "", profile: emptyRecruitmentProfile(), version: 0, error: "" });
  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await getSupabaseClient().from("youth_profiles").select("recruitment_profile,recruitment_profile_version").eq("user_id", userId).single();
    setState({ owner: userId, profile: readRecruitmentProfile(data?.recruitment_profile), version: data?.recruitment_profile_version ?? 0, error: error ? "Profiluppgifterna kunde inte hämtas. Försök igen." : "" });
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void getSupabaseClient().from("youth_profiles").select("recruitment_profile,recruitment_profile_version").eq("user_id", userId).single().then(({ data, error }) => {
      if (active) setState({ owner: userId, profile: readRecruitmentProfile(data?.recruitment_profile), version: data?.recruitment_profile_version ?? 0, error: error ? "Profiluppgifterna kunde inte hämtas. Försök igen." : "" });
    });
    return () => { active = false; };
  }, [userId]);
  return { ...state, loading: state.owner !== userId, reload: load };
}
