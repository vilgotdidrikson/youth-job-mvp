"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

// Kept only to support old links. Dashboard is no longer part of either role's flow.
export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
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
  }, [loading, profile?.role, router, user]);

  return (
    <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p>
    </main>
  );
}
