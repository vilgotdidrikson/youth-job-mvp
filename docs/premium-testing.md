# Testa premium manuellt

## Kontrollerat nuläge 2026-10-07 (DEV)

- Fyra RLS-skyddade tabeller finns i den aktiva databasen: produkter, order,
  tidsbegränsade rättigheter och aktiveringshändelser.
- Produkten `job_boost_7d` är aktiv och ger sju dagars annonsboost.
- `activate_premium` och `end_premium` får endast anropas med service role.
  De kontrollerar ägarskap, produkt och livscykel och har idempotenta återförsök.
  Flera boosts köas efter varandra. Avslut och annonsradering bevarar historiken.
- `premium_effective_boosts` räknar aktuell effekt från start/sluttid. Den lämnar
  bara annons-ID och boostflagga för annonser som anroparen får läsa: egna
  annonser eller publicerade aktiva annonser. Premiumorder och historik förblir privata.
- Klienten visar ”Framhävd annons” och prioriterar boostade jobb i det filtrerade
  jobbflödet. Ingen klient kan själv tilldela premium.
- Det finns serververktyg och stagingtest för aktivering/avslut. Något nytt
  skrivande test av premiumaktivering kördes inte i denna granskning.
- Betalning, fakturahantering, checkout, webhook, abonnemang och köp-/adminvy
  är inte implementerade. Ordertabellen är ett leveransunderlag, inte ett kvitto.
- Alla företag kan nu ha flera aktiva annonser; det kräver inte premium.

Databasrådgivaren markerar avsiktliga SECURITY DEFINER-RPC:er och service-only
tabeller utan klientpolicy. Dessa är granskningspunkter, inte en genomförd
fullständig säkerhetsrevision. Lösenordsskydd mot kända läckor är avstängt i DEV:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Premium är frikopplat från betalning och aktiveras endast av
activate_premium, som kräver Supabase service role. Använd aldrig
service-role-nyckeln i browsern eller i en NEXT_PUBLIC_-variabel.

## Förutsättningar

1. Kör migreringarna, inklusive
   supabase/migrations/20260928090000_add_premium_backend.sql.
2. Använd ett test- eller stagingprojekt med en befintlig användare med
   profiles.role = company och ett ägt jobb med job_kind = employment.
   Jobbet får vara active eller paused, men inte closed.
3. Sätt SUPABASE_SERVICE_ROLE_KEY endast i den lokala servermiljön.
   .env.local är gitignorerad.

## Aktivera en testboost

~~~bash
node --env-file=.env.local scripts/manage-premium.mjs grant \
  <company-user-id> \
  <job-id> \
  test-support-001
~~~

Kommandot använder den serverdefinierade produkten job_boost_7d och köar
den efter en eventuell befintlig boost för samma jobb. Ange ett annat aktivt
produktkodvärde som fjärde argument om en sådan har lagts till i migration eller
via en godkänd serverprocess.

Spara entitlement-ID:t i svaret. Samma stabila source_reference ska inte
användas för ett nytt köp; den behandlas som en idempotent återkörning.

## Avsluta en testboost

~~~bash
node --env-file=.env.local scripts/manage-premium.mjs end \
  <entitlement-id> \
  test_cleanup \
  test-support-001-end
~~~

Avslut är också idempotent när samma anropsreferens återanvänds.

## Stagingtester

För den skrivande integrationskontrollen skapar man en separat
.env.premium med enbart disposable stagingdata:

~~~text
PREMIUM_TEST_SUPABASE_URL=https://...
PREMIUM_TEST_SERVICE_ROLE_KEY=...
PREMIUM_TEST_COMPANY_ID=...
PREMIUM_TEST_JOB_ID=...
PREMIUM_TEST_ALLOW_WRITES=true
~~~

Kör sedan:

~~~bash
npm run test:premium:staging
~~~

Testet kontrollerar aktivering, idempotent återkörning, effektiv boost,
tidsutgång och idempotent avslut. Det avaktiverar sin temporära testprodukt
efteråt men lämnar revisionsrader i staging.

För RLS-täckning kan RLS_TEST_PREMIUM_ORDER_ID läggas till i den befintliga
.env.rls; då kontrollerar npm run test:rls:staging att bara ägande företag kan
läsa sin premiumorder.

