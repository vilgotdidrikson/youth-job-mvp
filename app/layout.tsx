import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
    <html lang="sv" suppressHydrationWarning className={inter.variable}>
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
