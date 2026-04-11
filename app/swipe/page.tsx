"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobSwipeDeck } from "@/components/job-swipe-deck";
import { LanguageToggle } from "@/components/language-toggle";
import { getSwipeJobs } from "@/lib/feeds";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";
import { swipeJob } from "@/lib/matching";
import type { JobPost, SwipeDecision } from "@/lib/types";

export default function SwipePage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
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
          console.error("Failed to load swipe jobs.", loadError);
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

  const t =
    language === "sv"
      ? {
          home: "Startsida",
          title: "Swipe jobb",
          subtitle: "Svep hÃ¶ger fÃ¶r intresserad, vÃ¤nster fÃ¶r hoppa Ã¶ver.",
          loading: "Laddar session...",
          onlyYouthTitle: "Denna vy Ã¤r fÃ¶r ungdomskonton",
          onlyYouthSubtitle: "Byt till ungdomsprofil fÃ¶r att matcha jobb med swipe.",
          interested: "Intresserad",
          skip: "Hoppa Ã¶ver",
          swipeHint: "Tips: dra kortet Ã¥t hÃ¶ger eller vÃ¤nster, eller anvÃ¤nd knapparna.",
          doneTitle: "Alla jobb granskade",
          doneSubtitle: "Bra jobbat! Kom tillbaka senare fÃ¶r nya annonser.",
          syncing: "Synkar jobb...",
          failed: "Kunde inte ladda jobbflÃ¶det.",
        }
      : {
          home: "Home",
          title: "Swipe jobs",
          subtitle: "Swipe right for interested, left to skip.",
          loading: "Loading session...",
          onlyYouthTitle: "This view is for youth accounts",
          onlyYouthSubtitle: "Switch to a youth profile to swipe and match jobs.",
          interested: "Interested",
          skip: "Skip",
          swipeHint: "Tip: drag the card right or left, or use the buttons.",
          doneTitle: "All jobs reviewed",
          doneSubtitle: "Nice work! Return later for new postings.",
          syncing: "Syncing jobs...",
          failed: "Unable to load the job feed.",
        };

  const handleDecision = async (job: JobPost, decision: SwipeDecision) => {
    await swipeJob(job.id, decision);
    setJobs((current) => current.filter((item) => item.id !== job.id));
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell flex flex-col justify-center">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="secondary-btn px-3 py-2 text-xs">
            {t.home}
          </Link>
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loading}</div>
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

      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6887]">WorkSpot</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#132742]">{t.title}</h1>
        <p className="mt-2 text-sm text-[#3f5f82]">{t.subtitle}</p>
      </div>

      {profile?.role !== "youth" ? (
        <div className="glass-card p-5">
          <h2 className="text-lg font-semibold text-[#132742]">{t.onlyYouthTitle}</h2>
          <p className="mt-2 text-sm text-[#3f5f82]">{t.onlyYouthSubtitle}</p>
        </div>
      ) : error ? (
        <div className="glass-card p-5 text-sm text-[#9e3a2d]">{error || t.failed}</div>
      ) : !jobsLoaded ? (
        <div className="glass-card p-5 text-sm text-[#3f5f82]">{t.syncing}</div>
      ) : (
        <JobSwipeDeck
          jobs={jobs}
          onDecision={handleDecision}
          emptyTitle={t.doneTitle}
          emptySubtitle={t.doneSubtitle}
          interestedLabel={t.interested}
          skipLabel={t.skip}
          swipeHint={t.swipeHint}
        />
      )}
    </main>
  );
}
