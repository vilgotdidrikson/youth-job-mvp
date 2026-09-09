"use client";

import { Suspense } from "react";
import { YouthCvHub } from "@/components/youth-cv-hub";

export default function YouthCvPage() {
  return (
    <Suspense fallback={<main className="mobile-shell"><p>Laddar...</p></main>}>
      <YouthCvHub />
    </Suspense>
  );
}
