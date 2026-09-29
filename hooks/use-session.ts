"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
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
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const updateUser = useCallback((nextUser: User | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
  }, []);

  const updateProfile = useCallback((nextProfile: Profile | null) => {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }, []);

  const refresh = useCallback(async ({
    knownUser,
    showLoading = true,
    preserveStateOnError = false,
  }: {
    knownUser?: User | null;
    showLoading?: boolean;
    preserveStateOnError?: boolean;
  } = {}) => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshTask = (async () => {
      if (isMountedRef.current && showLoading) {
        setLoading(true);
      }
      if (isMountedRef.current) setError(null);

      try {
        const nextUser = knownUser === undefined ? await getCurrentUser() : knownUser;

        if (!isMountedRef.current) {
          return;
        }

        const sameUser = Boolean(nextUser && userRef.current?.id === nextUser.id);
        updateUser(nextUser);

        if (!nextUser) {
          updateProfile(null);
          return;
        }

        // Token refreshes and mobile tab resumes frequently emit auth events.
        // The account role cannot change during those events, so keep the
        // existing profile instead of blanking the whole app and refetching it.
        if (!showLoading && sameUser && profileRef.current) {
          return;
        }

        let nextProfile = await getUserProfile(nextUser.id);
        // The profile row is created immediately after signup. A short retry
        // prevents a newly created company/private account from rendering as youth.
        for (let attempt = 0; !nextProfile && attempt < 2; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 180));
          nextProfile = await getUserProfile(nextUser.id);
        }

        if (!isMountedRef.current) {
          return;
        }

        updateProfile(nextProfile);
      } catch (sessionError) {
        console.error("Failed to synchronize the Supabase session in the client.", sessionError);

        if (!isMountedRef.current) {
          return;
        }

        if (!preserveStateOnError) {
          updateUser(null);
          updateProfile(null);
          setError(getSupabaseErrorMessage(sessionError, "Unable to load the Supabase session."));
        }
      } finally {
        refreshPromiseRef.current = null;

        if (isMountedRef.current && showLoading) {
          setLoading(false);
        }
      }
    })();

    refreshPromiseRef.current = refreshTask;
    return refreshTask;
  }, [updateProfile, updateUser]);

  useEffect(() => {
    isMountedRef.current = true;

    try {
      const supabase = getSupabaseClient();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
        if (event === "SIGNED_OUT") {
          updateUser(null);
          updateProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        const sessionUser = session?.user ?? null;
        const sameKnownUser = Boolean(sessionUser && userRef.current?.id === sessionUser.id);
        if (sessionUser) {
          if (!sameKnownUser) updateProfile(null);
          updateUser(sessionUser);
        }

        // A refreshed token or a repeated SIGNED_IN event when Safari resumes
        // should not make an already rendered app return to its loading gate.
        if (sameKnownUser && profileRef.current && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")) {
          return;
        }

        // Calling another Supabase API while this callback still holds the
        // auth lock can deadlock the client. Run the refresh on the next tick.
        window.setTimeout(() => {
          void refresh({ knownUser: sessionUser, showLoading: false, preserveStateOnError: event !== "INITIAL_SESSION" })
            .finally(() => {
              if (event === "INITIAL_SESSION" && isMountedRef.current) setLoading(false);
            });
        }, 0);
      });

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
  }, [refresh, updateProfile, updateUser]);

  const logout = async () => {
    try {
      await signOut();

      if (!isMountedRef.current) {
        return;
      }

      updateUser(null);
      updateProfile(null);
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
