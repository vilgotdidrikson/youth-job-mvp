"use client";

import { Suspense } from "react";
import { YouthCvHub } from "@/components/youth-cv-hub";
import { PageLoading } from "@/components/page-loading";

export default function WrittenCvPage() {
  return <Suspense fallback={<PageLoading label="Laddar..." />}><YouthCvHub initialCreate /></Suspense>;
}
