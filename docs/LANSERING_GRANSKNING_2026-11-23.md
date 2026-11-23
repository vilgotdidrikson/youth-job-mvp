# Lansering och återstående beslut

Vilgot / Codex, `codex/final-five-20261123`. Avgränsad förberedelse för L14, L15, L10, D05 och DA-18. D05:s ägarskap och uttryckliga designbeslut gäller. DA-18 gäller beslutsunderlag före eventuell implementation.

## L14 Leverantörer och dataflöden

| Tjänst | Kontrollerat | Bevis som behövs före skarp behandling |
| --- | --- | --- |
| Vercel | Två skilda projekt identifierade i samma team, `youth-job-mvp-dev` och `youth-job-mvp`. | Avtalspart, aktivt abonnemang, gällande DPA, region för funktioner, logglagring och behörigheter. |
| Supabase | DevStaging är aktivt i `eu-central-1`. Produktionsprojektet är aktivt i `eu-west-1`. Devs `youth-documents` är privat och `job-images` publikt. | Avtalskund och DPA per organisation, åtkomst, separat återställningsprov av databas och filer, hosted Auth/SMTP-konfiguration och kontroll av skarp lagring. |
| OpenAI | Kodens centrala textinställningar innehåller `store: false`. Kontoägare, projektinställningar och leverantörens lagring kunde inte verifieras därifrån. | Rätt organisation, faktisk datadelning/lagring, överföringsunderlag och separata projektnycklar. Se [OpenAI:s datakontroller](https://developers.openai.com/api/docs/guides/your-data). |
| Mapbox | Kart- och platsfunktionerna använder Mapbox i koden. | DPA, vilka data webbläsaren överför och kontots inställningar för token, ursprungsbegränsningar och telemetri. |
| Zoho och Loopia | HTTPS svarar på båda domännamnen och www leder till huvuddomänen. | Avtalspart, e-postregion, åtkomst, e-postleverans, DPA och överföringsunderlag där tillämpligt. |
| GitHub och utvecklingsverktyg | Källkoden är knuten till projektets repo. | Konton, behörigheter, avtal, loggar och rutin som håller verkliga kandidatdata utanför test- och utvecklingsverktyg. |

Profil- och onboardingflödena visar nu fasta feltexter i stället för obearbetade svar från databasen. Ingen faktisk åtkomst till leverantörsavtal eller äldre loggar kan utläsas av det. Bifoga daterat, maskerat kontobevis per tjänst i befintligt L14-underlag. [Vercels DPA](https://vercel.com/legal/dpa) och [Hobby-villkor](https://vercel.com/docs/plans/hobby) är publika källor för kontokontrollen.

## L15 Åldersgräns och beslut inför avtal

15-årsgränsen kontrolleras när födelsedatum sparas i onboarding och i kontouppgifterna. Den föreslagna migreringen validerar nya eller ändrade åldersuppgifter även vid databasskrivning och beräknar åldern från födelsedatum om ett sådant finns. Äldre och ofullständiga uppgifter kan finnas kvar, inklusive kontorader som skapas innan födelsedatum fyllts i. Valideringen bevisar inte att ett självuppgivet datum stämmer och inför ingen kontroll av vårdnadshavares godkännande. Reproducera det lokala databasprovet med `node scripts/test-youth-age-postgres.mjs` och installerad `@electric-sql/pglite`. `npm run test:profile-journey` täcker klientens gränsfall och profilskrivning.

| Beslut för Vilgot och rådgivaren | Påverkan på implementationen |
| --- | --- |
| Vem som är rätt avtalspart och personuppgiftsansvarig i varje steg. | Företagsavtal, eventuella bilagor, informationstexter, kontaktvägar och ansvar för rättighetsärenden. |
| Vilket avtals- och informationsflöde som gäller 15–17-åringar, inklusive äldre konton med saknat födelsedatum. | Vilka steg som går att slutföra med egen accept, vilka spärrar som behövs och hur äldre konton hanteras. |
| Godkända sluttexter och verifiering av företagets företrädare. | Serverns versionshistorik, sparbar identisk kopia och gemensamma spärrar för publicering, kandidatvyer, API och privata dokument. |
| Godkänd DPIA och AI-bedömning för de två användningarna, CV-hjälp och arbetsgivarens bedömningsunderlag. | Vilken behandling som kan tas i drift och vilka bevis, tester och skydd som måste finnas först. |

Använd befintligt DPIA-utkast och dokumentförteckningen i [åtgärdsplanen](ATGARDSPLAN.md#l15). Den frivilliga AI-rutan enligt F20 är redan beslutad och behöver inget nytt produktbeslut i den här leveransen. L15:s avtalsflöde förutsätter de godkända texterna och rollbesluten.

## L10 Driftsättningsprov och återställning

Kör `node scripts/check-launch-http.mjs dev` för startsida, login, hjälp, integritet och återställningssida. Kör `node scripts/check-launch-http.mjs production` för nuvarande startsida och omdirigering från www. Samtliga sju HTTP-prov gav HTML med status 200 på avsedd slutadress. Testet skickar inga formulär eller riktiga meddelanden. Inloggning, återställningslänkens leverans och kärnflödet i skarp miljö ingår i separat acceptans.

Inför släpp:

1. Identifiera målprojekt, domän och tidigare fungerande deployment i Vercel. Kontrollera separat Supabase-projektreferens, exakta Auth-redirects och mejllänkar samt miljöbindning för AI, SMTP, karta, testbetalningar och privata dokument. Hantera hemligheter i respektive plattform.
2. Kontrollera tillämpliga migreringar i staging innan produktionssläpp. Kontroll den 23 november i DevStaging visade att `public.application_ai_allowed(uuid,uuid)` och L13:s leveranstabell saknades. Den nya åldersmigrationen passerade även sex kontroller i DevStaging i en återställd transaktion med ett fiktivt ungdomskonto. Efteråt fanns inga testkonton kvar och migrationen var inte permanent installerad.
3. Utse släppansvarig, larmmottagare och supportkontakt. Efter godkänt L14/L15 och släppbeslut, kör rollprov med testkonton och kontrollera aktuella priser, betalningsläge och stödväg. Undvik riktiga ärenden i röktestet.
4. Vid regressionsfel, håll nya släpp och återställ webbdeployen till tidigare verifierad version i rätt Vercel-projekt. Kör HTTP-provet igen och kontrollera kärnflödet. Kontrollera separat databasens schema och kompatibilitet innan planerad återställning av data. En webbrollback rullar inte tillbaka databasen. Dokumentera vilken version som återställdes, utfallet och ägaren för uppföljning.

## D05 Första vyn

I dagens kod visas den första hela rubriken direkt: ”Ditt första jobb börjar här.” Skrivmaskinen påverkar den sista frasen, och den andra rubriken riktar sig mot rekrytering. Den tidigare statiska förklaringen och telefonkortet togs bort efter användarens val. Ett avgränsat förslag för Max och Vilgot är att använda den befintliga rubrikplatsen för en hel statisk rubrik om ungdomsjobb och rekrytering. Det behåller antal element och låter båda målgrupperna förstå tjänsten från första renderingen. Bestäm också om bakgrunden får justeras bakom vit text så att kontrasten kan verifieras. Efter beslut, prova startsidan vid 375 och 1280 px utan JavaScript, med minskad rörelse och i normalt läge. Kontrollera gemensam navigation på `/features` och `/pricing`.

## DA-18 Utloggade jobb

I DevStaging kunde databasrollen för utloggade läsa 11 rader från jobbtabellen den 23 november. Bara antal hämtades. Annonsdetaljen kan i koden försöka läsa ett jobb utan inloggning. Beslutet ska därför omfatta både vad som visas i gränssnittet och vilket läsunderlag som är tillåtet i databasen.

| Val för pilot | Omfattning |
| --- | --- |
| Fiktiva exempel utloggat | Demo visar konstruerade annonser. Riktiga annonser kräver inloggning även på detaljsidan och i dataåtkomsten. |
| Ett urval riktiga publicerade jobb utloggat | En utsedd mängd aktiva annonser med uttryckligt tillåtna annonsfält. Pausade, stängda och ej godkända annonser försvinner. Ansökan, sparande och allt kandidatunderlag kräver inloggning. |

Testa valt beteende med anonyma och inloggade roller, direktlänkar och ändrad annonsstatus. Ingen ny publik annonsvy eller ändrad behörighet ingår i detta förslag.

## Kompletterande verifiering i DevStaging

- Åldersprovet verifierade att ett fiktivt ungdomskonto kan skapas före profilkomplettering, att fyllt 15 godtas, att 14 år och framtida födelsedatum avvisas och att ett motstridigt numeriskt värde inte förbigår födelsedatumet. Skrivproven kördes med rollen `authenticated` bunden till testkontot. Transaktionen återställdes. Efterkontrollen gav noll testkonton och bekräftade att åldersmigrationen fortfarande väntar på permanent installation.
- Vercel bekräftade 23 november att `matchnwork.se` kör `master` på `58f6192` och att `youth-job-mvp-dev.vercel.app` kör `dev` på `d5a2797`. Båda deploymentarna är READY och använder skilda Vercel-projekt. Detta verifierar domänkopplingen och ger referenser för återställning av webbdeployen.
