"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { useSession } from "@/hooks/use-session";

interface AdminOverviewResponse {
  stats: {
    users: number;
    youthProfiles: number;
    companies: number;
    jobs: number;
    activeJobs: number;
    interests: number;
    matches: number;
    unreadNotifications: number;
  };
  monetization: {
    companiesByTier: {
      free: number;
      premium: number;
    };
    freeTierLimitReached: number;
    freePostLimit: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  recentJobs: Array<{
    id: string;
    title: string;
    companyName: string;
    location: string;
    jobType: string;
    createdAt: string;
  }>;
}

export default function AdminPage() {
  const { user, loading, logout } = useSession("admin");
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [error, setError] = useState("");

  const handleLogout = () => {
    if (!window.confirm("Är du säker på att du vill logga ut?")) {
      return;
    }
    logout();
  };

  useEffect(() => {
    if (!user) return;
    const loadOverview = async () => {
      try {
        const response = await apiRequest<AdminOverviewResponse>("/api/admin/overview", {
          userId: user.id,
        });
        setOverview(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load admin data.");
      }
    };
    void loadOverview();
  }, [user]);

  if (loading || !user) {
    return <div className="mobile-shell py-10 text-sm text-[#3e648d]">Laddar...</div>;
  }

  return (
    <div className="mobile-shell space-y-3">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[#4f6a8a]">Admin</p>
          <h1 className="text-2xl font-semibold text-[#132640]">Plattformsöversikt</h1>
        </div>
        <button className="secondary-btn px-3 py-2 text-sm" onClick={handleLogout}>
          Logga ut
        </button>
      </header>

      {error && (
        <p className="rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">{error}</p>
      )}

      {!overview && !error && (
        <div className="glass-card p-4 text-sm text-[#3f6186]">Laddar översikt...</div>
      )}

      {overview && (
        <>
          <section className="grid grid-cols-2 gap-2">
            {[
              { label: "Användare", value: overview.stats.users },
              { label: "Ungdomar", value: overview.stats.youthProfiles },
              { label: "Företag", value: overview.stats.companies },
              { label: "Jobb", value: overview.stats.jobs },
              { label: "Matchningar", value: overview.stats.matches },
              { label: "Intressen", value: overview.stats.interests },
            ].map((item) => (
              <article key={item.label} className="glass-card p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#5d7691]">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[#19345a]">{item.value}</p>
              </article>
            ))}
          </section>

          <section className="glass-card p-4">
            <p className="text-sm font-semibold text-[#17365b]">Intäktsöversikt</p>
            <p className="mt-2 text-sm text-[#2f4f74]">
              Free-företag: {overview.monetization.companiesByTier.free}
            </p>
            <p className="text-sm text-[#2f4f74]">
              Premium-företag: {overview.monetization.companiesByTier.premium}
            </p>
            <p className="text-sm text-[#2f4f74]">
              Free-företag vid postningsgräns ({overview.monetization.freePostLimit} jobb):{" "}
              {overview.monetization.freeTierLimitReached}
            </p>
          </section>

          <section className="glass-card p-4">
            <p className="text-sm font-semibold text-[#17365b]">Senaste användare</p>
            <div className="mt-2 space-y-2">
              {overview.recentUsers.map((entry) => (
                <div key={entry.id} className="rounded-xl bg-[#f4f9ff] px-3 py-2 text-sm text-[#2f4f74]">
                  {entry.email} - {entry.role}
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-4">
            <p className="text-sm font-semibold text-[#17365b]">Senaste jobb</p>
            <div className="mt-2 space-y-2">
              {overview.recentJobs.map((job) => (
                <div key={job.id} className="rounded-xl bg-[#f4f9ff] px-3 py-2 text-sm text-[#2f4f74]">
                  {job.title} - {job.companyName} ({job.location})
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

