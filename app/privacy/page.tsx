import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import "./privacy-design.css";

export default function PrivacyPage() {
  return <main className="mnw-privacy-page">
    <header className="mnw-privacy-nav"><Link href="/">MatchnWork</Link><Link href="/profile">Till profilen <UiIcon name="arrow" width="16" /></Link></header>
    <div className="mnw-privacy-heading"><span><UiIcon name="info" width="28" height="28" /></span><p>Din information</p><h1>Integritet och AI</h1><p>Här beskriver vi hur din profil, ditt CV och dina ansökningssvar används i MatchnWork.</p></div>
    <div className="mnw-privacy-layout"><aside aria-label="På den här sidan"><strong>På den här sidan</strong><a href="#profile-data">Profil och ansökan</a><a href="#documents">Dina dokument</a><a href="#ai-cv">AI-CV</a><a href="#followups">Kompletteringsfrågor</a><a href="#delete-account">Radera konto</a><a href="#reports">Anmälningar</a></aside><article>
      <section id="profile-data"><h2>Profil och ansökan</h2><p>MatchnWork använder dina profiluppgifter och ditt CV för att visa relevanta jobb och låta annonsägare granska kandidater som har visat intresse.</p></section>
      <section id="documents"><h2>Dina dokument</h2><p>Dokument lagras privat. De öppnas med tidsbegränsad länk endast när behörighetskontrollen ger åtkomst till din ansökan.</p></section>
      <section id="ai-cv"><h2>AI-CV</h2><p>När du använder AI- eller röst-CV behandlas det du skickar för att hjälpa dig formulera ditt CV. AI:n ska inte hitta på fakta; du kan alltid redigera resultatet.</p></section>
      <section id="followups"><h2>Kompletteringsfrågor och matchning</h2><p>Ansökningsunderlaget jämförs med jobbets godkända kriterier. Om uppgifter saknas kan du få individuella frågor. Du väljer själv om du vill svara; skickade svar kompletterar din befintliga ansökan och kan läsas av det berörda företaget.</p><p>Kompletteringarna används vid en uppdaterad matchningsbedömning. Saknad information är inte ett automatiskt avslag. Arbetsgivaren fattar alltid anställningsbeslutet.</p></section>
      <section id="delete-account"><h2>Radera konto</h2><p>Du kan permanent radera konto, profil, ansökningar, matchningar, chattar och uppladdade dokument från din profil. Raderar ett företag sitt konto försvinner även dess annonser och tillhörande ansökningar och chattar. Detta går inte att ångra.</p></section>
      <section id="reports"><h2>Anmälningar</h2><p>Anmälningar till moderering och det anmälda innehållet sparas för säkerhetsgranskning i upp till 12 månader efter att ärendet avslutats, även om något av kontona raderas. Anmälarens identitet tas då bort.</p></section>
      <footer><p>Den slutliga integritetspolicyn och kontaktuppgifterna måste juridiskt granskas av MatchnWork före produktion.</p><Link href="/profile">Tillbaka till profilen <UiIcon name="arrow" width="16" /></Link></footer>
    </article></div>
  </main>;
}
