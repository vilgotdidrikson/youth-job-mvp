"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { emptyRecruitmentProfile, type RecruitmentProfile } from "@/lib/recruitment-profile";
import { loadRecruitmentProfile } from "@/lib/recruitment-profile-loader";

export function useRecruitmentProfile(userId?: string) {
  const [state, setState] = useState<{ owner: string; profile: RecruitmentProfile; version: number; cvFacts: string; cvLanguages:{language:string;level:string}[]; error: string; loading: boolean }>({ owner: "", profile: emptyRecruitmentProfile(), version: 0, cvFacts: "",cvLanguages:[], error: "", loading: false });
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!userId) return;
    const currentRequest = ++request.current;
    return Promise.resolve()
      .then(() => loadRecruitmentProfile(getSupabaseClient(), userId, AbortSignal.timeout(15000)))
      .then(data => {
      if (request.current === currentRequest) setState({ owner: userId, ...data, error: "", loading: false });
      }).catch(() => {
      // Retain loaded data on transient failures; don't allow a failed read to
      // become an empty successful profile that the editor could overwrite.
      if (request.current === currentRequest) setState(current => ({
        ...(current.owner === userId ? current : { owner: userId, profile: emptyRecruitmentProfile(), version: 0, cvFacts: "",cvLanguages:[] }),
        error: "Profiluppgifterna kunde inte hämtas. Försök igen.", loading: false,
      }));
    });
  }, [userId]);
  const invalidateRequest = useCallback(() => { request.current++; }, []);
  useEffect(() => {
    void load();
    return invalidateRequest;
  }, [load, invalidateRequest]);
  const reload = useCallback(async () => {
    if (!userId) return;
    setState(current => ({ ...current, error: "", loading: true }));
    await load();
  }, [load, userId]);
  const ownsState = state.owner === userId;
  return {
    profile: ownsState ? state.profile : emptyRecruitmentProfile(),
    version: ownsState ? state.version : 0,
    cvFacts: ownsState ? state.cvFacts : "",
    cvLanguages: ownsState ? state.cvLanguages : [],
    error: ownsState ? state.error : "",
    loading: Boolean(userId) && (!ownsState || state.loading),
    reload,
  };
}
