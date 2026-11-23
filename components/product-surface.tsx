"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { YouthTerms } from "@/components/youth-terms";

/** Shared product styling and the current youth terms notice. */
export function ProductSurface({ children }: {children:ReactNode}) {
  const path = usePathname();
  const { user, profile } = useSession();
  const page = path.split("/")[1] || "home";
  const marketing = ["home","pricing","features","privacy","velaris-preview"].includes(page);
  return <div className={marketing ? undefined : "mnw-product"} data-page={page} data-onboarding={path.includes("onboarding") || path.includes("get-started") ? "true" : undefined}>
    {user && profile?.role === "youth" && ["swipe", "applications", "jobb", "youth", "profile"].includes(page)
      && <YouthTerms key={user.id} />}
    {children}
  </div>;
}
