"use client";
import { jobCities } from "@/lib/job-workplaces";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readSearchFilters, searchDetailLabels, searchHref } from "@/lib/job-search";
import { orderDiscoveryJobs } from "@/lib/job-discovery";
import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import "./map-design.css";
import { JobMap } from "@/components/job-map";
import { getCityCoordinates, type Coordinates } from "@/lib/job-location";
import { getSwipeJobs } from "@/lib/feeds";
import { getSupabaseClient } from "@/lib/supabase";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import type { JobPost } from "@/lib/types";

function MapPageContent() {
  const searchParams = useSearchParams();
  const filters = useMemo(() => readSearchFilters(searchParams), [searchParams]);
  const { user, profile, status, error: sessionError } = useRequireAuth();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [availableJobs, setJobs] = useState<JobPost[]>([]);
  const jobs = useMemo(() => orderDiscoveryJobs(availableJobs, filters), [availableJobs, filters]);
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState("");
  const [jobsLoaded, setJobsLoaded] = useState(false);

  useEffect(() => {
    if (!user || profile?.role !== "youth") return;
    void Promise.all([
      getSwipeJobs(),
      getSupabaseClient().from("youth_profiles").select("city").eq("user_id", user.id).maybeSingle(),
    ])
      .then(([availableJobs, locationResult]) => {
        setJobs(availableJobs);
        setUserCoordinates(getCityCoordinates(locationResult.data?.city));
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda jobbkartan."))
      .finally(() => setJobsLoaded(true));
  }, [profile?.role, user]);

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;

  if (profile?.role !== "youth") {
    return (
      <main className="mobile-shell map-page-loading">
        <h1>Kartan är för jobbsökare</h1>
        <p>Logga in med ett ungdomskonto för att se jobben på kartan.</p>
        <Link href="/company?view=annonser" className="map-back-link">Till mina annonser</Link>
      </main>
    );
  }

  return <main className={`map-page mnw-map mnw-map-view-${view}`}>
    <header className="mnw-map-heading"><div><p>Jobb nära dig</p><h1>Hitta din nästa plats.</h1></div><Link href={searchHref("/swipe", filters)} className="map-back-link">Sök och filtrera</Link><div className="mnw-map-switch" role="group" aria-label="Kartans vy"><button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}><UiIcon name="map" width="18"/>Karta</button><button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><UiIcon name="briefcase" width="18"/>Lista</button></div></header>
    <div className="mnw-map-workspace"><aside className="mnw-map-list" aria-label="Lediga jobb"><header><h2>Upptäck i närheten</h2><span>{jobs.length} jobb</span></header>{!jobsLoaded ? <p role="status">Hämtar jobb…</p> : error ? <p role="alert">{error}</p> : jobs.length === 0 ? <section className="mnw-map-empty"><UiIcon name="map"/><h2>Inga nya jobb just nu</h2><p>Prova att ändra dina sökval eller kom tillbaka senare.</p><Link href={searchHref("/swipe", filters)}>Ändra sökval</Link></section> : jobs.map(job => <article key={job.id} className={`mnw-map-job ${selectedJobId === job.id ? "is-selected" : ""}`}><button type="button" aria-pressed={selectedJobId === job.id} onClick={() => setSelectedJobId(job.id)}><span className="mnw-map-avatar">{(job.company_name || "A").slice(0,2).toUpperCase()}</span><span><small>{job.company_name || "Arbetsgivare"}</small><strong>{job.title}</strong><small>{[jobCities(job),job.employment_type].filter(Boolean).join(" · ")}</small></span></button>{searchDetailLabels(job, filters).map(label => <p key={label}>{label}</p>)}<footer><span>{job.salary_per_hour || "Lön enligt överenskommelse"}</span><Link href={`/jobb/${job.id}`}>Visa jobb <UiIcon name="arrow" width="15"/></Link></footer></article>)}</aside><section className="mnw-map-canvas" aria-label="Jobbkarta"><JobMap jobs={jobs} userCoordinates={userCoordinates} selectedJobId={selectedJobId} onJobSelect={setSelectedJobId}/></section></div>
  </main>;
}

export default function MapPage() { return <Suspense fallback={<main className="mobile-shell map-page-loading"><p>Laddar karta…</p></main>}><MapPageContent/></Suspense>; }
