"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobMap } from "@/components/job-map";
import { getCityCoordinates, type Coordinates } from "@/lib/job-location";
import { getSwipeJobs } from "@/lib/feeds";
import { getSupabaseClient } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import type { JobPost } from "@/lib/types";

export default function MapPage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState("");
  const [jobsLoaded, setJobsLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

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

  if (loading || !user) {
    return <main className="mobile-shell map-page-loading"><p>Laddar...</p></main>;
  }

  if (profile?.role !== "youth") {
    return (
      <main className="mobile-shell map-page-loading">
        <h1>Kartan är för jobbsökare</h1>
        <p>Logga in med ett ungdomskonto för att se jobben på kartan.</p>
        <Link href="/company?view=annonser" className="map-back-link">Till mina annonser</Link>
      </main>
    );
  }

  return (
    <main className="map-page">
      <footer className="map-page-footer">
        <div>
          <p>JOBB NÄRA DIG</p>
          <h1>Kartan</h1>
        </div>
        <span className="map-count">{jobs.length} jobb</span>
      </footer>
      <JobMap jobs={jobs} userCoordinates={userCoordinates} />
      {error ? <div className="map-page-error">Kartan visas, men jobben kunde inte laddas: {error}</div> : !jobsLoaded ? <div className="map-page-loading-overlay">Laddar jobb...</div> : null}
      {jobsLoaded && !error && jobs.length === 0 && <div className="map-empty-state">Inga nya jobb att visa på kartan just nu.</div>}
    </main>
  );
}
