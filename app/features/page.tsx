import type { Metadata } from "next";
import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import {
  aiCapabilities,
  companyFeatures,
  processSteps,
  youthFeatures,
} from "@/lib/features-data";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { CandidatePreview, SwipeCardPreview } from "@/components/marketing-product-preview";
import "../landing.css";
import "./features.css";

const heroBody = "MatchnWork samlar hela vägen från första swipe till första arbetsdagen – för ungdomar och företag.";

export const metadata: Metadata = { title: "Funktioner", description: heroBody };

export default function FeaturesPage() {
  return (
    <main className="features-page">
      <MarketingNav />

      <section className="features-hero">
        <h1>Hitta jobb. Hitta personal. Enklare.</h1>
        <p>{heroBody}</p>
      </section>

      <section className="features-section">
        <h2>Ditt nästa jobb börjar här.</h2>
        <p className="features-section-eyebrow">För ungdomar</p>
        <div className="features-audience">
          <div className="features-audience-visual"><SwipeCardPreview /></div>
          <div className="features-grid">
            {youthFeatures.map((feature) => (
              <article key={feature.title} className="features-card">
                <span className="features-icon" aria-hidden="true"><UiIcon name={feature.icon} width="24" height="24" /></span>
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="features-section features-section-tinted">
        <h2>Hitta rätt ungdom snabbare.</h2>
        <p className="features-section-eyebrow">För företag</p>
        <div className="features-audience">
          <div className="features-audience-visual"><CandidatePreview /></div>
          <div className="features-grid">
            {companyFeatures.map((feature) => (
              <article key={feature.title} className="features-card">
                <span className="features-icon" aria-hidden="true"><UiIcon name={feature.icon} width="24" height="24" /></span>
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="features-ai">
        <div className="features-ai-copy">
          <h2>AI som gör jobbsökandet enklare.</h2>
          <ul className="features-ai-list">
            {aiCapabilities.map((item) => (
              <li key={item}><span aria-hidden="true"><UiIcon name="check" width="15" height="15" strokeWidth="2.2" /></span>{item}</li>
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
          <span className="features-match-arrow" aria-hidden="true"><UiIcon name="arrow" width="20" height="20" /></span>
          <div className="features-match-node features-match-node-ai">
            <span className="features-match-label">AI-matchning</span>
          </div>
          <span className="features-match-arrow" aria-hidden="true"><UiIcon name="arrow" width="20" height="20" /></span>
          <div className="features-match-node">
            <span className="features-match-label">Företag</span>
            <p>Jobb, krav, plats, arbetstider</p>
          </div>
          <span className="features-match-arrow" aria-hidden="true"><UiIcon name="arrow" width="20" height="20" /></span>
          <div className="features-match-result">Match</div>
        </div>
      </section>

      <section className="features-process">
        <h2>Från första swipe till första arbetsdag.</h2>
        <div className="features-process-steps">
          {processSteps.map((step, index) => (
            <span key={step} className="features-process-step">
              {step}
              {index < processSteps.length - 1 && <b aria-hidden="true"><UiIcon name="arrow" width="16" height="16" /></b>}
            </span>
          ))}
        </div>
        <Link href="/signup" className="landing-bold-primary">Kom igång</Link>
      </section>

      <MarketingFooter />
    </main>
  );
}
