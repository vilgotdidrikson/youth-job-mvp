# L13 – rättelse av delat ansökningsunderlag

Vilgot / Codex, `codex/l13-application-corrections-20261112`. Reservation publicerad som `e2a3f05` före kodarbete från dev `dbf8013`. Avgränsad delleverans; L13 förblir Pågår. Draft [PR #213](https://github.com/vilgotdidrikson/youth-job-mvp/pull/213), kodcommit `dc0aa64`.

## Problem och beteende

Befintlig omdelning skapar en ny delningsrevision men ingen notis till mottagaren. Det reproduceras med den befintliga sparfunktionen i det lokala SQL-provet. Rättelse av eget profil-/CV-underlag ska också underrätta det berörda företaget utan att kopiera innehållet till notisen.

Efter egen profil-/CV-redigering väljer ungdomen **Se och uppdatera delat underlag**, uppdaterar från profilen, granskar urvalet och delar uttryckligen. För en skickad ansökan används nu en separat rättelse-RPC. Den återanvänder befintlig delningsfunktion, källtoken och analyskö och sparar en neutral företagsnotis i samma transaktion. Ett notisfel rullar även tillbaka delningen och köningen. Ingen automatisk omdelning av profiländringar införs.

Förhandsvisningen binder valet till en befintlig delningsrevision. En annan revision ger PT409 om önskat underlag inte redan finns sparat. Ett återförsök med redan sparad källtoken och samma urval returnerar aktuell delning utan en ny revision, analysköning eller notis. Det återställer aldrig en äldre revision. Roll-, ansöknings-, intresse-, blockerings- och versionskontroller gäller även återförsök.

En tidigare AI-bedömning behåller sin gamla delningsrevision och kan inte läsas som aktuell av företaget via befintlig RLS efter omdelningen. Ett nytt modellresultat garanteras inte: ansökan förblir skickad vid AI-fel. Redan visat eller hämtat material kan inte fjärraderas genom rättelsen. Andra ansökningar, profilens övriga innehåll och anställnings-/avtalsbevis skrivs inte om.

Notisen innehåller bara neutral text och en länk till rätt annons, utan kandidatnamn, CV, profiltext eller rättelsebeskrivning. Företagets vanliga behörighetskontroll gäller när länken öppnas. Inget mejl eller meddelande till annan person skickas av agenten.

## Migration och inventering

`supabase/migrations/20261112180000_l13_application_corrections.sql` skapar två privata SECURITY DEFINER-funktioner med låst search_path och två publika SECURITY INVOKER-omslag. Endast authenticated får anropa dem; identitet/ägarskap kontrolleras i databasen. Inga befintliga funktioner, tabeller, kolumner, ägarrelationer, RLS-regler, grants eller buckets ändras. Befintliga funktionsdefinitioner och exekveringsgrants jämförs före/efter i SQL-testet. Notiser använder befintlig notifications-källa; inget nytt exportregister krävs.

**Inte införd i DevStaging. Vilgot inför migrationen före merge till dev.** Ingen `.env.local` används. Bygget använder fiktiva publika värden och en tillfällig preloader som stänger av Nexts inläsning av env-filer.

`test:personal-data-inventory` passerar med 26 syntetiska kontroller. `check:personal-data-inventory` kördes utan ny metadatafil och stoppade korrekt med krav på `--catalog`; det är inte godkänd liveinventering. Följ `docs/L13_EXPORT_INVENTORY.md`: fånga ny metadata med `scripts/capture-personal-data-catalog.sql` i DevStaging och kör `npm run check:personal-data-inventory -- --catalog <metadatafil>`. Inga nya schemabilder eller registerposter accepteras på grundval av gamla lokala metadata.

## Lokal verifiering

- `test:application-corrections:postgres`: 35 kontroller i PGlite 0.5.16 utanför repot. Faktiska nya RPC:er, befintlig save/preview och befintlig bedömnings-RLS från migrationerna; fiktiva Auth-identiteter, källbyggare, blockerings-/verifieringsstatus och analyskö. Baslinje utan notis, korrekt revision, annan ansökan, fel konto/roll, uttrycklig kontobindning vid kontobyte, null/future/stale revision, gammal källtoken, blockering, återkallelse, oskickad ansökan, intresseåterkallelse, återförsök utan dubbletter och rollback vid notisfel. RLS-proven visar att gammal bedömning försvinner från företagets SELECT och endast rätt ny revision kan läsas.
- `test:disclosure-loading`: faktiska komponentcallbacks och installerad SDK med simulerad transport; rättelse-RPC/grundrevision, dubbelklick, fel kvittens och konflikt utan navigering, ursprunglig ansökningsväg, kontobyte/avmontering och gamla svar. Delade rena kontrakt ligger i `lib/application-correction.ts` för framtida mobilklient.
- `test:application-disclosure`, `test:assessment-snapshot` (20 handlerfall), `test:application-withdrawal`, `test:application-overview` och inventeringsregressionen passerar. Riktad ESLint för produktfilerna och nya SQL-testet passerar. Den befintliga `no-this-alias`-anmärkningen i komponenttestets hook-fixture kvarstår; ingen lintregel har stängts av.
- Webpack-produktionsbygge och TypeScript passerar med env-filinläsning avstängd. Befintliga varningar om GeoNames JSON-importer och metadataBase kvarstår. Första fristående typechecken mötte gamla genererade `.next`-typer från N21-branchen; bygget återskapade typerna. Ett ombygge stoppades av EPERM på en genererad `.next`-fil; samma kommando utanför sandboxen passerade. Den tillfälliga env-preloadern togs bort efter kontrollerna och ingår inte i leveransen.

Kör SQL-testet med `MNW_CASE_PGLITE_MODULE` satt till en extern PGlite-installations `dist/index.js`. Inga verkliga QA-konton eller filer skapades av dessa tester.

## Före merge och återstående L13

1. Vilgot inför migrationen i DevStaging. Kontrollera nya funktioner och metadata enligt ovan. Merge får inte ske innan migrationen är införd.
2. Verifiera i driftsatt dev inom L17 med fiktiva konton: två ansökningar, ändrat CV/urval, uttrycklig rättelse, en neutral notis till rätt företag, rätt underlag och spärrat gammalt bedömningsresultat. Kontrollera förlorad kvittens, versionskonflikt och återkallad ansökan. Verklig modellkörning kräver Vilgots verifierade QA-företag. Städa testdata efteråt.
3. Verklig flertransaktionssamtidighet, inloggad webb-/mobilacceptans och fysisk Safari/telefon är inte verifierade. L08:s kriterier kvarstår.
4. Detta bygger inte hela rättelsehanteringen: koppling av ett ärende om felaktig AI-bedömning till rätt ansökan, handläggarbeslut och mottagaruppföljning samt rättelse av historiska uppgifter kräver fortsatt L13/L16. Den befintliga ärendeingången finns kvar. Ingen individuell AI-bedömningsvy införs för ungdomen.

Hela L13 får inte markeras Klar genom denna delleverans. PR #212 lämnas till Vilgot och N21-kortet kontrolleras först efter dess merge. N23/L12, N20:s omfattningsavstämning och övriga kort påbörjas inte här.
