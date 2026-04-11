"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/swipe", label: "Swipe", icon: "🔥" },
  { href: "/chats", label: "Chats", icon: "💬" },
  { href: "/profile", label: "Profile", icon: "✨" },
  { href: "/dashboard", label: "Dashboard", icon: "👤" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${active ? "bottom-nav-item-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
