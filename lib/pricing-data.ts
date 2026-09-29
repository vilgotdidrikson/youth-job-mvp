export type PricingAudience = "youth" | "company";

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  priceSuffix?: string;
  features: string[];
  cta: string;
  ctaHref: string;
}

export const pricingAudiences: { id: PricingAudience; label: string }[] = [
  { id: "youth", label: "Ungdomar" },
  { id: "company", label: "Företag" },
];

export const pricingHeadlines: Record<PricingAudience, string> = {
  youth: "Din väg till första jobbet börjar här.",
  company: "Rekrytera unga talanger på ett enkelt sätt.",
};

export const pricingPlans: Record<PricingAudience, PricingPlan[]> = {
  youth: [
    {
      id: "youth-free",
      name: "Gratis",
      price: "0 kr",
      features: [
        "Skapa CV",
        "Hitta och ansök till jobb",
        "Jobbmatchning",
        "Chatta med företag efter matchning",
        "Karta över jobb",
      ],
      cta: "Kom igång gratis",
      ctaHref: "/signup",
    },
  ],
  company: [
    {
      id: "company-free",
      name: "Gratis",
      price: "0 kr",
      priceSuffix: "/mån",
      features: [
        "En aktiv rekrytering",
        "Upp till 20 kandidater",
        "Företagsprofil",
        "Publicera jobbannons",
        "Kandidatchatt efter matchning",
      ],
      cta: "Kom igång gratis",
      ctaHref: "/signup?role=company",
    },
  ],
};

export const enterprisePlan = {
  title: "Behöver ni rekrytera i större skala?",
  body: "Kontakta oss för att diskutera en lösning för ert företag.",
  cta: "Kontakta oss",
  ctaHref: "mailto:hej@employo.se",
};
