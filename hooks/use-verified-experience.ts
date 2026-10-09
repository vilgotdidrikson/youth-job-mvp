"use client";
import { useEffect, useState } from "react";
import { getVerifiedExperience } from "@/lib/recruitment";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { VerifiedExperience } from "@/lib/recruitment-types";

export function useVerifiedExperience(youthUserId?: string) {
  const [state, setState] = useState<{ userId: string; items: VerifiedExperience[]; error: string }>({ userId: "", items: [], error: "" });
  useEffect(() => {
    if (!youthUserId) return;
    let active = true;
    const refresh = async () => {
      try { const items = await getVerifiedExperience(youthUserId); if (active) setState({ userId: youthUserId, items, error: "" }); }
      catch (reason) { if (active) setState({ userId: youthUserId, items: [], error: reason instanceof Error ? reason.message : "Kunde inte läsa verifierad erfarenhet." }); }
    };
    void refresh(); const unsubscribe = subscribeVisibleRefresh(refresh);
    window.addEventListener("mnw-recruitment-refresh", refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener("mnw-recruitment-refresh", refresh); };
  }, [youthUserId]);
  return state.userId === youthUserId ? state : { items: [], error: "" };
}
