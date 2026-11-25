# N09 / L09 / L06 – CV-sessioner och privat PDF

- Ansvarig: Vilgot / Codex
- Branch: `codex/n09-l09-l06-live-cv-20261111`
- Status: Pågår; reserverad före implementation.
- N09: prova kontoutkast med separata sessioner och konkurrerande versioner.
- L09: prova verklig privat PDF och rätt/fel konto.
- L06: prova egen kontoradering inklusive utkast och filer samt städning av samtliga fiktiva QA-konton.
- Endast DevStaging och driftsatt dev, syntetiska uppgifter. Inga riktiga rekryteringar, mejlutskick, AI-anrop eller produktionsändringar.

## Resultat 2026-11-11

43 kontroller mot riktig Auth, Data API, Storage och driftsatt dev passerar med helt fiktiva konton. Testet använder de faktiska produkthjälparna med en sessionskontextadapter; nätverkssvaren simuleras inte.

- N09: separata Auth-sessioner för samma konto; verkligt samtidiga första sparningar och uppdateringar med exakt en vinnare; återupptagen text, metod, steg och genererad förhandsvisning; gamla revisioner avvisas även efter tömning. Privat utkast förändrar inte färdigt CV och profilsparning skriver inte över en annan sessions utkast.
- L09: faktisk PDF-generering och PDF.js-läsning bevarar svenska tecken, negation och slutmarkör. Den privata filen laddas upp och sparas genom befintligt ägarskopat flöde, och ägaren hämtar samma byteinnehåll. Annan ungdom, företag och anonym klient nekas. Separat original-PDF från den befintliga livekedjan renderad med Poppler och visuellt granskad; Inter är inbäddat.
- L06: fel förväntat konto och fel lösenord nekas; lokal utloggning återkallar den andra sessionens refresh-token och behåller den första. Egen kontoradering tar bort utkast och privat PDF; gammal token kan inte återläsa/återskapa utkastet eller hämta filen, och nytt login nekas.

Första försöket stannade på en QA-profil utan namn när CV-sparningen satte onboarding_completed. Databasens befintliga namnkrav bekräftades. Testet kompletterades med normal fiktiv grundprofil; produktregeln ändrades inte.

Ytterligare 25 förkontroller i den äldre livekedjan passerade, men dess beställda företagsdelning före matchning är inte godkänd. Den separata QA-verifieringen genomfördes inte när verktygets bekräftelse löpte ut. Den tidigare möjligheten att rapportera ett sådant överhopp som ett godkänt test är borttagen: begärd delning utan testförutsättningar ger nu felstatus. Detta är en verifieringsbegränsning, inte bevis på produktfel.

Samtliga nio konton från försöken raderades genom egen kontoradering. Efterkontroll med exakt avgränsade QA-ID:n visar noll kvarvarande Auth-konton/sessioner, kontoutkast, privata filer, testannonser och adminrättigheter.

## Reproducera

Använd bara DevStaging-konfiguration i .env.local och kör `MNW_LIVE_CV_ALLOW_WRITES=true npm run test:live-cv-drafts`. Testet vägrar andra projekt, kräver uttryckligt skrivval och stoppar före registrering om automatisk e-postbekräftelse är avstängd. Lösenord och token skapas/hanteras i minnet och skrivs inte till protokoll eller repo. En tillfällig lokal fil innehåller bara QA-ID:n för avgränsad efterkontroll. Testet skapar inga ansökningar eller AI-anrop.

Faktiska mobiler/webbläsare, full SMTP-kedja och behörigt företags CV-visning före matchning återstår. Lokal utloggning är inte ett löfte om omedelbart upphörande av varje redan utfärdad access-token. Huvudkortens återstående acceptans bevaras; inget av dem markeras Klar genom detta backendprov.

## Inloggad slutverifiering 2026-11-18

N08, N09 och L09 slutverifierades i driftsatt dev `122eac2` och är markerade Klar. [PR #229](https://github.com/vilgotdidrikson/youth-job-mvp/pull/229)

- Det fiktiva ungdomskontot sparade kontoutkast vid 375 px och återställde exakt steg och skoluppgift i en separat inloggad Chromium-process vid 1280 px. Första sessionen återställde därefter den nya versionen från datorn. Kontoutkastet ändrade inte det färdiga CV:t. Flödet Skriv själv gick via granskning och godkännande till en sparad dev-profil med noll anrop för AI-generering.
- En ensidig uppladdad PDF öppnades från den egna profilen vid 375 px. Ett tresidigt CV exporterades och öppnades från profilen vid 1280 px. Båda filerna överensstämde byte för byte med originalet. PDF.js kontrollerade text och sidgränser, inklusive alla 36 fiktiva erfarenhetsstycken, svenska tecken, merittext, språkavsnitt och sidnummer. Alla tre sidor renderades med Poppler. Det färdiga omprovets sidor var pixelidentiska med den export som granskades visuellt. Det tidigare företagsprovet i PR #178 täcker före-match-delning och främmande åtkomst.
- Omprovet passerade 18 kontroller. Första körningen föll på att testet förväntade sig meritmarkören på sista sidan trots att språkavsnittet följer efter. Omprovet verifierar meritmarkör, språkavsnitt och samtliga stycken oberoende av vilket sidnummer de hamnar på.
- Kontona raderades via ordinarie konto-API. Skrivskyddad efterkontroll bekräftade noll kvarvarande testkonton samt noll kontoutkast och privata dokument för slutkörningen. Filåtkomst för andra användare täcks av tidigare separata DevStaging-prov. Fysisk telefon och Safari ligger fortsatt i L08.

Kör `node scripts/test-live-cv-acceptance.mjs` med `MNW_CV_ANON_KEY` för DevStaging, Playwright och Chromium. Ett separat Chromium-program kan anges med `MNW_CV_CHROMIUM`. För Chromium Headless Shell kan `MNW_CV_HEADLESS_SHELL=1` aktiveras. Testet skapar och raderar ett fiktivt konto i DevStaging.
