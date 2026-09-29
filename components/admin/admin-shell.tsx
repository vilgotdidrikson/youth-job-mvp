"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/admin", label: "Översikt", icon: "⌂" },
  { href: "/admin/companies", label: "Företag", icon: "▦" },
  { href: "/admin/profile", label: "Profil", icon: "○" },
];

export function AdminShell({ title, eyebrow = "Adminpanel", email, children }: { title: string; eyebrow?: string; email?: string | null; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link href="/admin" className="admin-brand"><span>E</span><strong>employo</strong><small>Admin</small></Link>
        <nav className="admin-desktop-nav" aria-label="Adminnavigation">
          {links.map((link) => {
            const active = link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href);
            return <Link key={link.href} href={link.href} className={active ? "admin-nav-link admin-nav-link-active" : "admin-nav-link"}>{link.label}</Link>;
          })}
        </nav>
        <Link href="/admin/profile" className="admin-user-chip" aria-label="Öppna adminprofil"><span>{email?.slice(0, 1).toUpperCase() || "A"}</span><div><strong>Admin</strong><small>{email || "Employo"}</small></div></Link>
      </header>
      <div className="admin-content">
        <header className="admin-header"><div><p>{eyebrow}</p><h1>{title}</h1></div><span className="admin-access-badge">Adminläge</span></header>
        {children}
      </div>
      <nav className="admin-mobile-nav" aria-label="Adminnavigation">
        {links.map((link) => <Link key={link.href} href={link.href} className={(link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href)) ? "admin-nav-link-active" : ""}><span aria-hidden="true">{link.icon}</span>{link.label}</Link>)}
      </nav>
    </main>
  );
}
