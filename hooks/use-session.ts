"use client";

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser, getUserProfile, signOut } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { Profile } from "@/lib/types";

interface UseSessionResult {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<UseSessionResult | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const refresh = async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshTask = (async () => {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const nextUser = await getCurrentUser();

        if (!isMountedRef.current) {
          return;
        }

        setUser(nextUser);

        if (!nextUser) {
          setProfile(null);
          return;
        }

        const nextProfile = await getUserProfile(nextUser.id);

        if (!isMountedRef.current) {
          return;
        }

        setProfile(nextProfile);
      } catch (sessionError) {
        console.error("Failed to synchronize the Supabase session in the client.", sessionError);

        if (!isMountedRef.current) {
          return;
        }

        setUser(null);
        setProfile(null);
        setError(getSupabaseErrorMessage(sessionError, "Unable to load the Supabase session."));
      } finally {
        refreshPromiseRef.current = null;

        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    })();

    refreshPromiseRef.current = refreshTask;
    return refreshTask;
  };

  useEffect(() => {
    isMountedRef.current = true;

    try {
      const supabase = getSupabaseClient();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
        void refresh();
      });

      void refresh();

      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }, 5000);

      return () => {
        isMountedRef.current = false;
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error);
      if (isMountedRef.current) {
        setError(error instanceof Error ? error.message : "Failed to initialize Supabase");
        setLoading(false);
      }
      return () => {
        isMountedRef.current = false;
      };
    }
  }, []);

  const logout = async () => {
    try {
      await signOut();

      if (!isMountedRef.current) {
        return;
      }

      setUser(null);
      setProfile(null);
      setError(null);
    } catch (logoutError) {
      console.error("Failed to sign out from Supabase.", logoutError);

      if (!isMountedRef.current) {
        return;
      }

      setError(logoutError instanceof Error ? logoutError.message : "Unable to sign out.");
    }
  };

  return createElement(
    SessionContext.Provider,
    { value: { user, profile, loading, error, refresh, logout } },
    children,
  );
}

export function useSession(): UseSessionResult {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error("useSession must be used inside SessionProvider.");
  }

  return session;
}
