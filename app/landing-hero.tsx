"use client";

import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { useAppDestination } from "@/hooks/use-app-destination";

/** Sign-up actions, or a way back into the app for a signed-in visitor. */
export function LandingActions({ primary, secondary }: { primary: string; secondary: string }) {
  const { isAuthenticated, destination } = useAppDestination();
  const arrow = <span aria-hidden="true"><UiIcon name="arrow" width=".75em" height=".75em" /></span>;

  return (
    <div className="landing-bold-actions">
      {isAuthenticated ? (
        <Link href={destination ?? "/login"} className="landing-bold-primary">Gå till appen{arrow}</Link>
      ) : (
        <>
          <Link href="/signup?role=company" className="landing-bold-secondary">{secondary}</Link>
          <Link href="/signup" className="landing-bold-primary">{primary}{arrow}</Link>
        </>
      )}
    </div>
  );
}

export function LandingHero({ id, primary, secondary }: { id: string; primary: string; secondary: string }) {
  return (
    <section className="landing-bold-hero" id={id}>
      <h1 className="landing-bold-title">Ungdomsjobb och<br /><em>enklare rekrytering</em></h1>
      <LandingActions primary={primary} secondary={secondary} />
    </section>
  );
}
