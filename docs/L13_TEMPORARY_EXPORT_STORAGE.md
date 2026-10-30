# L13 – privat tillfällig paketlagring

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-temporary-export-storage-20261030`
- Offentlig reservation före kodarbete: `4faae76`, från aktuell dev efter PR #164. Öppna PR:er kontrollerade.

## Beteende

Migration `20261030130043_l13_temporary_export_storage.sql` är införd i DevStaging. Paketets giltighet är exakt en timme från reservation, även om insamling/uppladdning tar tid. Databasen genererar subject_id/export_id.zip. En partiell unik indexregel och ett kontoskopat transaktionslås tillåter högst ett aktivt building/ready-paket per konto. Upprepad reservation av samma byggande ID är idempotent; annat aktivt paket ger busy. Utgångna paket blockerar inte nytt försök.

Bucket personal-data-exports är privat, bara ZIP och högst 64 MiB. En restriktiv Storage-policy nekar anon/authenticated direkt åtkomst även om andra permissiva policyer tillkommer. Tabellen private.personal_data_exports har RLS och inga klientgrants. Sex fasta SECURITY INVOKER-RPC:er med tom search_path är endast körbara av service_role och kontrollerar verklig databasroll. Inga nya definerfunktioner eller klienträttigheter införs.

Servermodulen reserverar en kontoägd jobbrad, laddar upp utan upsert, registrerar storlek/SHA-256 och läser bara ett aktuellt ready-paket. Faktiska filbytes kontrolleras mot storlek och hash. Jobbmetadata läses igen efter nedladdning, så utgång, återkallelse eller ändring innebär att bytes kastas. Ingen publik/signerad URL skapas. Klientfabriken har cacheförbud och en gemensam 120-sekunders, avbrytbar transport även för SDK-uppladdning. Underlaget måste vara serverägt; anroparen måste kontrollera aktuell session/ny autentisering före lagring och igen före utlämning.

Kontoradering omfattar även exportbucket. Jobbmetadata saknar medvetet FK till kontot: den måste överleva kontoradering tills fysisk filstädning bekräftats. Konto utan skyddad profil nekas läsning och kvalificeras omedelbart för städning. Metadata innehåller bara konto/objekt-ID, status, tider, storlek/hash och städningslås/försök, inget exportinnehåll eller lösenord.

## Städning och fel

processPersonalDataExportCleanup tar först hand om övergivna objekt och hämtar sedan högst tio tidsbegränsade städningslås. Kandidater är utgångna/misslyckade paket, byggen över tio minuter och borttagna konton. Worker raderar via Storage.remove innan metadata kvitteras; ingen runtime raderar storage.objects med SQL. Fel behåller metadata och återförsöks efter fem minuter. Fel/förbrukat/utgånget lås kan inte kvittera jobbet.

En avbruten HTTP-uppladdning kan ändå slutföras hos lagringstjänsten. Därför köar varje körning även upp till 20 kanoniska objekt utan jobbrad som är äldre än 15 minuter, för fysisk API-radering. Detta förhindrar att en sen uppladdning permanent försvinner ur städningens underlag. Godtyckliga filnamn/buckets tas inte från HTTP-input eller jobbsvaret.

En timme är åtkomstfrist, inte en garanterad fysisk raderingstid. En återkommande scheduler och driftövervakning måste aktiveras/verifieras separat; avbrott och återförsök kan fördröja fysisk radering. Inga routes använder lagringsmodulen ännu, inga paket har skapats och inget städschema aktiveras här. Det tidigare exportprovet förblir avstängt och ändras inte till lagrad leverans i denna PR.

## Faktiskt verifierat

- DevStaging-SQL-provet passerar med DDL i rollback före införande och mot införda RPC:er. ACL/roller, idempotens, aktivt dublettpaket, kontoägarskap, expiry, statusövergångar, städningslås/återförsök, orphan-avstämning och metadata efter kontoradering kontrolleras. De sista kontoraderingsfallen tillkom efter det första DDL-provet och passerar mot införda funktioner.
- Alla QA-identiteter/jobbrader/Storage-metadatarader i SQL-provet rullas tillbaka. Metadataraden har ingen fysisk fil och är inte bevis på fysisk Storage-städning. Efterkontroll: noll QA-konton, exportjobb och exportobjekt.
- test:temporary-personal-data-export: 33 lokala kontroller av faktisk servermodul/worker och installerad SDK mot simulerad transport, inklusive låst sökväg/bucket, integritet, nekat sent/ändrat paket, cacheförbud, upsert=false, avbrott samt Storage.remove före kvittering. Inga verkliga fjärrfiler skapades.
- Färsk DevStaging-metadata visar 86 relationer/fyra buckets. Enda tilläggen är den nya privata tabellen och bucketen. Katalogens gamla Auth-/säkerhetsmetadata lämnas byteidentiska; ett granskat additions-only-tillägg innehåller bara exporttabellen och bucketen. Auditverktyget sammanfogar dem och nekar ersättning av gamla poster. Inventeringens 26 och insamlingens 120 kontroller passerar efter aktualisering. Nya interna exportstatusar förblir not_collected i insamlingen tills separat säker projektion införs.
- HTTP-provets 44, granskningspaketets 39, paketbyggarens 76 och serverfelens 42 kontroller passerar. Kontoraderingens verkliga handler/klient/dialog-prov passerar med simulerad Auth/Storage och fyra städade buckets.
- TypeScript, riktad ESLint och diff-check passerar. Säkerhetsadvisories är oförändrade jämfört med före migrationen (observationstid undantagen).

## Återstår före aktivering

Verifiera fysisk uppladdning/läsning/radering i verklig privat Storage, anslut och övervaka återkommande worker, koppla lagringen till autentiserat beställnings-/nedladdningsflöde och användarstatuser samt testa samtidighet över separata anslutningar. SQL-provens sekventiella reservations-/låskontroller är inte ett sådant samtidighetstest. Fullständigt exportinnehåll, verksamhetsinformation och övriga L13-kriterier återstår. Ingen AI, produktion eller verklig användarfil berörs. Global åtgärdsplan lämnas byteidentisk; leveranschecklista finns här och i PR.
