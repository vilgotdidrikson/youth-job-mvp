# Plan: betald boost för företag

## Avgränsning och nuläge

Denna plan gäller en engångsköpt boost för en jobbannons från ett `company`-konto. `private`-konton och de befintliga prisplanerna för ungdomar ligger utanför denna första leverans.

Kodbasen är Next.js 16 med React-klienter och Supabase. Klienten använder anon-nyckel och RLS; serverlogik ligger i `app/api/**/route.ts`. De privilegierade befintliga routes använder `SUPABASE_SERVICE_ROLE_KEY` först efter att den aktuella användaren har autentiserats och auktoriserats på servern. Det är mönstret betalning ska följa.

Viktiga befintliga gränser att bevara:

- `jobs.company_user_id` ägs av ett auth-konto. Jobb kan vara `active`, `paused` eller `closed`; triggern synkar `is_active` med status.
- RLS visar aktiva jobb, medan ägaren fortsatt ser sina egna pausade och stängda jobb. Ungdomars ansökningar är redan blockerade i databasen för pausade/stängda jobb.
- Företagsprofiler är privata för respektive företagskonto. Kandidatdata, matchning och chatt har egna relationsbundna RLS-policys/RPC:er.
- Vanlig jobblista hämtar idag `jobs` i `created_at desc`. Swipe/karta hämtar samma underlag och sorterar sedan swipe-flödet på befintlig relevanspoäng. En boost får inte kringgå status, RLS eller ändra inbördes ordning för annonser som inte är boostade.
- Det finns ett staging-RLS-test (`scripts/test-staging-rls.mjs`), men ingen etablerad enhetstestsvit. Nya betalningslogik bör därför vara små, rena moduler med Node-test eller den testlösning som införs i första delsteget.

## Rekommenderat betalupplägg

Välj **ingen specifik leverantör ännu**. Produktkravet är kort och svensk B2B-faktura; faktura-/betalplattformen ska väljas i ett kort kvalificeringssteg före implementation.

- **Kort:** servern skapar en order hos vald kortleverantör med en serverberäknad orderrad. Leverantörens hostade eller inbäddade betalningsyta hanterar kortuppgifter och 3DS/SCA; Employo tar aldrig emot kortdata.
- **Faktura:** en fakturaplattform ska skapa och distribuera en korrekt svensk B2B-faktura, med fakturaadress, företagsreferens/PO och vid behov PEPPOL-ID. Om plattformen finansierar/övertar fordran kan boost aktiveras när detta är serververifierat enligt avtalet. Om Employo bär fordran måste boost vänta tills fakturan faktiskt har markerats betald av leverantören.

Två upplägg ska jämföras: (A) en gemensam leverantör för kort och B2B-faktura eller (B) kortleverantör plus separat fakturaapp. Välj A endast om den faktiskt stödjer svenska företagsfakturor, testmiljö och säkra server-callbacks; välj B om fakturaappen är bättre för fakturanummer, kreditnotor, PEPPOL, bokföring och export. I båda fallen ska leverantörernas API ge: testmiljö, server-till-server-statusuppslag, signerade callbacks eller annan verifierbar autenticitet, idempotenta order-/fakturaskapanden, kreditering och dokumentation av när betalning respektive finansiering är definitiv.

Priskatalogen ägs av Employos server/databas. Den kopplar en godkänd intern produktkod till namn, pris, valuta, moms och boostlängd; dessa värden skickas som en serverbyggd provider-order/faktura. Klienten skickar `jobId`, vald intern produktkod och betalmetod — aldrig belopp, valuta eller moms.

## Föreslagen datamodell

Skapa nya tabeller i en ny migration. Belopp lagras som heltal i ören och alla tidsfält är `timestamptz`.

