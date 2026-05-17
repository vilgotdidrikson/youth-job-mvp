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
}: JobSwipeDeckProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDir, setFlyDir] = useState<"left" | "right" | null>(null);
  const startXRef = useRef<number | null>(null);
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remainingJobs = useMemo(() => jobs.filter((job) => !decisions[job.id]), [decisions, jobs]);
  const currentJob: JobPost | undefined = remainingJobs[0];

  const commitDecision = async (job: JobPost, decision: Decision) => {
    setFlyDir(null);
    setDragX(0);
    setDecisions((prev) => ({ ...prev, [job.id]: decision }));
    await onDecision(job, decision);
  };

  const triggerDecision = (job: JobPost, decision: Decision) => {
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    setFlyDir(decision === "interested" ? "right" : "left");
    setIsDragging(false);
    setDragX(0);
    startXRef.current = null;
    flyTimerRef.current = setTimeout(() => void commitDecision(job, decision), 280);
  };

  const onPointerDown = (x: number) => {
    if (flyDir) return;
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
      triggerDecision(currentJob, "interested");
    } else if (dragX < -90) {
      triggerDecision(currentJob, "skip");
    } else {
      setIsDragging(false);
      setDragX(0);
      startXRef.current = null;
    }
  };

  const interestedCount = Object.values(decisions).filter((v) => v === "interested").length;
  const flyTranslateX = flyDir === "right" ? 600 : flyDir === "left" ? -600 : dragX;
  const flyRotate = flyDir === "right" ? 18 : flyDir === "left" ? -18 : dragX * 0.03;
  const overlayOpacity = Math.min(Math.abs(dragX) / 100, 1);
  const isLiking = dragX > 20 || flyDir === "right";
  const isSkipping = dragX < -20 || flyDir === "left";

  if (!currentJob) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 420,
          gap: "0.75rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>🎉</div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111111", margin: 0 }}>
          {emptyTitle}
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#737373", margin: 0 }}>{emptySubtitle}</p>
        {interestedCount > 0 && (
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.6rem 1.2rem",
              borderRadius: 999,
              background: "#f0faf5",
              border: "1px solid #b9e5d7",
              fontSize: "0.85rem",
              color: "#226a54",
              fontWeight: 600,
            }}
          >
            {interestedCount} {interestedCount === 1 ? "match" : "matches"} sent
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Main swipe card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "#fff",
          border: "1px solid #e8e8e8",
          borderRadius: 20,
          overflow: "hidden",
          minHeight: 480,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          transform: `translateX(${flyTranslateX}px) rotate(${flyRotate}deg)`,
          transition: isDragging ? "none" : "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
          touchAction: "pan-y",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onPointerDown={(e) => onPointerDown(e.clientX)}
        onPointerMove={(e) => onPointerMove(e.clientX)}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Job image */}
        {currentJob.image_url ? (
          <div style={{ height: 200, overflow: "hidden", position: "relative" }}>
            <Image
              src={currentJob.image_url}
              alt={currentJob.title}
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              height: 160,
              background: "#f5f5f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "3rem",
            }}
          >
            💼
          </div>
        )}

        {/* Swipe direction indicators */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: "6px 14px",
            borderRadius: 8,
            border: "3px solid #21d07a",
            color: "#21d07a",
            fontWeight: 800,
            fontSize: "1.1rem",
            letterSpacing: "0.05em",
            opacity: isLiking ? overlayOpacity : 0,
            transform: `rotate(-15deg)`,
            transition: "opacity 0.1s ease",
            pointerEvents: "none",
          }}
        >
          YES
        </div>
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            padding: "6px 14px",
            borderRadius: 8,
            border: "3px solid #fd5564",
            color: "#fd5564",
            fontWeight: 800,
            fontSize: "1.1rem",
            letterSpacing: "0.05em",
            opacity: isSkipping ? overlayOpacity : 0,
            transform: `rotate(15deg)`,
            transition: "opacity 0.1s ease",
            pointerEvents: "none",
          }}
        >
          NOPE
        </div>

        {/* Card content */}
        <div style={{ padding: "1.1rem 1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
            <div>
              <p
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#a3a3a3",
                  margin: 0,
                }}
              >
                {currentJob.company_name || "Company"}
              </p>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#111111",
                  margin: "0.2rem 0 0",
                  lineHeight: 1.15,
                }}
              >
                {currentJob.title}
              </h2>
            </div>
          </div>

          <p
            style={{
              marginTop: "0.4rem",
              fontSize: "0.85rem",
              color: "#737373",
              display: "flex",
              gap: "0.35rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {currentJob.city && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: "0.8rem" }}>📍</span> {currentJob.city}
              </span>
            )}
            {currentJob.city && (currentJob.employment_type || currentJob.salary_per_hour) && (
              <span style={{ color: "#e8e8e8" }}>·</span>
            )}
            {currentJob.employment_type && <span>{currentJob.employment_type}</span>}
            {currentJob.employment_type && currentJob.salary_per_hour && (
              <span style={{ color: "#e8e8e8" }}>·</span>
            )}
            {currentJob.salary_per_hour && (
              <span style={{ fontWeight: 600, color: "#111111" }}>{currentJob.salary_per_hour}</span>
            )}
          </p>

          {currentJob.description && (
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.9rem",
                color: "#4a4a4a",
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {currentJob.description}
            </p>
          )}

          {currentJob.category && (
            <span
              className="chip"
              style={{ display: "inline-block", marginTop: "0.75rem" }}
            >
              {currentJob.category}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
        <button
          type="button"
          className="secondary-btn"
          style={{ flex: 1, padding: "0.9rem", fontSize: "0.95rem" }}
          onClick={() => triggerDecision(currentJob, "skip")}
        >
          {skipLabel}
        </button>
        <button
          type="button"
          className="cta-btn"
          style={{ flex: 1, padding: "0.9rem", fontSize: "0.95rem" }}
          onClick={() => triggerDecision(currentJob, "interested")}
        >
          {interestedLabel}
        </button>
      </div>
    </div>
  );
}
