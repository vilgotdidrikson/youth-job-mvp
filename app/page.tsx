"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import "./landing.css";

const copy = {
  sv: {
    login: "Logga in",
    language: "Språk",
    eyebrow: "Jobb för unga, på ditt sätt",
    title: "Ditt första jobb",
    titleAccent: "börjar här.",
    primary: "Kom igång",
    secondary: "För företag",
    note: "Gratis att skapa ett konto",
    builtFor: "Byggt för vägen från nyfiken till anställd",
    proof: [
      ["En profil", "Samla styrkor, erfarenheter och mål på ett ställe."],
      ["Ömsesidigt intresse", "Både kandidaten och företaget väljer vem de vill prata med."],
      ["Direkt kontakt", "När det blir en match öppnas chatten."],
    ],
    howTitle: "Tre steg. Inget krångel.",
    steps: [
      ["01", "Berätta vem du är", "Skapa en profil och få stöd att formulera ditt CV."],
      ["02", "Hitta rätt jobb", "Upptäck roller utifrån vad du söker och var du finns."],
      ["03", "Matcha och prata", "Visa intresse. Vid en match kan ni chatta direkt."],
    ],
    rolesLabel: "Exempel på roller du kan upptäcka",
    roles: [
      ["Café", "Service & tempo"],
      ["Butik", "Kunder & försäljning"],
      ["Lager", "Logistik & teamwork"],
      ["Kundservice", "Kommunikation & hjälp"],
    ],
    manifesto: "Potential syns inte alltid i ett tomt CV.",
    manifestoSub: "Därför hjälper Employo unga att visa vem de är – och företag att se mer än bara tidigare erfarenhet.",
    employerTitle: "Letar du efter nästa talang?",
    employerBody: "Skapa en tydlig annons, upptäck kandidater och starta samtalet när intresset är ömsesidigt.",
    employerCta: "Kom igång som företag",
    footer: "En enklare väg från nyfiken till anställd.",
  },
  en: {
    login: "Log in",
    language: "Language",
    eyebrow: "Youth jobs, on your terms",
    title: "Your first job",
    titleAccent: "starts here.",
    primary: "Get started",
    secondary: "For employers",
    note: "Free to create an account",
    builtFor: "Built for the path from curious to hired",
    proof: [
      ["One profile", "Bring strengths, experience and goals together in one place."],
      ["Mutual interest", "Candidates and employers both choose who they want to meet."],
      ["Direct contact", "When there is a match, the chat opens."],
    ],
    howTitle: "Three steps. No fuss.",
    steps: [
      ["01", "Tell us who you are", "Create a profile and get help shaping your CV."],
      ["02", "Find the right role", "Discover roles based on what you want and where you are."],
      ["03", "Match and talk", "Show interest. When it is mutual, you can chat directly."],
    ],
    rolesLabel: "Examples of roles you can discover",
    roles: [
      ["Café", "Service & pace"],
      ["Retail", "Customers & sales"],
      ["Warehouse", "Logistics & teamwork"],
      ["Customer service", "Communication & support"],
    ],
    manifesto: "Potential does not always show in an empty CV.",
    manifestoSub: "That is why Employo helps young people show who they are—and employers see beyond past experience.",
    employerTitle: "Looking for your next talent?",
    employerBody: "Create a clear listing, discover candidates and start the conversation when interest is mutual.",
    employerCta: "Get started as an employer",
    footer: "A simpler path from curious to hired.",
  },
};

export default function Home() {
  const { language, toggleLanguage } = useLanguage();
  const t = copy[language];

  return (
    <main className="landing-page landing-bold">
      <nav className="landing-bold-nav" aria-label="Huvudnavigation">
        <Link className="landing-logo" href="/" aria-label="Employo startsida">
          <span className="landing-logo-mark">E</span><span>employo</span>
        </Link>
        <div className="landing-bold-nav-actions">
          <Link href="/login" className="landing-bold-login">{t.login}</Link>
          <button type="button" className="landing-bold-language" onClick={toggleLanguage}>
            {t.language}<span>{language === "sv" ? "EN" : "SV"}</span>
          </button>
        </div>
      </nav>

      <section className="landing-bold-hero">
        <p className="landing-bold-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}<br /><em>{t.titleAccent}</em></h1>
        <div className="landing-bold-actions">
          <Link href="/signup" className="landing-bold-primary">{t.primary}</Link>
          <Link
            href="/signup?role=company"
            className="landing-bold-secondary"
            style={{ border: "1.5px solid #d65f85", background: "#ffffff" }}
          >
            {t.secondary}
          </Link>
        </div>
        <p className="landing-bold-note">{t.note}</p>
      </section>

      <section className="landing-bold-purpose">
        <p>{t.builtFor}</p>
        <div>
          <span>Profil</span><i />
          <span>Matchning</span><i />
          <span>Chatt</span><i />
          <span>Möjlighet</span><span className="landing-bold-scroll" aria-hidden="true">↓</span>
        </div>
      </section>

      <section id="landing-proof" className="landing-bold-proof">
        {t.proof.map(([title, body], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="landing-bold-how">
        <h2>{t.howTitle}</h2>
        <div className="landing-bold-step-grid">
          {t.steps.map(([number, title, body]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-bold-roles">
        <p>{t.rolesLabel}</p>
        <div>
          {t.roles.map(([title, subtitle]) => (
            <article key={title}><h3>{title}</h3><span>{subtitle}</span><b aria-hidden="true">↗</b></article>
          ))}
        </div>
      </section>

      <section className="landing-bold-manifesto">
        <p>{t.manifesto}</p>
        <span>{t.manifestoSub}</span>
      </section>

      <section className="landing-bold-employer">
        <h2>{t.employerTitle}</h2>
        <p>{t.employerBody}</p>
        <Link href="/signup?role=company">{t.employerCta}<span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="landing-bold-footer">
        <span>© 2026 Employo</span>
        <span>{t.footer}</span>
      </footer>
    </main>
  );
}
