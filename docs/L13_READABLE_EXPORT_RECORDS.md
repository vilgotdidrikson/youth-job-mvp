# L13 – läsbara uppgifter i exportpaketet

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-readable-export-records-20261102`
- Offentlig reservation före kodarbete från dev `2ee1502`; aktuell dev och öppna PR:er kontrollerade. Reservationen är branchens första tillägg.

## Problem och slutligt beteende

Offlinefilen LAS-MIG.html visade kategoristatus och generell sammanfattning, men de enskilda posterna gick i huvudsak bara att läsa i separata JSON-filer. Nu visas alla redan validerade poster direkt i samma HTML, som responsiva listor med rubriker, svenska fältnamn och fasta statusöversättningar för de 19 strukturerade källorna.

Till exempel visas application_completions.status=withdrawn som Ansökningsstatus / Status: Återkallad, och application_followups.status=pending som Obesvarad. Kravprofilens version skiljs från företagsprofilens version. Ja/Nej och Inget angivet värde skiljer booleska värden från null utan att hävda att uppgiften aldrig funnits. ID:n och versionsnummer bevaras. Kända datumfält visar explicit Stockholmstid, med originalets tidsstämpel i time-elementets datetime-attribut; JSON behåller originalets tidszon och mikrosekunder.

Okända statusar, fält och källor döljs inte och får inga påhittade statusförklaringar. Granskad generell text och nästlade uppgifter visas escapade, även när de saknar en känd presentation. Ingen post/text kapas. Länkarna till strukturerad JSON finns kvar och JSON-kontrakt, kategori-/filstatus och coverage ändras inte.

`lib/personal-data-export-display.ts` är en ren formatterare som anropas efter befintlig plain-data-, scope- och innehållsvalidering. Den är ingen insamlare, filtrerare, auktorisering eller rättighetsgranskare. Nya nätverksresurser, JavaScript och datalänkar tillförs inte i HTML. Befintlig CSP, escaping och paketets storleksgränser bevaras. Alla utökade poster var redan med i respektive JSON; inget nytt material lämnas ut genom denna ändring.

## Faktiskt verifierat 2026-11-02

- test:readable-export: **113** kontroller, varav **37** med riktig headless Chromium 133.0.6943.0. Verkliga ZIP-paket för ungdom, företag och privat uppdragsgivare läses och extraherad HTML öppnas. Alla 19 källors kända fält har svenska etiketter; utdata-JSON jämförs med ursprungliga tillåtna fält/värden. Separat generisk granskad testtext verifierar oförändrad svenska/emoji/negation/slutmarkör, okända värden, nästlad JSON och HTML-känsligt innehåll.
- Browserprov vid **375, 768 och 1280 px** för de tre rollerna och generisk testtext: poster renderas, inget horisontellt spill och inga script-/img-/iframe-element eller exekverad injektion. Noll externa nätverksanrop och browserundantag. Mobilskärmbilden för företagsuppgifter granskades visuellt: fältnamn, ID-brytning, status och datum ryms och är läsbara.
- test:personal-data-export **76**, test:structured-personal-data-export **178**, test:reviewed-personal-data-export **39** och test:export-preview-download **57** regressioner passerar. Paketprovet inkluderar oberoende Python ZIP-/CRC-/UTF-8-extraktion.
- Totalt **463** kontroller. Riktad ESLint, diff-check samt standardproduktionsbygge med TypeScript passerar.

Kör `npm run test:readable-export`. Browserdelen kräver dessutom MNW_READABLE_CHROMIUM med en körbar Chromium och externt tillgänglig Playwright (MNW_PLAYWRIGHT_MODULE eller runtime-moduler). MNW_READABLE_SCREENSHOT är en valfri lokal PNG-sökväg. Testutskriften anger uttryckligen om browserdelen kördes. Denna körning använde separat temporär, versionslåst Chromium; inga produktberoenden/låsfiler ändras.

## Begränsning och införande

Proven använder fiktiva lokala paket och simulerad fjärrtransport i HTTP-regressionen, inte verkliga konton eller backendfiler. Ingen fysisk mobil/Safari eller nytt autentiserat staginghelflöde påstås. Fullständigt exportinnehåll, rättighets-/leverantörsbedömning, samtidighet och övervakad gallring återstår före aktivering. Hela L13 är fortsatt Pågår och paketen förblir ofullständiga.

Ingen insamlingspolicy, databas, RLS, flagga, cron, bucket, produktion eller extern AI ändras. Global åtgärdsplan lämnas byteidentisk; scoped checklista och faktisk verifiering finns här och i PR.
