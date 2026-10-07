# Plan: Phase 5 — premium-backend utan betalning

> Historisk plan före implementationen. För aktuellt läge, se `premium-testing.md`.
> Premium-backenden är nu implementerad. Gränsen på en aktiv annons per företag
> togs bort i DEV 2026-10-07 på användarens begäran.

## Avgränsning och nuläge

Den här fasen bygger **premiumrättigheter**, inte betalning, fakturor, priser i
checkout eller admin-UI. Faktureringsfasen ska senare kunna bekräfta en faktura
genom att anropa samma server-side-aktivering som används manuellt i test.

Den kontrollerade nuvarande implementationen är Next.js 16/TypeScript med
Supabase Auth, Postgres, RLS och några skyddade Node-routes i `app/api`.
Jobb ägs av `jobs.company_user_id` och har `status` = `active`,
`paused` eller `closed`; databastriggern synkar `is_active` med status.
Endast aktiva jobb är synliga för andra än ägaren och nya ungdomsansökningar
blockeras i RLS för pausade/stängda jobb.

Nuvarande discovery hämtar `jobs` i `created_at desc`. Swipe och karta
använder `getSwipeJobs()`, filtrerar på ansökningar, text, plats, kategori och
ålder och sorterar därefter på en relevanspoäng. Företagets egna annonser,
kandidatgranskning, match och chatt använder andra, redan skyddade flöden.

Det finns ingen premium-, boost-, order- eller rättighetstabell i migrationerna
och ingen premium-serverlogik. Det enda befintliga premiumspåret är
marknadsföringsdata i `lib/pricing-data.ts`: där nämns bland annat
“Prioriterad exponering” i en plan och en `individual-boost` för
privatpersoner. Det är statisk UI-data, inte en rättighet eller betalning och
ska inte kopplas till denna fas. Den befintliga databastriggern begränsar
`company`-konton till en aktiv rekryteringsannons; premium ska inte ändra den
regeln i denna fas.

Det finns ett direkt stagingtest av RLS i
`scripts/test-staging-rls.mjs`, men ingen etablerad enhetstestsvit. Ingen
schemaläggare eller cron-konfiguration finns i repot.

## Liten första produktuppsättning

Stöd endast en faktisk premiumförmån nu:

- **Boost av en jobbannons**: en tidsbegränsad rättighet på ett specifikt
  `employment`-jobb. Den gör en annars synlig, aktiv annons framhävd och
  prioriterad i discovery.

Förbered katalogen för framtida produkter, men implementera inte deras effekt:

- `company_feature` som scope i datamodellen kan senare användas för exempelvis
  fler aktiva annonser eller statistik, men det ska inte låsa upp någonting i
  denna fas.
- Prenumerationer, AI-funktioner, fler annonsplatser, premium för ungdomar och
  privata engångsjobb ligger utanför scope.

Boost ska endast avse `company` + `job_kind = 'employment'`. Den förändrar
inte behörigheter, kandidatåtkomst, matchning eller chatt.

## Föreslagen datamodell

Skapa nya tabeller i en ny Supabase-migration. Alla tidsfält är
`timestamptz`; tidsperioden följer halvöppet intervall
`[starts_at, ends_at)`.

| Tabell | Syfte och viktiga fält |
| --- | --- |
| `premium_products` | Serveradministrerad produktkatalog: `code` (unik), namn, `kind` (börja med `job_boost`), `scope` (`job` eller framtida `company_feature`), `default_duration`, `active`, `metadata` för icke-prissättande produktdata. Prisfält kan reserveras som nullable snapshotfält, men inga priser eller betalregler används i denna fas. |
| `premium_orders` | Affärsunderlag för en manuell eller framtida fakturautlöst tilldelning: id, `company_user_id`, `product_id`, eventuellt `job_id`, `status` (`pending`, `activated`, `cancelled`), `source` (t.ex. `manual`, senare `invoice`), `source_reference`, `idempotency_key`, tids- och revisionsfält. Detta är inte ett betalbevis och får inga faktura-/betalstatusar i Phase 5; utgång hör till rättigheten. |
| `premium_entitlements` | Den enda tabellen som ger effekt: id, `order_id` (unik för första versionens en rättighet per order), `company_user_id`, `product_id`, `job_id` när scopet är jobb, `state` (`pending`, `active`, `expired`, `cancelled`), `starts_at`, `ends_at`, `activated_at`, `ended_at`, `end_reason`, `created_by_source` och auditfält. Constraints säkerställer rätt scope och `ends_at > starts_at`. |
| `premium_activation_events` | Smal revisions- och idempotensjournal: unik `idempotency_key`, order-/entitlement-id, åtgärd (`activate`/`end`), källa/referens, utfall och tidsstämpel. Ingen faktura-, person- eller full payload-data. |

