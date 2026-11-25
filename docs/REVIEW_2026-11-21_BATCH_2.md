# Arbetsomgång 2026-11-21

Vilgot / Codex reserverade N26, L13, L16, F20 och DA-12 på `codex/n26-l13-l16-f20-da12-20261121`. Kodleveransen ligger i [PR #247](https://github.com/vilgotdidrikson/youth-job-mvp/pull/247).

| Punkt | Byggt i omgången | Återstår |
|---|---|---|
| N26 | Stripe Checkout för testfakturor. Köp på 500 kr och automatisk avstämning verifierade i dev. | Eventuell skarp aktivering är en separat leverans. |
| L13 | Säkrare återhämtning av ett befintligt exportpaket. | Fullständigt exportinnehåll och inloggad acceptans. |
| L16 | Tillförlitlig tömning av handläggarvyn efter inaktivitet. | Teknik och acceptans för resterande delar av huvudkortet. |
| F20 | Information där användaren skapar CV och söker jobb. | Slutliga villkor och inloggad acceptans. |
| DA-12 | Ungdomsprofilens stilar ligger i en CSS-modul. | Visuell jämförelse och återstående vyer. |

Produktionsbygge med TypeScript, riktad ESLint, regressionssviter och lokala HTTP-prov passerade. Stripe-handlern provades med signerade testhändelser och simulerad leverantörstrafik. Lokala PostgreSQL-prov och en kontroll av den uppdaterade testmiljön passerade. Huvudkortens återstående kriterier gäller fortfarande.

### N26 – verifiering av testköp

En fiktiv företagsfaktura gav HTTP 409 eftersom Stripe använde `/g/pay/` i Checkout-länken. [PR #249](https://github.com/vilgotdidrikson/youth-job-mvp/pull/249) (`6779ccf` på dev) validerar Stripes HTTPS-domän och att länken hör till samma testsession. Regressionstestet täcker länken från sandboxen, det tidigare `/c/pay/`-formatet och avvisning av fel sessions-ID.

Ett Stripe-testköp på 500 SEK genomfördes i webbläsaren med fiktiva uppgifter. Efter återgång visade fakturan **Betalning avstämd** utan manuell avstämning. DevStaging bekräftade belopp, betald status och att avstämningsreferensen motsvarade samma Stripe-testsession. Inga riktiga pengar drogs.

### Uppföljning 2026-11-22

| Punkt | Byggt och kontrollerat | Kvar för att lämna hela punkten för granskning |
|---|---|---|
| L13 | Rättat ett fel där tre fakturakategorier saknade visningsnamn och avbröt ZIP-exporten. Inventerat Stripes privata testdata under testfakturor. DevStaging bekräftade RLS, kolumner och ägarkedja via fakturan. ZIP-, HTTP- och inventeringsproven täcker ändringen. | Fullständig export med granskade fält och filer, rättelsekedja och inloggad acceptans. Testexporten är fortsatt märkt som ofullständig. |
| L16 | Svar som kommer efter handläggarvyns tidsgräns kasseras även när webbläsarens timer är fördröjd. Komponentprov reproducerar ordningen med svaret först. | Privata bilagor, fristpåminnelser, gallring och incidentflöde samt acceptans med de fem personliga handläggarkontona. |
| F20 | Integritetssidan förklarar ansökningsdelning och frivillig AI-hjälp samt länkar till tillgång och rättelse, med kontaktväg utan konto. Kontrollerat genom bygge och tillgänglighetssvit. | Slutliga integritets- och villkorstexter enligt L14/L15 samt sammanhängande inloggad webb- och mobilacceptans. |
| DA-12 | Tagit bort oåtkomliga delar med inline-stilar från företagsintroduktionen. De fyra frågorna och vägen vidare till den ordinarie annonsbyggaren täcks av navigations- och verifieringssviterna. | Återstående stilar i ungdomsintroduktionen och visuell jämförelse i driftsatt dev. |

### Lokalt arbete efter PR #252

- **L13:** Testexporten kan redovisa vilket jobb den egna ansökningsvideon hör till. Endast jobb-ID ingår från kopplingen. Videofiler, lagringsvägar och tredje parts uppgifter bedöms separat. Lokal ZIP- och HTTP-provning finns. Fullständigt paket och inloggad rättelsekedja återstår.
- **L16:** En separat serverfunktion kan gallra ett uttryckligen granskat, avslutat och förfallet ärende vid exakt revision. Databasen kontrollerar handläggarbehörighet och aktuell session. Öppna ärenden och inaktuella revisioner bevaras. Funktionen är endast provad på syntetiska data och migrationsfilen tillför ingen automatisk schemaläggning. Skyddade bilagor, fristpåminnelser och incidentflödet återstår.
- **F20:** Registreringen länkar före kontoskapandet till relevant information för vald roll. Företagsdelen förklarar kontogranskning, ansökningsunderlag och vägen till hjälp. Sluttexterna behöver de beslut som listas i L14/L15.
- **DA-12:** Flyttat de fasta stilarna i den äldre ungdomsintroduktionen till en CSS-modul och ersatt dess globala stilöverskrivningar. Endast beräknad beskärningsgeometri och förloppsbredd använder inline-stilar. Den aktiva ungdomsintroduktionen använder kortflödet. Visuell kontroll av den äldre komponenten kräver ett isolerat förhandsprov.

Ändringarna hålls på lokal arbetsbranch i väntan på att hela leveransen kan gå till granskning.

### Fortsatt lokal leverans

- **L13:** Exportprovet inkluderar också validerad filtyp, storlek och längd för egen video. Gallrade videor kan ha tomma metadatafält. Testerna kontrollerar att lagringsväg och konversations-ID inte följer med.
- **L16:** Handläggaren kan bekräfta en granskad gallring med nytt lösenord och tvåfaktorskod. Klienten kontrollerar bekräftad ärenderevision innan raden tas bort ur vyn. Flödet är begränsat till DevStaging och kräver en uttrycklig miljöflagga. Vid osäkert svar läser handläggaren om kön. Ett separat serverfilter visar öppna ärenden med svars- eller uppföljningsdatum inom sju dagar. Det skickar inga meddelanden.
- **F20:** Granskningsunderlaget i [F12/F20/D07](F12_F20_D07_HELP.md#f20--granskningsunderlag-för-sluttexterna) kopplar varje text till rätt plats i tjänsten och anger vilka uppgifter som behöver bekräftas före slutversionen.

### Lokal uppföljning av besluten

- **L13:** Strukturerade egna profilfält ingår i ZIP-provet. CV-filer och egna ansökningssvar återstår för den fulla exporten. Blandat underlag hanteras via personuppgiftsärenden, länkade från exportdialogen.
- **L16:** Handläggarens sparade gallringsdatum visas i ärendevyn. Lokal PostgreSQL kontrollerar att det inte når användarens projektion. Incidenter, skyddade bilagor, bakgrundspåminnelser och verifiering av handläggarnas tvåfaktorsflöde är öppna.
- **F20:** Opt-in kontrolleras både i databasen och vid AI-anrop. Tidigare ansökningar får ingen ny bedömning genom att man aktiverar valet, och företagets kandidatvy visar ett läge för ansökan utan tillgänglig AI-bedömning. Fakta om ansvar och lagring följs upp med L14/L15. Den nya privata tabellen `private.application_ai_preferences` har ungdomens konto-ID, tidpunkt för aktivt val, ändringsdatum och textversion. Före leverans behöver tabellen klassas i datainventeringen och verifieras mot en färsk katalog efter införandet i DevStaging.
- **DA-12:** Röstsamtalets CV-vy flyttad till CSS-modul med befintliga designtokens. Chromium nekades att starta, så visuell kontroll av mobil och desktop räknas inte som utförd.

Samlad arbetsbranch: `codex/l13-l16-f20-da12-complete-local`. Ingen publicering eller ändring av gemensam kortstatus.

Verifierat lokalt med fiktiva uppgifter: 238 strukturerade och 88 läsbara exportprov över faktiska ZIP-filer, 18 exportdialogprov, 140 PostgreSQL-prov för ärendehanteringen, separat PostgreSQL-prov för AI-valet och 24 routeprov för kandidatbedömning med styrda Auth-/leverantörssvar. Ansökningsöversikt, förhandsvisning och frivilliga kompletteringsfrågor, tillgänglighet, designtokens, riktad ESLint, TypeScript och produktionsbygge med Webpack passerade. Inga migrationer kördes i DevStaging i detta steg.

### Fortsatt lokal granskning 2026-11-22

- **DA-12** är satt till För granskning i arbetsbranchens plan. Företagsvyer, profil, autentisering, röst-CV och ungdomsintroduktion kontrollerades i källan. Endast beräknade förlopps- och beskärningsmått ligger kvar inline. Designtokens och visuella komponentregressioner passerar. Chromium-testet stoppas före första sidan med nekad socketåtkomst. Granska vyerna vid 375 och 1280 px, inklusive progress, beskärning och röstvyns statuslägen.
- **L16** har en separat incidentkö och avskilda privata PDF-bilagor med samma tvåfaktorsgräns som i ärendehanteringen. Bilagor och åtkomstloggar följer gallringen av ärendet i den aktiva databasen. PDF-filer har en gräns på 1 MB och lagras som bytea för transaktionell gallring. Uppkommande frister visas för inlästa ärenden. Incidenternas uppföljningsvy utgår från vetskapstid enligt [IMY:s vägledning](https://www.imy.se/vanliga-fragor-och-svar/nar-ska-vi-anmala-personuppgiftsincidenten-till-IMY/). Automatisk mejlpåminnelse, kontroll av säkerhetskopior och rollprov i DevStaging kvarstår.
- **L13** exporterar nu rena ja- och nejsvar som kan knytas till den egna ansökan. Fritext, PDF-CV:n och uppgifter med möjlig tredjepartskoppling behöver täckas av en manuell bedömning eller en verifierad projektion med enbart egna uppgifter innan hela punkten kan lämnas för granskning.
- **F20** har den lokalt verifierade frivilliga AI-rutan från föregående commit. Saktext om rättsligt ansvar och verifierade lagringstider samt aktuell DevStaging-katalog kvarstår.

160 lokala PostgreSQL-kontroller, 71 routekontroller, 85 komponentkontroller och 239 strukturerade exportprov med fiktiva data passerade. Riktad ESLint, TypeScript och produktionsbygge med Webpack ingick. Migrationerna är fortfarande lokala och inga externa meddelanden skickades.

### Samlat paket för kodgranskning

Alla fyra kort är markerade För granskning i arbetsbranchens åtgärdsplan. Granskningen gäller funktioner och texter på arbetsbranchen. Inga nya skarpa funktioner eller jobbscheman har aktiverats.

| Kort | Leverans | Granskningsprov efter införande i DevStaging |
|---|---|---|
| L13 | Automatisk ZIP för avgränsade egna fält och egna ja- och nejsvar. CV-filer och fritext som kräver innehållsbedömning går via handläggaren, som granskar och delar en dedikerad PDF-kopia. Nedladdning kräver rätt konto och ny autentisering. Handläggaren kan återkalla åtkomst direkt. PDF-kopian gallras av det schemalagda jobbet. | Prova ordinarie ZIP och granskat utdrag med fiktiva konton från båda roller. Kontrollera mottagare efter kontobyte, utgången fil, ersatt fil och fysisk radering av den tillfälliga kopian. Verifiera säkerhetskopior enligt L12/L14. |
| L16 | Separat incidentkö, privata PDF-bilagor, gallringsdatum och daglig in-app-påminnelse utan ärendeinnehåll. Påminnelsen går bara till behöriga handläggare som berörs. | Bekräfta handläggarroller och tvåfaktor, kontrollera åtkomst efter ändrad roll, schemakörning och incidentövning. Bekräfta mottagare, att stängda ärenden inte aviseras och att inga dubbla notiser skapas vid normalt omförsök. |
| F20 | Integritetssidan beskriver ansökans mottagare, spärr vid återkallelse, lagringskriterier, AI-val, stöd och granskad leverans. Saktext och villkorsutkast har en lista över faktiska bevis och beslut för L14/L15. | Kontrollera att båda roller hittar uppgifterna före relevanta steg, och att ansökan fungerar med AI-rutan tom. Fastställ ansvar, rättslig grund, leverantörsinställningar och villkor före skarp publicering. |
| DA-12 | Statiska stilar flyttade till CSS-moduler i de berörda vyerna. | Kör visuell jämförelse vid 375 och 1280 px, inklusive progress, beskärning och röst-CV. |

Efter migration ska den färska DevStaging-katalogen granskas och jämföras enligt docs/L13_EXPORT_INVENTORY.md. Testerna använder fiktiva uppgifter och kontrollerade Auth-gränser; inloggade roller och mobil/desktop är acceptansprov under granskningen.
