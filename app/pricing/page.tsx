import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { PricingPlans } from "./pricing-plans";
import "../landing.css";
import "./pricing.css";

export const metadata: Metadata = { title: "Priser", description: "Priser för ungdomar och företag som använder MatchnWork." };

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <MarketingNav />
      <PricingPlans />
      <MarketingFooter />
    </main>
  );
}
