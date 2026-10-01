# Kontoradering och datalagring

Självbetjänad radering sker i `app/api/account/route.ts`. Den kräver giltig
session och lösenord. Därefter körs stegen i den här ordningen:

1. Adminkonton nekas (409). En admin måste först tas bort ur `admin_users`
   av en annan administratör. Plattformen kan då aldrig tappa sin sista admin.
2. Mottagare av notisen "chatt stängd" hämtas.
3. Storage-filer under `{userId}/` raderas i `youth-documents` och `job-images`.
   Misslyckas det avbryts raderingen och kontot finns kvar.
4. `auth.admin.deleteUser` körs. Resten sker via FK-kaskader i databasen.
5. Motparter i chattar får en `account_deleted`-notis.

Raderingen är inte atomär. Om steg 3 lyckas men steg 4 misslyckas finns kontot
kvar utan filer. Ett nytt försök är säkert eftersom alla steg är idempotenta.
Ordningen är vald så att filer aldrig blir kvar utan ägare (fail closed).

## Princip

- Personuppgifter och användarens innehåll raderas, inte anonymiseras.
  Det gäller även data som delas med en motpart (matchningar, chattar).
  Arbetsgivare ansvarar själva för sina rekryteringsunderlag utanför Employo.
- Undantag, enligt berättigat intresse och rättsliga anspråk (GDPR art. 6.1 f,
  17.3 e): modereringsärenden med bevis behålls tidsbegränsat, och
  premiumhistorik behålls anonymiserad.

## Datakarta

| Data | Vid radering | Motivering |
|---|---|---|
| `profiles`, `youth_profiles`, `company_profiles`, `private_profiles`, `youth_cv_profiles` | Raderas (CASCADE) | Användarens egna uppgifter |
| `ai_onboarding_sessions`, `ai_onboarding_messages` | Raderas (CASCADE) | CV-underlag. OpenAI anropas med `store: false`, och leverantörens egna missbruksloggar ligger utanför Employo |
| `jobs` | Företagets annonser raderas (CASCADE) | Annonser utan arbetsgivare ska inte visas |
| `swipe_actions`, `youth_saved_jobs`, `youth_application_drafts` | Raderas när ungdomen **eller** jobbet raderas | Ansökningsdata utan motpart har inget syfte |
| `company_interest_actions` | Raderas via ungdom, företag eller jobb | Som ovan |
| `matches` (även `hired`) | Raderas när någon part eller jobbet raderas. `hired_by_user_id` blir NULL | Dataminimering. Branschpraxis för jobbplattformar |
| `conversations`, `messages` | Raderas med matchningen | Motparten får notis om att chatten stängts |
| `moderation_reports` | Behålls. `reporter_user_id` och `reviewed_by_user_id` blir NULL. Det anmälda innehållet finns kvar i `target_snapshot` | Säkerhet på en plattform med minderåriga. En anmäld användare ska inte kunna radera bevisen |
| `company_profiles.verified_by_user_id` | Blir NULL när granskande admin raderas. Företaget förblir verifierat | Revisionsspår utan personkoppling |
| `admin_users` | Raderas (CASCADE). Självbetjäning är spärrad för admins | Privilegierade konton avvecklas av någon annan |
| `premium_orders`, `premium_entitlements` | Behålls. `company_user_id` och `job_id` blir NULL. Status sätts till `cancelled` | Anonymiserad leveranshistorik. Ingen betalning är implementerad |
| `premium_activation_events` | Behålls (ingen användarkoppling) | Idempotens och revision |
| `notifications` | Användarens egna raderas. Motparters notiser är generiska och behålls | Innehåller inga personuppgifter |
| `api_rate_limits` | Raderas (CASCADE) | |
| Storage `youth-documents`, `job-images` | Raderas av routen före auth-användaren | `job-images` är publik och kan ligga kvar i CDN-cache i upp till 1 timme |
| `auth.*` (sessioner, identiteter) | Raderas av Supabase Auth | |

## Gallring av modereringsärenden

Avslutade ärenden (`resolved`, `dismissed`) sparas i 12 månader från
`reviewed_at`. Därefter raderas de av `public.purge_closed_moderation_reports()`,
som endast service role får köra. Öppna ärenden gallras inte.

**Releasekrav:** schemalägg gallringen före produktion, till exempel med
pg_cron i Supabase:

```sql
select cron.schedule(
  'purge-closed-moderation-reports',
  '0 3 1 * *',
  $$select public.purge_closed_moderation_reports()$$
);
```

## Staging-test

`scripts/test-staging-account-deletion.mjs` skapar egna engångskonton (admin,
företag, ungdom och en utomstående ungdom) och bygger hela datagrafen:
verifiering, jobb, filer, swipe, sparat jobb, utkast, match, chatt, anställning,
anmälan och premium. Därefter raderas kontona via den deployade `/api/account`
och datakartan ovan kontrolleras. Skriptet kör bara mot DevStaging och städar
alltid upp efter sig.

1. Applicera migrationerna och deploya appen till dev-miljön.
2. Kopiera `scripts/account-deletion-staging.env.example` till
   `.env.deletion` (gitignorerad) och fyll i staging-nycklarna.
3. Kör `npm run test:deletion:staging`.

Fall som täcks:

- En admin som försöker radera sig själv nekas. Efter avveckling kan kontot
  raderas, och verifierade företag och ärenden tappar granskarreferensen utan
  att FK:n pekar på en raderad användare.
- När en ungdom raderas försvinner profil, swipes, anställd match, chatt och
  filer. Anmälan behålls anonymt med bevis, och företaget får notis.
- När ett företag raderas försvinner annonser och bilder, och andra ungdomars
  swipes, sparade jobb och utkast. Premium avslutas och anonymiseras.
- Korsfall: en utomstående ungdom behåller sitt konto och sin profil.
