"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

export type AuthGuardStatus = "checking" | "redirecting" | "error" | "ready";

/**
 * Guards a client page behind an authenticated session.
 * Redirects unauthenticated visitors to /login as soon as the session check
 * resolves, carrying the current URL so login can send them back here.
 */
export function useRequireAuth() {
  const session = useSession();
  const { user, loading, error } = session;
  const router = useRouter();

  useEffect(() => {
    if (loading || user || error) return;
    const target = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    router.replace(`/login?redirect=${encodeURIComponent(target)}`);
  }, [error, loading, router, user]);

  const status: AuthGuardStatus = loading ? "checking" : error ? "error" : !user ? "redirecting" : "ready";

  return { ...session, status };
}
