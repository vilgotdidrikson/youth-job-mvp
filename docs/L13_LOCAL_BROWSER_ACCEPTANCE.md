# L13 – lokal browseracceptans

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-local-browser-acceptance-20261102`
- Offentlig reservation före kodarbete: `3b0a86a`, från dev efter #169. Öppna PR:er kontrollerade.

## Leverans och resultat

`scripts/test-export-browser.mjs` bygger en tillfällig lokal fixture med verkliga ExportAccountControl, ModalDialog och exportklienten under React StrictMode. Bara Auth och HTTP ersätts med fiktiva svar. All trafik utanför loopback blockeras. Den riktiga browsern sparar en ZIP som jämförs byte för byte med testpaketet; Blob-URL-funktionerna är verkliga och räknas för att kontrollera städningen.

49 kontroller passerade i headless Chromium 133.0.6943.0 den 2026-11-02:

- 375, 768 och 1280 px breda vyer, 812 px höjd: native modal, ryms utan horisontell overflow, Tab når ingen kontroll utanför dialogen, Escape stänger och återför fokus.
- Verklig nedladdning med förväntat säkert filnamn och identiska ZIP-bytes; ett anrop, tömt lösenord och korrekt status.
- HTTP 403 visar fast text, döljer rått fel och tömmer lösenordet.
- Ny submit under pågående begäran dubblerar inte beställningen. Stängning, kontobyte och avmontering avbryter väntande hämtning utan fil-URL. Kontobyte efter lyckad hämtning frigör Blob-URL.
- Inga browserundantag. Skärmbilden vid 375 px granskades visuellt: läsbara texter, fält, fokusmarkering och båda knapparna ryms.

Därtill passerade 13 komponentprov, 18 klientprov, riktad ESLint och diff-check. Totalt 80 kontroller i denna leverans; de tidigare 53 serverproven ändras inte och räknas inte som omkörda här. Ingen produktkod behövde ändras. Testverktygets städning rättades också: fixturen tas bort före asynkron browserstängning och frånvaron kontrolleras uttryckligen.

## Köra igen

Kör `npm run test:export-browser` med externt tillgänglig Playwright och installerad Chromium. `MNW_PLAYWRIGHT_MODULE` kan ange Playwright-modulen; annars används runtime-moduler via `CODEX_PRIMARY_RUNTIME_NODE_MODULES` eller lokal installation. `MNW_CHROMIUM_EXECUTABLE` kan ange en separat körbar Chromium. `MNW_EXPORT_SCREENSHOT` är en valfri lokal PNG-sökväg. Saknad browser ger fel, aldrig ett överhoppat godkänt test. Tillfällig fixture tas bort efter körningen.

Denna körning använde runtime-Playwright och tillfällig `@sparticuz/chromium@133.0.0` utanför repot efter att standardnedladdningen misslyckats. Inga browserberoenden eller låsfiler lades till i produkten.

## Kvar före aktivering

Detta är lokal DOM-/nedladdningsacceptans med kontrollerad Auth/HTTP, inte autentiserad DevStaging-verifiering. CSS bygger på befintliga globala/dialogstilar, utan hela profilsidan eller produktionsbyggd Tailwind. Ingen fysisk mobil, Safari eller faktisk backendleverans testades. Komplett exportinnehåll, återhämtning/asynkron status och övervakad städning återstår också.

Exportprovet är fortsatt avstängt. Ingen flagga, databas, Storage, cron eller produktion ändras. Global åtgärdsplan lämnas byteidentisk; leveranschecklista finns här och i PR.

## Fortsättning – återhämtning och status

[L13_EXPORT_RECOVERY_STATUS.md](L13_EXPORT_RECOVERY_STATUS.md) utökar samma browserprotokoll till 63 kontroller, inklusive befintligt paket och fyra statusbesked utan ny beställning. Den tidigare körningens resultat och avgränsning ovan bevaras.
