"use client";

import { useEffect, useState } from "react";
import { hasCompletedCv } from "@/lib/cv-completion";
import { getSupabaseClient } from "@/lib/supabase";

export function useCvCompletion(userId?: string, isYouth = false) {
  const [result, setResult] = useState<{ userId: string; completed: boolean } | null>(null);

  useEffect(() => {
    if (!isYouth || !userId || result?.userId === userId) return;

    let active = true;
    void (async () => {
      try {
        const { data } = await getSupabaseClient()
          .from("youth_profiles")
          .select("cv_text, documents, cv_generated, cv_uploaded")
          .eq("user_id", userId)
          .maybeSingle();
        if (active) setResult({ userId, completed: hasCompletedCv(data) });
      } catch {
        if (active) setResult({ userId, completed: false });
      }
    })();

    return () => {
      active = false;
    };
  }, [isYouth, result?.userId, userId]);

  return {
    cvCompleted: !isYouth || Boolean(result?.userId === userId && result?.completed),
    cvLoading: isYouth && (!userId || result?.userId !== userId),
  };
}
