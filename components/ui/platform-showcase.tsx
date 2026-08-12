"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PlatformItem {
  id: string;
  title: string;
  body: string;
  icon: string;
  visual: ReactNode;
}

export interface PlatformShowcaseProps {
  items: PlatformItem[];
  heading?: ReactNode;
  subheading?: ReactNode;
  className?: string;
}

export function PlatformShowcase({ items, heading, subheading, className }: PlatformShowcaseProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let raf = 0;

    const update = () => {
      raf = 0;
      const panelHeight = scroller.clientHeight;
      if (!panelHeight) return;

      const rawIndex = scroller.scrollTop / panelHeight;
      const clampedIndex = Math.min(Math.max(rawIndex, 0), items.length - 1);
      const activeIndex = Math.min(Math.floor(clampedIndex), items.length - 1);
      const withinProgress = Math.min(Math.max((clampedIndex - activeIndex) * 100, 0), 100);

      setActive(activeIndex);
      setProgress(withinProgress);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items.length]);

  const selectItem = (index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: index * scroller.clientHeight, behavior: "smooth" });
  };

  return (
    <div className={cn("platform-showcase", className)}>
      <div className="platform-showcase-text-col">
        {(heading || subheading) && (
          <div className="platform-showcase-intro">
            {heading && <h2>{heading}</h2>}
            {subheading && <p>{subheading}</p>}
          </div>
        )}

        <div className="platform-showcase-list" role="tablist" aria-orientation="vertical">
          {items.map((item, index) => {
            const isActive = index === active;
            return (
              <div key={item.id} className={cn("platform-showcase-item", isActive && "platform-showcase-item-active")}>
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
                    style={{ width: isActive ? `${progress}%` : index < active ? "100%" : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="platform-showcase-image-col" ref={scrollerRef} aria-hidden="true">
        {items.map((item) => (
          <div key={item.id} className="platform-showcase-image-panel">
            <div className="platform-showcase-image-frame">{item.visual}</div>
          </div>
        ))}
      </div>

      <div className="platform-showcase-mobile">
        {items.map((item) => (
          <div key={item.id} className="platform-showcase-mobile-item">
            <div className="platform-showcase-mobile-visual">{item.visual}</div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
