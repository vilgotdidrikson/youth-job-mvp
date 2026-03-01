"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { useSession } from "@/hooks/use-session";

type CompanyTab = "jobs" | "candidates" | "matches" | "alerts" | "settings";

interface CompanyProfileResponse {
  profile: {
    companyName: string;
    city: string;
    description: string;
    tier: "free" | "premium";
  };
}

interface CompanyJobsResponse {
  jobs: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    jobType: string;
    active: boolean;
    interestedCount: number;
  }>;
  tier: "free" | "premium";
  freePostLimit: number;
}

interface CandidateResponse {
  jobTitle: string;
  candidates: Array<{
    youthId: string;
    name: string;
    age: number | null;
    city: string;
    skills: string[];
    availability: string;
    premiumBadge: boolean;
    cvSummary: string;
    cvContent: string;
    email: string;
    decision: "accept" | "reject" | null;
  }>;
}

interface MatchesResponse {
  matches: Array<{
    id: string;
    jobTitle: string;
    location: string;
    candidateName: string;
    candidateCity: string;
    candidateAvailability: string;
    candidateSkills: string[];
    candidateCvSummary: string;
    createdAt: string;
  }>;
}

interface NotificationsResponse {
  notifications: Array<{
    id: string;
    message: string;
    read: boolean;
    createdAt: string;
  }>;
  unreadCount: number;
}

