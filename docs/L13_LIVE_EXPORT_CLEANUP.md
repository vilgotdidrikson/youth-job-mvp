# L13 – skyddad städning och fysisk filverifiering

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-live-export-cleanup-20261101`
- Offentlig reservation före kodarbete: `7ff978c`, från dev efter PR #165. Aktuell dev och öppna PR:er kontrollerade.

## Leverans

Edge-funktionen personal-data-export-cleanup är driftsatt i DevStaging. Den återanvänder den riktiga städningsarbetaren från #165. Endast POST med en separat 256-bitars Vault-hemlighet tillåts. Vanliga användartoken, query-parametrar och metoder utan stöd startar inget privilegierat arbete. Anropets innehåll används inte som objektsökväg. Fel är fasta tomma svar; lyckat svar innehåller bara antal, inga konto-ID, låstoken eller objektvägar. Alla svar har cacheförbud.

Gateway-JWT-kontrollen är avstängd eftersom handlern gör egen oberoende autentisering; detta är inte ett publikt oautentiserat städnings-API. Den serverägda klienten har en 50-sekunders avbrytbar/no-store-transport. SDK-versionen är låst och Deno-importkartan låter samma städningskod användas av Next/Node-tester och Edge-runtime.

Migration 20261101151803_l13_export_cleanup_dispatch är införd i DevStaging. Den skapar en oberoende hemlighet i Vault utan att lämna ut värdet. En service-only invoker-RPC anropar en privat definer som bara svarar boolean; inga Vault-läsrättigheter ges till klientroller. Den interna dispatchern accepterar ingen URL eller token från anroparen. Projektets endpoint konfigureras separat i Vault, så en ny miljö inte ärver en hårdkodad DevStaging-destination. Inga hemliga värden visas i verktygsresultat, rapporter eller commits.

Cron-jobbet mnw-personal-data-export-cleanup är förberett för var femte minut men skapas atomärt avstängt. Det är fortfarande avstängt efter verifieringen. Manuell dispatch genom den faktiska cron-kopplingen har testats; ingen återkommande schemakörning påstås. Tabeller, kolumner, ägarrelationer och buckets är oförändrade, så ingen ny katalogklassificering behövs.

## Faktisk Storage-/HTTP-verifiering 2026-11-01

En tillfällig, separat test-entrypoint användes för exakt en statisk 170-bytes ZIP med QA.txt och helt fiktiv svensk text. Den var begränsad till DevStaging och skyddad av samma oberoende workerautentisering. Inga användar-/Auth-konton skapades. Filens slumpade test-ID och sökväg kom från serverägd testkod, aldrig HTTP-input.

1. Verklig Storage-uppladdning som privat application/zip, cacheControl=0 och upsert=false lyckades.
2. Ny verklig servicehämtning gav samma längd och SHA-256. Publik och anonym hämtning nekades, båda med HTTP 400.
3. En städningsjobbrad skapades för filens fiktiva konto-ID utan användarkonto. Den riktiga arbetaren anropades via den interna dispatchern och svarade HTTP 200: claimed=1, deleted=1, retry=0. Storage.remove kördes före jobbkvitto.
4. En separat färsk servicehämtning efter städningen bekräftade att filen inte gick att hämta. Kontroll av verklig Storage-metadata och jobbrader gav noll exportobjekt och noll exportjobb.
5. Funktionen ersattes därefter med slutversion 2, vars bundle inte innehåller test-entrypointen. En ny verklig dispatch gav HTTP 200 och noll objekt att städa.
6. Faktiska externa HTTP-prov mot slutversionen: POST utan credential 401, POST med fiktiv användar-JWT 401, GET 405 och GET på den tidigare testvägen 405. Samtliga hade no-store. Testfunktionen finns bara som reproducerbar fixture i scripts/fixtures och är inte driftsatt.

Detta verifierar verklig filöverföring och borttagning genom Storage API. Det är inte ett autentiserat användarflöde eller bevis om underliggande backup-/leverantörsgallring. Exporten och dess användargränssnitt är fortfarande avstängda.

## Övrig verifiering

- test:export-cleanup-handler: 16 lokala prov med verklig handler/worker och simulerad klient. Fel metod/token/query, strikt boolean-validering, driftfel, utebliven rå feltext, ignorerad caller-sökväg och enbart aggregerade svar kontrolleras.
- scripts/test-export-cleanup-dispatch.sql passerar både med DDL i rollback före införande och mot införda funktioner. Verkliga databasroller/ACL, förfalskad rollclaim, ogiltiga credentials och avstängd cron kontrolleras. Ingen HTTP dispatch sker i detta rollbackprov och inga nyckelvärden returneras.
- Regressioner: lagring/städning 33, exportens HTTP-prov 44 och inventering 26 passerar. Riktad ESLint, TypeScript och diff-check passerar. Vercel-byggstatus kontrolleras före merge.
- Säkerhetsadvisories är oförändrade jämfört med före migrationen (observationstid undantagen).

## Återstår

Koppla lagringen till det kontobundna beställnings-/nedladdningsflödet och tydliga användarstatuser. Verifiera det fulla flödet och samtidighet över separata anslutningar samt konfigurera driftövervakning innan återkommande körning aktiveras. Fullständigt exportinnehåll, verksamhetsinformation och övriga L13-kriterier återstår. Ingen AI eller produktion har berörts. Global åtgärdsplan lämnas byteidentisk; leveranschecklista finns här och i PR.
