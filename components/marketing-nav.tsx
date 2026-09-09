"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppDestination } from "@/hooks/use-app-destination";

export function MarketingNav() {
  const pathname = usePathname();
  const { isAuthenticated, destination } = useAppDestination();

  const navLinkClass = (href: string) =>
    pathname === href ? "landing-bold-language landing-bold-language-active" : "landing-bold-language";

  return (
    <nav className="landing-bold-nav" aria-label="Huvudnavigation">
      <Link className="landing-logo" href="/" aria-label="Employo startsida">
        <span className="landing-logo-mark">E</span><span>employo</span>
      </Link>
      <div className="landing-bold-nav-actions">
        <Link href="/features" className={navLinkClass("/features")}>Funktioner</Link>
        <Link href="/pricing" className={navLinkClass("/pricing")}>Priser</Link>
        {isAuthenticated ? (
          <Link href={destination ?? "/login"} className="landing-bold-primary">Gå till appen</Link>
        ) : (
          <>
            <Link href="/login" className="landing-bold-login">Logga in</Link>
            <Link href="/signup" className="landing-bold-primary">Kom igång</Link>
          </>
        )}
      </div>
    </nav>
  );
}