| Tabell | Syfte och centrala fält |
| --- | --- |
| `billing_profiles` | En rad per företagskonto: `company_user_id` (PK/FK), juridiskt namn, org.nr, VAT-nr vid behov, fakturaadress, referens/PO, fakturae-post, land och valfritt PEPPOL-ID. Separera detta från den publika/produktmässiga företagsprofilen. |
| `payment_products` | Serveradministrerad katalog: `code` (unik), namn/beskrivning, `currency`, `amount_ex_vat_ore`, `vat_rate_bps`, `active`, boostlängd och valfritt externt artikelnummer. Ingen klientskrivning. |
| `payment_purchases` | Den affärsmässiga ordern: id, företag, jobb, produkt, metod (`card`/`invoice`), status (`created`, `pending_payment`, `paid`, `failed`, `expired`, `void`, `refunded`, `partially_refunded`), kopior av produktnamn/pris/moms/valuta, totaler, snapshot av köparuppgifter, `card_provider`, `invoice_provider`, externa order-/faktura-ID:n, fakturanummer/PDF-/hosted-URL när den finns, externa status-/betalningsdatum och `idempotency_key`. En unik constraint per provider + externt ID. |
| `job_boosts` | Det som faktiskt styr synlighet: id, `job_id`, `company_user_id`, `purchase_id` (unik), `starts_at`, `ends_at`, `status` (`scheduled`, `active`, `expired`, `cancelled`, `revoked`), `activated_at`, `ended_at` och orsak. Constraint för `ends_at > starts_at`; index för aktiva intervall per jobb och sortering. |
| `payment_provider_events` | Revisions- och idempotenslogg: provider-event/korrelations-ID (unik), typ, mottagen-/behandlad-tid, resultat/fel och minimal sanerad payload eller hash/objektreferens. Ingen full kort- eller onödig persondata. |

Koppla `payment_purchases.job_id` till `jobs(id)` med **RESTRICT**, inte cascade. Ett betalt faktura-/kvitto-underlag får inte försvinna när en annons raderas. `company_user_id` behöver samma bokföringsgenomgång före eventuell kontoradering: använd inte automatiskt `on delete cascade` för betalningsunderlag. Spara köpets juridiska snapshot så att senare ändringar av företagsprofilen inte skriver om ett historiskt underlag.

Ingen boostkolumn ska läggas till i `jobs`: då kan en ägare med sin vanliga uppdateringsrätt annars försöka manipulera premiumstatus. En databasskyddad funktion/transaction, som bara körs av callback-hanteraren med service role, är enda vägen till `paid` och aktiv boost.

## Säkert köp, bekräftelse och idempotens

1. En autentiserad användare anropar `POST /api/payments/checkout`. Servern verifierar JWT, kräver rollen `company`, läser jobbet med ägarvillkoret och kräver `status = active`. Den läser produkt/pris från `payment_products`, räknar moms och total på servern och tar en snapshot av fakturauppgifter.
2. Servern skapar en lokal `payment_purchase` i en databastransaction med ett eget order-ID och en idempotensnyckel. Den skickar samma interna referens till vald leverantör. Vid dubbelklick returneras redan öppnad checkout eller redan skapad faktura för samma oavslutade order i stället för att skapa en ny.
3. Servern skapar en provider-order med serverns orderrad, callback-/return-URL och lokal orderreferens. Klienten får endast den token, URL eller snippet som behövs för leverantörens betalningsyta. Return-/bekräftelsesidan visar bara status och får **aldrig** aktivera boost.
4. `POST /api/payments/[provider]/callback` tar emot leverantörens callback. Den verifierar signaturen/annan avtalad autenticitet och hämtar sedan vid behov det aktuella objektet från leverantörens status-API med serverhemlighet. Den verifierar intern referens, belopp, valuta, företag, produkt och slutlig status mot den lokala ordern. Callbacken är en signal, inte betalningsbevis i sig.
5. Aktiveringsregeln definieras i leverantörsadapter och måste mappas till ett dokumenterat, slutligt serverstatusvärde: för kort en genomförd/captured betalning; för finansierad faktura ett bekräftat övertagande av fordran; för egen faktura faktisk betalning. Först därefter körs en enda SQL-RPC/transaction: lås orderraden, registrera callback-/korrelations-ID, överför endast till `paid` en gång och skapa/aktivera exakt en `job_boost`. Unika constraints på event, externt objekt och `job_boost.purchase_id` gör även parallella callbacks säkra. Returnera 2xx först när den lokala uppdateringen har lyckats.
6. Misslyckade, utgångna eller förfallna betalningar uppdaterar bara orderstatus; de ger aldrig boost. En återbetalning/kreditnota via provider-event avslutar eller återkallar en framtida aktiv boost enligt beslutad policy och bevarar revisionsspåret.

