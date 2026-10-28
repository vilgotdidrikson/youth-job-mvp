# L13 – exportpaketets formattering

[PR #147](https://github.com/vilgotdidrikson/youth-job-mvp/pull/147), `codex/l13-export-package-20261028`, Vilgot / Codex. Reserverad före kodarbete från aktuell dev. **Paketbyggare, ingen aktiverad kontoexport.** Hela L13 förblir Pågår. Ingen överlappning med #146:s UI-/laddningsarbete.

`lib/personal-data-export.ts` bygger en faktisk ZIP av uttryckligen förberedda uppgifter. Den läser inte tabeller, hämtar inte filer/URL:er och anropar inte AI eller externa tjänster. Ingen befintlig sida/API importerar den ännu. `fflate@0.8.3`, som redan fanns transitivt, är nu ett direkt versionslåst beroende.

## Kontrakt och innehåll

Anrop: `buildPersonalDataExport(verifiedSubjectId, preparedSnapshot, fetchedFiles)`. Första argumentet måste komma från framtida serververifierad identitet/ny autentisering, aldrig från klientens begäran. Paketets konto, varje kategori, varje post och varje fil måste stämma med denna identitet. Det är en konsistenskontroll, **inte** en självständig Auth-/RLS-kontroll eller bevis på att kollektorn har läst rätt uppgifter.

Alla 24 nu inventerade grupper (21 kataloggrupper och tre externa/lokala grupper) måste redovisas exakt en gång: `included`, `requires_review`, `unavailable` eller `not_applicable`. Ingen kategori får tyst utelämnas. Inkluderade poster får en läsbar sammanfattning; icke inkluderade kategorier får inte smuggla med payload. En framtida insamlare måste skilja tomt resultat från misslyckad läsning, slutföra paginering och individuellt bedöma delade uppgifter. Formatteraren kan inte upptäcka poster/filer som insamlaren felaktigt har utelämnat.

Paketet innehåller:

- `LAS-MIG.html`: responsiv offline-sammanställning på svenska med kategoristatus, länkar till inkluderade uppgifter/filer och upplysningar om behandlingen. Rosa designriktning, lokal systemfont och skapandetid i Stockholm. Inga externa resurser eller scripts.
- `oversikt.json`: version, export-/konto-ID, exakt UTC-tid, kategori-/filstatus, antal, behandlingsinformation och interna arkivreferenser.
- `uppgifter/<kategori>.json`: de uttryckligen inkluderade projektionerna. Originaltext, svenska tecken, emoji, negationer och egna känsliga uppgifter bevaras. Matchningens minimeringsfilter återanvänds inte för egen tillgång.
- `filer/dokument`, `filer/bilder`, `filer/video`: tillhandahållna filbytes utan innehållsomskrivning. Misslyckade/individuellt granskade filer redovisas utan falska filbytes eller fungerande länk.

`coverage` är `needs_completion` när någon kategori/fil saknas eller kräver granskning. Annars betyder `provided_sources_included` endast att angivna delar ingår/markerats ej tillämpliga. Ingen `complete: true` eller garanti om fullständigt registerutdrag genereras. Ansvarig/kontakt, ändamål, mottagare, lagring, källor, rättigheter och automatiserad behandling måste tillhandahållas uttryckligen; rättsliga formuleringar eller verksamhetsbeslut uppfinns inte här.

## Validering och begränsningar

- Plain JSON snapshottas utan getters, prototypdata eller `toJSON`; cykler, icke JSON-typer, ogiltiga Unicode-strängar, icke ändliga/osäkra heltal och oväntade metadatafält avvisas. Strukturella lösenords-/token-/hemlighetsfält avvisas även med vissa Unicode-varianter. Inga råa indata återges i feltext/logg.
- Detta upptäcker **inte** hemligheter eller tredje personers uppgifter inuti godtycklig fritext, neutralt namngivna fält eller filbytes. Bekräftad källa, projektion, maskering och rättighetsbedömning krävs före paketering. Deklarerat `subjectId`/`ownerId` är inte ett ägarskapsbevis. Ingen generell rå tabell-/Auth-dump får skickas till funktionen.
- Filvägar skapas internt, med unikt löpnummer även vid identiska namn. Inga absoluta/parent-/Windows-/dolda/bidi-vägar eller olämpliga enhetsnamn; namn måste vara NFC, högst 150 UTF-16-enheter/240 UTF-8-byte. Endast kända buckets och tillåtna dokument-/bild-/videotyper med motsvarande suffix. MIME-/namnkontroll är inte filinnehållsvalidering eller virusskanning.
- Högst 100 filposter, 32 MiB per inkluderad fil, 8 MiB JSON, 64 MiB totalt inklusive slutarkiv, 50 000 JSON-noder och 24 nivåer. Överskridande avbryter; ingenting kapas tyst. Större material behöver senare strömning/uppdelning eller annan hantering före aktivering.
- HTML-texter escapenas; fil-/JSON-länkar genereras av säkra arkivreferenser. Inbyggd CSP blockerar scripts, externa resurser, base och formulär. Paketet innehåller en vanlig **okrypterad** ZIP; den framtida lösningen måste hantera den privat. Formatteraren implementerar ingen lagring, kryptering, signerad länk, tidsfrist eller fysisk radering.

## Faktisk verifiering

`test:personal-data-export` passerar 76 lokala kontroller; med den separata Chromium-körningen passerar **79**. Riktiga ZIP:er läses med fflate och oberoende Python `zipfile` (CRC, UTF-8, sökvägar, extraktion och slutmarkör). Tester verifierar oförändrad egen text/filbytes, stabil kategoriordning, hela fel kontots paket samt främmande kategorier/poster/filer, saknade källor/filer, strikt metadata, getter-/proxy-/toJSON-fällor, hemlighetsnycklar, Unicode-/arkivvägar och explicita storleksfel även för färdig ZIP.

Chromium öppnar verkligt extraherad HTML med JavaScript påslaget vid 375/1280 px: inget horisontellt spill, ingen injicerad script-/img-/iframe-nod eller exekvering och noll externa nätverksanrop. Mobil-/desktoprenderingar har granskats visuellt; mobilens kategoriöversikt staplas för läsbarhet. Datumets JSON-värde behålls i UTC. Browserproven använder enbart lokala fiktiva uppgifter.

Inventeringens 21 kontroller, serverfelens 42 kontroller, riktad ESLint, TypeScript, diff-check och standardproduktionsbygge med 57 routes passerar med fiktiva publika byggvärden. Befintlig metadataBase-varning kvarstår. Inga verkliga konton, dokument, databasanrop eller leverantörsanrop har använts. Tillfälliga testarkiv städas; inga testkonton/filer skapades i DevStaging.

Upprepa: `npm run test:personal-data-export`. För browserdelen tillkommer `MNW_EXPORT_PLAYWRIGHT_MODULE` och vid separat Sparticuz-installation `MNW_EXPORT_CHROMIUM_MODULE`. Valfria QA-skärmbilder styrs av `MNW_EXPORT_SCREENSHOT_DIR`. Inga credentials behövs.

## Kvar inom L13

Faktisk datainsamling med rättighets-/tredjepartsbedömning, bevarad historik och tydlig källtäckning; ny autentisering och behörighetskontroll vid beställning/hämtning; privat temporärt paket, exakt beslutad frist, fysisk gallring och felåterhämtning; samtidiga ändringar/kontoradering, UI och negativa liveflöden. Kontakt-/ansvars-/leverantörsfrågorna i L13/L14 kvarstår. Automatisk export aktiveras inte av denna leverans och produktion ändras inte.
