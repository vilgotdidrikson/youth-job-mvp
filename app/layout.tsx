import type { Metadata } from "next";
import { Outfit, Space_Grotesk } from "next/font/google";
import { MobileNav } from "@/components/mobile-nav";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
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
    <html lang="sv" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${outfit.variable} ${spaceGrotesk.variable} antialiased`}
      >
        {children}
        <MobileNav />
      </body>
    </html>
  );
}
