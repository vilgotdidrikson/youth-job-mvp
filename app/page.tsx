import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import Velaris from "@/components/ui/velaris";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Reveal } from "@/components/ui/reveal";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { VerticalTimeline, type TimelineStep } from "@/components/ui/vertical-timeline";
import { PlatformShowcase, type PlatformItem } from "@/components/ui/platform-showcase";
import { AiVisual, MatchVisual, ChatVisual, MapVisual, EverywhereVisual } from "@/components/ui/platform-visuals";
import { LandingActions, LandingHero } from "./landing-hero";
import "./landing.css";

export const metadata: Metadata = {
  title: { absolute: "MatchnWork" },
};

const LANDING_BG_COLORS = ["#f7c2ce", "#ec7598", "#dc6f8d", "#ffffff"];

interface StatItem {
  value: number;
  decimals: number;
  suffix: string;
  label: string;
  note: string;
}

const stats: StatItem[] = [
  {
    value: 24.9,
    decimals: 1,
    suffix: "%",
    label: "ungdomsarbetslöshet i Sverige",
    note: "juni 2026 · EU-snitt: 15,4 %",
  },
  {
    value: 206500,
    decimals: 0,
    suffix: "",
    label: "unga (15–24 år) utan jobb",
    note: "maj 2026",
  },
];

const steps: TimelineStep[] = [
  {
    number: "01",
    title: "Skapa konto och utforska",
    body: "Börja med några grunduppgifter och upptäck jobb. Skapa eller ladda upp ditt CV när du vill söka.",
  },
  {
    number: "02",
    title: "Swipea och hitta jobb",
    body: "Bläddra bland jobb nära dig, swipea och visa intresse för roller som passar.",
  },
  {
    number: "03",
    title: "Ni har matchat",
    body: "Matcha, börja chatta med företaget och ta nästa steg mot en intervju.",
  },
];

const platformItems: PlatformItem[] = [
  {
    id: "ai",
    icon: "✦",
    title: "Stöd när du söker jobb",
    body: "Vår AI hjälper dig skriva CV och ställer kompletteringsfrågor när en ansökan saknar uppgifter.",
    visual: <AiVisual />,
  },
  {
    id: "match",
    icon: "◎",
    title: "Matchning åt båda håll",
    body: "Både du och företaget väljer vem ni vill prata med – ingen ansökan försvinner i tystnad.",
    visual: <MatchVisual />,
  },
  {
    id: "chat",
    icon: "◈",
    title: "Trygg chatt",
    body: "Prata direkt i appen. Du delar aldrig mer än du själv vill, när du själv vill.",
    visual: <ChatVisual />,
  },
  {
    id: "map",
    icon: "⌖",
    title: "Jobb nära dig",
    body: "Se lediga roller på kartan och upptäck möjligheter i ditt eget område.",
    visual: <MapVisual />,
  },
  {
    id: "everywhere",
    icon: "▤",
    title: "Mobil och dator",
    body: "Använd MatchnWork i webbläsaren på mobilen eller datorn.",
    visual: <EverywhereVisual />,
  },
];

const HERO_ID = "landing-hero";

const copy = {
  primary: "Kom igång",
  secondary: "För företag",
  statsHeading: "Ett verkligt problem",
  statsSource: "Källa: SCB / Ekonomifakta",
  platformTitleStart: "En plattform, ",
  platformTitleAccent: "hela vägen",
  platformSub: "MatchnWork samlar jobbsökande, ansökningar och kontakt med arbetsgivaren. Lön och anställningsvillkor hanterar du med arbetsgivaren.",
  howTitle: "Tre steg. Inget krångel.",
  manifesto: "Potential syns inte alltid i ett tomt CV.",
  manifestoSub: "Därför hjälper MatchnWork unga att visa vem de är – och företag att se mer än bara tidigare erfarenhet.",
};

export default function Home() {
  return (
    <main className="landing-page landing-bold">
      {/* The scroll animations start hidden and are revealed by JavaScript. */}
      <noscript>
        <style>{".reveal,.text-generate-word{opacity:1;filter:none;transform:none}"}</style>
      </noscript>
      <Velaris
        className="fixed inset-0 -z-10"
        height="100vh"
        bg="#ffffff"
        colors={LANDING_BG_COLORS}
        pauseOutsideId={HERO_ID}
      />

      <MarketingNav />

      <LandingHero id={HERO_ID} primary={copy.primary} secondary={copy.secondary} />

      <div className="landing-bold-body">
        <section className="landing-bold-stats">
          <div className="landing-bold-stats-heading">
            <h2>
              <TextGenerateEffect words={copy.statsHeading} />
            </h2>
          </div>
          <div className="landing-bold-stats-grid">
            {stats.map((stat) => (
              <article key={stat.label}>
                <NumberTicker
                  value={stat.value}
                  decimals={stat.decimals}
                  suffix={stat.suffix}
                  className="landing-bold-stat-value"
                />
                <p>{stat.label}</p>
                <span className="landing-bold-stat-note">{stat.note}</span>
              </article>
            ))}
          </div>
          <p className="landing-bold-stats-source">{copy.statsSource}</p>
        </section>

        <section className="landing-bold-platform">
          <PlatformShowcase
            items={platformItems}
            heading={
              <>
                {copy.platformTitleStart}
                <span className="landing-bold-platform-sweep">{copy.platformTitleAccent}</span>
              </>
            }
            subheading={copy.platformSub}
          />
        </section>

        <section className="landing-bold-how">
          <h2>{copy.howTitle}</h2>
          <VerticalTimeline steps={steps} />
        </section>

        <section className="landing-bold-manifesto">
          <Reveal>
            <p>{copy.manifesto}</p>
            <span className="landing-bold-manifesto-sub">{copy.manifestoSub}</span>
          </Reveal>
          <LandingActions primary={copy.primary} secondary={copy.secondary} />
        </section>

        <MarketingFooter />
      </div>
    </main>
  );
}
