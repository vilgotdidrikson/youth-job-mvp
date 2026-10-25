import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const footerLinks = [
  { href: "/features", label: "Funktioner" },
  { href: "/pricing", label: "Priser" },
  { href: "/privacy", label: "Integritet" },
  { href: "/login", label: "Logga in" },
] as const;

/** Shared footer for the public marketing pages (DA-08). Styles live in app/landing.css. */
export function MarketingFooter() {
  return (
    <footer className="landing-bold-footer">
      <div className="landing-bold-footer-brand">
        <span className="landing-logo">
          <BrandLogo tone="light" />
        </span>
        <p>En enklare väg från nyfiken till anställd.</p>
      </div>
      <nav className="landing-bold-footer-links" aria-label="Sidfotsnavigation">
        {footerLinks.map((link) => (
          <Link key={link.href} href={link.href}>{link.label}</Link>
        ))}
      </nav>
      <span className="landing-bold-footer-copy">© 2026 MatchnWork</span>
    </footer>
  );
}
