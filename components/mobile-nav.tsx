"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";

const youthItems = [
  {
    href: "/swipe",
    label: "Hitta jobb",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    href: "/kartan",
    label: "Kartan",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18-6 3V5l6-3 6 3 6-3v16l-6 3-6-3Z" />
        <path d="M9 2v16M15 5v16" />
      </svg>
    ),
  },
];

const companyItems = [
  {
    href: "/company?view=swipe",
    label: "Swipe",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    ),
  },
  {
    href: "/company?view=annonser",
    label: "Mina annonser",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
  },
  {
    href: "/company?view=kandidater",
    label: "Kandidater",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const sharedItems = [
  {
    href: "/chats",
    label: "Chattar",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profil",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useSession();
  const [isHidden, setIsHidden] = useState(false);
  const previousScrollY = useRef(0);

  useEffect(() => {
    previousScrollY.current = window.scrollY;
    let frameId: number | null = null;

    const updateVisibility = () => {
      frameId = null;
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > previousScrollY.current;

      setIsHidden(currentScrollY > 24 && isScrollingDown);
      previousScrollY.current = currentScrollY;
    };

    const handleScroll = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updateVisibility);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  /* Hide nav on auth / landing / onboarding pages */
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname === "/features" ||
    pathname === "/velaris-preview" ||
    pathname.startsWith("/youth/onboarding") ||
    pathname.startsWith("/youth/cv") ||
    pathname.startsWith("/youth/get-started") ||
    pathname.startsWith("/company/onboarding")
  ) {
    return null;
  }

  const firstItem = profile?.role === "company" ? companyItems : youthItems;
  const items = [...firstItem, ...sharedItems];

  return (
    <nav
      className={`bottom-nav${isHidden ? " bottom-nav-is-hidden" : ""}`}
      aria-label="Primary navigation"
      onFocusCapture={() => setIsHidden(false)}
    >
      <Link href="/swipe" className="desktop-nav-logo" aria-label="Employo hitta jobb">
        <span>E</span> employo
      </Link>
      {items.map((item) => {
        const [itemPath, itemQuery] = item.href.split("?");
        const requestedView = new URLSearchParams(itemQuery ?? "").get("view");
        const active = pathname === itemPath && (!requestedView || searchParams.get("view") === requestedView);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${active ? "bottom-nav-item-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.icon(active)}
            <span style={{ fontSize: "0.6rem", marginTop: 1 }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
