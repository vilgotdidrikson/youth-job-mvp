"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { getCurrentUser, getUserProfile, signOut } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage, isNetworkError } from "@/lib/supabase-errors";
import { sessionUserForEvent } from "@/lib/session-events";
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
  const generationRef = useRef(0);

  const invalidateRefresh = useCallback(() => {
    generationRef.current += 1;
    refreshPromiseRef.current = null;
  }, []);

  const updateUser = useCallback((nextUser: User | null, event?: AuthChangeEvent) => {
    const identity = sessionUserForEvent(userRef.current, nextUser, event);
    userRef.current = identity;
    setUser(identity);
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

    const generation = generationRef.current;
    let timedOut = false;
    const current = () => isMountedRef.current && generation === generationRef.current && !timedOut;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error("Kontouppgifterna kunde inte hämtas i tid. Kontrollera anslutningen och försök igen."));
      }, 15_000);
    });

    const refreshTask = (async () => {
      if (isMountedRef.current && showLoading) {
        setLoading(true);
      }
      if (isMountedRef.current) setError(null);

      try {
        await Promise.race([deadline, (async () => {
          const nextUser = knownUser === undefined ? await getCurrentUser() : knownUser;

          if (!current()) {
            return;
          }

          const sameUser = Boolean(nextUser && userRef.current?.id === nextUser.id);
          if (!sameUser) updateProfile(null);
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
          for (let attempt = 0; !nextProfile && attempt < 2 && current(); attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 180));
            if (!current()) return;
            nextProfile = await getUserProfile(nextUser.id);
          }

          if (!current()) {
            return;
          }

          if (!nextProfile) throw new Error("Kontouppgifterna kunde inte hämtas. Försök igen.");
          updateProfile(nextProfile);
        })()]);
      } catch (sessionError) {
        if (!isMountedRef.current || generation !== generationRef.current) {
          return;
        }
        (isNetworkError(sessionError) || timedOut ? console.warn : console.error)("Failed to synchronize the Supabase session in the client.", sessionError);

        if (!preserveStateOnError || !profileRef.current || profileRef.current.id !== userRef.current?.id) {
          updateUser(null);
          updateProfile(null);
          setError(getSupabaseErrorMessage(sessionError, "Unable to load the Supabase session."));
        }
      } finally {
        clearTimeout(timer!);
        if (isMountedRef.current && generation === generationRef.current) {
          setLoading(false);
        }
      }
    })();

    // Cleared in a later microtask, after the assignment below. A refresh without
    // any await (the signed-out initial session) finishes synchronously, and
    // clearing it inside the task left a settled promise here, so every later
    // refresh, including the one after SIGNED_IN, reused it and never loaded
    // the profile.
    const trackedTask = refreshTask.finally(() => {
      if (refreshPromiseRef.current === trackedTask) refreshPromiseRef.current = null;
    });
    refreshPromiseRef.current = trackedTask;
    return trackedTask;
  }, [updateProfile, updateUser]);

  useEffect(() => {
    isMountedRef.current = true;

    try {
      const supabase = getSupabaseClient();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
        if (event === "SIGNED_OUT") {
          invalidateRefresh();
          updateUser(null);
          updateProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        const sessionUser = session?.user ?? null;
        const sameKnownUser = Boolean(sessionUser && userRef.current?.id === sessionUser.id);
        if (sessionUser) {
          if (!sameKnownUser) { invalidateRefresh(); updateProfile(null); }
          updateUser(sessionUser, event);
        }

        // A refreshed token or a repeated SIGNED_IN event when Safari resumes
        // should not make an already rendered app return to its loading gate.
        if (sameKnownUser && profileRef.current && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")) {
          return;
        }

        // Calling another Supabase API while this callback still holds the
        // auth lock can deadlock the client. Run the refresh on the next tick.
        const eventGeneration = generationRef.current;
        window.setTimeout(() => {
          if (!isMountedRef.current || eventGeneration !== generationRef.current) return;
          void refresh({ knownUser: sessionUser, showLoading: false, preserveStateOnError: event !== "INITIAL_SESSION" })
            .finally(() => {
              if (event === "INITIAL_SESSION" && isMountedRef.current && eventGeneration === generationRef.current) setLoading(false);
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
        invalidateRefresh();
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
        invalidateRefresh();
      };
    }
  }, [refresh, updateProfile, updateUser, invalidateRefresh]);

  const logout = async () => {
    // Cancel reads immediately; an old response must not undo a later logout.
    invalidateRefresh();
    const generation = generationRef.current;
    try {
      await signOut();

      if (!isMountedRef.current || generation !== generationRef.current) {
        return;
      }

      updateUser(null);
      updateProfile(null);
      setError(null);
    } catch (logoutError) {
      console.error("Failed to sign out from Supabase.", logoutError);

      if (!isMountedRef.current || generation !== generationRef.current) {
        return;
      }

      setError(logoutError instanceof Error ? logoutError.message : "Unable to sign out.");
      throw logoutError;
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
