"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getSupabaseClient } from "@/lib/supabase";

export function useAdminAccess() {
  const session = useRequireAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (session.status !== "ready") return;
    let active = true;
    void getSupabaseClient().rpc("is_admin_account").then(({ data, error }) => {
      if (!active) return;
      setIsAdmin(!error && data === true);
      setCheckingAdmin(false);
    });
    return () => { active = false; };
  }, [session.status, session.user?.id]);

  return {
    ...session,
    checkingAdmin,
    isAdmin,
    adminReady: session.status === "ready" && !checkingAdmin,
  };
}
