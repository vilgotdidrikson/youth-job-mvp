"use client";

import { useState } from "react";
import Link from "next/link";
import {
  enterprisePlan,
  pricingAudiences,
  pricingHeadlines,
  pricingPlans,
  type PricingAudience,
} from "@/lib/pricing-data";
import { MarketingNav } from "@/components/marketing-nav";
import "../landing.css";
import "./pricing.css";

export default function PricingPage() {
  const [audience, setAudience] = useState<PricingAudience>("youth");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const plans = pricingPlans[audience];

  const selectAudience = (nextAudience: PricingAudience) => {
    setAudience(nextAudience);
    setSelectedPlanId(null);
  };

  return (
    <main className="pricing-page">
      <MarketingNav />

      <section className="pricing-hero">
        <h1>{pricingHeadlines[audience]}</h1>

        <div className="pricing-switch" role="tablist" aria-label="Kundtyp">
          {pricingAudiences.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={audience === option.id}
              className={audience === option.id ? "pricing-switch-selected" : ""}
              onClick={() => selectAudience(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className={`pricing-grid pricing-grid-${plans.length}`} role="radiogroup" aria-label="Välj prisplan">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`pricing-card${plan.highlighted ? " pricing-card-highlighted" : ""}${selectedPlanId === plan.id ? " pricing-card-selected" : ""}`}
            role="radio"
            aria-checked={selectedPlanId === plan.id}
            tabIndex={0}
            onClick={() => setSelectedPlanId(plan.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedPlanId(plan.id);
              }
            }}
          >
            {plan.badge && <span className="pricing-badge">{plan.badge}</span>}
            <h2>{plan.name}</h2>
            <p className="pricing-price">
              {plan.price}
              {plan.priceSuffix && <span>{plan.priceSuffix}</span>}
            </p>
            <ul className="pricing-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span aria-hidden="true">✓</span>{feature}
                </li>
              ))}
            </ul>
            <Link
              href={plan.ctaHref}
              className={plan.highlighted ? "pricing-cta pricing-cta-highlighted" : "pricing-cta"}
            >
              {plan.cta}
            </Link>
          </article>
        ))}
      </section>

      {audience === "individual" && (
        <p className="pricing-note">Boost är ett tillval till en aktiv annons, inte en prenumeration.</p>
      )}

      {audience === "company" && (
        <section className="pricing-enterprise">
          <h2>{enterprisePlan.title}</h2>
          <p>{enterprisePlan.body}</p>
          <a href={enterprisePlan.ctaHref} className="pricing-cta">{enterprisePlan.cta}</a>
        </section>
      )}

      <footer className="landing-bold-footer">
        <span>© 2026 Employo</span>
        <span>En enklare väg från nyfiken till anställd.</span>
      </footer>
    </main>
  );
}
