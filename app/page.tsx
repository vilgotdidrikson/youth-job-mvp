"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";

const copy = {
  sv: {
    login: "Logga in",
    language: "Språk",
    eyebrow: "Jobb för unga, på ditt sätt",
    title: "Hitta ett jobb som",
    titleAccent: "passar dig.",
    body: "Employo gör det enkelt för unga att hitta sitt nästa jobb – och för företag att hitta rätt person.",
    primary: "Kom igång",
    secondary: "För företag",
    note: "Gratis att skapa konto",
    cardLabel: "Nytt jobb nära dig",
    cardTitle: "Cafémedarbetare",
    cardCompany: "Kvarterscafét · Stockholm",
    cardTag: "Deltid",
    cardAge: "Från 16 år",
    match: "98% match",
    trust: "En enklare väg från nyfiken till anställd.",
  },
  en: {
    login: "Log in",
    language: "Language",
    eyebrow: "Jobs for young people, your way",
    title: "Find a job that",
    titleAccent: "fits you.",
    body: "Employo makes it easy for young people to find their next job – and for businesses to find the right person.",
    primary: "Get started",
    secondary: "For businesses",
    note: "Free to create an account",
    cardLabel: "New job near you",
    cardTitle: "Café team member",
    cardCompany: "Kvarterscafét · Stockholm",
    cardTag: "Part time",
    cardAge: "From age 16",
    match: "98% match",
    trust: "A simpler path from curious to hired.",
  },
};

export default function Home() {
  const { language, toggleLanguage } = useLanguage();
  const t = copy[language];

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Huvudnavigation">
        <div className="landing-nav-actions">
          <Link href="/login" className="landing-login">{t.login}</Link>
          <button type="button" className="landing-language" onClick={toggleLanguage}>
            <span className="landing-language-icon" aria-hidden="true">◎</span>
            {t.language}
            <span aria-hidden="true">{language === "sv" ? "EN" : "SV"}</span>
          </button>
        </div>
        <Link className="landing-logo" href="/" aria-label="Employo startsida">
          <span className="landing-logo-mark">E</span>
          <span>employo</span>
        </Link>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow"><span />{t.eyebrow}</p>
          <h1>{t.title}<br /><em>{t.titleAccent}</em></h1>
          <p className="landing-description">{t.body}</p>
          <div className="landing-cta-group">
            <Link href="/signup" className="landing-primary-cta">
              {t.primary}<span aria-hidden="true">↗</span>
            </Link>
            <Link href="/signup" className="landing-text-cta">{t.secondary}<span aria-hidden="true">→</span></Link>
          </div>
          <p className="landing-note"><span aria-hidden="true">✦</span>{t.note}</p>
        </div>

        <div className="landing-visual" aria-label="Exempel på jobbmatchning">
          <div className="landing-sun" />
          <div className="landing-orbit landing-orbit-one" />
          <div className="landing-orbit landing-orbit-two" />
          <div className="landing-job-card">
            <div className="landing-card-topline">
              <span>{t.cardLabel}</span>
              <button aria-label="Spara jobb" type="button">♡</button>
            </div>
            <div className="landing-card-image">
              <div className="landing-cup"><i /><b /></div>
              <span className="landing-card-sparkle">✦</span>
            </div>
            <div className="landing-card-content">
              <p>{t.cardTitle}</p>
              <span>{t.cardCompany}</span>
              <div className="landing-card-tags"><small>{t.cardTag}</small><small>{t.cardAge}</small></div>
            </div>
          </div>
          <div className="landing-match-pill"><span>✦</span>{t.match}</div>
          <div className="landing-face landing-face-one">☺</div>
          <div className="landing-face landing-face-two">✦</div>
        </div>
      </section>

      <footer className="landing-footer"><span>© 2026 Employo</span><span>{t.trust}</span></footer>
    </main>
  );
}
