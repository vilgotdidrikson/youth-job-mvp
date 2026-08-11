"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface InfiniteMovingCardItem {
  icon: string;
  title: string;
  body: string;
}

export interface InfiniteMovingCardsProps {
  items: InfiniteMovingCardItem[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  className?: string;
}

const DURATION_BY_SPEED: Record<NonNullable<InfiniteMovingCardsProps["speed"]>, string> = {
  fast: "22s",
  normal: "38s",
  slow: "58s",
};

export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  className,
}: InfiniteMovingCardsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    if (!track.dataset.duplicated) {
      const originalItems = Array.from(track.children);
      originalItems.forEach((item) => {
        const clone = item.cloneNode(true);
        if (clone instanceof HTMLElement) clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
      track.dataset.duplicated = "true";
    }

    container.style.setProperty("--marquee-direction", direction === "left" ? "forwards" : "reverse");
    container.style.setProperty("--marquee-duration", DURATION_BY_SPEED[speed]);
  }, [direction, speed]);

  return (
    <div ref={containerRef} className={cn("infinite-cards", className)}>
      <ul ref={trackRef} className="infinite-cards-track" aria-label="Funktioner">
        {items.map((item) => (
          <li key={item.title} className="infinite-cards-item">
            <span className="infinite-cards-icon" aria-hidden="true">{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
