"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import Velaris from "@/components/ui/velaris";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Reveal } from "@/components/ui/reveal";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { VerticalTimeline, type TimelineStep } from "@/components/ui/vertical-timeline";
import { PlatformShowcase, type PlatformItem } from "@/components/ui/platform-showcase";
import { AiVisual, MatchVisual, ChatVisual, MapVisual, EverywhereVisual } from "@/components/ui/platform-visuals";
import "./landing.css";

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
    title: "Skapa konto & CV",
    body: "Registrera dig och få hjälp av AI att bygga ett vasst CV på minuter.",
  },
  {
    number: "02",
    title: "Swipea och hitta jobb",
    body: "Bläddra bland jobb nära dig, swipea och visa intresse för roller som passar.",
  },
  {
    number: "03",
    title: "Du har fått jobbet",
    body: "Matcha, chatta med företaget och landa din första anställning.",
  },
];

const platformItems: PlatformItem[] = [
  {
    id: "ai",
    icon: "✦",
    title: "AI som känner dig",
    body: "Vår AI hjälper dig skriva CV, formulera ett personligt brev och förbereda dig inför intervjuer.",
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
    title: "Fungerar överallt",
    body: "Sköt hela din jobbsökning från mobilen, webben eller var du än är.",
    visual: <EverywhereVisual />,
  },
];

const copy = {
  eyebrow: "Jobb för unga, på ditt sätt",
  title: "Ditt första jobb",
  titleAccent: "börjar här.",
  primary: "Kom igång",
  secondary: "För företag",
  builtFor: "Byggt för vägen från nyfiken till anställd",
  statsHeading: "Ett verkligt problem",
  statsSource: "Källa: SCB / Ekonomifakta",
  platformTitleStart: "En plattform, ",
  platformTitleAccent: "hela vägen",
  platformSub: "Employo är byggt för att bära dig från första ansökan till första arbetsdagen – och hela vägen till din första lönecheck. En enklare och tydligare väg till jobbet.",
  howTitle: "Tre steg. Inget krångel.",
  manifesto: "Potential syns inte alltid i ett tomt CV.",
  manifestoSub: "Därför hjälper Employo unga att visa vem de är – och företag att se mer än bara tidigare erfarenhet.",
  footer: "En enklare väg från nyfiken till anställd.",
};

export default function Home() {
  return (
    <main className="landing-page landing-bold">
      <Velaris
        className="fixed inset-0 -z-10"
        height="100vh"
        bg="#ffffff"
        colors={LANDING_BG_COLORS}
      />

      <MarketingNav />

      <section className="landing-bold-hero">
        <p className="landing-bold-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}<br /><em>{copy.titleAccent}</em></h1>
        <div className="landing-bold-actions">
          <Link
            href="/signup?role=company"
            className="landing-bold-secondary"
            style={{ border: "1.5px solid #d65f85", background: "#ffffff" }}
          >
            {copy.secondary}
          </Link>
          <Link href="/signup" className="landing-bold-primary">
            {copy.primary}<span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="landing-bold-purpose">
        <p>{copy.builtFor}</p>
        <div>
          <span>Profil</span><i />
          <span>Matchning</span><i />
          <span>Chatt</span><i />
          <span>Möjlighet</span><span className="landing-bold-scroll" aria-hidden="true">↓</span>
        </div>
      </section>

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
          <span>{copy.manifestoSub}</span>
        </Reveal>
      </section>

      <footer className="landing-bold-footer">
        <div className="landing-bold-footer-brand">
          <span className="landing-logo">
            <span className="landing-logo-mark">E</span>employo
          </span>
          <p>{copy.footer}</p>
        </div>
        <nav className="landing-bold-footer-links" aria-label="Sidfotsnavigation">
          <Link href="/features">Funktioner</Link>
          <Link href="/pricing">Priser</Link>
          <Link href="/login">Logga in</Link>
        </nav>
        <span className="landing-bold-footer-copy">© 2026 Employo</span>
      </footer>
    </main>
  );
}
