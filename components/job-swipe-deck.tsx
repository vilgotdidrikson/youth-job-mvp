"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "./ui-icon";
import styles from "./job-discovery.module.css";
import type { JobPost, SwipeDecision } from "@/lib/types";

interface JobSwipeDeckProps {
  jobs: JobPost[];
  onDecision: (job: JobPost, decision: SwipeDecision) => Promise<void>;
  onSave: (job: JobPost, saved: boolean) => Promise<void>;
  savedIds: Set<string>;
  emptyTitle: string;
  emptySubtitle: string;
  interestedLabel: string;
  skipLabel: string;
  swipeHint: string;
}

export function JobSwipeDeck({ jobs, onDecision, onSave, savedIds, emptyTitle, emptySubtitle, interestedLabel, skipLabel, swipeHint }: JobSwipeDeckProps) {
  const [dragX, setDragX] = useState(0);
  const [flyDir, setFlyDir] = useState<"left" | "right" | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const startX = useRef<number | null>(null);
  const actionLock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentJob = jobs[0];
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const resetDrag = () => { startX.current = null; setDragX(0); };
  const decide = (decision: SwipeDecision) => {
    if (!currentJob || actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setActionError(""); resetDrag();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) setFlyDir(decision === "interested" ? "right" : "left");
    timer.current = setTimeout(() => {
      void onDecision(currentJob, decision).catch(() => {
        setActionError("Ditt val kunde inte sparas. Försök igen.");
      }).finally(() => { actionLock.current = false; setBusy(false); setFlyDir(null); });
    }, reduced ? 0 : 240);
  };
  const save = async () => {
    if (!currentJob || saving) return;
    setSaving(true); setActionError("");
    try { await onSave(currentJob, !savedIds.has(currentJob.id)); }
    catch { setActionError("Jobbet kunde inte sparas. Försök igen."); }
    finally { setSaving(false); }
  };

  if (!currentJob) return <section className={styles.empty} aria-live="polite"><span className={styles.emptyIcon}><UiIcon name="discover" width="32" height="32"/></span><h2>{emptyTitle}</h2><p>{emptySubtitle}</p><Link href="/swipe" className={styles.textLink}>Utforska jobb <UiIcon name="arrow"/></Link></section>;
  const image = currentJob.image_url?.split(",")[0]?.trim();
  const saved = savedIds.has(currentJob.id);
  return <div className={styles.deck}>
    <article className={styles.jobCard}
      style={{ transform: flyDir ? `translateX(${flyDir === "right" ? 600 : -600}px) rotate(${flyDir === "right" ? 12 : -12}deg)` : `translateX(${dragX}px) rotate(${dragX * .025}deg)`, transition: startX.current !== null ? "none" : undefined }}
      onPointerDown={event => { if (busy || event.button !== 0 || (event.target as HTMLElement).closest("a,button")) return; startX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (startX.current !== null) setDragX(event.clientX - startX.current); }}
      onDragStart={event => event.preventDefault()}
      onPointerUp={event => { if (startX.current === null) return; const delta = event.clientX - startX.current; if (delta > 90) decide("interested"); else if (delta < -90) decide("skip"); else resetDrag(); }}
      onPointerCancel={resetDrag} onLostPointerCapture={resetDrag}>
      {image ? <Image src={image} alt="" fill sizes="(max-width: 720px) 100vw, 680px" priority draggable={false} className={styles.jobImage}/> : <div className={styles.imageFallback}><span><UiIcon name="briefcase" width="56" height="56"/></span></div>}
      <div className={styles.imageShade}/>
      <div className={styles.cardTop}><span className={styles.cardBadge}>{currentJob.is_boosted ? "Framhävd annons" : `${jobs.length} ${jobs.length === 1 ? "jobb" : "jobb att upptäcka"}`}</span><button className={styles.bookmark} type="button" aria-label={saved ? "Ta bort sparat jobb" : "Spara jobbet till senare"} aria-pressed={saved} disabled={saving || busy} onClick={() => void save()}><UiIcon name="bookmark" fill={saved ? "currentColor" : "none"}/></button></div>
      {Math.abs(dragX) > 20 && <span className={`${styles.swipeFeedback} ${dragX > 0 ? styles.feedbackYes : ""}`}>{dragX > 0 ? "Intresserad" : "Inte nu"}</span>}
      <div className={styles.cardContent}><p className={styles.company}>{currentJob.company_name || "Arbetsgivare"}</p><h2><Link href={`/jobb/${encodeURIComponent(currentJob.id)}`}>{currentJob.title}</Link></h2><div className={styles.cardChips}>{[currentJob.city, currentJob.employment_type, currentJob.salary_per_hour].filter(Boolean).map((text, index) => <span key={index}>{text}</span>)}</div></div>
    </article>
    <div className={styles.actions}>
      <button type="button" className={styles.action} disabled={busy || saving} onClick={() => decide("skip")}><span><UiIcon name="close"/></span><span>{skipLabel}</span></button>
      <button type="button" className={`${styles.action} ${styles.interested}`} disabled={busy || saving} onClick={() => decide("interested")}><span><UiIcon name="heart"/></span><span>{interestedLabel}</span></button>
      <Link className={styles.action} href={`/jobb/${encodeURIComponent(currentJob.id)}`}><span><UiIcon name="info"/></span><span>Detaljer</span></Link>
    </div>
    <p className={styles.swipeHint}>{busy ? "Sparar ditt val…" : swipeHint}</p>
    {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
  </div>;
}