Exakt callbackformat och slutlig betalstatus får inte kodas förrän leverantör har valts och dess avtal/API har granskats. Kravet är dock fast: callbacken ska tåla dubbletter, kontrolleras kryptografiskt eller genom verifierande statusuppslag, och servern — inte klientens återkomst — ska vara auktoritativ.

## Synlighet och sortering

Boost är bara kvalificerad när en rad i `job_boosts` har `status = active`, det aktuella klockslaget ligger i `[starts_at, ends_at)` och jobbet fortfarande är aktivt. Den får inte göra ett pausat, stängt eller i övrigt otillåtet jobb synligt.

Inför en begränsad discovery-funktion/RPC (t.ex. `get_discoverable_jobs`) som returnerar bara de fält som dagens jobblistor behöver plus ett ofarligt `is_boosted`/`boost_priority`-värde. Den ska uttryckligen återskapa dagens synlighetsvillkor innan den läser booststatus; den exponeras inte som åtkomst till köp- eller fakturadata. Alternativt kan den endast returnera aktiva boostade jobbid:n till den befintliga listningen. Valet avgörs i implementation efter en EXPLAIN-/RLS-kontroll, men klienten ska inte få direkt läsrätt till betalningstabeller.

Sortering per vy:

- Allmän lista: stabil partition — aktiva boostade före övriga; inom vardera gruppen bibehålls nuvarande `created_at desc`.
- Swipe/karta: kör nuvarande filter och relevanssortering först. Partitionera sedan stabilt på `is_boosted`; inom varje grupp bevaras den befintliga relevansordningen och dess nuvarande tie-break (hämtningens `created_at desc`).
- Företagets egna annonssidor, kandidatgranskning, direkta jobblänkar och match/chatt får ingen ny sortering eller åtkomst.

Det innebär att två icke-boostade annonser behåller sin inbördes ordning; det enda synliga ingreppet är att en kvalificerad boost flyttas framför dem.

## Behörigheter och hemligheter

| Resurs/operation | Företagsägare | Ungdom/annat konto | Server/callback |
| --- | --- | --- | --- |
| `billing_profiles` | Egen rad: läsa/skapa/uppdatera fakturauppgifter, aldrig sätta providerfält | Ingen åtkomst | Skapa/uppdatera providerfält via service role |
| `payment_products` | Endast läsa de publika, aktiva produktfält som checkout behöver | Ingen betaldataåtkomst | Skriva via migration/adminprocess |
| `payment_purchases` | Endast select av egna köp och säkra visningsfält; ingen insert/update/delete från klient | Ingen åtkomst | Enda skrivaren efter auktorisering/callback |
| `job_boosts` | Endast select för egna jobb, eventuellt begränsade statusfält | Endast härledd publik boostmarkering via discovery | Enda skrivaren |
| `payment_provider_events` | Ingen direkt åtkomst | Ingen åtkomst | Endast callback/service role |

Aktivera RLS på alla nya tabeller och börja utan breda `for all`-policys. Köp, provider-ID:n, faktura-PDF-länk och callbacklogg ska inte kunna skrivas från browsern. Checkout-route kontrollerar alltid både konto-rollen och att jobbet tillhör kontot; service role ersätter aldrig den kontrollen. Begränsa felmeddelanden och loggar så att de inte innehåller fakturaadress, token, signatur eller full provider-payload.

