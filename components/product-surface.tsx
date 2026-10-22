"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Presentation boundary only: shared tokens never alter account or matching logic. */
export function ProductSurface({ children }: {children:ReactNode}) {
  const path = usePathname();
  const page = path.split("/")[1] || "home";
  const marketing = ["home","pricing","features","privacy","velaris-preview"].includes(page);
  return <div className={marketing ? undefined : "mnw-product"} data-page={page} data-onboarding={path.includes("onboarding") || path.includes("get-started") ? "true" : undefined}>{children}</div>;
}
