
import Link from "next/link";
import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { CONTACT_EMAIL } from "@/lib/product-copy";
import { UiIcon } from "@/components/ui-icon";
import { PrivacyProfileLink } from "./privacy-profile-link";
import "../landing.css";
import "./privacy-design.css";

export const metadata: Metadata = { title: "Integritet och AI" };

export default function PrivacyPage() {
  return <main className="mnw-privacy-page">
    <MarketingNav />
    <div className="mnw-privacy-content">
    <div className="mnw-privacy-heading"><span><UiIcon name="info" width="28" height="28" /></span><p>Din information</p><h1>Integritet och AI</h1><p>Här beskriver vi hur din profil, ditt CV och dina ansökningssvar används i MatchnWork.</p></div>
    <div className="mnw-privacy-layout"><aside aria-label="På den här sidan"><strong>På den här sidan</strong><a href="#profile-data">Profil och ansökan</a><a href="#company-data">För företag</a><a href="#documents">Dina dokument</a><a href="#storage">Lagring och åtkomst</a><a href="#ai-cv">AI-CV</a><a href="#followups">Kompletteringsfrågor</a><a href="#privacy-requests">Dina rättigheter</a><a href="#delete-account">Radera konto</a><a href="#videos">Video</a><a href="#reports">Anmälningar</a></aside><article>
      <section id="profile-data"><h2>Profil och ansökan</h2><p>MatchnWork använder din jobbprofil för att visa relevanta jobb. När du söker ett jobb får arbetsgivaren underlaget för just den ansökan, till exempel ditt valda CV och de praktiska uppgifter du delar. Du kan läsa vad som delas i <Link href="/help#applications">hjälpen om ansökningar</Link>.</p></section>
      <section id="company-data"><h2>För företag</h2><p>MatchnWork hanterar företagskontot och plattformens funktioner. Den arbetsgivare som tar emot en ansökan använder uppgifterna för sin rekrytering och fattar anställningsbeslutet. Kontakta arbetsgivaren om du undrar hur företaget hanterar ditt underlag. MatchnWork använder företagets namn, organisationsnummer och utsedd administratör för att granska företagskontot. När en kandidat söker ser ni underlaget för den ansökan i kandidatvyn. Frågor om konto, fakturauppgifter och användning av kandidatvyn finns på <Link href="/help#company">hjälpsidan för arbetsgivare</Link>.</p></section>
      <section id="documents"><h2>Dina dokument</h2><p>Dokument lagras privat. De öppnas med tidsbegränsad länk endast när behörighetskontrollen ger åtkomst till din ansökan.</p></section>
      <section id="ai-cv"><h2>AI-CV</h2><p>När du använder AI-CV behandlas det du skickar för att hjälpa dig formulera ditt CV. Du väljer om du vill använda AI eller skriva ditt CV själv. Läs igenom förslaget och ändra uppgifter som inte stämmer innan du sparar.</p></section>
      <section id="followups"><h2>Kompletteringsfrågor och matchning</h2><p>Om du väljer AI-bedömning jämförs uppgifter från ditt CV, din jobbprofil och dina ansökningssvar med jobbets kriterier. Relevanta uppgifter ur underlaget kan skickas till OpenAI för den bedömningen. Arbetsgivaren kan se bedömningsunderlaget och du kan få kompletteringsfrågor. Du kan söka utan AI och ändra valet i dina inställningar. Om du stänger av valet stoppas fortsatt AI-bedömning och tidigare AI-underlag visas inte längre när arbetsgivaren hämtar ansökan igen. Du väljer själv om du vill svara; skickade svar kompletterar din befintliga ansökan och kan läsas av det berörda företaget.</p><p>Kompletteringarna kan användas vid en uppdaterad matchningsbedömning om AI-valet gäller för ansökan. Saknad information är inte ett automatiskt avslag. Arbetsgivaren fattar alltid anställningsbeslutet.</p></section>
      <section id="storage"><h2>Lagring och åtkomst</h2><p>Återkallar du en ansökan spärras arbetsgivarens åtkomst till underlaget i MatchnWork. Lagring och åtkomst kan upphöra vid olika tidpunkter. Planerad gallring av ansökningsunderlag utgår från när ansökan eller rekryteringen avslutades. Uppgifter för anställning, fakturering, säkerhetsärenden och rättighetsärenden kan omfattas av andra lagringsregler.</p><p>En handläggare kan göra ett granskat utdrag tillgängligt i ditt personuppgiftsärende. Nedladdningen kräver att du verifierar dig igen och är tillgänglig i en timme från delningen.</p></section>
      <section id="privacy-requests"><h2>Dina rättigheter</h2><p>Du kan be om en kopia av dina uppgifter eller få hjälp att rätta något, även i en redan skickad ansökan. Gå till <Link href="/help#privacy-requests">Hjälp med personuppgifter</Link> för att skicka en begäran i ditt konto. Du kan också kontakta MatchnWork på <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> utan att logga in.</p></section>
      <section id="delete-account"><h2>Radera konto</h2><p>Du kan permanent radera konto, profil, ansökningar, matchningar, chattar och uppladdade dokument från din profil. Raderar ett företag sitt konto försvinner även dess annonser och tillhörande ansökningar och chattar. Detta går inte att ångra.</p></section>
      <section id="videos"><h2>Video i chatten</h2><p>Video är frivillig och används inte för AI-analys eller matchpoäng. En skickad video blir otillgänglig efter 14 dagar från skickandet, oavsett om mottagaren hunnit se den. Utgångstiden visas vid videon. Saknad eller utgången video döljer inte din ansökan.</p><p>I den här utvecklingsversionen är automatisk filradering ännu inte aktiverad. Åtkomsten stängs ändå efter 14 dagar för skickade videor och efter 24 timmar för oskickade uppladdningar. Filradering och återförsök ska verifieras innan funktionen lanseras. Anmäld video kan behöva behållas separat för säkerhetsgranskning; vanlig uppspelning stängs ändå vid utgångstiden.</p><p>Kopior som någon redan har laddat ned kan inte återkallas av tjänsten. Mottagaren ansvarar för sin vidare hantering.</p></section>
      <section id="reports"><h2>Anmälningar</h2><p>Anmälningar till moderering och det anmälda innehållet sparas för säkerhetsgranskning i upp till 12 månader efter att ärendet avslutats, även om något av kontona raderas. Anmälarens identitet tas då bort.</p></section>
      <footer><p>Informationen beskriver tjänsten i utvecklingsmiljön. Fullständig integritetsinformation och villkor granskas före skarp lansering.</p><Link href="/help">Hjälp och kontakt</Link><PrivacyProfileLink /></footer>
    </article></div>
    </div>
    <MarketingFooter />
  </main>;
}
