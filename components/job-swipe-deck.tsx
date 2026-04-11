"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import type { JobPost, SwipeDecision } from "@/lib/types";

type Decision = SwipeDecision;

interface JobSwipeDeckProps {
  jobs: JobPost[];
  onDecision: (job: JobPost, decision: Decision) => Promise<void>;
  emptyTitle: string;
  emptySubtitle: string;
  interestedLabel: string;
  skipLabel: string;
  swipeHint: string;
}

export function JobSwipeDeck({
  jobs,
  onDecision,
  emptyTitle,
  emptySubtitle,
  interestedLabel,
  skipLabel,
  swipeHint,
}: JobSwipeDeckProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);

  const remainingJobs = useMemo(() => jobs.filter((job) => !decisions[job.id]), [decisions, jobs]);
  const currentJob: JobPost | undefined = remainingJobs[0];

  const applyDecision = async (job: JobPost, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [job.id]: decision }));
    await onDecision(job, decision);
  };

  const onPointerDown = (x: number) => {
    startXRef.current = x;
    setIsDragging(true);
  };

  const onPointerMove = (x: number) => {
    if (!isDragging || startXRef.current === null) return;
    setDragX(x - startXRef.current);
  };

  const onPointerEnd = () => {
    if (!currentJob) {
      setIsDragging(false);
      setDragX(0);
      startXRef.current = null;
      return;
    }

    if (dragX > 90) {
      void applyDecision(currentJob, "interested");
      setDragX(0);
      setIsDragging(false);
      startXRef.current = null;
      return;
    }

    if (dragX < -90) {
      void applyDecision(currentJob, "skip");
      setDragX(0);
      setIsDragging(false);
      startXRef.current = null;
      return;
    }

    setIsDragging(false);
    setDragX(0);
    startXRef.current = null;
  };

  const interestedCount = Object.values(decisions).filter((value) => value === "interested").length;
  const skippedCount = Object.values(decisions).filter((value) => value === "skip").length;
  const overlayOpacity = Math.min(Math.abs(dragX) / 110, 1);

  if (!currentJob) {
    return (
      <div className="glass-card p-5 text-center">
        <h2 className="text-xl font-semibold text-[#132742]">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-[#3f5f82]">{emptySubtitle}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <p className="rounded-xl bg-[#e8f5ec] px-3 py-2 text-[#1f6845]">
            {interestedLabel}: {interestedCount}
          </p>
          <p className="rounded-xl bg-[#fff1ea] px-3 py-2 text-[#9e4e2d]">
            {skipLabel}: {skippedCount}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="glass-card relative min-h-[440px] overflow-hidden p-6"
        onPointerDown={(event) => onPointerDown(event.clientX)}
        onPointerMove={(event) => onPointerMove(event.clientX)}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX * 0.035}deg)`,
          transition: isDragging ? "none" : "transform 0.24s ease",
          touchAction: "pan-y",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px] bg-[#e8f5ec]"
          style={{ opacity: dragX > 0 ? overlayOpacity * 0.62 : 0 }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px] bg-[#fff1ea]"
          style={{ opacity: dragX < 0 ? overlayOpacity * 0.62 : 0 }}
          aria-hidden
        />

        <div className="relative z-10 flex min-h-[390px] flex-col">
          {currentJob.image_url && (
            <Image
              src={currentJob.image_url}
              alt={currentJob.title}
              width={640}
              height={320}
              className="mb-4 h-40 w-full rounded-2xl object-cover"
            />
          )}

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4c6887]">
            {currentJob.company_name ?? "Company"}
          </p>
          <h2 className="mt-2 text-[1.9rem] font-semibold leading-tight text-[#132742]">
            {currentJob.title}
          </h2>
          <p className="mt-1 text-sm text-[#3f5f82]">
            {currentJob.city} • {currentJob.job_type} • {currentJob.pay}
          </p>
          <p className="mt-4 text-base text-[#2f4663]">{currentJob.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(currentJob.tags ?? []).map((tag: string) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
            {currentJob.category && <span className="chip">{currentJob.category}</span>}
          </div>

          <div className="mt-auto pt-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#5a7492]">
            {dragX > 40 ? interestedLabel : dragX < -40 ? skipLabel : "Swipe"}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[#58708b]">{swipeHint}</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="secondary-btn min-h-12 px-4 py-3 text-sm"
          onClick={() => void applyDecision(currentJob, "skip")}
        >
          {skipLabel}
        </button>
        <button
          type="button"
          className="cta-btn min-h-12 px-4 py-3 text-sm"
          onClick={() => void applyDecision(currentJob, "interested")}
        >
          {interestedLabel}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-[#3f5f82]">
        <p className="rounded-xl bg-[#e8f5ec] px-3 py-2">
          {interestedLabel}: {interestedCount}
        </p>
        <p className="rounded-xl bg-[#fff1ea] px-3 py-2">
          {skipLabel}: {skippedCount}
        </p>
      </div>
    </div>
  );
}
