"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getJobById } from "@/lib/jobs";
import { useSession } from "@/hooks/use-session";
import { getSupabaseClient } from "@/lib/supabase";
import type { JobPost } from "@/lib/types";

function listItems(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function ageRequirement(job: JobPost): string | null {
  if (job.min_age == null && job.max_age == null) return null;
  if (job.min_age != null && job.max_age != null) return `${job.min_age}–${job.max_age} år`;
  return job.min_age != null ? `Minst ${job.min_age} år` : `Högst ${job.max_age} år`;
}

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const { user, profile } = useSession();
  const [job, setJob] = useState<JobPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    let active = true;
    void getJobById(params.jobId)
      .then((result) => { if (active) setJob(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte hämta annonsen."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.jobId]);

  useEffect(() => {
    if (!user || profile?.role !== "youth") {
      setAlreadyApplied(false);
      return;
    }

    let active = true;
    void getSupabaseClient()
      .from("swipe_actions")
      .select("decision")
      .eq("youth_user_id", user.id)
      .eq("job_id", params.jobId)
      .eq("decision", "interested")
      .maybeSingle()
      .then(({ data }) => { if (active) setAlreadyApplied(Boolean(data)); });
    return () => { active = false; };
  }, [params.jobId, profile?.role, user]);

  if (loading) return <main className="mobile-shell"><p>Laddar annonsen...</p></main>;
  if (error || !job) return <main className="mobile-shell"><div className="card" style={{ padding: "1.25rem" }}><p>{error || "Annonsen hittades inte eller är inte längre aktiv."}</p><Link href="/swipe" className="job-detail-back">← Tillbaka till jobben</Link></div></main>;

  const coverImage = job.image_url.split(",").map((url) => url.trim()).find(Boolean);
  const requirements = [ageRequirement(job), ...listItems(job.requirements)].filter((item): item is string => Boolean(item));
  const benefits = listItems(job.benefits);
  const address = [job.address, job.postal_code, job.city].filter(Boolean).join(", ");

  return (
    <main className="job-detail-page">
      <Link href="/swipe" className="job-detail-back">← Alla jobb</Link>
      <article className="job-detail-card">
        <header className="job-detail-header">
          <div className="job-detail-hero-wrap">
          <div className="job-detail-hero">
            {coverImage ? <img src={coverImage} alt={`Omslagsbild för ${job.title}`} /> : <span aria-hidden="true">💼</span>}
          </div>
          </div>
          <div className="job-detail-heading">
            <p className="job-detail-company">{job.company_name || "Företag"}</p>
            <h1>{job.title}</h1>
          </div>
        </header>
        <div className="job-detail-layout">
          <section className="job-detail-main">
          <section><h2>Om jobbet</h2><p>{job.description || "Ingen beskrivning angiven."}</p></section>
          <section><h2>Tider</h2><p>{job.employment_type || job.category || "Tider enligt överenskommelse"}</p></section>
          </section>
          <aside className="job-detail-aside">
          {requirements.length > 0 && <section className="job-detail-panel"><h2>Krav</h2><ul className="job-detail-list">{requirements.map((item) => <li key={item}>{item}</li>)}</ul></section>}
          {benefits.length > 0 && <section className="job-detail-panel"><h2>Förmåner</h2><ul className="job-detail-list">{benefits.map((item) => <li key={item}>{item}</li>)}</ul></section>}
          <section className="job-detail-panel"><h2>Lön</h2><p>{job.salary_per_hour || "Lön enligt överenskommelse"}</p></section>
          <section className="job-detail-panel"><h2>Adress</h2><p>{address || "Adress meddelas av arbetsgivaren"}</p></section>
          {profile?.role === "youth" && (alreadyApplied ? <p className="job-detail-applied">Du har redan ansökt till det här jobbet.</p> : <Link href={`/swipe?job=${encodeURIComponent(job.id)}`} className="cta-btn job-detail-apply">Ansök till jobbet</Link>)}
          </aside>
        </div>
      </article>
    </main>
  );
}