export default function CompanyPage() {
  const { user, loading, logout } = useSession("company");
  const [tab, setTab] = useState<CompanyTab>("jobs");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const [profile, setProfile] = useState<CompanyProfileResponse["profile"] | null>(
    null,
  );
  const [jobs, setJobs] = useState<CompanyJobsResponse["jobs"]>([]);
  const [tier, setTier] = useState<"free" | "premium">("free");
  const [freePostLimit, setFreePostLimit] = useState(3);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [candidates, setCandidates] = useState<CandidateResponse["candidates"]>([]);
  const [candidateJobTitle, setCandidateJobTitle] = useState("");
  const [matches, setMatches] = useState<MatchesResponse["matches"]>([]);
  const [notifications, setNotifications] = useState<
    NotificationsResponse["notifications"]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobType, setJobType] = useState<"part-time" | "temporary" | "summer">(
    "part-time",
  );
  const [savingJob, setSavingJob] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const [profileResponse, jobsResponse, matchesResponse, notificationsResponse] =
        await Promise.all([
          apiRequest<CompanyProfileResponse>("/api/company/profile", {
            userId: user.id,
          }),
          apiRequest<CompanyJobsResponse>("/api/company/jobs", {
            userId: user.id,
          }),
          apiRequest<MatchesResponse>("/api/matches", { userId: user.id }),
          apiRequest<NotificationsResponse>("/api/notifications", {
            userId: user.id,
          }),
        ]);

      setProfile(profileResponse.profile);
      setJobs(jobsResponse.jobs);
      setTier(jobsResponse.tier);
      setFreePostLimit(jobsResponse.freePostLimit);
      setMatches(matchesResponse.matches);
      setNotifications(notificationsResponse.notifications);
      setUnreadCount(notificationsResponse.unreadCount);

      if (!selectedJobId && jobsResponse.jobs.length > 0) {
        setSelectedJobId(jobsResponse.jobs[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda företagsdata.");
    } finally {
      setBusy(false);
    }
  }, [selectedJobId, user]);

  const loadCandidates = useCallback(async () => {
    if (!user || !selectedJobId) {
      setCandidates([]);
      return;
    }

    try {
      const response = await apiRequest<CandidateResponse>(
        `/api/company/jobs/${selectedJobId}/candidates`,
        {
          userId: user.id,
        },
      );
      setCandidates(response.candidates);
      setCandidateJobTitle(response.jobTitle);
    } catch (candidateError) {
      setError(
        candidateError instanceof Error
          ? candidateError.message
          : "Kunde inte ladda kandidater.",
      );
    }
  }, [selectedJobId, user]);

  useEffect(() => {
    if (user) {
      void loadDashboard();
    }
  }, [loadDashboard, user]);

  useEffect(() => {
    if (user && selectedJobId) {
      void loadCandidates();
    }
  }, [loadCandidates, selectedJobId, user]);

  const handleCreateJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSavingJob(true);
    setError("");
    try {
      await apiRequest("/api/company/jobs", {
        method: "POST",
        userId: user.id,
        body: JSON.stringify({
          title: jobTitle,
          description: jobDescription,
          location: jobLocation,
          jobType,
        }),
      });
      setJobTitle("");
      setJobDescription("");
      setJobLocation("");
      setJobType("part-time");
      await loadDashboard();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Kunde inte skapa jobbet.");
    } finally {
      setSavingJob(false);
    }
  };

  const handleCandidateDecision = async (
    youthId: string,
    decision: "accept" | "reject",
  ) => {
    if (!user || !selectedJobId) return;
    try {
      await apiRequest(
        `/api/company/jobs/${selectedJobId}/candidates/${youthId}/decision`,
        {
          method: "POST",
          userId: user.id,
          body: JSON.stringify({ decision }),
        },
      );
      await Promise.all([loadCandidates(), loadDashboard()]);
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "Kunde inte uppdatera kandidaten.",
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await apiRequest("/api/notifications", {
      method: "PATCH",
      userId: user.id,
      body: JSON.stringify({ markAllRead: true }),
    });
    await loadDashboard();
  };

  const handleSaveCompanyProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !profile) return;
    try {
      await apiRequest("/api/company/profile", {
        method: "PATCH",
        userId: user.id,
        body: JSON.stringify(profile),
      });
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara inställningarna.");
    }
  };

  const handleTierToggle = async () => {
    if (!user || !profile) return;
    const nextTier = profile.tier === "free" ? "premium" : "free";
    try {
      await apiRequest("/api/company/profile", {
        method: "PATCH",
        userId: user.id,
        body: JSON.stringify({ tier: nextTier }),
      });
      await loadDashboard();
    } catch (tierError) {
      setError(
        tierError instanceof Error ? tierError.message : "Kunde inte ändra nivå.",
      );
    }
  };

  const handleLogout = () => {
    if (!window.confirm("Är du säker på att du vill logga ut?")) {
      return;
    }
    logout();
  };

  if (loading || !user) {
    return <div className="mobile-shell py-10 text-sm text-[#3e648d]">Laddar...</div>;
  }

  if (busy && !profile) {
    return <div className="mobile-shell py-10 text-sm text-[#3e648d]">Laddar dashboard...</div>;
  }

  return (
    <div className="mobile-shell">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[#4f6a8a]">
            Företagsläge
          </p>
          <h1 className="text-2xl font-semibold text-[#132640]">
            {profile?.companyName || "Företagspanel"}
          </h1>
          <p className="text-sm text-[#3d5d82]">{profile?.city || "Sverige"}</p>
        </div>
      </header>

      {error && (
        <p className="mb-3 rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">
          {error}
        </p>
      )}

      {tab === "jobs" && (
        <section className="tab-fade space-y-3">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#2f5074]">
                Nivå: <strong>{tier}</strong>
              </p>
              <p className="text-xs text-[#4f6f92]">Gratisgräns: {freePostLimit} aktiva jobb</p>
            </div>
          </div>

          <form className="glass-card space-y-3 p-4" onSubmit={handleCreateJob}>
            <p className="text-sm font-semibold text-[#17365b]">Skapa jobbannons</p>
            <input
              className="w-full rounded-2xl border border-[#cce0ff] px-4 py-3 text-sm outline-none"
              placeholder="Jobbtitel"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              required
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-[#cce0ff] p-3 text-sm outline-none"
              placeholder="Jobbbeskrivning"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              required
            />
            <input
              className="w-full rounded-2xl border border-[#cce0ff] px-4 py-3 text-sm outline-none"
              placeholder="Plats"
              value={jobLocation}
              onChange={(event) => setJobLocation(event.target.value)}
              required
            />
            <select
              className="w-full rounded-2xl border border-[#cce0ff] px-4 py-3 text-sm outline-none"
              value={jobType}
              onChange={(event) =>
                setJobType(event.target.value as "part-time" | "temporary" | "summer")
              }
            >
              <option value="part-time">Deltid</option>
              <option value="temporary">Tillfälligt</option>
              <option value="summer">Sommar</option>
            </select>
            <button className="cta-btn w-full px-4 py-3 text-sm" disabled={savingJob}>
              {savingJob ? "Skapar..." : "Publicera jobb"}
            </button>
          </form>

          <div className="space-y-3">
            {jobs.map((job) => (
              <article key={job.id} className="glass-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#122744]">{job.title}</h2>
                  <span className="chip">{job.jobType}</span>
                </div>
                <p className="mt-1 text-sm text-[#3f6288]">{job.location}</p>
                <p className="mt-2 text-sm text-[#2b4769]">{job.description}</p>
                <p className="mt-3 text-xs text-[#48698f]">
                  Intresserade kandidater: {job.interestedCount}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "candidates" && (
        <section className="tab-fade space-y-3">
          <div className="glass-card p-4">
            <label className="text-xs uppercase tracking-[0.15em] text-[#4f6b89]">
              Välj jobb
            </label>
            <select
              className="mt-2 w-full rounded-2xl border border-[#cce0ff] px-4 py-3 text-sm outline-none"
              value={selectedJobId}
              onChange={(event) => setSelectedJobId(event.target.value)}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>

          {candidateJobTitle && (
            <div className="glass-card p-4 text-sm text-[#2e4f75]">
              Visar kandidater för <strong>{candidateJobTitle}</strong>
            </div>
          )}

          {candidates.length === 0 && (
            <div className="glass-card p-4 text-sm text-[#3f6186]">
              Inga intresserade kandidater ännu.
            </div>
          )}

          {candidates.map((candidate) => (
            <article key={candidate.youthId} className="glass-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-[#132743]">{candidate.name}</h3>
                {candidate.premiumBadge && <span className="chip">Premium badge</span>}
              </div>
              <p className="text-sm text-[#3e5f84]">
                {candidate.age ? `${candidate.age} år` : "Ålder saknas"} - {candidate.city}
              </p>
              <p className="mt-2 text-sm text-[#2f4f74]">{candidate.availability}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="chip">
                    {skill}
                  </span>
                ))}
              </div>
              {candidate.cvSummary && (
                <p className="mt-3 rounded-xl bg-[#f5f9ff] p-3 text-sm text-[#2f5074]">
                  {candidate.cvSummary}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="secondary-btn px-3 py-2 text-sm"
                  onClick={() => handleCandidateDecision(candidate.youthId, "reject")}
                >
                  Avslå
                </button>
                <button
                  className="cta-btn px-3 py-2 text-sm"
                  onClick={() => handleCandidateDecision(candidate.youthId, "accept")}
                >
                  Acceptera
                </button>
              </div>
              {candidate.decision && (
                <p className="mt-2 text-xs text-[#567493]">Beslut: {candidate.decision}</p>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === "matches" && (
        <section className="tab-fade space-y-3">
          {matches.length === 0 && (
            <div className="glass-card p-4 text-sm text-[#3f6186]">
              Inga matchningar ännu. Acceptera intresserade kandidater för att matcha.
            </div>
          )}
          {matches.map((match) => (
            <article key={match.id} className="glass-card p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-[#4f6b89]">Matchning</p>
              <h3 className="mt-1 text-lg font-semibold text-[#132743]">{match.candidateName}</h3>
              <p className="text-sm text-[#3d5e82]">{match.jobTitle}</p>
              <p className="text-sm text-[#3d5e82]">{match.location}</p>
              <p className="mt-2 text-sm text-[#2f4f74]">{match.candidateAvailability}</p>
            </article>
          ))}
        </section>
      )}

      {tab === "alerts" && (
        <section className="tab-fade space-y-3">
          <div className="glass-card flex items-center justify-between p-4">
            <p className="text-sm text-[#2f5074]">
              {unreadCount > 0 ? `${unreadCount} olästa notiser` : "Du är ikapp"}
            </p>
            <button className="secondary-btn px-3 py-2 text-sm" onClick={handleMarkAllRead}>
              Markera alla som lästa
            </button>
          </div>
          {notifications.length === 0 && (
            <div className="glass-card p-4 text-sm text-[#3f6186]">Inga notiser ännu.</div>
          )}
          {notifications.map((notification) => (
            <article key={notification.id} className="glass-card p-4">
              <p className="text-sm text-[#27496f]">{notification.message}</p>
              <p className="mt-2 text-xs text-[#5d7591]">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </section>
      )}

      {tab === "settings" && profile && (
        <section className="tab-fade space-y-3">
          <form className="glass-card space-y-3 p-4" onSubmit={handleSaveCompanyProfile}>
            <p className="text-sm font-semibold text-[#17365b]">Företagsinställningar</p>
            <input
              className="w-full rounded-2xl border border-[#cce0ff] px-4 py-3 text-sm outline-none"
              value={profile.companyName}
              onChange={(event) =>
                setProfile((current) =>
                  current ? { ...current, companyName: event.target.value } : current,
                )
              }
              placeholder="Företagsnamn"
            />
            <input
              className="w-full rounded-2xl border border-[#cce0ff] px-4 py-3 text-sm outline-none"
              value={profile.city}
              onChange={(event) =>
                setProfile((current) =>
                  current ? { ...current, city: event.target.value } : current,
                )
              }
              placeholder="Stad"
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-[#cce0ff] p-3 text-sm outline-none"
              value={profile.description}
              onChange={(event) =>
                setProfile((current) =>
                  current ? { ...current, description: event.target.value } : current,
                )
              }
              placeholder="Kort företagsbeskrivning"
            />
            <button className="cta-btn w-full px-4 py-3 text-sm">Spara inställningar</button>
          </form>

          <div className="glass-card p-4">
            <p className="text-sm text-[#2f5074]">
              Nuvarande nivå: <strong>{profile.tier}</strong>
            </p>
            <button className="secondary-btn mt-3 w-full px-4 py-3 text-sm" onClick={handleTierToggle}>
              {profile.tier === "free"
                ? "Uppgradera till Premium (demo)"
                : "Byt tillbaka till Free"}
            </button>
          </div>

          <button
            className="w-full rounded-xl border border-[#ffcfcf] bg-[#ffe8e8] px-4 py-3 text-sm font-semibold text-[#b42323]"
            onClick={handleLogout}
            type="button"
          >
            Logga ut
          </button>
        </section>
      )}

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-[#d2e3ff] bg-[#f7fbff]/95 px-2 py-2 backdrop-blur">
        <div className="grid grid-cols-5 gap-2">
          {[
            { key: "jobs", label: "Jobb" },
            { key: "candidates", label: "Kandidater" },
            { key: "matches", label: "Matchningar" },
            { key: "alerts", label: `Notiser${unreadCount ? ` (${unreadCount})` : ""}` },
            { key: "settings", label: "Inställningar" },
          ].map((item) => (
            <button
              key={item.key}
              className={`rounded-xl px-2 py-2 text-xs font-medium ${
                tab === item.key
                  ? "bg-[#1474ff] text-white"
                  : "bg-white text-[#406286] border border-[#d7e8ff]"
              }`}
              onClick={() => setTab(item.key as CompanyTab)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
