"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";

// Kept only to support old links. Dashboard is no longer part of either role's flow.
export default function DashboardRedirectPage() {
  const router = useRouter();
  const { profile, loading, status, error: sessionError } = useRequireAuth();

  useEffect(() => {
    if (loading) return;
    if (profile?.role === "company") {
      router.replace("/company?view=swipe");
      return;
    }
    if (profile?.role === "private") {
      router.replace("/private");
      return;
    }
    if (profile?.role === "youth") {
      router.replace("/swipe");
    }
  }, [loading, profile?.role, router]);

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;

  return (
    <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#737373", fontSize: "0.9rem" }}>Hämtar innehåll...</p>
    </main>
  );
}
