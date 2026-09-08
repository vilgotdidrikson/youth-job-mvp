"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { JobSwipeDeck } from "@/components/job-swipe-deck";
import { getSwipeJobs } from "@/lib/feeds";
import { useSession } from "@/hooks/use-session";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { swipeJob } from "@/lib/matching";
import { getApplicationDraftCount, getSavedJobs, getYouthFlowState, saveApplicationDraft } from "@/lib/youth-job-flow";
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
  const { user, profile, loading } = useSession();
  const { cvCompleted, cvLoading } = useCvCompletion(user?.id, profile?.role === "youth");
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [showCvPrompt, setShowCvPrompt] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
        const data = showingSaved
          ? await getSavedJobs()
          : await getSwipeJobs();
        const requestedJobId = searchParams.get("job");
        if (active) {
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

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, router, user]);

  useEffect(() => {
    if (!user || cvCompleted || profile?.role !== "youth") return;
    const storageKey = `employo-pre-cv-swipe-count:${user.id}`;
    setSwipeCount(Number(window.localStorage.getItem(storageKey) ?? "0"));
    void getApplicationDraftCount().then(setDraftCount).catch(() => undefined);
  }, [cvCompleted, profile?.role, user]);

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
    try {
      if (!cvCompleted && decision === "interested") {
        await saveApplicationDraft(job.id);
        setDraftCount((count) => count + 1);
      } else if (cvCompleted) {
        await swipeJob(job.id, decision);
      }
      setJobs((current) => current.filter((item) => item.id !== job.id));
      if (!cvCompleted && user) {
        const storageKey = `employo-pre-cv-swipe-count:${user.id}`;
        const nextCount = swipeCount + 1;
        window.localStorage.setItem(storageKey, String(nextCount));
        setSwipeCount(nextCount);
        if (nextCount > 0 && nextCount % 10 === 0) setShowCvPrompt(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunde inte spara ditt val.");
    }
  };

  if (loading || cvLoading || !user) return <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p></main>;

  return <main className="mobile-shell">
    <div style={{ marginBottom: "1.25rem", paddingTop: "0.5rem" }}>
      {!cvCompleted && <div className="cv-required-banner"><div><strong>Gör klart ditt CV för att skicka ansökningar</strong><p>{draftCount ? `${draftCount} ${draftCount === 1 ? "ansökan är" : "ansökningar är"} sparad${draftCount === 1 ? "" : "e"} och skickas när ditt CV är klart.` : "Du kan swipa nu. Ansökningar sparas tills ditt CV är klart."}</p></div><Link className="cv-required-banner-action" href="/youth/cv">Skapa ditt CV</Link></div>}
    </div>
    {profile?.role !== "youth" ? <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}><p style={{ fontSize: "1.1rem", fontWeight: 700 }}>Bara för ungdomskonton</p></div> : error ? <div style={{ borderRadius: 12, background: "#fff1f0", border: "1px solid #ffd6d3", padding: "1rem", fontSize: "0.85rem", color: "#c0392b" }}>{error}</div> : !jobsLoaded ? <div style={{ textAlign: "center", paddingTop: "3rem", color: "#737373" }}>Laddar jobb...</div> : <div className="job-explore-layout">
      {!showingSaved && <><button type="button" className="job-filter-menu-button" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen}>☰ Filter</button>{filtersOpen && <button type="button" className="job-filter-backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}<aside className={`job-filter-sidebar${filtersOpen ? " is-open" : ""}`} aria-label="Filtrera jobb"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong>Filter</strong>{(city || category || employmentType) && <button type="button" onClick={() => { setCity(""); setCategory(""); setEmploymentType(""); }} style={{ border: 0, background: "none", color: "var(--accent)", font: "inherit", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>Rensa</button>}</div><label>Ort<select value={city} onChange={(event) => setCity(event.target.value)}><option value="">Alla orter</option>{filterOptions.cities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Kategori<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Alla kategorier</option>{filterOptions.categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Anställningsform<select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}><option value="">Alla former</option>{filterOptions.employmentTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><p>{filteredJobs.length} {filteredJobs.length === 1 ? "jobb" : "jobb"}</p><button type="button" className="job-filter-close" onClick={() => setFiltersOpen(false)}>Stäng</button></aside></>}
      <div><JobSwipeDeck jobs={filteredJobs} onDecision={handleDecision} emptyTitle={showingSaved ? "Inga sparade jobb ännu" : "Inga jobb som matchar dina filter"} emptySubtitle={showingSaved ? "Spara jobb som du vill återkomma till." : "Rensa ett filter eller kolla tillbaka senare."} interestedLabel={cvCompleted ? "Skicka ansökan" : "Påbörja ansökan"} skipLabel="Hoppa" swipeHint="Swipa eller tryck" /></div>
    </div>}
    {showCvPrompt && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 10, display: "grid", placeItems: "center", padding: "1.25rem", background: "rgba(0,0,0,.45)" }}><section className="card" style={{ maxWidth: 380, padding: "1.4rem" }}><p style={{ margin: 0, color: "var(--accent)", fontSize: ".78rem", fontWeight: 800 }}>DU HAR UTFORSKAT 10 JOBB</p><h2>Gör klart ditt CV</h2><p>{draftCount ? `${draftCount} sparade ansökningar skickas när företagen kan se ditt CV.` : "För att skicka ansökningar behöver företagen kunna se ditt CV."}</p><Link className="cta-btn" style={{ display: "block", textAlign: "center" }} href="/youth/cv">Skapa ditt CV</Link><button type="button" className="secondary-btn" style={{ width: "100%", marginTop: ".7rem" }} onClick={() => setShowCvPrompt(false)}>Fortsätt utforska</button></section></div>}
  </main>;
}

export default function SwipePage() { return <Suspense fallback={<main className="mobile-shell map-page-loading"><p>Laddar...</p></main>}><SwipePageContent /></Suspense>; }