Viktiga constraints och index:

- `premium_orders.source + source_reference` ska vara unik när
  `source_reference` är satt. En kommande fakturaadapter kan då använda
  fakturans stabila ID som referens.
- `premium_entitlements.order_id` är unik i första versionen. Det gör en
  lyckad order till högst en boost och stoppar dubblettaktivering.
- `job_id` ska referera `jobs(id)` med **RESTRICT**, inte cascade. Ett
  revisionsunderlag eller en aktiv rättighet ska inte tyst försvinna vid
  annonsradering. Kontoradering behöver samma uttryckliga retentionbeslut
  innan en FK till `auth.users` får cascade.
- Indexera `premium_entitlements(job_id, starts_at, ends_at)` och
  `premium_entitlements(company_user_id, state)`.
- Lägg inte `is_premium` eller `boost_until` i `jobs`: annonsägaren har
  idag uppdateringsrätt till sina jobb och skulle då kunna manipulera förmånen
  från klienten.

## Livscykel och utgång

En order skapas som `pending`. När den server-side-funktion som beskrivs
nedan lyckas blir ordern `activated` och dess rättighet blir:

- `pending` om starttiden ligger i framtiden eller jobbet är pausat;
- `active` när starttiden har nåtts, sluttiden inte har passerat och jobbet
  är aktivt;
- `expired` när `now() >= ends_at`;
- `cancelled` när den avslutas uttryckligen av server-side-funktionen.

Effektiv rättighet ska beräknas från tidsintervallet i discoveryfrågan,
inte lita på ett senast uppdaterat statusfält. Därmed upphör en boost korrekt
även om inget schemalagt jobb körs. En daglig schemalagd reconciliation kan
läggas till senare för att skriva `expired` i historik och rapportering, men
den är inte ett krav för korrekt visning och ska inte införas i denna fas
eftersom repot saknar scheduler-infrastruktur.

Rekommenderad pauspolicy: boostens kalendertid fortsätter att löpa medan
annonsen är pausad eller stängd, men den får ingen synlighet. Det ger en enkel,
begränsad och förutsägbar förmån. “Frys vid paus” är möjligt senare men kräver
en tidsbokföring med flera intervall och ska vara ett uttryckligt produktbeslut.

## Server-side-aktivering och avslut

Skapa två databasfunktioner som är den enda skrivvägen till effektiva
rättigheter:

```text
activate_premium(
  p_company_user_id uuid,
  p_product_code text,
  p_job_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_source text,
  p_source_reference text,
  p_idempotency_key uuid
) -> order_id, entitlement_id, result

end_premium(
  p_entitlement_id uuid,
  p_reason text,
  p_source text,
  p_source_reference text,
  p_idempotency_key uuid
) -> entitlement_id, result
```

Båda funktionerna ska vara små `SECURITY DEFINER`-funktioner med låst
`search_path`, `revoke all from public, anon, authenticated` och explicit
kontroll att anropet kommer från service role. De ska endast nås från en
server-only administrationsscript eller en framtida serverroute/fakturaadapter
med service role — aldrig genom Supabase-klienten i browsern. En eventuell
framtida adminroll får inte få direkt SQL/RPC-rätt utan ska gå via en separat
auktoriserad serverroute.

`activate_premium` gör atomärt:

1. verifierar service role, aktiv produkt, produktens scope och att kontot har
   `role = 'company'`;
2. verifierar att jobbet finns, ägs av företaget och är `employment`; tillåt
   `active` eller `paused`, men inte `closed`;
3. validerar tidsintervallet och en begränsad, serverbestämd källa;
4. låser/läser en eventuell rad med samma idempotensnyckel eller
   source/referens och returnerar samma resultat utan att skapa en ny boost;
