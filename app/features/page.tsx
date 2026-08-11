"use client";

import Link from "next/link";
import {
  aiCapabilities,
  companyFeatures,
  individualFeatures,
  processSteps,
  youthFeatures,
} from "@/lib/features-data";
import { MarketingNav } from "@/components/marketing-nav";
import "../landing.css";
import "./features.css";

export default function FeaturesPage() {
  return (
    <main className="features-page">
      <MarketingNav />

      <section className="features-hero">
        <h1>Hitta jobb. Hitta personal. Enklare.</h1>
        <p>Employo samlar hela vägen från första swipe till första arbetsdagen – för ungdomar, företag och privatpersoner.</p>
      </section>

      <section className="features-section">
        <h2>Ditt nästa jobb börjar här.</h2>
        <p className="features-section-eyebrow">För ungdomar</p>
        <div className="features-grid features-grid-3">
          {youthFeatures.map((feature) => (
            <article key={feature.title} className="features-card">
              <span className="features-icon" aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="features-section features-section-tinted">
        <h2>Hitta rätt ungdom snabbare.</h2>
        <p className="features-section-eyebrow">För företag</p>
        <div className="features-grid features-grid-4">
          {companyFeatures.map((feature) => (
            <article key={feature.title} className="features-card features-card-compact">
              <span className="features-icon" aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="features-section">
        <h2>Behöver du hjälp? Lägg ut jobbet.</h2>
        <p className="features-section-eyebrow">För privatpersoner</p>
        <p className="features-intro">Från snöskottning till lövkrattning – hitta ungdomar som kan hjälpa till nära dig.</p>
        <div className="features-grid features-grid-4">
          {individualFeatures.map((feature) => (
            <article key={feature.title} className="features-card features-card-compact">
              <span className="features-icon" aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="features-ai">
        <div className="features-ai-copy">
          <h2>AI som gör jobbsökandet enklare.</h2>
          <ul className="features-ai-list">
            {aiCapabilities.map((item) => (
              <li key={item}><span aria-hidden="true">✦</span>{item}</li>
            ))}
          </ul>
        </div>
        <div className="features-ai-mock" aria-hidden="true">
          <div className="features-ai-mock-header">
            <span /><span /><span />
            <b>AI-assistent</b>
          </div>
          <div className="features-ai-mock-bubble features-ai-mock-bubble-user">Hjälp mig skriva ett CV för mitt första jobb.</div>
          <div className="features-ai-mock-bubble features-ai-mock-bubble-ai">Klart! Berätta kort om dig – jag formulerar resten.</div>
          <div className="features-ai-mock-bubble features-ai-mock-bubble-user">Jag har jobbat i en kiosk och gillar att prata med folk.</div>
          <div className="features-ai-mock-typing"><span /><span /><span /></div>
        </div>
      </section>

      <section className="features-match">
        <h2>Rätt person. Rätt jobb.</h2>
        <div className="features-match-flow">
          <div className="features-match-node">
            <span className="features-match-label">Ungdom</span>
            <p>Profil, erfarenhet, intressen, tillgänglighet</p>
          </div>
          <span className="features-match-arrow" aria-hidden="true">↓</span>
          <div className="features-match-node features-match-node-ai">
            <span className="features-match-label">AI-matchning</span>
          </div>
          <span className="features-match-arrow" aria-hidden="true">↓</span>
          <div className="features-match-node">
            <span className="features-match-label">Företag</span>
            <p>Jobb, krav, plats, arbetstider</p>
          </div>
          <span className="features-match-arrow" aria-hidden="true">↓</span>
          <div className="features-match-result">Match</div>
        </div>
      </section>

      <section className="features-process">
        <h2>Från första swipe till första arbetsdag.</h2>
        <div className="features-process-steps">
          {processSteps.map((step, index) => (
            <span key={step} className="features-process-step">
              {step}
              {index < processSteps.length - 1 && <b aria-hidden="true">→</b>}
            </span>
          ))}
        </div>
        <Link href="/signup" className="landing-bold-primary">Kom igång</Link>
      </section>

      <footer className="landing-bold-footer">
        <span>© 2026 Employo</span>
        <span>En enklare väg från nyfiken till anställd.</span>
      </footer>
    </main>
  );
}
