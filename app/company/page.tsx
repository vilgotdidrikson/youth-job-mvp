"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";
import {
  companyRespondToCandidate,
  createJob,
  getCompanyCandidateFeed,
  getCompanyJobs,
} from "@/lib/app-data";
import type { JobPost } from "@/lib/types";

interface JobForm {
  title: string;
  city: string;
  pay: string;
  job_type: JobPost["job_type"];
  description: string;
}

const initialForm: JobForm = {
  title: "",
  city: "",
  pay: "",
  job_type: "part-time",
  description: "",
};

export default function CompanyPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { user, profile, loading } = useSession();

  const [form, setForm] = useState<JobForm>(initialForm);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [feed, setFeed] = useState<Array<{ youthUserId: string; job: JobPost }>>([]);
  const [busy, setBusy] = useState(false);

  const t =
    language === "sv"
      ? {
          home: "Startsida",
          title: "Företagsflöde",
          subtitle: "Skapa jobbannonser och hantera intresserade kandidater.",
          loading: "Laddar...",
          companyOnly: "Denna sida är för företagskonton.",
          postTitle: "Annonsrubrik",
          city: "Stad",
          pay: "Lön / timme",
          type: "Typ",
          description: "Beskrivning",
          create: "Skapa annons",
          yourJobs: "Dina annonser",
          interestedYouth: "Intresserade ungdomar",
          match: "Matcha",
          skip: "Hoppa över",
        }
      : {
          home: "Home",
          title: "Company flow",
          subtitle: "Create jobs and review interested youth candidates.",
          loading: "Loading...",
          companyOnly: "This page is for company accounts.",
          postTitle: "Job title",
          city: "City",
          pay: "Pay / hour",
          type: "Type",
          description: "Description",
          create: "Create job",
          yourJobs: "Your jobs",
          interestedYouth: "Interested youth",
          match: "Match",
          skip: "Skip",
        };

  const refreshData = async () => {
    if (!user) return;
    const [jobsData, feedData] = await Promise.all([getCompanyJobs(user.id), getCompanyCandidateFeed(user.id)]);
    setJobs(jobsData);
    setFeed(feedData);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
      return;
    }

    if (!loading && user && profile?.role === "company") {
      void refreshData();
    }
  }, [loading, profile?.role, router, user]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setBusy(true);
    await createJob({
      company_user_id: user.id,
      company_name: user.email ?? "Company",
      title: form.title,
      city: form.city,
      pay: form.pay,
      job_type: form.job_type,
      description: form.description,
    });
    setForm(initialForm);
    await refreshData();
    setBusy(false);
  };

  const handleResponse = async (youthUserId: string, job: JobPost, interested: boolean) => {
    if (!user) return;
    await companyRespondToCandidate({
      companyUserId: user.id,
      youthUserId,
      job,
      interested,
    });
    await refreshData();
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell flex flex-col justify-center">
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loading}</div>
      </main>
    );
  }

  if (profile?.role !== "company") {
    return (
      <main className="mobile-shell pb-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="secondary-btn px-3 py-2 text-xs">
            {t.home}
          </Link>
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
        <div className="glass-card p-5 text-sm text-[#3f5f82]">{t.companyOnly}</div>
      </main>
    );
  }

  return (
    <main className="mobile-shell pb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="secondary-btn px-3 py-2 text-xs">
          {t.home}
        </Link>
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>

      <section className="glass-card p-5">
        <h1 className="text-2xl font-semibold text-[#132742]">{t.title}</h1>
        <p className="mt-2 text-sm text-[#3f5f82]">{t.subtitle}</p>
      </section>

      <section className="mt-3 glass-card p-4">
        <form className="space-y-2.5" onSubmit={handleCreate}>
          <input
            className="h-11 w-full rounded-xl border border-[#cfe2ff] px-3 text-sm"
            placeholder={t.postTitle}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="h-11 rounded-xl border border-[#cfe2ff] px-3 text-sm"
              placeholder={t.city}
              value={form.city}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded-xl border border-[#cfe2ff] px-3 text-sm"
              placeholder={t.pay}
              value={form.pay}
              onChange={(event) => setForm((prev) => ({ ...prev, pay: event.target.value }))}
              required
            />
          </div>
          <select
            className="h-11 w-full rounded-xl border border-[#cfe2ff] px-3 text-sm"
            value={form.job_type}
            onChange={(event) => setForm((prev) => ({ ...prev, job_type: event.target.value as JobPost["job_type"] }))}
          >
            <option value="part-time">Part-time</option>
            <option value="summer">Summer</option>
            <option value="weekend">Weekend</option>
            <option value="extra">Extra</option>
          </select>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-[#cfe2ff] px-3 py-3 text-sm"
            placeholder={t.description}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
          />
          <button className="cta-btn min-h-12 w-full px-4 py-3 text-sm" type="submit">
            {busy ? "..." : t.create}
          </button>
        </form>
      </section>

      <section className="mt-3 glass-card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.yourJobs}</p>
        <div className="mt-2 space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-[#dbe8ff] bg-white px-3 py-2 text-sm text-[#2f4663]">
              <p className="font-semibold text-[#133e76]">{job.title}</p>
              <p className="text-xs">{job.city} • {job.job_type} • {job.pay}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-3 glass-card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.interestedYouth}</p>
        <div className="mt-2 space-y-2">
          {feed.map((item) => (
            <div key={`${item.youthUserId}-${item.job.id}`} className="rounded-xl border border-[#dbe8ff] bg-white p-3">
              <p className="text-sm font-semibold text-[#133e76]">{item.job.title}</p>
              <p className="mt-1 text-xs text-[#3f5f82]">Candidate: {item.youthUserId.slice(0, 8)}...</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="secondary-btn min-h-10 px-3 text-xs"
                  onClick={() => void handleResponse(item.youthUserId, item.job, false)}
                >
                  {t.skip}
                </button>
                <button
                  type="button"
                  className="cta-btn min-h-10 px-3 text-xs"
                  onClick={() => void handleResponse(item.youthUserId, item.job, true)}
                >
                  {t.match}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
