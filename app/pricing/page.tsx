import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { CURRENT_COMPANY_OFFER } from "@/lib/current-offer";
import { PricingPlans } from "./pricing-plans";
import "../landing.css";
import "./pricing.css";

export const metadata: Metadata = { title: "Priser", description: CURRENT_COMPANY_OFFER.description };

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <MarketingNav />
      <PricingPlans />
      <MarketingFooter />
    </main>
  );
}
