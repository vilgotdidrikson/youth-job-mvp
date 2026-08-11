"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PlatformItem {
  id: string;
  title: string;
  body: string;
  icon: string;
}

export interface PlatformShowcaseProps {
  items: PlatformItem[];
  duration?: number;
  className?: string;
}

const STEP_MS = 50;

export function PlatformShowcase({ items, duration = 5000, className }: PlatformShowcaseProps) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const step = (STEP_MS / duration) * 100;
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          setActive((prevActive) => (prevActive + 1) % items.length);
          return 0;
        }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(interval);
  }, [duration, items.length]);

  const selectItem = (index: number) => {
    setActive(index);
    setProgress(0);
  };

  return (
    <div
      className={cn("platform-showcase", className)}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="platform-showcase-accordion" role="tablist" aria-orientation="vertical">
        {items.map((item, index) => {
          const isActive = index === active;
          return (
            <div key={item.id} className="platform-showcase-item">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-expanded={isActive}
                className="platform-showcase-trigger"
                onClick={() => selectItem(index)}
              >
                {item.title}
              </button>
              {isActive && <p className="platform-showcase-body">{item.body}</p>}
              <div className="platform-showcase-rule">
                <div
                  className="platform-showcase-progress"
                  style={{ width: isActive ? `${progress}%` : "0%" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="platform-showcase-visual" aria-hidden="true">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn("platform-showcase-panel", index === active && "platform-showcase-panel-active")}
          >
            <span className="platform-showcase-panel-icon">{item.icon}</span>
            <span className="platform-showcase-panel-title">{item.title}</span>
          </div>
        ))}
      </div>

      <div className="platform-showcase-mobile">
        {items.map((item) => (
          <div key={item.id} className="platform-showcase-mobile-item">
            <span className="platform-showcase-panel-icon">{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
