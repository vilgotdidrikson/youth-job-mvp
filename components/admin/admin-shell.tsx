"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/admin", label: "Översikt" },
  { href: "/admin/companies", label: "Företag" },
  { href: "/admin/profile", label: "Profil" },
];

export function AdminShell({ title, eyebrow = "Adminpanel", email, children }: { title: string; eyebrow?: string; email?: string | null; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand"><span>E</span><div><strong>employo</strong><small>Admin</small></div></Link>
        <nav aria-label="Adminnavigation">
          {links.map((link) => {
            const active = link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href);
            return <Link key={link.href} href={link.href} className={active ? "admin-nav-link admin-nav-link-active" : "admin-nav-link"}>{link.label}</Link>;
          })}
        </nav>
        <div className="admin-sidebar-user"><span>{email?.slice(0, 1).toUpperCase() || "A"}</span><div><strong>Administratör</strong><small>{email || "Employo"}</small></div></div>
      </aside>
      <div className="admin-content">
        <header className="admin-header"><div><p>{eyebrow}</p><h1>{title}</h1></div><Link href="/" className="secondary-btn">Visa Employo</Link></header>
        {children}
      </div>
      <nav className="admin-mobile-nav" aria-label="Adminnavigation">
        {links.map((link) => <Link key={link.href} href={link.href} className={(link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href)) ? "admin-nav-link-active" : ""}>{link.label}</Link>)}
      </nav>
    </main>
  );
}
