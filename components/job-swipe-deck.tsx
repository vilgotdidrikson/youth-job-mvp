"use client";

import { jobCities } from "@/lib/job-workplaces";
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
  onClearFilters?: () => void;
  interestedLabel: string;
  skipLabel: string;
  swipeHint: string;
}

export function JobSwipeDeck({ jobs, onDecision, onSave, savedIds, emptyTitle, emptySubtitle, onClearFilters, interestedLabel, skipLabel, swipeHint }: JobSwipeDeckProps) {
  const [dragX, setDragX] = useState(0);
  const [flyDir, setFlyDir] = useState<"left" | "right" | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const startX = useRef<number | null>(null);
  const startY = useRef(0);
  const suppressClick = useRef(false);
  const activePointer = useRef<number | null>(null);
  const actionLock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentJob = jobs[0];
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const resetDrag = () => { startX.current = null; activePointer.current = null; setDragX(0); };
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
    }, reduced ? 0 : 160);
  };
  const save = async () => {
    if (!currentJob || saving) return;
    setSaving(true); setActionError("");
    try { await onSave(currentJob, !savedIds.has(currentJob.id)); }
    catch { setActionError("Jobbet kunde inte sparas. Försök igen."); }
    finally { setSaving(false); }
  };

  if (!currentJob) return <section className={styles.empty} aria-live="polite"><span className={styles.emptyIcon}><UiIcon name="discover" width="32" height="32"/></span><h2>{emptyTitle}</h2><p>{emptySubtitle}</p><>{onClearFilters ? <button type="button" className={styles.textLink} onClick={onClearFilters}>Rensa filter <UiIcon name="arrow"/></button> : <Link href="/swipe" className={styles.textLink}>Utforska jobb <UiIcon name="arrow"/></Link>}</></section>;
  const image = currentJob.image_url?.split(",")[0]?.trim();
  const saved = savedIds.has(currentJob.id);
  return <div className={styles.deck}>
    <article className={styles.jobCard}
      style={{ transform: flyDir ? `translateX(${flyDir === "right" ? 600 : -600}px) rotate(${flyDir === "right" ? 12 : -12}deg)` : `translateX(${dragX}px) rotate(${dragX * .025}deg)`, transition: startX.current !== null ? "none" : undefined }}
      onPointerDown={event => { if (busy || saving || actionLock.current || startX.current !== null || !event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest("button,input,textarea,select")) return; activePointer.current = event.pointerId; startX.current = event.clientX; startY.current = event.clientY; suppressClick.current = false; }}
      onPointerMove={event => { if (startX.current !== null && event.pointerId === activePointer.current) { const dx=event.clientX-startX.current, dy=event.clientY-startY.current; if (Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)*1.2) { suppressClick.current=true; event.currentTarget.setPointerCapture(event.pointerId); setDragX(dx); } } }}
      onClickCapture={event => {if(suppressClick.current) {event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}
      onDragStart={event => event.preventDefault()}
      onPointerUp={event => { if (startX.current === null || event.pointerId !== activePointer.current) return; const delta = event.clientX - startX.current; if (suppressClick.current && delta > 60) decide("interested"); else if (suppressClick.current && delta < -60) decide("skip"); else resetDrag(); }}
      onPointerCancel={event => { if (event.pointerId === activePointer.current) resetDrag(); }} onLostPointerCapture={event => { if (event.pointerId === activePointer.current) resetDrag(); }}>
      {image ? <Image src={image} alt="" fill sizes="(max-width: 720px) 100vw, 680px" priority draggable={false} className={styles.jobImage}/> : <div className={styles.imageFallback}><span><UiIcon name="briefcase" width="56" height="56"/></span></div>}
      <div className={styles.imageShade}/>
      <div className={styles.cardTop}><span className={styles.cardBadge}>{currentJob.is_boosted ? "Framhävd annons" : `${jobs.length} ${jobs.length === 1 ? "jobb" : "jobb att upptäcka"}`}</span><button className={styles.bookmark} type="button" aria-label={saved ? "Ta bort sparat jobb" : "Spara jobbet till senare"} aria-pressed={saved} disabled={saving || busy} onClick={() => void save()}><UiIcon name="bookmark" fill={saved ? "currentColor" : "none"}/></button></div>
      {Math.abs(dragX) > 20 && <span className={`${styles.swipeFeedback} ${dragX > 0 ? styles.feedbackYes : ""}`}>{dragX > 0 ? "Intresserad" : "Inte nu"}</span>}
      <div className={styles.cardContent}><p className={styles.company}>{currentJob.company_name || "Arbetsgivare"}</p><h2><Link href={`/jobb/${encodeURIComponent(currentJob.id)}`}>{currentJob.title}</Link></h2><div className={styles.cardChips}>{[jobCities(currentJob), currentJob.employment_type, currentJob.salary_per_hour].filter(Boolean).map((text, index) => <span key={index}>{text}</span>)}</div></div>
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
