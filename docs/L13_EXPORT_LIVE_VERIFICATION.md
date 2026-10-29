# L13 – verifiering av utökad insamling

Reservation före arbete 2026-10-29: Vilgot / Codex, `codex/l13-live-collection-20261029`, från dev be4bdc8. Aktuell dev och öppna PR:er kontrollerade. Verifiera den utökade interna insamlingen med fiktiva dev-konton och egna/främmande annonsutkast, kravprofiler och versionshistorik. Återanvänd Auth/Data API/RLS och befintlig kontoradering. Inga riktiga rekryteringar, AI-anrop, betalningar eller privilegieutökningar. Redovisa verkliga resultat och städning; saknade källor eller fixtures blir inte godkänd fullständig export. L13 fortsatt Pågår.


## Faktiskt genomfört 2026-10-29

`qa-l13-collection-1793267149923-84578443`: **96 livekontroller passerar**, exit 0. `npm run test:personal-data-collection:staging` med publik DevStaging-nyckel, riktig Auth, Data API, befintlig RLS, profilhistoriktriggers, faktura-RPC och egen konto-API. Inget Auth-/HTTP-/databasmock, service-role, direkt skrivning till Auth, adminmedlemskap, nya behörigheter eller AI-anrop användes.

Fyra fiktiva konton: två ungdomar och två företag. Ungdomarna hade 105 respektive ett privat CV-meddelande. Företagen hade separat fakturaunderlag, privata företagsmatchprofiler och totalt tre opublicerade/inaktiva testannonser. Det första företaget hade två annonser och tolv historiksnapshots, det andra en annons med en snapshot. Elva versioner skapades genom normala uppdateringar av den första annonsprofilen, inte direkt skrivning till historiktabellen.

- Alla 34 valda relationer gav collected utan unavailable för varje konto. Samtliga 24 kategorier och 85 inventerade relationer behöll sin uttryckliga täcknings-/granskningsredovisning. Detta betyder inte att alla 85 relationer exporterats.
- Egna originaltexter, svenska tecken och negationer bevarades. Företag fick inte ungdomarnas privata CV-arbete. Ungdom fick inget fakturaunderlag, inga företagsutkast och inga interna annonsprofiler/historik.
- Båda företagen fick bara sina egna fakturor, matchprofiler, annonser, annonsprofiler och historiska snapshots. Versionerna 1–11 kom i numerisk ordning; version 1 för en annan egen annons bevarades separat.
- Direkta förfrågningar med känt främmande annons-ID gav noll rader för jobs, job_match_profiles och job_match_profile_versions, för båda rollerna. Känt främmande privat CV-session-ID gav också noll meddelanden.
- Fel förväntat konto nekades före insamling för alla fyra. Anonym insamling nekades.

Insamlingarna tog cirka 30/71 sekunder för ungdomarna och 105/85 sekunder för företagen i denna miljö. Flera nätverkssvar var långsamma. Detta är ingen generell prestandagaranti eller fullständighets-/snapshotgaranti. Befintlig 120-sekundersgräns behölls; ingen budget eller behörighet höjdes för att få provet godkänt.

## Städning och lokal kontroll

Samtliga fyra konton raderades via egen konto-API i finally; remainingFixtureIds var tom. Separat SQL-efterkontroll visar noll Auth-konton för körningsprefixet, noll testannonser och noll kvarvarande QA-historiksnapshots eller QA-CV-meddelanden. Inga riktiga rekryteringar eller publicerade jobb användes. Konto-/jobb-/CV-/fakturaunderlag skapades enbart för detta prov och återanvänds inte.

Riktad ESLint, Node-syntaxkontroll och diff-check passerar för det utökade liveprovet. Ingen produktkod eller beroende ändrades i denna leverans, så ett nytt lokalt produktionsbygge upprepades inte. De tidigare 206 lokala kontrollerna från #152 är inte en ny livekörning. Vercel-byggkontroller redovisas separat vid publiceringen.

## Kvarstående verifiering

En tom läsning av en vald källa betyder fortfarande endast inga synliga rader under aktuell RLS. Positiva fixtures finns i detta prov för konto/faktura/privat CV/företagsmatchprofil/annonser/kravprofiler/historik, inte för alla 34 relationer. Positiva livefall för gemensam chatt/ansökningar/anställning, video, premium och rapport-/blockuppgifter återstår. Inga betalnings- eller rekryteringshändelser aktiverades för att fylla dessa tabeller.

Privata delningsunderlag, historiska AI-bedömningar, Auth/Storage/legacy och externa/lokala källor, innehålls-/rättighetsgranskning, konsistens vid samtidiga ändringar, ny autentisering, säker nedladdning och paketgallring återstår före aktivering. L13 är fortsatt Pågår. Detta prov aktiverar ingen användarexport och verifierar inte ett komplett registerutdrag.
