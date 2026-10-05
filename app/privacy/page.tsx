import Link from "next/link";

export default function PrivacyPage() {
  return <main className="mobile-shell" style={{ paddingBottom: "5rem" }}>
    <h1>Integritet och AI</h1>
    <p>Employo använder dina profiluppgifter och ditt CV för att visa relevanta jobb och låta annonsägare granska kandidater som har visat intresse.</p>
    <h2>Dina dokument</h2><p>Dokument lagras privat. De öppnas med tidsbegränsad länk endast när en behörig matchning ger åtkomst.</p>
    <h2>AI-CV</h2><p>När du använder AI- eller röst-CV behandlas det du skickar för att hjälpa dig formulera ditt CV. AI:n ska inte hitta på fakta; du kan alltid redigera resultatet.</p>
    <h2>Radera konto</h2><p>Du kan permanent radera konto, profil, ansökningar, matchningar, chattar och uppladdade dokument från din profil. Raderar ett företag sitt konto försvinner även dess annonser och tillhörande ansökningar och chattar. Detta går inte att ångra.</p>
    <p>Anmälningar till moderering och det anmälda innehållet sparas för säkerhetsgranskning i upp till 12 månader efter att ärendet avslutats, även om något av kontona raderas. Anmälarens identitet tas då bort.</p>
    <p>Den slutliga integritetspolicyn och kontaktuppgifterna måste juridiskt granskas av Employo före produktion.</p>
    <Link href="/profile" className="secondary-btn">Tillbaka till profilen</Link>
  </main>;
}
