import Image from "next/image";
import Link from "next/link";
import { PrelaunchSignup } from "@/components/prelaunch-signup";
import "./prelaunch.css";

export default function Home() {
  return <main className="pl-page pl-signup-first">
    <section className="pl-first-screen" aria-label="Intresseanmälan">
      <a href="/" aria-label="MatchnWork startsida" className="pl-logo"><span className="pl-logo-box"><Image src="/brand/matchnwork-logo.png" alt="" width={44} height={44} priority /></span><span>matchnwork<span className="pl-brand-dot">.</span></span></a>
      <PrelaunchSignup />
      <a className="pl-scroll-info" href="#om-matchnwork">Lär känna MatchnWork <span>↓</span></a>
    </section>
    <section className="pl-about" id="om-matchnwork"><div className="pl-about-heading"><span className="pl-eyebrow">POTENTIAL FÖRTJÄNAR EN CHANS</span><h2>Ditt första jobb.<br /><em>Er nästa medarbetare.</em></h2><p>MatchnWork för samman unga från 15 år som vill jobba med företag som ser möjligheter. En enklare väg till extrajobb, sommarjobb och nya kollegor.</p></div><div className="pl-about-details"><article><span>01 / UPPTÄCK</span><h3>Hitta något som passar.</h3><p>Unga upptäcker jobb nära sig. Företag visar vilka de är och vem de söker.</p></article><article><span>02 / VISA INTRESSE</span><h3>Mer än ett tomt CV.</h3><p>Personlighet, tillgänglighet och erfarenheter får ta plats i ansökan.</p></article><article><span>03 / TA KONTAKT</span><h3>Börja med ett hej.</h3><p>En direkt kontakt mellan kandidat och företag gör nästa steg enklare.</p></article></div></section>
    <section className="pl-demo-invite"><div><span className="pl-eyebrow">NYFIKEN PÅ HUR DET FUNKAR?</span><h2>Ta en liten <em>förhandstitt.</em></h2><p>Testa upplevelsen som ungdom eller företag i vår interaktiva demo.</p></div><Link href="/demo" className="pl-button">Testa demon <span>↗</span></Link></section>
    <footer className="pl-footer"><a href="/" className="pl-footer-brand">matchnwork<span>.</span></a><p>Potential förtjänar en chans.</p><div><Link href="/launch-privacy">Integritet</Link><a href="mailto:info@matchnwork.se">Kontakt ↗</a><span>© 2026 MatchnWork UF</span></div></footer>
  </main>;
}
