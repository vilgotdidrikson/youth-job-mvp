"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser, getUserProfile, signOut } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface UseSessionResult {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useSession(): UseSessionResult {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  const refresh = async () => {
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
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : "Unable to load the Supabase session.",
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const supabase = getSupabaseClient();
    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
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

  return { user, profile, loading, error, refresh, logout };
}
