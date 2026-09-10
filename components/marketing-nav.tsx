"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppDestination } from "@/hooks/use-app-destination";

export function MarketingNav() {
  const pathname = usePathname();
  const { isAuthenticated, destination } = useAppDestination();
  const [menuOpen, setMenuOpen] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const navRef = useRef<HTMLElement | null>(null);

  const navLinkClass = (href: string) =>
    pathname === href ? "landing-bold-language landing-bold-language-active" : "landing-bold-language";

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
    setCtaOpen(false);
  }

  useEffect(() => {
    if (!menuOpen && !ctaOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setCtaOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setCtaOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, ctaOpen]);

  return (
    <nav className="landing-bold-nav" aria-label="Huvudnavigation" ref={navRef}>
      <Link className="landing-logo" href="/" aria-label="Employo startsida">
        <span className="landing-logo-mark">E</span><span>employo</span>
      </Link>

      <div className="landing-bold-nav-actions landing-bold-nav-actions-desktop">
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

      <div className="landing-bold-nav-actions-mobile">
        {isAuthenticated ? (
          <Link href={destination ?? "/login"} className="landing-bold-primary">Gå till appen</Link>
        ) : (
          <div className="landing-bold-mobile-cta">
            <button
              type="button"
              className="landing-bold-primary landing-bold-mobile-cta-trigger"
              aria-haspopup="menu"
              aria-expanded={ctaOpen}
              onClick={() => {
                setCtaOpen((open) => !open);
                setMenuOpen(false);
              }}
            >
              Kom igång
              <svg className="landing-bold-mobile-cta-arrow" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {ctaOpen && (
              <div className="landing-bold-mobile-cta-menu" role="menu">
                <Link href="/login" role="menuitem" onClick={() => setCtaOpen(false)}>Logga in</Link>
                <Link href="/signup" role="menuitem" onClick={() => setCtaOpen(false)}>Skapa konto</Link>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="landing-bold-hamburger"
          aria-label="Meny"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          onClick={() => {
            setMenuOpen((open) => !open);
            setCtaOpen(false);
          }}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div id="landing-mobile-menu" className="landing-bold-mobile-menu" role="menu">
          <Link href="/features" role="menuitem" onClick={() => setMenuOpen(false)}>Funktioner</Link>
          <Link href="/pricing" role="menuitem" onClick={() => setMenuOpen(false)}>Priser</Link>
        </div>
      )}
    </nav>
  );
}
