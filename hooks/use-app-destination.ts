"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { getYouthFlowState } from "@/lib/youth-job-flow";

/**
 * Resolves where a logged-in visitor's "Go to app" CTA should point, without
 * ever redirecting on its own — marketing pages use this to swap their CTA
 * copy while still letting an authenticated visitor browse marketing pages.
 */
export function useAppDestination() {
  const { user, profile, loading } = useSession();
  const [youthDestination, setYouthDestination] = useState<string | null>(null);
  const isYouth = !loading && !!user && profile?.role === "youth";

  useEffect(() => {
    if (!isYouth || !user) return;
    let active = true;
    void getYouthFlowState(user.id).then((state) => {
      if (active) setYouthDestination(state.shortOnboardingCompleted ? "/swipe" : "/youth/onboarding");
    });
    return () => {
      active = false;
    };
  }, [isYouth, user]);

  const isAuthenticated = !loading && !!user;
  const destination = !isAuthenticated || !profile
    ? null
    : profile.role === "youth"
      ? youthDestination
      : profile.role === "company"
        ? "/company?view=swipe"
        : "/private";

  return { isAuthenticated, destination };
}
