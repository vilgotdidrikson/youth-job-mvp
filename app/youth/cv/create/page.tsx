"use client";

import { Suspense } from "react";
import { YouthCvHub } from "@/components/youth-cv-hub";

export default function WrittenCvPage() {
  return <Suspense fallback={<main className="mobile-shell" style={{ display: "grid", minHeight: "100svh", placeItems: "center" }}><p>Laddar...</p></main>}><YouthCvHub initialCreate /></Suspense>;
}