5. skapar order och rättighet eller återanvänder den identiska redan skapade
   tilldelningen;
6. skriver audit-event i samma transaction.

`end_premium` låser rättigheten, är idempotent för samma slutreferens och
byter bara ett ännu ej avslutat entitlement till `cancelled`. Den får inte
förlänga, ändra produkt, företag eller målannons.

Manuell testaktivering görs därför med ett versionshanterat,
server-only script som använder `SUPABASE_SERVICE_ROLE_KEY` och alltid kräver
en explicit `source_reference` (exempelvis ett supportärende eller en
testreferens). Scriptet blir det godkända gränssnittet tills en admin-UI finns.
Det ska dokumenteras, men skapas först i steg 2.

## Discovery, märkning och sortering

En boost är kvalificerad endast om:

- entitlementet hör till samma jobb och produkt `job_boost`;
- dess intervall innehåller aktuell tid;
- entitlementet inte är avslutat; och
- jobbet är `active` och därmed redan synligt enligt befintlig RLS.

Premium får aldrig göra ett pausat/stängt jobb synligt eller ändra
ansökningsregler. Betalnings- och ordertabeller exponeras inte till ungdomar.

Lägg till en begränsad databasskyddad discoveryväg som returnerar dagens
jobbfält plus en ofarlig härledd flagga `is_boosted`. Den kan vara en
säker `SECURITY DEFINER`-RPC som återskapar dagens synlighetsvillkor, eller
en snäv funktion som enbart returnerar kvalificerade jobb-ID:n och används
tillsammans med dagens jobbfråga. Valet ska verifieras med RLS- och
`EXPLAIN`-kontroll i implementationen. Ingen klient får direkt läsrätt till
`premium_orders` eller `premium_entitlements` för att avgöra booststatus.

Sortering måste vara stabil:

- Vanlig jobblista: partitionera kvalificerade boostar före övriga; bevara
  inom respektive grupp dagens `created_at desc`.
- Swipe/karta: kör alla nuvarande filter och relevanssortering först,
  partitionera sedan stabilt på `is_boosted`. Inom varje grupp bevaras
  dagens relevansordning och dess nuvarande tie-break.
- Egna företagsannonser, kandidatgranskning, direkta jobblänkar, matchning och
  chatt ändras inte.

Två icke-boostade annonser behåller alltså alltid sin inbördes ordning.
Ungdomar kan få se en neutral “Framhävd annons”-markering, men inte produkt,
order, start-/slutdatum eller företagsbeställningsdata.

## Behörigheter

| Resurs | Företagskonto | Ungdom/annan användare | Service role |
| --- | --- | --- | --- |
| `premium_products` | Läsning av begränsade aktiva produktfält via säker vy/RPC vid behov | Ingen åtkomst i Phase 5 | Skriver via migration/manual process |
| `premium_orders` | Select av endast egna order, aldrig klientinsert/-update/-delete | Ingen åtkomst | Aktivering skapar/uppdaterar |
| `premium_entitlements` | Select av endast egna rättigheter och säkra statusfält | Ingen åtkomst; endast härledd `is_boosted` i discovery | Aktivering/avslut skriver |
| `premium_activation_events` | Ingen direkt åtkomst | Ingen åtkomst | Endast aktiverings-/avslutsfunktion |

Aktivera RLS på alla nya tabeller. Starta utan breda `for all`-policys.
Företagsselect ska kontrollera både `auth.uid() = company_user_id` och
`profiles.role = 'company'`. Ingen direkt insert/update/delete-policy för
företag eller ungdomar ska finnas på order, rättighet eller auditlogg.

Alla premiumfördelar kontrolleras i databas/serverlogik. UI, klientfilter,
local state och URL-parametrar är bara presentation och får aldrig vara grund
för synlighet, gränser eller aktivering.

## Kantfall

- **Pausad annons:** tilldelning kan skapas som väntande för en ägd pausad
  annons, men har ingen discoveryeffekt förrän jobbet är aktivt. Kalendertiden
  löper enligt rekommenderad policy.
- **Stängd annons:** ny boost nekas. En redan aktiv boost ger ingen effekt och
  löper ut/kan avslutas i historiken.
