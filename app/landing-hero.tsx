"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UiIcon } from "@/components/ui-icon";
import { useAppDestination } from "@/hooks/use-app-destination";

const heroHeadlines = [
  { title: "Ditt första jobb", accent: "börjar här." },
  { title: "En enklare väg till rätt", accent: "rekrytering." },
];

const HOLD_MS = 1700;
const TYPE_MS = 55;
const DELETE_MS = 38;

/**
 * Only the last phrase is typed; the first line is always written out. Server HTML,
 * visitors without JavaScript and reduced motion get the first headline as still text,
 * and screen readers always get that full headline.
 */
function AnimatedHeroHeadline() {
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [visibleAccent, setVisibleAccent] = useState(heroHeadlines[0].accent);
  const [isDeleting, setIsDeleting] = useState(false);
  const headline = heroHeadlines[headlineIndex];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const full = headline.accent;
    const written = visibleAccent.length === full.length;
    const timer = setTimeout(() => {
      if (!isDeleting && !written) setVisibleAccent(full.slice(0, visibleAccent.length + 1));
      else if (!isDeleting) setIsDeleting(true);
      else if (visibleAccent.length > 0) setVisibleAccent(visibleAccent.slice(0, -1));
      else {
        setHeadlineIndex((current) => (current + 1) % heroHeadlines.length);
        setIsDeleting(false);
      }
    }, written && !isDeleting ? HOLD_MS : isDeleting ? DELETE_MS : TYPE_MS);
    return () => clearTimeout(timer);
  }, [headline.accent, isDeleting, visibleAccent]);

  // Invisible copies of every headline share one grid cell with the typed text,
  // so the heading keeps the height of the longest one and nothing below moves.
  return (
    <h1 className="landing-bold-title">
      <span className="sr-only">{`${heroHeadlines[0].title} ${heroHeadlines[0].accent}`}</span>
      {heroHeadlines.map((item) => (
        <span key={item.title} className="landing-bold-title-sizer" aria-hidden="true">
          {item.title}
          <br />
          <em>{item.accent}</em>
        </span>
      ))}
      <span aria-hidden="true">
        <span key={headline.title} className="landing-hero-stem">{headline.title}</span>
        <br />
        <em>{visibleAccent}<span className="landing-hero-caret" /></em>
      </span>
    </h1>
  );
}

/** Sign-up actions, or a way back into the app for a signed-in visitor. */
export function LandingActions({ primary, secondary }: { primary: string; secondary: string }) {
  const { isAuthenticated, destination } = useAppDestination();
  const arrow = <span aria-hidden="true"><UiIcon name="arrow" width=".75em" height=".75em" /></span>;

  return (
    <div className="landing-bold-actions">
      {isAuthenticated ? (
        <Link href={destination ?? "/login"} className="landing-bold-primary">Gå till appen{arrow}</Link>
      ) : (
        <>
          <Link href="/signup?role=company" className="landing-bold-secondary">{secondary}</Link>
          <Link href="/signup" className="landing-bold-primary">{primary}{arrow}</Link>
        </>
      )}
    </div>
  );
}

export function LandingHero({ id, primary, secondary }: { id: string; primary: string; secondary: string }) {
  return (
    <section className="landing-bold-hero" id={id}>
      <AnimatedHeroHeadline />
      <LandingActions primary={primary} secondary={secondary} />
    </section>
  );
}
