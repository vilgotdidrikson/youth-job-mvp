"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
];

const companyItems = [
  {
    href: "/company",
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
  {
    href: "/dashboard",
    label: "Konto",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { profile } = useSession();

  /* Hide nav on auth / landing / onboarding pages */
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/" ||
    pathname.startsWith("/youth/onboarding") ||
    pathname.startsWith("/youth/get-started") ||
    pathname.startsWith("/company/onboarding")
  ) {
    return null;
  }

  const firstItem = profile?.role === "company" ? companyItems : youthItems;
  const items = [...firstItem, ...sharedItems];

  return (
    <nav
      className="bottom-nav"
      aria-label="Primary navigation"
      style={{ maxWidth: 430, left: "50%", transform: "translateX(-50%)" }}
    >
      <Link href="/dashboard" className="desktop-nav-logo" aria-label="Employo kontoöversikt">
        <span>E</span> employo
      </Link>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
