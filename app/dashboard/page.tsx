"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
          home: "Startsida",
          title: "Din dashboard",
          subtitle: "Mobil vy för att hantera konto och rolldata från Supabase.",
          loading: "Laddar session...",
          noProfile:
            "Ingen profil hittades i tabellen profiles för den inloggade användaren.",
          userId: "Användar-ID",
          email: "E-post",
          role: "Roll",
          youth: "Ungdomskonto aktivt. Du kan söka och följa jobbmatchningar.",
          company: "Företagskonto aktivt. Du kan hantera kandidater och roller.",
          roleChip: "Kontotyp",
          signedIn: "Inloggad",
          account: "Kontoinformation",
          refresh: "Ladda om data",
          logout: "Logga ut",
          logoutBusy: "Loggar ut...",
          authError: "Kunde inte läsa sessionen från Supabase.",
          quickActions: "Snabbval",
          findJobs: "Upptäck jobb",
          chats: "Chattar",
          editProfile: "Redigera profil",
          postJobs: "Skapa annons",
          reviewApplicants: "Granska kandidater",
        }
      : {
          home: "Home",
          title: "Your dashboard",
          subtitle: "Mobile view to manage account and role data loaded from Supabase.",
          loading: "Loading session...",
          noProfile:
            "No profile row was found in the profiles table for the signed-in user.",
          userId: "User ID",
          email: "Email",
          role: "Role",
          youth: "Youth account active. You can browse and track job matches.",
          company: "Company account active. You can manage candidates and roles.",
          roleChip: "Account type",
          signedIn: "Signed in",
          account: "Account details",
          refresh: "Refresh data",
          logout: "Sign out",
          logoutBusy: "Signing out...",
          authError: "Unable to read the Supabase session.",
          quickActions: "Quick actions",
          findJobs: "Discover jobs",
          chats: "Chats",
          editProfile: "Edit profile",
          postJobs: "Post a role",
          reviewApplicants: "Review applicants",
        };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/auth");
  };

  const quickActions =
    profile?.role === "company"
      ? [
          { label: t.postJobs, onClick: () => router.push("/company") },
          { label: t.reviewApplicants, onClick: () => router.push("/company") },
          { label: t.editProfile, onClick: () => router.push("/profile") },
          { label: t.refresh, onClick: () => void refresh() },
        ]
      : [
          { label: t.findJobs, onClick: () => router.push("/swipe") },
          { label: t.editProfile, onClick: () => router.push("/cv-builder") },
          { label: t.refresh, onClick: () => void refresh() },
          { label: t.chats, onClick: () => router.push("/chats") },
        ];

  if (loading) {
    return (
      <main className="mobile-shell flex flex-col justify-center">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="secondary-btn px-3 py-2 text-xs">
            {t.home}
          </Link>
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loading}</div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mobile-shell pb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="secondary-btn px-3 py-2 text-xs">
          {t.home}
        </Link>
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>

      <div className="glass-card space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6887]">
            {t.title}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#132742]">
            {profile?.role === "company" ? "Company" : "Youth"}
          </h1>
          <p className="mt-2 text-sm text-[#3f5f82]">{t.subtitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="chip">{t.signedIn}</span>
            <span className="chip">
              {t.roleChip}: {profile?.role ?? "-"}
            </span>
          </div>
        </div>

        {(error || !profile) && (
          <p className="rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">
            {error || t.noProfile}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">
            {t.quickActions}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="secondary-btn min-h-11 px-3 py-2 text-xs"
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-[#f6fbff] p-4 text-sm text-[#264b73]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.account}</p>
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
          <button
            type="button"
            className="secondary-btn min-h-12 px-4 py-3 text-sm"
            onClick={() => void refresh()}
          >
            {t.refresh}
          </button>
          <button
            type="button"
            className="cta-btn min-h-12 px-4 py-3 text-sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? t.logoutBusy : t.logout}
          </button>
        </div>
      </div>
    </main>
  );
}
