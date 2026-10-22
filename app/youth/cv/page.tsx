"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { YouthCvHub } from "@/components/youth-cv-hub";
import { JourneyStepFrame } from "@/components/profile-steps/step-nav";

/** In the profile journey the CV step gets the same step menu as the other steps. */
function CvPage() {
  const query = useSearchParams();
  const hub = <YouthCvHub />;
  return query.get("return") === "build" && !query.get("job") ? <JourneyStepFrame step="cv">{hub}</JourneyStepFrame> : hub;
}

export default function YouthCvPage() {
  return (
    <Suspense fallback={<main className="mobile-shell"><p>Laddar...</p></main>}>
      <CvPage />
    </Suspense>
  );
}
