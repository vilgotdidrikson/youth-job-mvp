# L13 – aktiv session vid export

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-active-export-session-20261030`
- Reservation publicerad före kodarbete i `73e83c8`, från dev efter PR #162. Öppna PR:er kontrollerade.

## Problem och beteende

En giltig JWT-signatur och lyckad getUser innebär inte ensamt att sessionen fortfarande finns efter utloggning. Supabase beskriver kontroll av JWT-claimen session_id mot auth.sessions för särskilt känsliga åtgärder: https://supabase.com/docs/guides/auth/sessions#how-to-ensure-an-access-token-jwt-cannot-be-used-after-a-user-signs-out.

`verifyPersonalDataSession` verifierar ursprungstokens signatur/utgång med installerad SDK, aktuell kontoidentitet och en kontoägd aktiv sessionsrad. Den körs obligatoriskt före lösenordsverifiering och efter insamlingen i `preparePersonalDataReview`. Sena indragningar eller byten av session gör att hela underlaget kastas. Fel/cancel ger inget partiellt resultat. Resultatet innehåller bara sessionId som intern bindning, aldrig token.

Anroparen måste skapa userClient med samma requesttoken som lämnas i accessToken och en separat serverklient sessionClient. Privat historikinsamling via reviewClient är fortfarande valfri och separat. Auth-metoderna får explicit tokenargument; inget cachat getSession eller osignerad JWT-avkodning används. Samtliga kontroller delar en tiosekunders väntbudget per kontroll och den yttre insamlingens avbrytningssignal. Sena Auth-svar används inte.

## Databasgräns

Migration `20261030122406_l13_export_session_guard.sql` är införd i DevStaging. CLI-genererad fil har synkats med migrationshistoriens faktiska version. Inga tabeller, kolumner, ägarrelationer eller buckets har ändrats; kataloginventeringen behöver därför ingen ny klassificering.

Den publika RPC:n är SECURITY INVOKER med tom search_path och bara service_role får köra. Den anropar en fast privat SECURITY DEFINER-funktion, eftersom service_role uttryckligen saknar SELECT på auth.sessions. Ingen bred läsrätt till Auth tilldelas. Den privata funktionen är också spärrad för PUBLIC/anon/authenticated och kontrollerar verklig databasroll, inte JWT-rolltext. Den lämnar endast boolean för ID + användar-ID + not_after. Inga sessionsrader, refresh-token, IP-adresser eller andra Auth-fält lämnas ut. Den signerade tokenkontrollen och aktuella identiteten sker först på servern; RPC:n ersätter dem inte.

## Faktisk verifiering

- `test:personal-data-session`: 37 lokala kontroller. Anropsordning, fel konto/claim/roll/expiry, återkallad session, falska RPC-svar, driftfel, klientseparation, avbrott och sena svar. Installerad SDK verifierar verklig lokalt skapad ES256-signatur; fel signatur och utgången signerad token nekas. HTTP/Auth/RPC i dessa prov är simulerade, inga riktiga inloggningar görs.
- `test:personal-data-review`: 19 kontroller, inklusive återkallelse efter insamling, sessionsbyte och verkliga hjälpfunktioner tillsammans med simulerad Auth/Data/Storage.
- Regressioner: 120 insamlings-, 24 lösenordsverifierings-, 41 strukturerade export- och 39 granskningspaketkontroller passerar. Totalt 280 lokala kontroller.
- `scripts/test-export-session-guard.sql` passerar både med DDL i rollbacktransaktion före införande och mot den införda RPC:n i DevStaging. Faktiska databasroller/ACL, förfalskad rollclaim, egen/främmande/saknad/utgången/borttagen session, null-inmatning, borttaget konto och utebliven rå Auth-läsrätt kontrolleras.
- QA-identiteter och sessionsrader skapas endast inuti rollbacktransaktionen, utan lösenord, refresh-token eller signerade JWT. Efterkontroll: noll QA-identiteter kvar.
- Säkerhetsadvisories är identiska före/efter när observationstid undantas. Ingen ny anmärkning. Befintliga fem grupper är oförändrade.
- TypeScript och riktad ESLint passerar. Diff-check och Vercel-status följs före merge.

## Begränsningar

Kontrollen visar aktuell sessionsförekomst och not_after vid kontrollögonblicket. Den ger inget varaktigt nedladdningstillstånd, ingen snapshotisolering och ingen atomär spärr för en utloggning som sker efter sista kontrollen. Framtida leverans måste verifiera session/identitet igen precis före hämtning. Global inaktivitetstid och inställningar som tillämpas vid nästa tokenförnyelse omtolkas inte av denna funktion.

Ingen publik exportendpoint, faktisk Auth-inloggning/utloggning över HTTP, klientnedladdning eller nytt lagrings-/gallringsflöde verifieras här. Fullständigt innehåll, kort paketfrist och säker leverans återstår. Befintlig kontoradering ändras inte. Ingen AI eller produktion.

Leveranschecklistan finns här och i PR; den globala åtgärdsplanen är byteidentisk. L13 är inte Klar.
