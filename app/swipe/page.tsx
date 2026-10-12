"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { JobDiscovery, type DiscoveryFilterValues } from "@/components/job-discovery";
import { getSwipeJobs } from "@/lib/feeds";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { swipeJob } from "@/lib/matching";
import { getSavedJobs, getYouthFlowState, saveApplicationDraft, setJobSaved } from "@/lib/youth-job-flow";
import type { JobPost, SwipeDecision } from "@/lib/types";

const EMPLOYMENT_FORMS = ["Heltid", "Deltid", "Sommarjobb", "Helgjobb", "Extraarbete", "Extra vid behov", "Praktik", "Engångsjobb"];
const employmentFormKeys = new Set(EMPLOYMENT_FORMS.map((value) => value.toLocaleLowerCase("sv")));

function uniqueSorted(values: string[]) {
  return [...new Map(values.map((value) => [value.trim().toLocaleLowerCase("sv"), value.trim()])).values()]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "sv"));
}

function SwipePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, status, error: sessionError } = useRequireAuth();
  const { cvCompleted, cvLoading } = useCvCompletion(user?.id, profile?.role === "youth");
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const pending = useRef(new Set<string>());
  const [pendingCount, setPendingCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  const [savedJobs, setSavedJobs] = useState<JobPost[]>([]);
  const showingSaved = searchParams.get("saved") === "1";

  useEffect(() => {
    if (loading || !user || profile?.role !== "youth") return;
    void getYouthFlowState(user.id).then((state) => {
      if (!state.shortOnboardingCompleted) router.replace("/youth/onboarding");
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Kunde inte kontrollera ditt konto."));
  }, [loading, profile?.role, router, user]);

  useEffect(() => {
    if (loading || cvLoading || !user || profile?.role !== "youth") return;
    let active = true;
    const load = async () => {
      try {
        const [feed, bookmarks] = await Promise.all([showingSaved ? Promise.resolve([]) : getSwipeJobs(), getSavedJobs()]);
        const data = showingSaved ? bookmarks : feed;
        const requestedJobId = searchParams.get("job");
        if (active) {
          setSavedJobs(bookmarks);
          setJobs(requestedJobId ? [...data].sort((a, b) => (a.id === requestedJobId ? -1 : b.id === requestedJobId ? 1 : 0)) : data);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda jobb.");
      } finally {
        if (active) setJobsLoaded(true);
      }
    };
    void load();
    return () => { active = false; };
  }, [cvLoading, loading, profile?.role, searchParams, showingSaved, user]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (pending.current.size) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);

  const filterOptions = useMemo(() => ({
    cities: uniqueSorted(jobs.map((job) => job.city)),
    // Older listings incorrectly copied employment type to category. Do not
    // surface those values under work categories.
    categories: uniqueSorted(jobs.map((job) => job.category).filter((value) => !employmentFormKeys.has(value.trim().toLocaleLowerCase("sv")))),
    employmentTypes: uniqueSorted(jobs.flatMap((job) => job.employment_type.split(",").map((value) => value.trim()))),
  }), [jobs]);
  const filteredJobs = useMemo(() => jobs.filter((job) =>
    (!city || job.city === city)
    && (!category || job.category === category)
    && (!employmentType || job.employment_type.split(",").some((value) => value.trim().toLocaleLowerCase("sv") === employmentType.toLocaleLowerCase("sv"))),
  ), [category, city, employmentType, jobs]);

  const handleDecision = async (job: JobPost, decision: SwipeDecision) => {
    if (pending.current.has(job.id)) return;
    pending.current.add(job.id); setPendingCount(pending.current.size);
    setError(""); setNotice("");
    setJobs(current => current.filter(item => item.id !== job.id));
    // Release the deck immediately; only show success once the server confirms it.
    void (async () => {
      try {
        if (!cvCompleted && decision === "interested") {
          await saveApplicationDraft(job.id); setDraftCount(count => count + 1);
          setNotice("Intresset är sparat. Skapa ditt CV under Profil för att skicka ansökan.");
        } else if (cvCompleted) {
          await swipeJob(job.id, decision);
          if (decision === "interested") setNotice(`Ansökan till ${job.company_name || "företaget"} är skickad.`);
        }
        window.dispatchEvent(new Event("mnw-navigation-refresh"));
      } catch {
        setJobs(current => current.some(item => item.id === job.id) ? current : [job, ...current]);
        setError(`Valet för ${job.title} kunde inte sparas. Jobbet finns kvar – försök igen.`);
      } finally { pending.current.delete(job.id); setPendingCount(pending.current.size); }
    })();
  };

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;
  if (cvLoading) return <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#737373", fontSize: "0.9rem" }}>Hämtar innehåll...</p></main>;

  const handleSave = async (job: JobPost, saved: boolean) => {
    await setJobSaved(job.id, saved);
    setSavedJobs(current => saved ? [job, ...current.filter(item => item.id !== job.id)] : current.filter(item => item.id !== job.id));
    if (showingSaved && !saved) setJobs(current => current.filter(item => item.id !== job.id));
  };
  const handleFilter = (key: keyof DiscoveryFilterValues, value: string) => {
    if (key === "city") setCity(value);
    else if (key === "category") setCategory(value);
    else setEmploymentType(value);
  };
  return <>
    {profile?.role !== "youth" ? <main className="mobile-shell"><p>Bara för ungdomskonton</p></main> : <JobDiscovery jobs={filteredJobs} savedJobs={savedJobs} savedIds={new Set(savedJobs.map(job => job.id))} showingSaved={showingSaved} cvCompleted={cvCompleted} draftCount={draftCount} loading={!jobsLoaded} error={error} notice={notice} filters={{ city, category, employmentType }} options={filterOptions} onFilter={handleFilter} onDecision={handleDecision} onSave={handleSave}/>}
    <p className="sr-only" role="status">{pendingCount ? `${pendingCount} val sparas i bakgrunden. Stanna kvar tills de är sparade.` : "Alla val är sparade."}</p>
  </>;
}

export default function SwipePage() { return <Suspense fallback={<main className="mobile-shell map-page-loading"><p>Laddar...</p></main>}><SwipePageContent /></Suspense>; }
