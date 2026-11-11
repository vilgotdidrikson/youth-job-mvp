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
