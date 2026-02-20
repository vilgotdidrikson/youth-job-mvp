"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearSession,
  readSession,
  roleHome,
  SESSION_CHANGED_EVENT,
} from "@/lib/client-session";
import { Role, SessionUser } from "@/lib/types";

interface UseSessionResult {
  user: SessionUser | null;
  loading: boolean;
  logout: () => void;
}

export function useSession(requiredRole?: Role): UseSessionResult {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const syncSession = () => {
      const session = readSession();
      setUser(session);
      setLoading(false);
    };

    syncSession();

    const onChange = () => syncSession();
    window.addEventListener("storage", onChange);
    window.addEventListener(SESSION_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace(roleHome(user.role));
    }
  }, [loading, requiredRole, router, user]);

  const logout = () => {
    clearSession();
    router.replace("/auth");
  };

  return { user, loading, logout };
}
