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

## Inloggad webbgranskning 2026-11-23 (Max / Claude)

Chromium (Playwright, headless, WebGL via SwiftShader) mot https://youth-job-mvp-dev.vercel.app, DevStaging, dev `d5a2797`. Fiktiva QA-konton med prefix `qa-l17-1795454322587-8956a4`: ett företag, tre ungdomar (en skapad via `/signup`) och en admin med tillfälligt adminmedlemskap. Företaget verifierades av QA-admin via `/admin/companies`. Två tydligt märkta QA-annonser (”… – EJ RIKTIGT JOBB”) publicerades i dev under testet. Efterkontroll: 0 QA-konton, 0 QA-annonser och 0 adminmedlemskap kvar. Ingen verklig AI-körning, e-post, betalning, kamera eller filuppladdning ingick. Testskripten låg i en lokal arbetsmapp och är inte incheckade.

### Godkänt i inloggad webb

| Kort | Provat och utfall |
| --- | --- |
| [N14](ATGARDSPLAN.md#n14) | Annons med två adresser (Uppsala, Stockholm) publicerades vid 375 px. Båda fick koordinater, annonsen visas som ”Uppsala / Stockholm” och textsökningen ger en post per annons. En kopia behåller båda adresserna. Kartan ritas med WebGL (16 nålar). QA-nålarna kunde inte identifieras var för sig eftersom nålarna saknar namn. |
| [N15](ATGARDSPLAN.md#n15) | Kopieringsdialogen öppnades. Kopian öppnas som utkast och finns kvar efter omladdning i samma webbläsare. Publicering kräver kryssrutan, och ett blockerat försök visar varför. Lönetexten följer med. Kopian publicerades som en egen annons med en ny jobbtyp, och originalet var oförändrat. |
| [N16](ATGARDSPLAN.md#n16) | Pausa visar Pausad och döljer annonsen för ungdomar. Återaktivera visar Publicerad. Stäng rekrytering via formuläret med ”Anställd genom MatchnWork” ger Stängd. Annonsen försvinner då för ungdomar, chatten finns kvar och Återaktivera erbjuds. |
| [N17](ATGARDSPLAN.md#n17) | Caféarbete och Butiksarbete valdes i annonsbyggaren, och jobbtypen visas i annonslistan. Filtret Kategori = Caféarbete begränsar ungdomens urval. |
| [F06](ATGARDSPLAN.md#f06) | Prissidans företagsflik, anställningsdialogen och fliken Fakturor stämmer överens: kostnadsfritt nu, 500 kr per bekräftad anställning vid lansering och 1 000 kr senare. Faktureringen sker efter kandidatens bekräftelse. |
| [L04](ATGARDSPLAN.md#l04) | Företaget registrerade anställningen i chatten och fick ”Inväntar kandidatens granskning”, alltså ingen egen bekräftelse. Ungdomen granskade vid 375 px och valde ”Uppgifterna stämmer”. Båda rollerna visar sedan ”Anställning bekräftad”. Invändningsvägen provades inte i webben. |
| [N02](ATGARDSPLAN.md#n02) | Ungdomen återkallade ansökan via dialogen, som förklarar match, chatt och redan läst underlag. Status ”Ansökan är återkallad.” visas. Ansökan försvinner ur arbetsgivarens lista och företaget får en notis. |
| [N24](ATGARDSPLAN.md#n24) | Företaget skickade en fråga och fick status Inväntar svar. Ungdomen fick notisen ”Fråga från företaget”, svarade och kunde avstå. Företaget läser svaret under ”Uttryckligen delade svar”, och ingen chatt skapades. Samma fråga en gång till nekas med ”Frågan finns redan i ansökan.” |
| [F10](ATGARDSPLAN.md#f10) (företagsdelen) | Steg 3 i en ny annons får orten Uppsala från företagsprofilen, med förklaringen. |
| [F22](ATGARDSPLAN.md#f22) | Vid 375 px: omvänt åldersintervall och omvänd lön ger svensk feltext vid fältet och markerar fältet. Förhandsvisningen öppnas inte, och felet försvinner när värdet rättas. Ogiltigt organisationsnummer ger svensk feltext. Datumfältet visar fortfarande webbläsarens format, vilket är känt. |
| [F15](ATGARDSPLAN.md#f15) | Ny ungdom via `/signup`: två onboardingsteg och sedan valet Bygg profil/Bygg senare. Bygg senare leder direkt till `/swipe` utan spärr, med 13 jobb och utan horisontell scroll vid 375 px. |
| [F16](ATGARDSPLAN.md#f16) | ”CV:t är sparat.” står kvar och användaren stannar på sidan i minst 7 s. Efter Intresserad visas ”Ansökan till … är skickad.” och ansökan syns under Ansökningar. |
| [F18](ATGARDSPLAN.md#f18) | Efter sparade kontaktuppgifter stannar användaren under Inställningar, med bekräftelse. Värdet finns kvar efter omladdning. |
| [F19](ATGARDSPLAN.md#f19) | Dialogen säger att stängning behåller tidigare val. Avbryt och Escape behåller urvalet och återför fokus till Filtrera jobb, och ett avbrutet val visas inte nästa gång. Tillämpa ändrar urvalet (13 → 3) och visar aktivt filter. Rensa återställer urvalet. |
| [F23](ATGARDSPLAN.md#f23) | Rollvalet i `/signup` är radioknappar. Kopierings- och filterdialogerna tar fokus vid öppning, och Escape återför fokus. I filterdialogen stannar 20 Tab och 20 Shift+Tab i dialogen, med ett undantag: efter sista knappen går fokus till webbläsaren och sedan tillbaka in, vilket är normalt för en inbyggd modal. Fokus är synligt. Ej provat med skärmläsare eller på fysisk mobil. |
| [F24](ATGARDSPLAN.md#f24) | När WebGL nekas visas beskedet ”Din webbläsare saknar stöd för WebGL … Sökvalen är kvar. Fortsätt i listan nedan.”, knappen Försök visa kartan igen och en jobblista med 12 jobb. Ingen horisontell scroll vid 375 px. |
| [N07](ATGARDSPLAN.md#n07) | Efter Inte nu visas Ångra, som tar tillbaka samma jobb. Provat med knappar, inte med swipegest på pekskärm. |
| [N10](ATGARDSPLAN.md#n10) | Ungdomens adress sparas och finns kvar efter omladdning. Företagets markering för Nya meddelanden sparas på kontot och finns kvar efter omladdning. E-postbyte provades inte, eftersom det kräver e-post. |
| [D02](ATGARDSPLAN.md#d02) | Vid 375×667 ligger skrivfältet inom vyn (nederkant 587 px), även efter skickat meddelande. Ingen horisontell scroll. Chatten fungerar åt båda hållen. Ej provat med skärmtangentbord. |
| [N18](ATGARDSPLAN.md#n18) | Korten visar skäl (”Tillhör en typ av jobb du vill söka · Har en arbetsplats på en ort du angett”), och sedda kort flyttas ner vid nästa laddning. Ingen paginering eller betalda lyft provades. |
| [DA-04](ATGARDSPLAN.md#da-04) | 30 vyer vid 375 och 1280 px, alla utan horisontell scroll: företagsvyn, kandidatvyn, företagsuppgifter med verifieringsruta, fakturor, notiser, chattar, `/private`, ungdomens profil, profilbygget, ansökningar och swipe, samt adminens företags- och rekryteringslistor. Färgerna följer temat, även i chatten. De 20 hex-träffarna utanför `theme.css` är kartan och selektorer i `product-design.css`. |
| [DA-12](ATGARDSPLAN.md#da-12) | `app/company/page.tsx` och `/private` vid 375 och 1280 px har inga renderade inline-färger eller inline-avstånd i `main`, bara `color: transparent` från Next-bilder, och ingen horisontell scroll. |
| [L07](ATGARDSPLAN.md#l07) | Kedjan i webben: företagsuppgifter → adminverifiering → två annonser → ansökningar → fråga och svar → accept → chatt → registrerad och bekräftad anställning → stängd annons. Annonsbild, video, verklig AI och faktura ingick inte. |

### Underkänt med felbeskrivning

| Kort | Fel |
| --- | --- |
| [N25](ATGARDSPLAN.md#n25) | Byte mellan annonser fungerar. Men i en annons kandidatvy byter varken klick eller Enter på en annan kandidat i listan visad kandidat. Den först valda står kvar, och URL:en skrivs utan `candidate`. En direktlänk med `&candidate=<id>` öppnar rätt kandidat. Återskapat tre gånger vid 1280 px. Frågor och beslut gäller därmed den kandidat som visas, inte den som klickades. |
| [N06](ATGARDSPLAN.md#n06) | Textsökningen fungerar (QA-märket gav 2 träffar). Men filter och sökning finns inte i URL:en (`/swipe`) och försvinner både med webbläsarens Tillbaka från Ansökningar och vid omladdning. |
| [N20](ATGARDSPLAN.md#n20) | Formulärvägen skickar inga AI-anrop och sparar profil och CV med godkännande. Men med svaret ”Svenska – Modersmål / Engelska – Goda kunskaper” får profilen båda språken medan CV-utkastet bara får Svenska. Återskapat med två ungdomar. Berör även N19:s grund-CV. |

### Observationer (inget kriterium underkänt)

- `/swipe` och Inställningar visar ”AI-inställningen kunde inte hämtas.” Det stämmer med F20-raden ovan, där samtyckesfunktionen saknades i DevStaging.
- Stängningsdialogen säger ”Använd Registrera anställning i chatten …” även när anställningen redan är bekräftad (N16/L04, text).
- Adminens rekryteringslista vid 1280 px: Spara granskning ser ostylad ut, Visa annons har större text och filterknapparna saknar markerat läge. Det gäller layout, inte färg (L03/F17).
- Kandidatens praktiska uppgifter visar ”Inte angivet” för dagar och tider, trots att ”Helger och kvällar” angavs i fritext i profilformuläret.
- Adminens företagslista innehåller äldre QA-företag från tidigare tester (till exempel ”QA Café 12 oktober — fiktivt testföretag” och flera ”Namnlöst företag”). Jag rörde dem inte.

### Ej testat i den här körningen

- Video och kamera: N11, N12, N13, N22, N23.
- Verklig AI-modell: N21, F12, F26 och AI-chatten i N20.
- E-post och domän: L02, L06.
- Testfaktura och Stripe: L03, N26.
- GDPR-kort utanför Max avgränsning: L12, L13, L16, F20, N19.
- Fysisk mobil och Safari: L08.
- Profilflödeskortet (2026-10-14).
- D05 är inte infört i dev.

## Uppföljning 2026-11-25

| Kort | Åtgärd och prov |
| --- | --- |
| N25 | Kandidatval skriver både annons och kandidat till URL:en via samma historikmekanism som företagsvyn använder. Komponentprovet klickar på kandidat två och verifierar URL, markerad rad och CV-/beslutsomfång. |
| N06 | Textsökning och tillämpade filter skrivs till URL:en utan ny hämtning av jobbflödet. Kort, karta och sparat behåller sökvalen. Komponentprov verifierar söktext, filter och återläsning från URL vid ny montering, rensning utan att ta bort jobblänk och fortsatt paginering efter tjugo val. |
| N20 | Formulär och chatt återanvänder samma språkparser. Två språk på samma rad separeras och båda når CV-granskning och sparning. Testet täcker även separat godkännande och bevarad egen nivåtext. |
| N02 | DevStaging använder PT409 vid konflikt efter statusändring. SQL-provet för återkallande kontrollerar rätt kod och att en gammal bekräftelse lämnar den skickade ansökan intakt. |
| N14 | Arbetsplatsprovet skapar fiktiva testkonton i transaktionen och skickar ansökan via ordinarie delningsförhandsvisning. Verifierat i DevStaging, inklusive serverns ögonblicksbild och nekad åtkomst. |
| N17 | Kategoritestet stubbade CSS-modulen som formulärfältet använder. Hela det lokala kategoriprovet passerade därefter. |

De riktade komponentproven, TypeScript, riktad ESLint och produktionsbygget
passerade. DevStaging-proven kördes med rollback för rekryteringskedjan,
frågor, återkallande, arbetsplatser, publika jobb, ansökningsrättelser, AI-val,
avtal, videoåtkomst, ansökningsvideo, integritetsärenden samt pris och
testfakturering. Lokala prov täckte även faktura-PDF och SMTP-transport,
matchningsregressioner och klient-/UI-delar av personuppgiftsärenden.

Kandidatbyte, filter vid omladdning/Tillbaka och flerspråkigt profilsparande
behöver omprovas i inloggad webb. Fysisk mobil/Safari, kamera och verkliga
utskick ingick inte. De publika och administrativa driftinställningarna i
produktion berördes inte. Punktstatus ändras när respektive klart-kriterium
har verifierats.
