import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import "../landing.css";
import styles from "./public-jobs.module.css";

export const metadata: Metadata = { title: "Lediga ungdomsjobb" };
export const dynamic = "force-dynamic";

type Preview = { id: string; title: string; city: string | null };

async function getPreviews(): Promise<Preview[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("list_public_job_previews").abortSignal(AbortSignal.timeout(5000));
    return error ? null : (data ?? []) as Preview[];
  } catch {
    return null;
  }
}

export default async function PublicJobsPage() {
  const jobs = await getPreviews();
  return (
    <main className={styles.page}>
      <MarketingNav />
      <section className={styles.content}>
        <h1>Lediga ungdomsjobb</h1>
        {jobs === null ? <p role="status">Jobben kunde inte hämtas just nu. Försök igen om en stund.</p>
          : jobs.length === 0 ? <p>Det finns inga jobb att visa just nu.</p>
          : <ul className={styles.jobs}>{jobs.map(job => (
            <li key={job.id}>
              <h2>{job.title}</h2>
              {job.city && <p>{job.city}</p>}
            </li>
          ))}</ul>}
        <div className={styles.actions}>
          <Link href="/signup" className="cta-btn">Skapa konto för att söka</Link>
          <Link href="/login" className="secondary-btn">Logga in</Link>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
