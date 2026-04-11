"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";

export default function DashboardPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { user, profile, loading, error, logout, refresh } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const t =
    language === "sv"
      ? {
          title: "Supabase-session",
          subtitle: "Denna vy laddar bara användaren och rollen från Supabase.",
          loading: "Laddar session...",
          noProfile:
            "Ingen profil hittades i tabellen profiles för den inloggade användaren.",
          userId: "Användar-ID",
          email: "E-post",
          role: "Roll",
          youth: "Ungdomskonto anslutet till Supabase.",
          company: "Företagskonto anslutet till Supabase.",
          refresh: "Ladda om data",
          logout: "Logga ut",
          logoutBusy: "Loggar ut...",
          authError: "Kunde inte läsa sessionen från Supabase.",
        }
      : {
          title: "Supabase session",
          subtitle: "This screen only loads the authenticated user and role from Supabase.",
          loading: "Loading session...",
          noProfile:
            "No profile row was found in the profiles table for the signed-in user.",
          userId: "User ID",
          email: "Email",
          role: "Role",
          youth: "Youth account connected to Supabase.",
          company: "Company account connected to Supabase.",
          refresh: "Refresh data",
          logout: "Sign out",
          logoutBusy: "Signing out...",
          authError: "Unable to read the Supabase session.",
        };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/auth");
  };

  if (loading) {
    return (
      <div className="mobile-shell flex flex-col justify-center">
        <div className="mb-3 flex justify-end">
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loading}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mobile-shell flex flex-col justify-center">
      <div className="mb-3 flex justify-end">
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>

      <div className="glass-card space-y-4 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6887]">
            {t.title}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#132742]">
            {profile?.role === "company" ? "Company" : "Youth"}
          </h1>
          <p className="mt-2 text-sm text-[#3f5f82]">{t.subtitle}</p>
        </div>

        {(error || !profile) && (
          <p className="rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">
            {error || t.noProfile}
          </p>
        )}

        <div className="space-y-3 rounded-2xl bg-[#f6fbff] p-4 text-sm text-[#264b73]">
          <p>
            <span className="font-semibold">{t.email}:</span> {user.email}
          </p>
          <p className="break-all">
            <span className="font-semibold">{t.userId}:</span> {user.id}
          </p>
          <p>
            <span className="font-semibold">{t.role}:</span> {profile?.role ?? t.authError}
          </p>
        </div>

        {profile?.role === "youth" && (
          <p className="rounded-2xl bg-[#ebf7f2] px-4 py-3 text-sm text-[#1d5b4e]">{t.youth}</p>
        )}
        {profile?.role === "company" && (
          <p className="rounded-2xl bg-[#eef3ff] px-4 py-3 text-sm text-[#274c84]">
            {t.company}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="secondary-btn px-4 py-3 text-sm" onClick={() => void refresh()}>
            {t.refresh}
          </button>
          <button
            type="button"
            className="cta-btn px-4 py-3 text-sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? t.logoutBusy : t.logout}
          </button>
        </div>
      </div>
    </div>
  );
}
