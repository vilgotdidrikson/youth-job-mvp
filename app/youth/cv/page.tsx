"use client";

import { Suspense } from "react";
import { YouthOnboardingFlow } from "@/app/youth/onboarding/page";

export default function YouthCvPage() {
  return (
    <Suspense fallback={<main className="mobile-shell"><p>Laddar...</p></main>}>
      <YouthOnboardingFlow flow="cv" />
    </Suspense>
  );
}
