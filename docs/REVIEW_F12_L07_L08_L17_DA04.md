# F12, L07, L08, L17 och DA-04

Vilgot / Codex reserverar F12, L07, L08, L17 och uppföljningen av Max färgtokenarbete i DA-04 för granskning den 22 november 2026. Branch `codex/f12-l07-l08-l17-da04-review-20261122` från `dev` 214eeec. Ägare för tidigare leveranser bevaras.

## Underlag för granskning

| Punkt | Leverans | Utfall och avgränsning |
| --- | --- | --- |
| F12 | Kompletteringar återanvänder uttryckliga, godkända uppgifter om B-körkort och truckkort. Synonymer räknas som samma krav. Motstridiga uppgifter blir okända och tidigare arbetstider används inte som aktuell tillgänglighet. | Matchnings-, delnings-, sparade svar- och frågeregressionerna passerade. Verklig modellkörning och en senare ansökan med ett ändrat sparat svar ingick inte i webbacceptansen. |
| L07 | Ny transaktionell DevStaging-svit med fiktivt företag, två ungdomar och en admin. Fakturaprovet söker nu bara efter de fakturor det själv skapar. | 12 faktiska databaskontroller passerade. Separat fakturaprov passerade för bekräftelse, invändning, behörigheter och hantering av utskick. En sammanhängande körning i inloggad webb, inklusive annonsbild, video, verklig AI och omladdningar, återstår. |
| L08 | Tangentbordsöppning flyttar fokus in i kartans annonsruta. Escape stänger rutan och återför fokus till kartnålen. Muspekaren stjäl inte tangentbordsfokus och kartan respekterar minskad rörelse. Webbläsarprovet har en ny kontroll för det beteendet. | Kartkomponentens och kartreservvyns regressioner passerade med simulerad DOM och Mapbox. Tidigare Chromium-resultat finns i [L08-protokollet](L08_BROWSER.md). Den här körmiljön kunde inte starta Chromium. Fysisk Safari, skärmtangentbord, kamera, bilddragning och kartans zoom/geolokalisering återstår. |
| L17 | Samlat acceptansprotokoll för korten som väntade på granskning före leveransen samt F12. | Verkliga rollprov i DevStaging där det fanns isolerade testfall. Lokala regressioner och otestade webbfall anges per kort nedan. |
| DA-04 | Kvarvarande deklarationer med hårdkodade färger ersatta med motsvarande temavärden. Kontrollskriptet underkänner nya färglitteraler i CSS-deklarationer utanför kartan. | Tokenkontrollen passerade. De kvarvarande 20 hex-träffarna ingår i kartan eller i befintliga selektorer. Deklarationsvärdena och layouten bevaras. Ny inloggad visuell kontroll återstår. |

Kör `scripts/test-recruitment-chain-dev.sql` och `scripts/test-hire-test-invoices-staging.sql` mot DevStaging med SQL-behörighet. Båda paketen återställer testtransaktionen. Ingen betalning, faktisk e-postleverans, beständig testdata eller schemaändring ingick. Kör `npm run test:browser:staging` enligt [webbläsarprotokollet](L08_BROWSER.md) vid fortsatt acceptans.

## L17 per kort

DevStaging avser det driftsatta projektets databas. Ett lokalt prov kan köra verklig komponentkod med simulerad webbläsare eller transport. Kolumnen längst till höger anger vad som inte kunde provas i den här inloggade webb- eller leverantörskörningen. Ägarna bedömer `Klar` mot respektive korts kriterier.

