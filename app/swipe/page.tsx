"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JobSwipeDeck } from "@/components/job-swipe-deck";
import { getSwipeJobs } from "@/lib/feeds";
import { useSession } from "@/hooks/use-session";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { swipeJob } from "@/lib/matching";
import type { JobPost, SwipeDecision } from "@/lib/types";

function SwipePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useSession();
  const { cvCompleted, cvLoading } = useCvCompletion(user?.id, profile?.role === "youth");
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !cvLoading && user && profile?.role === "youth") {
      void (async () => {
        try {
          const data = await getSwipeJobs();
          const requestedJobId = searchParams.get("job");
          setJobs(requestedJobId ? [...data].sort((a, b) => (a.id === requestedJobId ? -1 : b.id === requestedJobId ? 1 : 0)) : data);
          setError("");
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load jobs.");
        } finally {
          setJobsLoaded(true);
        }
      })();
    }
  }, [cvLoading, loading, profile?.role, searchParams, user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  const handleDecision = async (job: JobPost, decision: SwipeDecision) => {
    await swipeJob(job.id, decision);
    setJobs((current) => current.filter((item) => item.id !== job.id));
  };

  if (loading || cvLoading || !user) {
    return (
      <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p>
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <div style={{ marginBottom: "1.25rem", paddingTop: "0.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111111", margin: 0 }}>
          Hitta jobb
        </h1>
        <p style={{ marginTop: "0.3rem", fontSize: "0.85rem", color: "#737373" }}>
          Swipa höger för att ansöka, vänster för att hoppa.
        </p>
      </div>

      {profile?.role !== "youth" ? (
        <div
          className="card"
          style={{ padding: "1.25rem", textAlign: "center" }}
        >
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111111", marginBottom: "0.4rem" }}>
            Bara för ungdomskonton
          </p>
          <p style={{ fontSize: "0.85rem", color: "#737373" }}>
            Byt till ett ungdomskonto för att swipa och matcha.
          </p>
        </div>
      ) : error ? (
        <div
          style={{
            borderRadius: 12,
            background: "#fff1f0",
            border: "1px solid #ffd6d3",
            padding: "1rem",
            fontSize: "0.85rem",
            color: "#c0392b",
          }}
        >
          {error}
        </div>
      ) : !jobsLoaded ? (
        <div style={{ textAlign: "center", paddingTop: "3rem", color: "#737373", fontSize: "0.9rem" }}>
          Laddar jobb...
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={!cvCompleted ? { opacity: 0.38, pointerEvents: "none", filter: "grayscale(0.25)" } : undefined} aria-hidden={!cvCompleted}>
            <JobSwipeDeck
              jobs={jobs}
              onDecision={handleDecision}
              emptyTitle="Inga fler jobb just nu"
              emptySubtitle="Kolla tillbaka senare för nya annonser."
              interestedLabel="Intresserad"
              skipLabel="Hoppa"
              swipeHint="Swipe or tap"
            />
          </div>
          {!cvCompleted && (
            <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem", background: "rgba(255,255,255,0.16)", borderRadius: 20 }}>
              <div style={{ maxWidth: "20rem", padding: "1.15rem", borderRadius: 16, background: "rgba(255,255,255,0.94)", boxShadow: "0 8px 28px rgba(0,0,0,0.14)", textAlign: "center" }}>
                <p style={{ margin: "0 0 0.45rem", fontSize: "1.1rem", fontWeight: 700, color: "#111111" }}>Slutför ditt CV först</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#555555", lineHeight: 1.5 }}>Du kan inte swipa jobb eller chatta med företag förrän du har slutfört ditt CV.</p>
                <button type="button" className="cta-btn" onClick={() => router.push("/youth/cv")} style={{ width: "100%", marginTop: "1rem", padding: "0.75rem 1rem" }}>Fortsätt till CV-flödet</button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function SwipePage() {
  return <Suspense fallback={<main className="mobile-shell map-page-loading"><p>Laddar...</p></main>}><SwipePageContent /></Suspense>;
}
