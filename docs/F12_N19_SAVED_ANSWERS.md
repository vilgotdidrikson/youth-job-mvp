# F12/N19 – sparade kompletteringssvar i profilen

- Status: För granskning (leveransen), huvudkorten F12 och N19 förblir Pågår
- Ansvarig: Vilgot / Claude
- Branch: `claude/f12-n19-saved-answers-20261112`, reservation `1b53468` publicerad före kodarbete, kod `fbeced8`
- Bas: dev `6179fb7`; öppna PR:er kontrollerade (endast äldre #40)

## Vad som levereras

Beslutet 2026-10-20 och samordningen 2026-11-09: ett kompletteringssvar får återanvändas i profilen först efter ett separat aktivt val.

- Under ett besvarat kompletteringssvar i Ansökningar visas frågan ”Vill du spara det här svaret i din profil så att det kan återanvändas i framtida ansökningar?” med valen **Ja, spara i min profil** och **Nej, bara för den här ansökan**. Inget är förvalt. Nej eller inget val sparar ingenting, och svaret i den aktuella ansökan påverkas inte.
- Ja öppnar uppgiften för granskning och rättelse i samma kort innan den sparas. Högst 600 tecken, högst åtta sparade svar.
- Svar om arbetstider, tillgänglighet och startdatum erbjuds inte. De är tidsbundna och hålls aktuella under ”När jag kan jobba”.
- I Din jobbprofil finns avsnittet **Sparade svar** med fråga, datum, Ändra och Ta bort. Det visas bara när något är sparat.
- Ett nej kommer ihåg per konto i webbläsaren så att frågan inte upprepas. Det är en bekvämlighet, inte lagrad persondata på servern.

## Hur uppgiften används

- Lagring: valfri femte del `savedAnswers` i befintlig `youth_profiles.recruitment_profile`. Ingen ny tabell, kolumn eller bucket. Befintlig versionskontroll (PT409), CHECK-villkor, RLS, export och kontoradering gäller oförändrat.
- Matchning: endast den sparade texten läggs i matchningsunderlaget som ”Sparad egen uppgift från tidigare komplettering”, genom samma lokala minimering som övrig profiltext. Ursprungsfrågan och källan (annons-ID) skickas aldrig vidare.
- Delning: den sparade uppgiften är ett valbart tillägg i delningsförhandsvisningen (”Sparad egen uppgift – självuppgiven”), precis som egna exempel. Inget delas som standard. Ett belägg från en ej delad uppgift visas inte för företaget.
- Skickade ansökningar och grund-CV:t ändras inte. Ändrad eller borttagen uppgift ändrar källtoken, så ett gammalt delningsgodkännande kan inte återanvändas.

## Migration

`supabase/migrations/20261112150000_f12_n19_saved_profile_answers.sql`. Införd i DevStaging av Vilgot 2026-11-12 och därefter kontrollerad med liveprovet nedan.

- Ny validator `public.valid_saved_profile_answers(jsonb)` (inte anropbar för anon).
- Tre befintliga funktioner patchas med samma mönster som N17: `public.valid_recruitment_profile`, `public.save_my_recruitment_profile` och `private.build_application_disclosure`. Varje patch stoppar med fel om den aktuella definitionen inte innehåller väntad text eller redan är patchad.
- Inga tabeller, kolumner, policys, buckets eller behörigheter på befintliga objekt ändras. `check:personal-data-inventory` behöver därför ingen ny källa; kontrollera ändå en färsk metadatafil efter införandet enligt `docs/L13_EXPORT_INVENTORY.md`.
- Före migrationen ger Ja ett vanligt felmeddelande och inget sparas. PR:en ska därför införas i dev först när migrationen finns i DevStaging.

## Faktiskt körda kontroller

- `test:saved-answers:postgres`: 39 kontroller i verklig lokal PostgreSQL (PGlite 0.5.16). Basfunktionerna hämtas ordagrant ur repots migrationer, därefter körs den nya migrationen. Kontrollerar att delningsfunktionen bara skiljer sig med den nya slingan, att en andra körning stoppar, bevarad ACL, giltiga och 11 ogiltiga former, bevarade gränser för övriga delar, ägarens sparning med versionsökning, PT409 vid gammal version, nekat företagskonto, CHECK-villkor vid direkt skrivning, RLS mot annan ungdom, valbar delning utan fråga/källa, ingen delning som standard, ändrad källtoken, undanhållen text med bostadsadress och borttagen uppgift.
- `test:saved-answers`: 36 kontroller av de delade modulerna med kontrollerad Supabase-transport: profilmodell, regler för erbjudande, ersättning av samma svar, gräns, intern matchningstext, ej delad kontra delad uppgift i företagsbedömningen samt versionsbunden skrivning, kontobyte, konflikt, serverfel och misslyckad läsning.
- Regressioner som passerar: profile-journey, application-disclosure, disclosure-loading, application-supplement, supplement-recovery, matching-fairness, followup-batch, assessment-progress, recruitment, application-withdrawal och personal-data-inventory.
- TypeScript utan fel, riktad ESLint utan nya fel och standardproduktionsbygge passerar (fiktiva publika Supabase-byggvärden).

## Verkligt prov i DevStaging 2026-11-12

`npm run test:live-saved-answers` med publik DevStaging-nyckel: **9 verkliga kontroller**, exit 0, `remainingFixtureIds=[]`. Ett tillfälligt fiktivt ungdomskonto, inget företag och ingen AI. Verklig Auth och RPC: sparad uppgift med versionsökning, PT409 vid gammal version, sex ogiltiga former och okänd sektion nekas med 22023, annan profildel bevarar sparade svar, ogiltig direktskrivning nekas av databasen och borttagning lämnar övrig profil orörd. Kontot raderades via eget konto-API.

## Begränsningar och det som återstår

- Liveprovet täcker sparning och validering för ungdomskontot. Delningsvalet för en sparad uppgift (kräver verifierat QA-företag och annons) är bara kört i lokal PostgreSQL och ingår i [L17](ATGARDSPLAN.md#l17).
- Ingen inloggad webb- eller mobilkontroll av valet, granskningen eller profilavsnittet. Komponenterna är inte körda i webbläsare.
- Ingen verklig modellkörning: att en sparad uppgift faktiskt minskar följdfrågor i ansökan B är bara visat genom att texten ingår i matchningsunderlaget.
- Tre befintliga tester faller oberoende av leveransen: `test:profile-steps` (förväntar äldre felkodstext i redigeraren, rad som inte ändrats här), `test:matching` (kräver lokal fixtur `/tmp/mnw-qa-cv.pdf`) och `test:accessibility` (känd förväntan på företagsflikar).
- `check:design-tokens` jämför filsökvägar med snedstreck och faller därför på Windows oavsett ändring. Leveransen lägger bara till tokenreferenser.
- Befintligt lintfel för setState i effekt i `recruitment-profile-editor.tsx` finns kvar från dev.
- Heuristiken för tidsbundna svar är ordbaserad och kan missa ovanliga formuleringar. Ungdomen granskar alltid texten före sparning.
