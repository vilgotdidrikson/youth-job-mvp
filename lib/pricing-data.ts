export type PricingAudience = "youth" | "company" | "individual";

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  priceSuffix?: string;
  badge?: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
}

export const pricingAudiences: { id: PricingAudience; label: string }[] = [
  { id: "youth", label: "Ungdomar" },
  { id: "company", label: "Företag" },
  { id: "individual", label: "Privatpersoner" },
];

export const pricingPlans: Record<PricingAudience, PricingPlan[]> = {
  youth: [
    {
      id: "youth-free",
      name: "Gratis",
      price: "0 kr",
      features: [
        "AI-skapat CV",
        "Hitta jobb",
        "Swipea jobb",
        "Jobbmatchning",
        "Chatta med företag",
        "Karta",
        "Ansök till jobb",
      ],
      cta: "Kom igång gratis",
      ctaHref: "/signup",
    },
    {
      id: "youth-premium",
      name: "Premium",
      price: "79 kr",
      priceSuffix: "/mån",
      badge: "Rekommenderad",
      features: [
        "Allt i Gratis",
        "AI-optimerat CV",
        "Personligt brev",
        "AI-intervjuträning",
        "AI-karriärcoach",
        "Förbättrad jobbmatchning",
        "Ansökningsstatistik",
      ],
      cta: "Välj Premium",
      ctaHref: "/signup?plan=premium",
      highlighted: true,
    },
  ],
  company: [
    {
      id: "company-free",
      name: "Gratis",
      price: "0 kr",
      priceSuffix: "/mån",
      features: [
        "1 aktiv rekrytering",
        "Upp till 20 kandidater",
        "Grundläggande företagsprofil",
        "Jobbannons",
        "Kandidatchatt",
      ],
      cta: "Kom igång gratis",
      ctaHref: "/signup?role=company",
    },
    {
      id: "company-pro",
      name: "Pro",
      price: "999 kr",
      priceSuffix: "/mån",
      badge: "Mest populär",
      features: [
        "10 aktiva rekryteringar",
        "Obegränsade kandidater",
        "AI-matchning",
        "AI-screening",
        "Kandidatfilter",
        "Intervjubokning",
        "Statistik",
        "Prioriterad exponering",
      ],
      cta: "Välj Pro",
      ctaHref: "/signup?role=company&plan=pro",
      highlighted: true,
    },
    {
      id: "company-business",
      name: "Business",
      price: "2 499 kr",
      priceSuffix: "/mån",
      features: [
        "25 aktiva rekryteringar",
        "Obegränsade kandidater",
        "Avancerad AI-matchning",
        "Avancerad AI-screening",
        "Kandidatpool",
        "Employer branding",
        "Utökad företagsprofil",
        "Avancerad statistik",
      ],
      cta: "Välj Business",
      ctaHref: "/signup?role=company&plan=business",
    },
  ],
  individual: [
    {
      id: "individual-ad",
      name: "Annons",
      price: "39 kr",
      priceSuffix: "/annons",
      features: [
        "Publicera engångsjobb",
        "Annons aktiv i 7 dagar",
        "Ta emot svar från ungdomar",
      ],
      cta: "Skapa annons",
      ctaHref: "/signup?role=company&plan=ad",
    },
    {
      id: "individual-boost",
      name: "Boost",
      price: "+20 kr",
      features: [
        "Ökad exponering",
        "Högre placering",
        "Boostad-markering",
        "Aktiv i 48 timmar",
      ],
      cta: "Boost din annons",
      ctaHref: "/signup?role=company&plan=boost",
    },
  ],
};

export const enterprisePlan = {
  name: "Enterprise",
  title: "Behöver ni rekrytera i större skala?",
  body: "Anpassad lösning för större företag och kedjor.",
  cta: "Kontakta oss",
  ctaHref: "mailto:hej@employo.se",
};
