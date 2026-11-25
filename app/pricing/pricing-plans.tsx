"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import {
  enterprisePlan,
  pricingAudiences,
  pricingHeadlines,
  pricingPlans,
  type PricingAudience,
} from "@/lib/pricing-data";
import { CURRENT_COMPANY_OFFER, HIRE_REGULAR_PRICE } from "@/lib/current-offer";
import { invoiceAmount } from "@/lib/hire-test-invoices";
import { getSupabaseClient } from "@/lib/supabase";

type Tariff = { amount_ore: 50000 | 80000; regular_on: string };

const tariffDate = new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeZone: "UTC" });

export function PricingPlans() {
  const [audience, setAudience] = useState<PricingAudience>("youth");
  const [tariff, setTariff] = useState<Tariff | null | "loading" | "error">("loading");
  const plans = pricingPlans[audience];

  useEffect(() => {
    if (audience !== "company") return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    async function loadTariff() {
      try {
        const { data, error } = await getSupabaseClient().rpc("get_public_hire_tariff").abortSignal(signal);
        if (error || (data !== null && ((data.amount_ore !== 50000 && data.amount_ore !== 80000)
          || typeof data.regular_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.regular_on)
          || !Number.isFinite(Date.parse(data.regular_on))))) throw new Error("Invalid tariff");
        if (!controller.signal.aborted) setTariff(data);
      } catch {
        if (!controller.signal.aborted) setTariff("error");
      }
    }
    void loadTariff();
    return () => controller.abort();
  }, [audience]);

  const selectAudience = (nextAudience: PricingAudience) => {
    if (nextAudience !== audience) setTariff("loading");
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
        {tariff === "loading" && <p role="status">Hämtar pris för rekrytering…</p>}
        {tariff === "error" && <p role="status">Priset för rekrytering kunde inte hämtas. Ni ser aktuellt pris innan ni registrerar en anställning.</p>}
        {tariff === null && <>
          <h2>{CURRENT_COMPANY_OFFER.title}</h2>
          <p>{CURRENT_COMPANY_OFFER.description}</p>
          <p>{CURRENT_COMPANY_OFFER.future}</p>
        </>}
        {tariff && typeof tariff === "object" && <>
          <h2>{invoiceAmount(tariff.amount_ore)} per bekräftad anställning</h2>
          {tariff.amount_ore === 50000 && <p>Lanseringspriset gäller fram till {tariffDate.format(new Date(tariff.regular_on))}. Från det datumet är priset {HIRE_REGULAR_PRICE}.</p>}
          <p>Priset låses när ni registrerar anställningen. Vi fakturerar när kandidaten har bekräftat den.</p>
        </>}
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
