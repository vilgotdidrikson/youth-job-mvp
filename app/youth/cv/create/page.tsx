"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { YouthOnboardingFlow } from "@/app/youth/onboarding/page";

function WrittenCvFlow() {
  const searchParams = useSearchParams();
  return <YouthOnboardingFlow flow="cv" cvBuilder voiceFinalize={searchParams.get("voice") === "finalize"} />;
}

export default function WrittenCvPage() {
  return <Suspense fallback={<main className="mobile-shell" style={{ display: "grid", minHeight: "100svh", placeItems: "center" }}><p>Laddar...</p></main>}><WrittenCvFlow /></Suspense>;
}