Hemligheter: vald kort-/fakturaleverantörs API-nycklar, callback-hemlighet samt `SUPABASE_SERVICE_ROLE_KEY` finns endast server-side i lokal/deploy-miljö, aldrig med `NEXT_PUBLIC_`-prefix, i `.env.example`, klientkod eller git. Leverantörens betalningsyta kan visas i browsern, men inga autentiseringshemligheter får skickas dit.

## Svenska fakturor och kvitton

Detta är en teknisk plan, inte skattejuridisk rådgivning. Konfigurera vald fakturaplattform och Employos fakturavillkor med redovisningsansvarig innan skarpt läge. För en fullständig svensk B2B-faktura behöver vi minst:

- Employos juridiska namn, adress och momsregistreringsnummer (eller korrekt uppgift om eventuell momsbefrielse), plus organisationsnummer där det krävs.
- Unikt löpande fakturanummer, fakturadatum, leverans-/tillhandahållandedatum (boostperiodens start eller relevant datum), tydlig radbeskrivning som “Boost av jobbannons”, pris exkl. moms, tillämpad momssats, momsbelopp och total inkl. moms.
- Köparens juridiska namn och fakturaadress; samla organisationsnummer och köparens VAT-nummer när det krävs, samt fakturae-post, kontaktperson och valfri referens/PO.
- Betalvillkor/förfallodatum samt en oföränderlig kopia/länk till faktura och vid kreditering en kreditnota som refererar till originalet.

