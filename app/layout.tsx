import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { SessionProvider } from "@/hooks/use-session";
import { ProductSurface } from "@/components/product-surface";
import { NavigationIndicatorsProvider } from "@/hooks/use-navigation-indicators";
import "./fonts.css";
import "./globals.css";
import "./product-design.css";

// Pinned Inter/Fraunces files, unicode coverage and fallback metrics live in fonts.css.
export const metadata: Metadata = {
  // Absolute URLs for the share image. Unset, Next.js uses the Vercel deployment URL.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: "MatchnWork", template: "%s · MatchnWork" },
  description:
    "Mobilanpassad jobbmatchningsplattform för ungdomar i Sverige och företag som anställer för deltidsjobb, tillfälliga jobb och sommarjobb.",
  applicationName: "MatchnWork",
  openGraph: { siteName: "MatchnWork", locale: "sv_SE", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#fffafb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" suppressHydrationWarning className="mnw-fonts">
      <head>
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased"
      >
        <SessionProvider>
          <NavigationIndicatorsProvider>
          <ProductSurface>{children}</ProductSurface>
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          </NavigationIndicatorsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
