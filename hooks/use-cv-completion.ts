"use client";

import { useEffect, useState } from "react";
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
          .select("cv_text")
          .eq("user_id", userId)
          .maybeSingle();
        if (active) setResult({ userId, completed: Boolean(data?.cv_text?.trim()) });
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
