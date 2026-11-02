import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { SessionProvider } from "@/hooks/use-session";
import "./globals.css";

const inter = localFont({ src: "../public/fonts/inter-latin.woff2", variable: "--font-inter", display: "swap", weight: "100 900" });
const fraunces = localFont({ src: "../public/fonts/fraunces-latin.woff2", variable: "--font-fraunces", display: "swap", weight: "100 900" });

export const metadata: Metadata = {
  metadataBase: new URL("https://matchnwork.se"),
  title: "MatchnWork – Mer potential. Mindre krångel.",
  applicationName: "MatchnWork",
  openGraph: { title: "MatchnWork – Var med från start", description: "För unga som vill jobba och företag som ser möjligheter. Anmäl intresse inför lanseringen.", siteName: "MatchnWork", locale: "sv_SE", type: "website", images: ["/brand/matchnwork-logo.png"] },
  icons: { icon: "/favicon.ico", apple: "/icons/icon-192.png" },
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
