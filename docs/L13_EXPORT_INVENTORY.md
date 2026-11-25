# L13 – datainventering inför automatisk export

[PR #143](https://github.com/vilgotdidrikson/youth-job-mvp/pull/143), `codex/l13-export-inventory-20261028`, Vilgot / Codex. Reserverad före arbete 2026-10-28 från aktuell dev. **Inventering och granskningsverktyg, ingen fungerande export ännu.** L13 förblir Pågår.

## Aktualisering 2026-10-30

[L13_TEMPORARY_EXPORT_STORAGE.md](L13_TEMPORARY_EXPORT_STORAGE.md) inför en serverägd exporttabell och privat bucket. Ny faktisk DevStaging-katalog visar 86 relationer och fyra buckets, med exakt dessa två tillägg och inga andra schemaavvikelser. Källregistret är uppdaterat. Granskad katalog läses som den byteidentiska ursprungsfilen plus catalog.export-storage-2026-10-30.json med enbart den nya exporttabellen/bucketen. Tillägget får inte ersätta gamla relationer eller buckets. Nedanstående 85/tre-protokoll är historiskt från den första inventeringen. Ingen export eller städschemaläggning aktiveras genom aktualiseringen.

## Ursprungligt underlag och täckning

DevStagings faktiska systemkatalog lästes 2026-10-28: **85 relationer**, varav 50 i `public`/`private` och 35 i `auth`/`storage`, samt tre Storage-buckets. Endast tabell-/kolumnnamn, typer, FK-definitioner, relationstyp, RLS-flagga och bucketnamn/publikflagga hämtades. Inga användarrader, objektnamn, dokument, lösenord, tokenvärden eller Vault-hemligheter lästes. Ingen databasändring gjordes.

- [Källregister](privacy/personal-data-inventory.json): 21 grupper med exakta tabellnamn, person-/ägaravgränsning, innehåll och granskningsbehov; alla tre buckets; lokala och externa/driftkällor.
- [Granskad schemabild](privacy/catalog.dev-2026-10-28.json): metadata från DevStaging, inga användaruppgifter. Omfattar fyra scheman, inte varje leverantörs-/systemresurs.
- [Metadatafråga](../scripts/capture-personal-data-catalog.sql) och [kontroll](../scripts/check-personal-data-inventory.mjs): jämför en inläst katalog med granskad schemabild och register.

`subject`, `mixed`, `review` och `context` beskriver tekniska granskningsbehov. De avgör varken rätt till tillgång eller behörighet och är **inte** fältlistor för automatiskt utlämnande. `automaticExportEnabled: false` är en inventeringsmarkering, ingen driftsatt feature flag. Ingen runtime importerar registret. Inga API:er, UI-knappar eller exportjobb aktiveras.

## Gränser inför implementation

| Område | Urval och avgränsning |
|---|---|
| Konto/profil/CV | Egen identitet, även privat jobbprofil, dokumentreferenser och kvarvarande originalfiler. Egen tillgång är inte samma sak som N19:s företagsdelning. Ingen bred join mot andra konton. |
| Privat AI-arbetsmaterial | CV-samtal och ej godkända förslag som fortfarande behandlas. Uteslut inte uppgifter enbart för att de inte används i matchning. |
| Ansökningar/delningar | Relevant status-/svarshistorik och privata `application_disclosures`. `packet` och `matching_input` är olika underlag. Företagets kontoexport får inte kringgå ungdomens delningsgräns. |
| AI-bedömningar | Relevanta aktuella och historiska rader, belägg och kriteriesnapshots. Företags-RLS döljer äldre delningsrevisioner; den begränsningen får inte tyst kapa ungdomens egen tillgång. |
| Chattar/relationer | Deltagarskap via konversation, inte endast egna avsända meddelanden. Bedöm relevanta meddelanden från båda parter och avgränsad maskering. Varken total rådump eller generellt undantag för motpartsmeddelanden. |
| Säkerhet/admin | Rapporter kan avse personen via mål-ID/snapshot utan direkt FK. Anmälare/blockerare och fria anteckningar kräver individuell bedömning. Nullad anmälaridentitet gör inte snapshot automatiskt anonym. |
| Anställning/notiser/premium | Indirekta kopplingar via match/job/order; aktör är inte alltid berörd person. Notistext och fria referenser kan innehålla personuppgifter även efter nullad FK. Premium är inte skarp fakturering. |
| Drift/Auth | Kontorelaterad aktivitet/gallringsstatus kan behöva förklaras. Serialisera aldrig kör-/Auth-tabeller generiskt: lösenordshashar, token, MFA/OTP/OAuth/PKCE-hemligheter, upload-signaturer och worker-lock-token får inte följa med. |
| Filer/legacy-video | Alla tre buckets och eventuella kvarvarande avvecklade profilvideor. Verifiera ägare, bucket, faktisk referens, fysisk filstatus och delningar. Publik bucket/eget filprefix är inte ensamt ägarskapsbevis. Återskapa inte gallrat material från backup. |
| Lokala utkast | CV/röst-CV/chatt i lokal-/sessionslagring och annonsutkast med bild-Blob i IndexedDB. Serverexporten kan inte se andra enheter. Separat kontoskopad hantering behövs; ingen tyst uppladdning eller lokala Auth-hemligheter i exporten. |

Schemainventering ersätter inte bedömning av verkligt innehåll, ändamål, mottagare eller rättigheter. JSON, fritext och filer kan få ytterligare personuppgifter utan schemadrift. Hantera detta i innehålls-/rättighetsgranskningen med fiktiva blandade testdata före aktivering.

## Kontroll vid schemaändring

1. Kör metadatafrågan skrivskyddat mot DevStaging. Spara själva JSON-värdet i kolumnen `catalog` som lokal metadatafil; inte verktygets textomslag eller användarrader.
2. Kör `npm run check:personal-data-inventory -- --catalog /path/to/catalog.json`.
3. Granska avvikelser och uppdatera klassning/schemabild tillsammans. Acceptera inte automatiskt den nya katalogen som säker.

Kontrollen saknar nätverksanslutning och kan inte bevisa att filen är färsk. Uttrycklig `--catalog` krävs; utan fil misslyckas den i stället för att ge ett skenbart live-resultat. Ordning ignoreras; okända/saknade tabeller/kolumner, typ-/FK-ändring, relationstyp/RLS-flagga, bucket/publikflagga och ogiltig/dubbel klassning underkänns. Policytext, triggers, RPC-kod, externa konton och nya JSON-nycklar verifieras inte.

## Verifierat

- Ny läsning av DevStagings metadata matchar alla 85 relationer och tre buckets utan okända/överlappande källor.
- `test:personal-data-inventory`: 21 kontroller inklusive nya privata AI-källor/fält, ändrat ägarskap/typ/RLS/bucketexponering, borttagningar, ogiltigt/dubbelt underlag, saknad CLI-indata och oskadlig omsortering. Negativa fall är syntetiska metadatamutationer, inga ändringar av verkliga tabeller.
- Riktad ESLint och `git diff --check`. Produktkod/beroenden ändras inte; inget nytt lokalt produktionsbygge behövs. Ingen kontoexport, filhämtning, negativ RLS-, modell- eller browserverifiering påstås.

## Återstår

Bygg nyautentisering, kontobunden beställning, sammanställning/JSON/filer, säkra hämtningar och fysisk paketgallring med exakt beslutad frist. Redovisa resultat för varje datakategori: saknad källa eller avbruten paginering får inte visas som komplett export. Hantera samtidig rättelse/radering och dubbla jobb. Inga externa AI-anrop för formatering/maskering.

Fastställ personuppgiftsansvarig, ärendeansvarig och fungerande kontaktväg även utan konto. `info@matchnwork.se` är verifierad som utskicksadress; denna leverans utser inte automatiskt adressen till bevakad integritetsfunktion. Bedöm delade uppgifter, anteckningar och säkerhetsdata före automatisk projektion. Besluta hur automatiska och individuellt bedömda delar redovisas tillsammans utan att likställa ett databasuttag med komplett registerutdrag.

L14 behöver fortfarande granska leverantörsinställningar, avtal, loggar och retention för Supabase, Vercel, OpenAI, Mapbox och SMTP. `store:false` bevisar inte att leverantörsloggar saknas. Vault/cron/net/realtime och övriga system-/extensionscheman ligger utanför den lästa katalogen. Inga nya konton/avtal/inställningar aktiveras. L12:s backup-/lagringsbeslut och resterande L13-kriterier kvarstår.


## Aktualisering 2026-11-17 – interna ärendeuppföljningar

PR #222: ny faktisk DevStaging-katalog före ändringen visade två befintliga Auth-kolumner utanför tidigare metadata: `auth.one_time_tokens.link_token_hash` (text) och `auth.saml_providers.dedicated_scope` (boolean). Inga värden lästes. Hashen omfattas uttryckligen av Auth-hemligheter som aldrig får exporteras; SAML-flaggan är konfigurationsmetadata och öppnar ingen ny åtkomst/insamling. Dessa fält skapades inte av leveransen.

Efter migration `privacy_case_internal_reviews` var den enda nya schemaavvikelsen `private.privacy_case_events.review_after` (timestamp with time zone): datum för planerad uppföljning vid en intern audithändelse. Individuell rättighets-/säkerhetsbedömning enligt gruppen safety gäller fortsatt; ingen generell råexport eller ny insamlingsprojektion aktiveras.

`catalog.column-additions-2026-11-17.json` innehåller exakt dessa tre granskade kolumntillägg. Verktyget accepterar bara nya kolumner på redan kända relationer; ersättning av fält/typ, okänd relation, extra relationsmetadata och dubblerade tillägg avvisas. Historiska katalogfiler är oförändrade. Baslinjekontrollen hittade först de två Auth-fälten; kontrollen efter migreringen hittade auditfältet innan det granskade tillägget lades in. Den färska slutkontrollen matchar 92 relationer/fyra buckets. 33 positiva/negativa driftkontroller passerar. Detta gäller metadata; innehålls-/rättighetsbedömningar och full exportacceptans kvarstår.

## Aktualisering 2026-11-17 – manuellt mejlintag

[PR #223](https://github.com/vilgotdidrikson/youth-job-mvp/pull/223): ny katalog före ändringen matchade 92 relationer/fyra buckets. Efter `20261117182648_privacy_case_email_intake.sql` var enda avvikelserna `private.privacy_cases.intake_source` (text), `private.privacy_cases.contact_email` (text) och `private.privacy_case_events.external_sent_at` (timestamp with time zone). Dessa tre fält är nu granskade tillägg i samma strikta kolumnfil; tidigare kataloger är oförändrade. Ny faktisk slutkatalog och 33 driftkontroller passerar.

Gruppen safety omfattar mejlkälla, kontaktadress och faktiskt sändningsdatum, separat från registreringstid. Mejlintag har alltid null requester_id även om adressen råkar motsvara ett konto. Adressen bevisar ingen identitet; individuell sökning och rättighetsbedömning krävs. Ärendekällorna förblir not_collected i den automatiska exportinsamlingen. Inga nya tabeller, buckets, klientgrants, automatisk kontokoppling eller allmän råexport införs.

## Väntande ändringar i leveransen L13/L16/F20

När migrationerna är införda i DevStaging behöver en färsk kataloggranskning klassificera följande källor innan referenskatalogen uppdateras.

- `private.application_ai_preferences` hör till det aktuella ungdomskontot. Åtkomst ska bedömas för kontoägaren utan uppgifter om andra personer.
- `private.privacy_case_attachments` är länkat till ett skyddat ärende. PDF-innehåll bedöms manuellt och hämtas aldrig i den automatiska exporten.
- `private.privacy_case_attachment_access` innehåller åtgärdstyp, tid och handläggar-ID när kontot finns kvar. Loggen bedöms manuellt med hänsyn till den som handlagt ärendet.
- `private.privacy_case_deliveries` kopplar samma ärende, granskad bilaga och autentiserat mottagarkonto till en utgångstid. Jobbet gallrar den tillfälliga filkopian, och därmed även leveransraden. Åtkomst är redan spärrad vid utgångstid även om jobbet fördröjs.
- Intern incident är en separat källa i samma ärendetabell. En incident saknar koppling till en enskild sökandes konto och lämnas inte ut genom kontoportalen.

Ingen referenskatalog uppdaterades från de lokala testfixturerna.
