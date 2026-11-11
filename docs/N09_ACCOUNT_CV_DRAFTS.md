# N09 – privata CV-utkast på kontot

- Ansvarig: Vilgot / Codex
- Branch: `codex/n09-account-cv-drafts-20261110`, reserverad före kodarbete från dev.
- Status: För granskning. [PR #197](https://github.com/vilgotdidrikson/youth-job-mvp/pull/197) samlar kod och inventerings-/exportintegration. Databasdelen är införd i dev. Inloggat prov mellan verkliga enheter återstår; punkten är inte Klar.
- Publicering: Användaren godkände 2026-11-11 offentlig publicering av detta dokument, datainventeringen och de två nya schematilläggen. Godkännandet gäller dessa fyra filer; tidigare opublicerade ändringar i den större arbetsplanen hanteras separat.

## Beteende

CV-guiden kan uttryckligen spara ett privat arbetsutkast på kontot och öppna det på en annan enhet. Metod, formulärsvar, plats i guiden och befintlig genererad förhandsvisning bevaras. Öppning ersätter det lokala arbetsutkastet efter en synlig förklaring och återställer godkännandet; inget nytt AI-anrop, profilsparande eller ansökningsutskick görs av öppningen. Lokala utkast laddas inte upp automatiskt.

Sparstatus visar tid och om den aktuella lokala versionen avviker. Endast en sparning i taget kan startas. Versionskonflikt eller okänt sparresultat kräver en ny läsning innan nästa uttryckliga skrivning. Den läsningen skriver inte igen. Sparsvaret måste innehålla rätt konto, ny revision och exakt inskickat innehåll.

Radering tömmer kontots arbetsutkast och behåller en revisionsmarkör så att gamla enheter inte kan återskapa det med en föråldrad version. Färdigt CV, tidigare ansökningsunderlag och lokalt arbete påverkas inte. Kontoutkastet töms inte automatiskt när ett CV görs klart, eftersom en annan enhet kan ha nyare arbete.

## Lagring och åtkomst

DevStaging-migration `20261110164329_account_cv_drafts.sql` är införd. En rad per ungdomskonto, högst 120 000 byte validerat arbetsmaterial; versions-UUID och uppdateringstid. RLS ger egen läsning för ungdomsidentitet och blockerar andra konton, företag och anonym identitet. Direkta klientskrivningar saknar behörighet. En privat ägarkontrollerad funktion bakom en invoker-RPC serialiserar skrivningar på ungdomsprofilen och jämför den förväntade revisionen. Kontoradering tar bort raden via FK-kaskad.

Detta arbetsmaterial kopplas inte till matchning eller företagsdelning. Granskningsgodkännande, filer, tokens och andra godtyckliga toppfält ingår inte i formatet. Klienten validerar även strukturerat CV i detalj; servern validerar det begränsade JSON-trädet och accepterar aldrig granskningsgodkännande. Ett eget lagrat format som klienten inte kan tolka kan ersättas eller tömmas utan att det öppnas.

## Inventering och kontoexport

Färsk metadata före ändringen visade två nya plattformstabeller för Storage-livscykel. De granskades separat som driftmetadata; inga rader eller objektnamn lästes. Färsk metadata efter ändringen omfattar 89 relationer och fyra buckets. Ursprunglig granskad katalog är oförändrad; nya metadata läggs till genom additions-only-filer.

Kontoutkastet ingår i insamlingen av eget underlag för granskning. Automatisk strukturerad export tar enbart user_id, revision och updated_at. Utkastets fritext kvarstår för individuell granskning och paketet anges fortsatt som ofullständigt. Storage-livscykelns driftfält samlas inte in automatiskt. Ingen generell exportaktivering eller ny gallringsfrist införs här; bredare gallrings- och exportarbete kvarstår i ordinarie plan.

## Kontroller

- Faktisk DevStaging-SQL med tre helt fiktiva konton i en återställd transaktion: egen läsning/skrivning, annan ungdom, företag, anonym identitet och anon-roll; nekade direkta skrivningar; storleks-/format-/godkännandekontroller; gamla skapa/uppdatera/tömma-versioner, revisionsmarkör och oförändrat färdigt CV. FK-kaskad kontrollerad som metadata. Noll testkonton kvar efteråt. Inga mejl skickade eller riktiga konton ändrade.
- Lokal PostgreSQL via PGlite 0.5.16: samma migration/test samt faktisk raderingskaskad på fiktivt konto. Auth/profilbootstrap simulerad. Ingen samtidig testtransaktion påstås; gamla versioner prövas sekventiellt och låsningen granskas i SQL.
- `test:account-cv-drafts`: strikt format, fullständig förhandsvisning, datagränser, installerad Supabase-SDK över simulerad transport, kontobundna anrop, konflikter, felaktigt/uteblivet svar, avbrott och kontobyte; faktiska panelcallbacks med simulerade hooks/DOM/tjänster för uttryckliga val, låsning, läsförnyelse och avmontering.
- `test:cv-save-recovery`: befintligt CV-/PDF-flöde samt öppning av kontoutkast till exakt förhandsvisning/formsteg, återkallat godkännande och inga nya AI-/profil-/ansökningsanrop.
- Inventerings-, insamlings- och strukturerad exportkontroll, inklusive ägarskydd och utesluten utkastfritext. Riktad lint, TypeScript och produktionsbygge.
- Supabase säkerhetsrådgivare visar inga nya fynd jämfört med före migrationen. Tidigare fynd hanteras separat; denna leverans friskförklarar inte projektet.

Reproducera det återställda SQL-provet med `scripts/test-account-cv-drafts.sql` enbart i dev efter migration. Valfritt lokalt prov: installera `@electric-sql/pglite@0.5.16` i en tillfällig katalog och kör `N09_PGLITE_MODULE=/absolut/sökväg/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-account-cv-drafts-postgres.mjs`. Ingen ny app- eller byggdependency tillkommer.

## Återstår

Faktiskt inloggat prov mobil → dator → mobil, tangentbords-/visuell kontroll och session som löper ut i webbläsaren. Simulerade UI-/SDK-prov ersätter inte det. Punkten markeras inte Klar före den verifieringen. Dev-publicering och PR redovisas i leveransen; produktion lämnas orörd.
