"use client";
import { useEffect, useRef } from "react";
/** Only the displayed card counts, after a continuous visible second. */
export function useJobImpression(jobId: string | undefined, onSeen?: (id: string) => Promise<void>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !jobId || !onSeen || typeof IntersectionObserver === "undefined") return;
    let visible = false, stopped = false, attempts = 0, completed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      if (!visible || document.visibilityState !== "visible" || completed || attempts >= 2 || stopped) return;
      timer = setTimeout(() => {
        attempts++;
        void onSeen(jobId).then(() => { completed = true; }).catch(() => { if (!stopped) update(); });
      }, 1000);
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio >= .5);
      update();
    }, { threshold: [.5] });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { stopped = true; clearTimeout(timer); observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [jobId, onSeen]);
  return ref;
}
