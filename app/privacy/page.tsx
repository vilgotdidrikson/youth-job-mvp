import Link from "next/link";

export default function PrivacyPage() {
  return <main className="mobile-shell" style={{ paddingBottom: "5rem" }}>
    <h1>Integritet och AI</h1>
    <p>Employo använder dina profiluppgifter och ditt CV för att visa relevanta jobb och låta annonsägare granska kandidater som har visat intresse.</p>
    <h2>Dina dokument</h2><p>Dokument lagras privat. De öppnas med tidsbegränsad länk endast när en behörig matchning ger åtkomst.</p>
    <h2>AI-CV</h2><p>När du använder AI- eller röst-CV behandlas det du skickar för att hjälpa dig formulera ditt CV. AI:n ska inte hitta på fakta; du kan alltid redigera resultatet.</p>
    <h2>Radera konto</h2><p>Du kan permanent radera konto, profil och uppladdade dokument från din profil. Detta går inte att ångra.</p>
    <p>Den slutliga integritetspolicyn och kontaktuppgifterna måste juridiskt granskas av Employo före produktion.</p>
    <Link href="/profile" className="secondary-btn">Tillbaka till profilen</Link>
  </main>;
}
