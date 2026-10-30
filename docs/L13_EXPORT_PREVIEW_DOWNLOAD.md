# L13 – avstängt dev-prov av exportnedladdning

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-export-preview-download-20261030`
- Offentlig reservation före kodarbete: `98d5f8b`, från aktuell dev efter PR #163. Öppna PR:er kontrollerade.

## Leverans och avgränsning

`POST /api/account/export-preview` kopplar de befintliga riktiga serverdelarna till en binär HTTP-nedladdning: aktiv kontoägd session → begränsning av försök → ny lösenordsverifiering med isolerad sessionsstädning → insamling → automatisk skalärpolicy → nytt sessionsprov efter paketering → ZIP-svar. Ingen klientskickad datakälla, projektion, granskningsapproval eller exportmetadata accepteras.

Detta är ett uttryckligen ofullständigt transportprov, ingen aktiverad användarfunktion eller färdigt registerutdrag. Paketnamn, HTTP-rubrik och paketets sammanställning visar ofullständig täckning. Alla 24 kategorier förblir väntande. Endast den tidigare fasta policyn för åtta strukturerade konto-/aktivitetskällor används. Fritext, meddelanden, snapshots och originalfiler följer inte med. Ingen valfri privat läsarklient används.

`includeCvFiles: false` i serverinsamlingen hoppar över filhämtning som inte används i detta prov, och anger `cvScope: not_requested_for_policy`. Standardbeteendet för den tidigare granskningsinsamlingen är oförändrat. Ungdomens skippade filer påstås inte saknas eller vara undantagna på grund av kontoroll.

## Avstängd konfiguration

Routen svarar 404 om `MATCHNWORK_EXPORT_PREVIEW_ENABLED` inte är exakt `true`, eller om Supabase-URL inte är exakt DevStagings `https://vwcfjvwfeatvuisojwrh.supabase.co` (slutande snedstreck tolereras). Ingen flagga eller Vercel-inställning ändras i denna leverans. Andra databasprojekt är spärrade även om flaggan råkar vara satt. Ingen sida/knapp anropar routen.

En framtida kontrollerad dev-aktivering kräver också befintliga publika/service-nycklar på servern och `MATCHNWORK_EXPORT_INFORMATION`: ett JSON-objekt med exakt controller, contact, purposes, recipients, retention, sources, rights och automatedProcessing. De sex senare är icke-tomma stränglistor. Informationen måste fastställas och granskas av verksamheten; kodleveransen hittar inte på ansvarig, bevakad kontakt eller rättighetsinformation. Saknad/fel konfiguration ger 503 före Auth eller insamling. Inga exempelnycklar/credentials sparas i dokumentet.

## HTTP- och åtkomstgränser

- Authorization kräver Bearer-token; token, lösenord eller export-ID accepteras inte i URL. JSON-body får bara innehålla expectedUserId och password.
- Body läses med faktisk gräns på 8192 bytes, även utan Content-Length. Fel UTF-8, format, extra fält eller för långt lösenord stoppas före Auth. Även en hängande body kan avbrytas.
- Cross-site-webbläsaranrop/avvikande Origin nekas. Inga CORS-rättigheter eller cookie-baserad autentisering införs.
- Befintlig atomär consume_api_quota används med användarens token, fast endpointnamn och högst tre försök per timme, innan lösenordsprov/insamling. Kvotfel nekar vidare arbete. Ingen ny kvotfunktion eller databasbehörighet införs.
- Alla svar har private/no-store, no-cache, nosniff, same-origin-resurspolicy och no-referrer. Framgång är attachment med servergenererat filnamn och korrekt binärlängd; fel innehåller bara fast JSON-text. Inga råa fel eller requestuppgifter loggas.
- Gemensam 120-sekunders väntbudget och requestens avbrytningssignal gäller hela provet. Slutlig session kontrolleras efter paketering, inte enbart efter insamling. Förlorad session eller ändrad sessionsbindning ger inga ZIP-bytes.

## Faktiskt verifierat

- `test:export-preview-download`: 44 lokala kontroller. Avstängning/fel projekt/fel konfiguration, requestgränser, URL-token, storlek/UTF-8, avbrott, kvot, lösenord, slutlig återkallelse, säkerhetsrubriker och faktiskt ZIP-innehåll. Ett lokalt HTTP-serverprov verifierar riktig nätverksinramning och läsbart ZIP-svar.
- Fyra av dessa prov kör verklig route, installerad Supabase-SDK, verkliga serverhjälpare och paketbyggare tillsammans. ES256-token signeras lokalt och signaturen verifieras av SDK:n. Fjärr-Auth/Data-API/RPC är simulerade. Framgång, indragen session efter paketering, fel lösenord och främmande källrad kontrolleras. Temporär lösenordssession städas före källäsning och rätt originaltoken används för ordinarie Data API.
- `test:personal-data-review`: 20 kontroller, inklusive nytt separat test för utebliven onödig filhämtning.
- Regressioner: sessionskontroll 37, strukturerat paket 41, granskningspaket 39 och paketbyggare 76. Totalt 257 lokala kontroller.
- TypeScript, riktad ESLint och diff-check passerar; Vercel-byggstatus kontrolleras före merge.

## Återstår

Ingen live-inloggning, livekvot eller autentiserad fjärrnedladdning påstås. Ingen faktisk persondataexport har lämnats ut eller feature flag aktiverats. Hosted timeout för stora insamlingar är inte verifierad; detta ersätter inte planerade asynkrona jobb.

ZIP finns bara i arbetsminne för det aktuella HTTP-provet; inga serverfiler eller Storage-objekt skapas, inga signerade URL:er finns och ingen beställnings-/statushistorik lagras. Den planerade privata, tillfälliga paketlagringen med beslutad exakt tidsfrist, fysisk gallring, statuser, idempotens och kontoraderingskoppling återstår. Nedladdad lokal kopia styrs av mottagaren. Slutkontrollen är inte en atomär spärr för utloggning som sker efter att HTTP-svaret börjat skickas.

Fullständigt innehåll/rättighetsbedömning, verksamhetsinformation, användargränssnitt, lagring/gallring och fullständigt dev-acceptanstest krävs före den planerade användarfunktionen. Ingen ny databas/Storage, AI eller produktion. Leveranschecklistan finns här och i PR; global åtgärdsplan är byteidentisk.
