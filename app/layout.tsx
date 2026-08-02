import type { Metadata } from "next";
import { Suspense } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { SessionProvider } from "@/hooks/use-session";
import "./globals.css";

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
    <html lang="sv" suppressHydrationWarning>
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