Skatteverket anger bland annat datum, unikt löpnummer, säljare/köpare, beskrivning, beskattningsunderlag, momssats och momsbelopp för fullständiga fakturor ([faktureringsregler](https://www.skatteverket.se/foretagochorganisationer/moms/saljavarorochtjanster/fakturering.4.58d555751259e4d66168000403.html)). Förenklad faktura kan i vissa fall användas upp till 4 000 kr inklusive moms, men vi väljer fullständig B2B-faktura från start för konsekvent underlag. Kvitto/faktura och bokföringsunderlag måste kunna arkiveras enligt beslutade redovisningsrutiner; bekräfta gallring/retention med redovisningsansvarig.

## Kantfall och beslutad standard tills annat bestäms

- **Pausad eller stängd annons efter köp:** den visas inte och förbrukar standardmässigt boostens kalendertid. Ingen automatisk förlängning. Detta förhindrar att en gammal betalning ligger obegränsat; alternativet “frys tiden vid paus” är en öppen produktfråga nedan.
- **Raderad annons:** blockera vanlig radering om den har ett öppet eller betalt köp; erbjud först avpublicering/stängning. Om radering ändå måste stödjas krävs explicit support/admin-policy och bokföringsbevarande av köp.
- **Raderat konto:** stoppa/cancelera obetalda provider-order och fakturautkast. Betalda verifikationer och fakturasnapshots får inte cascade-raderas; hantera anonymisering/retention enligt beslutad juridisk rutin.
- **Betalning misslyckas, avbryts eller löper ut:** status uppdateras, ingen boost skapas, och samma produkt kan köpas på nytt med en ny order.
- **Dubbelklick, återförsökt request eller dubblettcallback:** återanvänd oavslutad lokal order/provider-order och låt constraints/transaction göra aktivering exakt en gång.
- **Betalning klar men jobbet är nu pausat/stängt:** rekommendationen är att boostperioden startar vid bekräftad betalning och löper som kalendertid, men jobbet visas inte förrän det är aktivt igen. Det håller ordern enkel och begränsad i tid; välj den alternativa frys-/senstartspolicyn uttryckligen före implementation om det är önskat.
- **Återbetalning/kredit:** initieras inte av kundklienten. När en full återbetalning bekräftas ska framtida boost avslutas/återkallas enligt refundpolicy och köpet behålla länk till kreditnota. Partiell återbetalning kräver separat produktpolicy (förkorta, behåll eller kreditera utan ändrad boost) och ska inte gissas i kod.
- **Leverantören är nere/callback försenad:** köpet förblir `pending_payment`; en autentiserad statusroute kan läsa men inte ändra lokal status. Leverantörens callback och serverns efterföljande statusuppslag är sanningskälla; lägg till begränsad manuell reconciliation i framtida adminarbete.

## Öppna beslut från produkt/ekonomi

1. Vilka boostpaket säljs: pris exkl./inkl. moms, momssats, längd (exempelvis 48 timmar eller 7 dagar), om flera boosts får staplas och om ett jobb kan ha högst en aktiv boost.
2. När ska perioden börja om betalning sker medan jobbet är pausat: direkt kalendertid, vid nästa aktivering eller förbjud köp av pausade jobb?
3. Val av leverantör: en gemensam checkout eller kortleverantör plus separat fakturaapp. Kvalificera testmiljö, API/callback-säkerhet, idempotens, B2B-faktura, PEPPOL, kreditnotor, export/bokföring, svenska villkor/pris och ägande av fakturafordran.
4. Fakturavillkor: förfallodagar, minsta ordervärde för faktura, krav på org.nr/VAT, kreditbedömning/manuell godkännande och vilka betalmetoder som ska visas.
5. Ska B2B-faktura endast erbjudas när fakturaplattformen köper/förskotterar fordran (rekommenderat), eller ska boost vänta på att kunden faktiskt har betalat fakturan? Det senare kan fördröja en 14–30-dagars boost så mycket att produkten behöver utformas om.
6. Är bara svenska företag och SEK i första versionen? Planen antar Sverige, SEK och svensk moms; EU-/utlandsförsäljning kräver separat momsupplägg.
7. Employos juridiska fakturauppgifter, momsregistrering och vem som ansvarar för bokföring, arkivering, återbetalningar och support.
8. Återbetalningspolicy vid avpublicering, tekniskt fel eller avbruten rekrytering; särskilt partiella återbetalningar.
9. Ska prisplanssidan uppdateras nu? Den innehåller idag marknadsföringsdata för abonnemang och en `individual-boost` för privatpersoner, vilket inte motsvarar detta B2B-scope.

## Implementationsordning efter godkännande

1. Välj och kvalificera kort-/fakturalösning mot kriterierna ovan. Registrera test- och callbackdomäner, hämta testuppgifter och dokumentera exakt vilka providerstatusar som motsvarar kortbetalning, fakturafinansiering och faktisk fakturabetalning.
2. Migrera datamodell, constraints, index och minimala RLS-policys. Lägg till den begränsade discovery-vägen för booststatus utan betaldata.
3. Bygg rena servermoduler för produktuppslag, serverberäkning, provider-order/faktura och statusläsning bakom ett litet leverantörsinterface. Lägg API-routes med JWT-, roll- och jobbägarverifiering.
4. Bygg vald providers callback-route med signaturkontroll, statusuppslag, callbackjournal och atomär aktivering. Testa kort och B2B-faktura i den valda testmiljön.
5. Lägg liten företags-UI för fakturauppgifter, val av boost på egen aktiv annons, Checkout-redirect/faktura-status och egen köphistorik. Visa aldrig detta för ungdomar.
6. Lägg tester för signerad/ogiltig callback, belopps-/metadataavvikelse, dubblettevent, parallella försök, cross-company-jobb och RLS (inkludera betalningstabeller i staging-scriptet). Verifiera att inga client-anrop kan aktivera boost.
7. Gör regression av jobb → ansökan → kandidatgranskning → match → chatt → anställning samt discovery för aktiv/pausad/stängd annons. Dokumentera lokal testning med den valda testmiljön och callbackflödet i README eller en separat betalningsguide.

Varje punkt ovan blir en liten, fristående commit. Ingen implementation eller migration har gjorts i detta steg.
