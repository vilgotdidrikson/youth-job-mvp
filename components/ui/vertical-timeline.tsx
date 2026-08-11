"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  number: string;
  title: string;
  body: string;
}

export interface VerticalTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function VerticalTimeline({ steps, className }: VerticalTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let frame: number | null = null;

    const update = () => {
      frame = null;
      const rect = node.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const total = rect.height + viewportH * 0.5;
      const covered = viewportH * 0.85 - rect.top;
      const pct = Math.min(Math.max(covered / total, 0), 1);
      setProgress(pct);
    };

    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("vertical-timeline", className)}
      style={{ "--timeline-progress": progress } as CSSProperties}
    >
      <div className="vertical-timeline-track">
        <div className="vertical-timeline-fill" />
      </div>
      <ol className="vertical-timeline-list">
        {steps.map((step, index) => {
          const active = progress >= (index + 0.5) / steps.length;
          return (
            <li key={step.number} className="vertical-timeline-item">
              <span className={cn("vertical-timeline-node", active && "vertical-timeline-node-active")}>
                {step.number}
              </span>
              <div className="vertical-timeline-content">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
