"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PROFILE_JOURNEY, profileStepUrl, type ProfileJourneyStep } from "@/lib/profile-journey";
import { useRememberProfileStep } from "../profile-journey";
import { useSession } from "@/hooks/use-session";
import { useRecruitmentProfile } from "@/hooks/use-recruitment-profile";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { completedProfileSections } from "@/lib/recruitment-profile";
import { UiIcon } from "../ui-icon";
import styles from "./profile-steps.module.css";

const PAUSE_HREF = "/profile?tab=work";

/** Mobile (under 720px): back to the previous step, "Steg X av 5", five progress segments and the pause link. */
export function StepHeader({ step }: { step: ProfileJourneyStep }) {
  const remember = useRememberProfileStep(step);
  const index = PROFILE_JOURNEY.findIndex(item => item.key === step);
  const previous = PROFILE_JOURNEY[index - 1];
  return <div className={`${styles.header} ${styles.mobileOnly}`}>
    <div className={styles.headerTop}>
      <Link className={styles.back} href={previous ? profileStepUrl(previous.key) : "/profile/build"} aria-label={previous ? `Föregående steg: ${previous.title}` : "Till profilbygget"}><UiIcon name="chevron-left" width="22" height="22" strokeWidth="2" /></Link>
      <span className={styles.stepCount}>Steg {index + 1} av {PROFILE_JOURNEY.length}</span>
      <Link className={styles.pause} href={PAUSE_HREF} onClick={remember}>Pausa och fortsätt senare</Link>
    </div>
    <div className={styles.segments} aria-hidden="true">{PROFILE_JOURNEY.map((item, i) => <span key={item.key} className={i <= index ? styles.filled : ""} />)}</div>
  </div>;
}

/** Desktop: the five steps (done, current, upcoming) with links, the pause link and an optional info box. */
export function StepRail({ step, done, info }: { step: ProfileJourneyStep; done: readonly ProfileJourneyStep[]; info?: ReactNode }) {
  const remember = useRememberProfileStep(step);
  return <aside className={`${styles.rail} ${styles.desktopOnly}`}>
    <Link className={styles.railBack} href="/profile/build"><UiIcon name="chevron-left" width="16" height="16" strokeWidth="2" />Profilbygget</Link>
    <ol aria-label="Steg i profilbygget">{PROFILE_JOURNEY.map((item, i) => {
      const current = item.key === step, complete = !current && done.includes(item.key);
      return <li key={item.key}><Link href={profileStepUrl(item.key)} aria-current={current ? "step" : undefined}>
        <span className={`${styles.marker} ${current ? styles.markerCurrent : complete ? styles.markerDone : ""}`} aria-hidden="true">{complete ? <UiIcon name="check" width="14" height="14" strokeWidth="2.8" /> : i + 1}</span>
        {item.title}{complete && <span className="sr-only"> (klar)</span>}
      </Link></li>;
    })}</ol>
    <Link className={styles.railPause} href={PAUSE_HREF} onClick={remember}>Pausa och fortsätt senare</Link>
    {info}
  </aside>;
}

/** Journey page for a step in the new design. CV facts sit in the rail on desktop; the form shows its own toggle on mobile. */
export function ProfileStepPage({ step, done, cvFacts, children, as: Outer = "main" }: { step: ProfileJourneyStep; done: readonly ProfileJourneyStep[]; cvFacts?: string; children: ReactNode; as?: "main" | "div" }) {
  const [showCv, setShowCv] = useState(false);
  const info = cvFacts ? <div className={styles.info}>
    <strong>Redan i ditt CV</strong>
    <p>Det du skrivit i CV:t används automatiskt. Här lägger du bara till det som saknas.</p>
    <button type="button" aria-expanded={showCv} onClick={() => setShowCv(open => !open)}>{showCv ? "Dölj uppgifterna" : "Visa uppgifterna"}</button>
    {showCv && <p className={styles.cvFacts}>{cvFacts}</p>}
  </div> : undefined;
  return <Outer className={styles.page}>
    <StepHeader step={step} />
    <div className={styles.layout}>
      <StepRail step={step} done={done} info={info} />
      <div className={styles.main}>{children}</div>
    </div>
  </Outer>;
}

/** Step frame for pages that are not the profile editor (the CV step): loads progress itself and wraps a page that has its own <main>. */
export function JourneyStepFrame({ step, children }: { step: ProfileJourneyStep; children: ReactNode }) {
  const { user, profile } = useSession();
  const youth = profile?.role === "youth";
  const state = useRecruitmentProfile(youth ? user?.id : undefined);
  const { cvCompleted } = useCvCompletion(user?.id, youth);
  const done = [...(cvCompleted ? ["cv" as const] : []), ...completedProfileSections(state.profile)] as ProfileJourneyStep[];
  return <ProfileStepPage as="div" step={step} done={done}><div className={styles.framed}>{children}</div></ProfileStepPage>;
}
