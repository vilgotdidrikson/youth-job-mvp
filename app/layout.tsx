import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Suspense } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { SessionProvider } from "@/hooks/use-session";
import "./globals.css";

// Self-hosted by Next.js at build time (no runtime request to Google Fonts),
// so it renders identically for every visitor — unlike the previous base
// font, "Neue Haas Grotesk", which was never actually shipped to the browser
// and only rendered correctly on machines that happened to have it installed
// as a system font.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display serif used for the map's counts and headings, mirroring the
// editorial feel of the startup-map layout the map view is modelled on.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Employo Youth Jobs",
  description:
    "Mobilanpassad jobbmatchningsplattform för ungdomar i Sverige och företag som anställer för deltidsjobb, tillfälliga jobb och sommarjobb.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body
        suppressHydrationWarning
        className="antialiased"
      >
        <SessionProvider>
          {children}
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
        </SessionProvider>
      </body>
    </html>
  );
}
