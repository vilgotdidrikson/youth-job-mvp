"use client";

import { useEffect, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { createLatestRead, type ReadState } from "@/lib/latest-read";

export function useAdminAccess() {
  const session = useRequireAuth();
  const userId = session.user?.id;
  const [check, setCheck] = useState<{ userId: string; result: ReadState<boolean> } | null>(null);
  const reader = useRef<ReturnType<typeof createLatestRead<boolean>> | null>(null);
  useEffect(() => {
    if (session.status !== "ready" || !userId) return;
    const current = createLatestRead<boolean>({
      read: async (_, signal) => {
        const { data, error } = await getSupabaseClient().rpc("is_admin_account").abortSignal(signal);
        if (error || typeof data !== "boolean") throw new Error("Adminåtkomst kunde inte kontrolleras.");
        return data;
      },
      update: result => setCheck({ userId, result }),
      errorMessage: "Adminåtkomst kunde inte kontrolleras. Försök igen.",
    });
    reader.current = current; void current.load();
    return () => { current.stop(); reader.current = null; };
  }, [session.status, userId]);
  const result = check?.userId === userId ? check?.result : undefined;
  const adminReady = session.status === "ready" && !!result && result.status !== "loading";
  return { ...session, checkingAdmin: !adminReady, adminReady,
    isAdmin: adminReady && result?.status === "ready" && result.value,
    adminError: result?.status === "error" ? result.message : "",
    retryAdmin: () => void reader.current?.load(),
  };
}