| Kort | Faktiskt utfall | Ej testat i inloggad webb eller externt system |
| --- | --- | --- |
| [N22](ATGARDSPLAN.md#n22) | Godkänt lokalt, gamla profillänkar öppnar ingen inspelare eller videospelare. | Befintlig QA-profil i driftsatt webb. |
| [N11](ATGARDSPLAN.md#n11) | Godkänt lokalt, gamla videomeddelanden begär ingen uppspelning. | Historiskt meddelande i driftsatt webb. |
| [N12](ATGARDSPLAN.md#n12) | Godkänt lokalt, matchbunden videoöverföring och återförsök. | Kamera, uppladdning och serverkontrollerad uppspelning. |
| [N23](ATGARDSPLAN.md#n23) | Godkänt lokalt, frivillig ansökningsvideo och återhämtning i videoflödet. | Kameraavslag och ansökan i driftsatt webb. |
| [N14](ATGARDSPLAN.md#n14) | Godkänt lokalt, arbetsplatsdata och flera adresser. | Publicering med flera adresser och karta i samma webbtest. |
| [N15](ATGARDSPLAN.md#n15) | Godkänt lokalt, kopia och versionsbundet annonsutkast. | Kopiera och öppna utkast efter omladdning. |
| [F06](ATGARDSPLAN.md#f06) | Godkänt lokalt, samma pris och benämningar i anställningsflödet. | Prisvisning i ett inloggat företagskonto. |
| [L04](ATGARDSPLAN.md#l04) | Godkänt i DevStaging, bekräftelse och invändning med syntetisk anställning och testfaktura. | Bekräftelse från webbgränssnittet hos båda rollerna. |
| [N16](ATGARDSPLAN.md#n16) | Godkänt i DevStaging för paus, ändring och återpublicering. Utkastsregressionen godkänd lokalt. | Stängning och publicering genom formuläret. |
| [N17](ATGARDSPLAN.md#n17) | Kategorierna ingick i de lokala upptäckts- och filterproven. | Val i annonsbyggaren och filtrering genom hela webbflödet. |
| [N18](ATGARDSPLAN.md#n18) | Godkänt lokalt, urval och filtrering av jobb. | Personligt flöde före och efter omladdning. |
| [F26](ATGARDSPLAN.md#f26) | Godkänt lokalt, likvärdiga fakta och belägg från faktiskt modellunderlag. Leverantören simulerad. | Verklig modell och kandidatvy med fiktiva CV:n. |
| [N19](ATGARDSPLAN.md#n19) | Godkänt i DevStaging för delningsförhandsvisning, sparad version och arbetsgivarens läsning av utdraget. Lokal kontroll av valfri delning passerade. | Val mellan sparade fält i webb samt PDF-läsning som företag. |
| [N20](ATGARDSPLAN.md#n20) | Godkänt lokalt, profilens flöde och återhämtning från laddningsfel. | Chatt och formulär genom hela inloggade flödet. |
| [N21](ATGARDSPLAN.md#n21) | Godkänt lokalt, CV-återkoppling och säker hantering av oläsbar PDF. | Uppladdning och valfri genomläsning genom verklig modell i webb. |
| [L02](ATGARDSPLAN.md#l02) | Godkänt i DevStaging för fakturakö, återförsök och osäker leverans. Lokala notifieringsprov passerade. | Levererad SMTP i avsedd testinkorg. |
| [L03](ATGARDSPLAN.md#l03) | Godkänt i DevStaging för debitering, åtkomst, avisering och stopp vid invändning. | Faktura-PDF i företagsvyn och faktisk testleverans. |
| [N26](ATGARDSPLAN.md#n26) | Godkänt i DevStaging för den gemensamma testfakturans avstämningsunderlag. | Stripe Checkout och webhook med isolerad betalningssession. |
| [N02](ATGARDSPLAN.md#n02) | Godkänt lokalt, återkallad ansökan nekar fortsatt komplettering. | Återkallelse, arbetsgivarens vy och notis från inloggad webb. |
| [L06](ATGARDSPLAN.md#l06) | Godkänt lokalt, sessionsbyte, utloggning, otillgänglig server och återförsök. | Full återställning med verklig e-post och webbsession. |
| [L12](ATGARDSPLAN.md#l12) | Nio godkända kontroller i DevStaging för gallringsregler, kandidater och isolering. | Schemalagd skarp gallring och kontroll från kontots vy. |
| [L13](ATGARDSPLAN.md#l13) | Godkänt lokalt för strukturerad export och återhämtning i klienten. Läsbar leveransfunktion saknades i DevStaging vid kontrollen. | Granskat ZIP-utlämnande genom den driftsatta appen. |
| [L16](ATGARDSPLAN.md#l16) | Godkänt i DevStaging för åtkomst till ärenden och skyddade operationer. Klientprovet för personuppgiftsgranskning passerade lokalt. | Hela handläggarvyn med inloggad QA-admin och engångsfaktorer. |
| [D02](ATGARDSPLAN.md#d02) | Godkänt lokalt, chattens läs- och skrivåterhämtning. | Skrivfält på fysisk mobil med öppet skärmtangentbord. |
| [N13](ATGARDSPLAN.md#n13) | Godkänt lokalt, inspelarens komponentflöde och reservval. | Mikrofon, webbkamera och fysisk mobil. |
| [F10](ATGARDSPLAN.md#f10) | Berörda lokala profil- och annonsprov passerade. | Förifyllning genom båda rollernas formulär i webb. |
| [N24](ATGARDSPLAN.md#n24) | Sju godkända kontroller i DevStaging. Rekryteringsprovet verifierade även frågans svar från företagets roll. | Läsning och svar via den driftsatta kandidatvyn. |
| [F22](ATGARDSPLAN.md#f22) | Lokala annonsutkast och företagsverifieringsprov passerade. | Fältvalidering i inloggad annonsbyggare på mobil. |
| [N25](ATGARDSPLAN.md#n25) | Godkänt lokalt, företagets navigering och annonsbundna kandidater. | Byte mellan två annonser med verklig webbdata. |
| [F20](ATGARDSPLAN.md#f20) | AI-valet gick inte att verifiera i DevStaging, där samtyckesfunktionen saknades. Anonym dev-sida svarade. | Samtycke på inloggad ansökan och worker som läser det. |
| [F23](ATGARDSPLAN.md#f23) | Godkänt lokalt, dialog-, tangentbords- och fokusregressioner. | Skärmläsare och full Tab/Shift+Tab i inloggad webb. |
| [F15](ATGARDSPLAN.md#f15) | Godkänt lokalt, första profilsteg och sida vid saknad profil. | Ny autentiserad ungdom i driftsatt onboarding. |
| [F16](ATGARDSPLAN.md#f16) | Godkänt lokalt, profilsteg och återhämtning. | Slutfört CV i driftsatt webb med rätt nästa steg. |
| [N07](ATGARDSPLAN.md#n07) | Godkänt lokalt, ångra och återhämta kort. | Swipegest och återläsning på fysisk mobil. |
| [N06](ATGARDSPLAN.md#n06) | Godkänt lokalt, filterlogik, URL och olika filterutfall. | Inloggade sökval kvarstår efter navigation. |
| [F18](ATGARDSPLAN.md#f18) | Godkänt lokalt, profilsteg, återhämtning och versionsbundna skrivningar. | Omladdning efter ändring i inloggad webb. |
| [F24](ATGARDSPLAN.md#f24) | Godkänt lokalt, reservlista, omladdning och oförändrade filter. | Nytt inloggat kartprov med verkligt WebGL. |
| [D07](ATGARDSPLAN.md#d07) | Ingen ny visuell genomgång av samtliga texter. Den publika dev-adressen svarade. | Inloggad text, hjälp och tomvyer med saknad webbläsare. |
| [F19](ATGARDSPLAN.md#f19) | Godkänt lokalt, filterlogik och tillgänglighetsregression. | Dialogens fokus, återställning och alternativ i inloggad webb. |
| [N10](ATGARDSPLAN.md#n10) | Godkänt lokalt, kontoinställningar och kontobundna tillstånd. | Byten i båda rollernas inloggade konton. |
| [DA-12](ATGARDSPLAN.md#da-12) | Godkänt lokalt, bygge och designtokenkontroll över berörda stilmallar. | Visuell jämförelse av migrerade vyer vid 375 och 1280 px. |
| [F12](ATGARDSPLAN.md#f12) | Godkänt lokalt, synonymdubbletter, motstridiga fakta, sparade svar och frivillig komplettering. | Återanvänt svar i en senare annons genom inloggad webb med verklig modell. |
