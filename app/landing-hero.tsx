"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UiIcon } from "@/components/ui-icon";
import { useAppDestination } from "@/hooks/use-app-destination";

const heroHeadlines = [
  { title: "Ditt första jobb", accent: "börjar här." },
  { title: "En enklare väg till rätt", accent: "rekrytering." },
];

const firstHeadline = `${heroHeadlines[0].title}\n${heroHeadlines[0].accent}`;

function AnimatedHeroHeadline() {
  const [headlineIndex, setHeadlineIndex] = useState(0);
  // Starts fully written, so the server HTML and visitors without JavaScript
  // see the first headline; the loop then deletes it and types the next one.
  const [visibleText, setVisibleText] = useState(firstHeadline);
  const [isDeleting, setIsDeleting] = useState(false);
  const headline = heroHeadlines[headlineIndex];
  const fullHeadline = `${headline.title}\n${headline.accent}`;

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion ? 0 : isDeleting ? 38 : 55;
    const timer = setTimeout(() => {
      if (reducedMotion) {
        setVisibleText(fullHeadline);
        return;
      }

      if (!isDeleting && visibleText.length < fullHeadline.length) {
        setVisibleText(fullHeadline.slice(0, visibleText.length + 1));
        return;
      }

      if (!isDeleting) {
        setIsDeleting(true);
        return;
      }

      if (visibleText.length > 0) {
        setVisibleText(fullHeadline.slice(0, visibleText.length - 1));
        return;
      }

      setHeadlineIndex((current) => (current + 1) % heroHeadlines.length);
      setIsDeleting(false);
    }, visibleText.length === fullHeadline.length && !isDeleting ? 1700 : delay);

    return () => clearTimeout(timer);
  }, [fullHeadline, isDeleting, visibleText]);

  const visibleTitle = visibleText.slice(0, headline.title.length);
  const visibleAccent = visibleText.slice(headline.title.length + 1);
  const isWritingAccent = visibleText.length > headline.title.length;

  // Invisible copies of every headline share one grid cell with the typed text,
  // so the heading always keeps the height of the longest headline and the
  // buttons below never move or overlap, whatever the zoom level.
  return (
    <h1 className="landing-bold-title" aria-label={`${headline.title} ${headline.accent}`}>
      {heroHeadlines.map((item) => (
        <span key={item.title} className="landing-bold-title-sizer" aria-hidden="true">
          {item.title}
          <br />
          <em>{item.accent}</em>
        </span>
      ))}
      <span aria-hidden="true">
        {visibleTitle}{!isWritingAccent && <span className="landing-hero-caret" />}
        <br />
        <em>{visibleAccent}{isWritingAccent && <span className="landing-hero-caret" />}</em>
      </span>
    </h1>
  );
}

export function LandingHero({ primary, secondary }: { primary: string; secondary: string }) {
  const { isAuthenticated, destination } = useAppDestination();

  return (
    <section className="landing-bold-hero">
      <AnimatedHeroHeadline />
      <div className="landing-bold-actions">
        {isAuthenticated ? (
          <Link href={destination ?? "/login"} className="landing-bold-primary">
            Gå till appen<span aria-hidden="true"><UiIcon name="arrow" width=".75em" height=".75em" /></span>
          </Link>
        ) : (
          <>
            <Link
              href="/signup?role=company"
              className="landing-bold-secondary"
              style={{ border: "1.5px solid #d65f85", background: "#ffffff" }}
            >
              {secondary}
            </Link>
            <Link href="/signup" className="landing-bold-primary">
              {primary}<span aria-hidden="true"><UiIcon name="arrow" width=".75em" height=".75em" /></span>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
