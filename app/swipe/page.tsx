"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobSwipeDeck } from "@/components/job-swipe-deck";
import { getSwipeJobs } from "@/lib/feeds";
import { useSession } from "@/hooks/use-session";
import { swipeJob } from "@/lib/matching";
import type { JobPost, SwipeDecision } from "@/lib/types";

export default function SwipePage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user && profile?.role === "youth") {
      void (async () => {
        try {
          const data = await getSwipeJobs();
          setJobs(data);
          setError("");
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load jobs.");
        } finally {
          setJobsLoaded(true);
        }
      })();
    }
  }, [loading, profile?.role, user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const handleDecision = async (job: JobPost, decision: SwipeDecision) => {
    await swipeJob(job.id, decision);
    setJobs((current) => current.filter((item) => item.id !== job.id));
  };

  if (loading || !user) {
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
        <JobSwipeDeck
          jobs={jobs}
          onDecision={handleDecision}
          emptyTitle="Inga fler jobb just nu"
          emptySubtitle="Kolla tillbaka senare för nya annonser."
          interestedLabel="Intresserad"
          skipLabel="Hoppa"
          swipeHint="Swipe or tap"
        />
      )}
    </main>
  );
}