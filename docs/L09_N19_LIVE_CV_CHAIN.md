# L09/N19 – sammanhängande CV-kedja i DevStaging

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/l09-n19-live-cv-chain-20261103`
- Offentlig reservation före arbete från dev `0f07da3`; öppna PR:er kontrollerade.
- Sammanhängande verifiering av eget uppladdat/genererat PDF-CV, profilreferens, privat filåtkomst och delningsunderlag. Fiktiva tillfälliga QA-konton med städning; ingen AI, betalning eller produktion. Bevara behörigheter och dokumentera vad som faktiskt kan verifieras.

## Sammanhängande arbete och rättningar

### CV-referensen binds till konto och verklig fil

Ett faktiskt DevStaging-prov reproducerade att saveUploadedCvToProfile accepterade en annan testungdoms filsökväg. RLS nekade filåtkomst och delningsprojektionen filtrerade bort främmande sökvägar, så provet visar en ogiltig profilreferens, inte en bevisad dataläcka. Den felaktiga referensen och CV-flaggorna kunde dock sparas.

Sparfunktionen kräver nu ungdomsroll, giltig egen privat PDF-sökväg och verklig Storage-metadata med application/pdf och 1 byte till 5 MiB filstorlek. Tom/null, extern, främmande och query-/fragment-/procentkodad referens nekas före filfrågan. Kontot kontrolleras igen, och själva skrivningen filtrerar alltid på den ursprungliga identiteten. Befintliga andra dokument bevaras. MIME-/storlekskontroll är inte en fullständig filinnehålls-/viruskontroll. Inga databasskydd ersätts av klientkontrollen; direkt API-skrivning kan fortfarande kräva egen validering, medan befintlig RLS/delningsprojektion är åtkomstgränsen.

### Egen dokumentöppning använder samma säkra livscykel som kandidatvyn

Profilen väntade tidigare på en signerad URL innan window.open, vilket riskerar popupblockering och sena öppningar. Den återanvänder nu openCvDocument via en egen ägarbunden wrapper: fönstret reserveras synkront och opener kopplas bort; identitet kontrolleras före/efter URL-hämtning. Privat HTTPS-origin och exakt objektväg valideras innan navigering. Dubbeltryck spärras och kontobyte, stängd profilruta, flikbyte eller avmontering avbryter väntan. Tidsgräns/fel stänger det tomma fönstret och sena svar navigerar inte. Lagrat externt/ogiltigt fil-URL öppnas inte; användaren får ladda upp igen. Ingen befintlig rad eller fil raderas automatiskt.

## Verkliga prov i DevStaging

Den slutliga fulla körningen `qa-cv-chain-1793733283273-557c9975` passerade **27 livekontroller**, exit 0, tre tillfälliga QA-konton (två ungdomar och ett företag):

- Faktisk Auth, PDF-produktfunktion, privata Storage-uppladdningsfunktion och profilens riktiga sparfunktion. Bara SDK-klientens leverantör kopplas till den verkliga testanvändaren; Auth/Data/Storage är inte mockade. PDF-fontresurser laddas från samma lokala produktfiler för Node-körningen.
- Verklig PDF öppnad med PDF.js: svensk text, negation och slutmarkör bevaras, högst två sidor. Ägarens signerade och autentiserade hämtningar har exakt samma SHA-256 som originalet.
- Både annan ungdom och företag nekas ny signerad URL, autentiserad filhämtning och främmande profilrad. Anonym/publik hämtning nekas. Negativa Storage-prov kräver uttryckliga HTTP 400/403/404, inte transportfel som bara råkar ge error.
- Verklig UI-inloggning i driftsatt dev, profildialog vid 375/768/1280 px, inget horisontellt spill och rätt privat PDF öppnas via dialogknappen med identiska filbytes.
- Annat konto nekas vid sparning av främmande filreferens. Alla tre konton raderade via eget konto-API, remainingFixtureIds=[]; ingen AI eller betalning.

Första försöket saknade obligatoriskt QA-namn och nekades av databaskravet; fixturen rättades, skyddet behölls. Ett senare browserförsök misslyckades innan inloggning på grund av saknad proxykonfiguration. Efter separat nätverksdiagnostik rättades testmiljön och browserkontrollerna ovan passerade. Tidigare försök är inte fullständigt godkända körningar.

En separat visuell PDF-kontroll med PDF-skillens Poppler-rendering visar läsbar text, svenska tecken, rubriker, marginaler och sidfot utan klippning. PDF-regressionen verifierar dessutom 1/2/4-sidiga texter, långa namn/URL:er, fontintegritet och innehållsbevarande.

## Delningsprov som fortfarande återstår

Positiv företagshämtning före match, fel annons och återkallad ansökan förbereddes med två tydligt fiktiva QA-annonser och utkast till kravprofiler. Utkasten hålls oauktoriserade för AI; SQL-efterkontroll visade noll analysjobb. Företagets normala verifieringstrigger bevarade pending trots ett första privilegierat testuppdateringsförsök. Förhandsvisningssteget blev därför inte godkänt. Ett senare explicit QA-verifieringssteg avbröts utan säkert slutbesked och kördes inte om. Detta räknas inte som godkänt positivt delnings-/HTTP-prov.

Efterkontroll visar noll qa-cv-chain-konton, noll QA-annonser, noll filer för det sista delningsprovets ägare och noll medlemskap för den tilltänkta QA-granskaren. Ingen behörighet, policy, trigger, migration eller produktionskonfiguration har ändrats. Det valfria delningsprotokollet i skriptet kräver att en behörig operatör verifierar exakt den egna fiktiva fixturen; skriptet skapar inga adminmedlemskap eller verifieringar.

## Lokala kontroller och upprepning

- test:uploaded-cv-binding: 17 faktiska helper-/SDK-kontroller med kontrollerad Auth/HTTP: egen fil, relaterade dokument bevaras, fel sökvägar, roll, MIME/storlek, saknad fil, kontobyte och främmande serversvar.
- test:open-youth-document: 15 faktiska öppningskontroller med kontrollerade fönster/Auth/URL: synkron popup, blockering, konto före/efter, URL-origin/objekt, avbrott, manuellt stängt fönster och inga sena navigeringar.
- Befintliga manual-cv, profile-journey (inklusive verklig SDK-serialisering), cv-document, application-disclosure, disclosure-loading och cv-pdf passerar. Riktad ESLint, diff-check och standardproduktionsbygge med TypeScript passerar.

`MNW_CV_ANON_KEY=<publik DevStaging-nyckel> npm run test:live-cv-chain` är låst till dev och skapar/städar fiktiva konton. Lösenord/token stannar i minnet; endast QA-ID:n skrivs till temporär checkpoint. Browser: sätt MNW_CV_CHROMIUM och vid behov MNW_PLAYWRIGHT_MODULE; vanlig proxykonfiguration återanvänds. MNW_CV_BROWSER_ONLY=1 kör ägar-/browserdelen med ett enda testkonto. MNW_CV_SHARE_SEED=1 är ett separat, operatörsberoende delningsprov med tidsbegränsad QA-fixturhandshake; utebliven seed redovisas som blockerad, aldrig passerad.

L09/N19 är fortsatt Pågår tills kvarvarande autentiserade företagsdelning, samtidighet och avsedda webbläsare är verifierade. Fysisk mobil/Safari ersätts inte av Chromium-viewports. Ingen ny AI-funktion, exportflagga, gallring, databas/RLS eller produktion aktiveras. Global åtgärdsplan lämnas byteidentisk; detta protokoll och PR redovisar faktiskt arbete och kvarstående kriterier.


## Efter driftsättning av #176

Fortsatt verifiering inom samma L09/N19-reservation, branch `codex/l09-n19-postmerge-ui-proof-20261103`, från dev-merge `f001d7c6a4d84710e53afeae084065db6b4daee7`. Båda Vercel-kontrollerna passerade före och efter merge.

- `qa-cv-chain-1793734173608-dc9ab0fd`: 15 verkliga ägar-/browserkontroller mot uppdaterad dev. Privat PDF öppnas med identiska bytes vid 375/768/1280 px. Det tillfälliga kontot städades, remainingFixtureIds=[].
- `qa-cv-chain-ui-1793734354299-094882aa`: 10 verkliga kontroller via filväljaren på driftsatt dev. UI-inloggning, uppladdning på /youth/cv, sparbekräftelse, cv_uploaded=true/cv_generated=false, ägarbunden referens, identiska Storage-bytes och återöppning via profilens nya popupflöde. Mobilbredd utan dokumentöverspill. Inga AI-anrop observerades i browserprovet. Kontot städades, remainingFixtureIds=[].
- Slutlig skrivskyddad databasfråga: 0 QA-konton, 0 QA-annonser, 0 filer för filväljarprovets ägare och 0 medlemskap för den tidigare tilltänkta QA-granskaren.

Filväljarprovet finns i `scripts/test-live-cv-upload-ui.mjs`, körs med `npm run test:live-cv-upload-ui`. Kräver publik MNW_CV_ANON_KEY för fast dev-projekt, Playwright/Chromium och en fiktiv PDF via MNW_CV_PDF (standard /tmp/mnw-live-cv.pdf från kedjeprovet). Det skapar ett eget tillfälligt ungdomskonto och försöker alltid radera det i finally; kvarvarande ID ger felkod. Lösenord/token skrivs inte till fil eller logg. Detta verifierar Chromium och ersätter inte kvarstående företagsdelning eller fysisk Safari/mobilacceptans.

Uppföljningen tillför QA-skript och evidens; produktfixarna ligger redan i #176. Syntax, riktad ESLint och diff-check körs för dessa uppföljningsfiler; produktbygget ovan återanvänds eftersom ingen produktkod ändras.