- **Annons före publicering:** det finns ingen draft/publicerad status i
  nuvarande schema; `paused` är närmaste befintliga tillstånd. Tilldelning
  utan existerande `job_id` ska nekas; den får inte reserveras för ett
  ospecificerat framtida jobb.
- **Flera boosts på samma annons:** separata legitimt unika order får skapa
  flera entitlements. Överlapp ger bara en framhävning, aldrig multipel rank.
  För att inte förbruka värde rekommenderas att en senare boost schemaläggs
  att börja när senaste oavslutade boost slutar. Exakt staplingsregel är ett
  öppet beslut.
- **Dubblettanrop:** samma idempotensnyckel eller samma källa/referens returnerar
  ursprungligt resultat och skapar ingen extra order/rättighet.
- **Raderad annons:** blockera radering medan den har väntande/aktiv premium
  eller använd uttrycklig server-side-cancel först. FK:n får inte cascade-radera
  revisionsdata.
- **Borttaget konto:** obetalda/pending rättigheter avslutas. Bevarande och
  anonymisering av orderhistorik behöver beslutas innan nuvarande
  kontoraderingsroute får påverka premiumtabeller.
- **Systemtid/reconciliation:** discovery räknar med databastid; ett framtida
  bakgrundsjobb får bara synka historik och aldrig vara ensam mekanism för
  utgång.

## Gränssnitt till kommande faktureringsfas

Faktureringsfasen behöver inte känna till jobsortering eller entitlementtabeller
direkt. Den behöver endast ett server-to-server-adapteranrop till
`activate_premium` med:

- intern företagsidentitet;
- produktkod och mål-`job_id`;
- fastställd period eller produktens serverbestämda längd;
- `source = 'invoice'`;
- stabil `source_reference` = fakturans interna/externa unika ID; och
- en stabil idempotensnyckel från faktura-/betalbekräftelsen.

Vid kredit/återbetalning kan samma fas anropa `end_premium` med
faktura-/kreditnotareferens. Betalningsfasen äger pris, moms, fakturadokument,
betalstatus och leverantörscallbacks; Phase 5 äger endast den bekräftade
rättigheten och dess plattformseffekt.

## Öppna beslut

1. Produktnamn, boostlängder och om pris över huvud taget ska lagras som
   produktmetadata redan nu eller först med fakturering.
2. Ska boosts staplas i kö, förlänga en befintlig rättighet eller tillåtas
   överlappa? Rekommendationen är köad, icke-överlappande tid.
3. Ska boostens kalendertid fortsätta vid paus (rekommenderat) eller frysas?
4. Ska ett företag kunna få en boost manuellt på en pausad annons, eller endast
   en aktiv annons?
5. Vilken neutral markering ska ungdomar se, om någon?
6. Hur ska betalda/aktiverade order bevaras vid borttagen annons eller konto?
7. Vilka tilldelningskällor tillåts före fakturafasen (minst `manual`;
   eventuellt `migration`), och vem får köra service-role-scriptet?
8. Ska Phase 5 senare utökas med en separat `company_feature`-produkt, eller
   ska denna första fas hållas strikt till jobbboost?

## Implementationsordning efter godkännande

1. Lägg migrationen för katalog, order, entitlement, auditlogg, constraints,
   index och RLS. Skriv server-only, idempotenta
   `activate_premium`/`end_premium`-funktioner.
2. Lägg ett dokumenterat manuellt administrationsscript som anropar
   `activate_premium` med service role, och ingen admin-UI.
3. Bygg den säkra discoveryvägen och utöka `JobPost` med härledd,
   presentationssäker `is_boosted`. Anpassa endast discovery-lista,
   swipe och karta med stabil sortering och eventuell märkning.
4. Lägg tester för giltig aktivering, avslut, idempotens, tidsexpiry,
   job-/företagsägarskap, ungdomsnekad åtkomst och cross-company-läsning.
   Utöka `scripts/test-staging-rls.mjs` med premiumtabeller.
5. Kör regressionskontroll av jobb → ansökan → kandidatgranskning → match →
   chatt → anställning för aktiv, pausad och stängd annons.
6. Dokumentera exakt testkommando, krävd service-role-miljövariabel och hur en
   testboost avslutas. Gör separata, små commits per steg.

Ingen implementation, migration eller pris-/betalningsintegration görs i steg 1.
