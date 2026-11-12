import type {Metadata} from "next";
import Link from "next/link";
import {MarketingFooter} from "@/components/marketing-footer";
import {MarketingNav} from "@/components/marketing-nav";
import {PrivacyProfileLink} from "../privacy/privacy-profile-link";
import {CONTACT_EMAIL} from "@/lib/product-copy";
import "../landing.css";
import styles from "./page.module.css";
export const metadata:Metadata={title:"Hjälp och kontakt",description:"Hjälp med konto, CV och ansökningar i MatchnWork."};
export default function HelpPage(){return <main className={styles.page}>
 <MarketingNav/>
 <div className={styles.content}>
  <header><h1>Hjälp och kontakt</h1><p>Hitta nästa steg för ditt konto, ditt CV eller din ansökan.</p></header>
  <div className={styles.layout}>
   <nav className={styles.topics} aria-label="Hjälpområden"><a href="#account">Konto och inloggning</a><a href="#cv">Profil och CV</a><a href="#applications">Ansökningar</a><a href="#company">För arbetsgivare</a><a href="#contact">Kontakta oss</a></nav>
   <article>
    <section id="account"><h2>Konto och inloggning</h2><p>Har du glömt lösenordet kan du begära en återställningslänk. Om kontot väntar på e-postbekräftelse kan du begära ett nytt bekräftelsemejl.</p><div className={styles.actions}><Link href="/forgot-password">Återställ lösenord</Link><Link href="/resend-confirmation">Ny bekräftelselänk</Link><Link href="/login">Logga in</Link></div></section>
    <section id="cv"><h2>Profil och CV</h2><p>Du kan skriva ditt CV själv, ta hjälp av AI eller ladda upp en PDF. Granska uppgifterna innan du gör CV:t klart.</p><p>Arbetsutkastet på din enhet och ditt färdiga CV är skilda saker. Välj Spara privat utkast på kontot i CV-guiden om du vill fortsätta på en annan enhet. Öppna sedan det sparade utkastet där och granska CV:t igen.</p><p>Kontaktuppgifter kan ändras i profilens inställningar. Kontrollera också det färdiga CV:t om du har ändrat namn eller ort.</p></section>
    <section id="applications"><h2>Ansökningar och frivilliga frågor</h2><p>I Ansökningar ser du om ditt intresse väntar på ett färdigt CV eller om ansökan har skickats. En skickad ansökan väntar inte på att du besvarar frivilliga kompletteringsfrågor.</p><p>Välj Se vad företaget söker vid frågorna för att läsa annonsens beskrivning och krav. Saknade uppgifter är inte ett automatiskt avslag; arbetsgivaren fattar anställningsbeslutet.</p><p>Du kan återkalla en ansökan från Ansökningar. Ett privat arbetsutkast ersätter inte det underlag du redan har delat. <Link href="/privacy#profile-data">Läs om profil och ansökan</Link>.</p></section>
    <section id="company"><h2>För arbetsgivare</h2><p>Företagsuppgifter, verifiering och fakturaunderlag finns i profilen. Annonser och deras status hanteras från Mina annonser. Kandidatgranskning och meddelanden hör till den aktuella rekryteringen.</p><p>Lön och anställningsvillkor kommer arbetsgivaren och den sökande överens om. MatchnWork hanterar inte löneutbetalningen.</p></section>
    <section id="contact"><h2>Kontakta MatchnWork</h2><p>Beskriv vad du försökte göra och vad som hände. Skicka inga lösenord eller onödiga personuppgifter.</p><a className={styles.contact} href={`mailto:${CONTACT_EMAIL}?subject=Hj%C3%A4lp%20med%20MatchnWork`}>{CONTACT_EMAIL}</a><p>Mejllänken öppnar din mejlapp. Inget meddelande skickas automatiskt.</p></section>
    <section id="privacy-requests"><h2>Dina personuppgifter</h2><p>Be om tillgång, rättelse eller annan hjälp med dina uppgifter. När ärendemottagningen är tillgänglig kan du skicka en begäran och läsa svar i ditt konto. Du kan alltid använda mejlkontakten ovan utan att logga in.</p><Link href="/account/privacy-requests">Mina personuppgiftsärenden</Link></section>
    <footer><Link href="/privacy">Integritet och AI</Link><PrivacyProfileLink/></footer>
   </article>
  </div>
 </div>
 <MarketingFooter/>
 </main>;}
