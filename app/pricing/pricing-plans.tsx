"use client";

import { useState } from "react";
import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import {
  enterprisePlan,
  pricingAudiences,
  pricingHeadlines,
  pricingPlans,
  type PricingAudience,
} from "@/lib/pricing-data";
import { CURRENT_COMPANY_OFFER } from "@/lib/current-offer";

export function PricingPlans() {
  const [audience, setAudience] = useState<PricingAudience>("youth");
  const plans = pricingPlans[audience];

  const selectAudience = (nextAudience: PricingAudience) => {
    setAudience(nextAudience);
  };

  return (
    <>
      <section className="pricing-hero">
        <h1>{pricingHeadlines[audience]}</h1>

        <div className="pricing-switch" role="group" aria-label="Kundtyp">
          {pricingAudiences.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={audience === option.id}
              className={audience === option.id ? "pricing-switch-selected" : ""}
              onClick={() => selectAudience(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className={`pricing-grid pricing-grid-${plans.length}`} aria-label="Prisplaner">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="pricing-card"
          >
            <h2>{plan.name}</h2>
            <p className="pricing-price">
              {plan.price}
              {plan.priceSuffix && <span>{plan.priceSuffix}</span>}
            </p>
            <ul className="pricing-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span aria-hidden="true"><UiIcon name="check" width="16" height="16" strokeWidth="2.2" /></span>{feature}
                </li>
              ))}
            </ul>
            <Link href={plan.ctaHref} className={plan.highlighted ? "pricing-cta pricing-cta-highlighted" : "pricing-cta"}>
              {plan.cta}
            </Link>
          </article>
        ))}
      </section>

      {audience === "company" && <section className="pricing-enterprise" aria-label="Priser och anställning">
        <h2>{CURRENT_COMPANY_OFFER.title}</h2>
        <p>{CURRENT_COMPANY_OFFER.description}</p>
        <p>{CURRENT_COMPANY_OFFER.registration}</p>
        <p>{CURRENT_COMPANY_OFFER.future}</p>
      </section>}

      {audience === "company" && (
        <section className="pricing-enterprise">
          <h2>{enterprisePlan.title}</h2>
          <p>{enterprisePlan.body}</p>
          <a href={enterprisePlan.ctaHref} className="pricing-cta">{enterprisePlan.cta}</a>
        </section>
      )}
    </>
  );
}
