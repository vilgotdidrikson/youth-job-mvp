# L13 – intern insamling inför kontoexport

[PR #149](https://github.com/vilgotdidrikson/youth-job-mvp/pull/149), Vilgot / Codex, `codex/l13-export-collection-20261029`. Reserverad offentligt före kodarbete från aktuell dev. L13 är fortsatt **Pågår**.

`lib/server/personal-data-collection.ts` samlar granskningsunderlag från 15 uttryckligt valda relationer. Modulen har `server-only`-gräns och importeras ännu inte av någon sida/API. Ingen export aktiveras, inga paket sparas och inga databas-/RLS-/leverantörsinställningar ändras. Inga nya beroenden.

## Ägarskap och källor

Anrop: `collectPersonalDataForReview(userScopedSupabaseClient, expectedSubjectId, optionalAbortSignal)`. Klienten ska bära begärande användares token, aldrig service-role. `auth.getUser()` kontrollerar verklig kontoidentitet före och efter läsning; fel konto, anonym användare eller försvunnet konto avbryter utan resultat. Förväntat UUID valideras före Auth/läsning. `user_metadata` används inte för behörighet. Detta ersätter **inte** ny autentisering, verifiering av gammal/återkallad session eller behörighetskontroll vid framtida beställning/hämtning.

| Grupp | Källor | Filter |
| --- | --- | --- |
| Konto | profiles, youth_profiles, company_profiles, private_profiles, admin_users | id eller user_id = eget konto |
| Fakturaunderlag | company_billing_details | user_id = eget konto |
| Privat CV-arbete | ai_onboarding_sessions, ai_onboarding_messages | egna youth_user_id-sessioner; meddelanden hämtas per verifierad egen session_id |
| Egen aktivitet | youth_application_drafts, youth_saved_jobs, youth_job_impressions, youth_job_dismissals, swipe_actions, application_workplace_preferences | youth_user_id = eget konto |
| Aviseringar | notifications | user_id = eget konto |

Alla queries har uttryckliga kolumnlistor, ägarfilter och unik stigande UUID-nyckel inom ägarskapet. Arbetsplatspreferenser använder job_id, som är unikt inom youth_user_id; samma gäller visningar/bortval. Ingen profil-/jobb-/kandidatjoin eller generell rå tabell-/Auth-dump. Företagets verifierares user-ID väljs inte. Övriga kolumner i dessa 15 relationer följer den granskade schemabilden; aktuell DevStaging-kolumnmetadata jämfördes före implementation utan att läsa riktiga användarrader.

Meddelandenas föräldrakälla måste ha lästs färdigt; annars blir barnkällan unavailable/dependency_unavailable utan bredare fallback. Även avslutade sessioner och gammalt/avvisat privat CV-arbetsmaterial läses, utan nya AI-anrop. Egen originaltext, svenska tecken, emoji, negationer och egna känsliga uppgifter bevaras. Inga filer eller URL:er hämtas.

## Täckning och granskning

Resultatet är **internt granskningsunderlag**, inte `ExportPackageInput` och inte ett användarutdrag. Alla 24 inventerade kategorier och samtliga 85 relationer redovisas. Relationerna får collected, unavailable med fast felkod eller not_collected. Samtliga kategorier och hela resultatet behåller reviewState=pending. Tomt resultat betyder bara inga synliga rader under aktuell RLS; det bevisar inte att källan saknar uppgifter. Ingen grupp markeras automatiskt ej tillämplig eller fullständigt exporterad.

JSON/fritext, kontaktuppgifter, interna/signerade URL:er, delade snapshots och aviseringar kan innehålla tredje persons uppgifter eller hemligheter. Även egna strukturer kan bära sådant innehåll. Därför ska resultatet aldrig skickas direkt till klient/paketbyggare, loggas eller råsparas. Nästa del behöver uttryckliga granskade projektioner, rättighets-/maskeringsbedömning och behandlingsinformation. Strukturell validering är inget innehålls-/rättighetsgodkännande.

Ansökningar/delningar, AI-bedömningar/historik, företagsjobb, chatt, anställningar, säkerhet, video, behandlingstillstånd, premium, Auth/Storage, externa/lokala källor och konfiguration förblir uttryckligen ej insamlade här. Dessa ska bedömas separat; ingen fullständig export påstås.

## Sidindelning, fel och gränser

Oberoende källor läses i en pool om högst fyra samtidiga anrop; CV-meddelanden väntar på sina egna fullständigt lästa sessioner. Keyset-sidindelning med gt på senaste nyckeln och högst 100 rader/anrop. Insamlingen fortsätter till en **tom** sida även om servern returnerar färre än 100 rader. Detta undviker tyst kapning vid serverns lägre maxgräns. Undantaget är konto-/fakturakällor där både ägarfilter och unik nyckel är samma kolumn: likhetsfiltret låser den enda möjliga raden, så en extra tom läsning behövs inte. Radernas ägare och strängt stigande UUID kontrolleras i varje svar. Främmande rad avbryter hela insamlingen; andra läsfel kastar alla delrader från just den källan och markerar unavailable. Ingen feltext från SDK/leverantör återges eller loggas.

Högst 500 Data API-anrop totalt, 10 000 rader/källa, 50 000 JSON-noder, 24 nivåer och 8 MiB budget för UTF-8-text/nycklar med strukturpåslag. Budgeten gäller även redan förbrukat arbete från senare underkända källor. Den är en bearbetningsgräns, inte ett löfte om exakt serialiserad ZIP-/JSON-storlek; paketbyggaren kontrollerar sina egna slutgränser. Gränsöverskridande ger explicit unavailable/limit_exceeded, aldrig ett kapat collected-resultat.

120 sekunders total väntbudget och valfri avbrytning; Data API får abortsignal. Auth saknar SDK-argument för signal, så väntan avbryts separat och eventuellt senare Auth-svar används inte. Pågående Auth-transport kan avslutas senare. Plain JSON kopieras utan getters/toJSON; oväntade/utelämnade toppkolumner, cykler, glesa/utökade arrayer, prototyper, symboler, ogiltig Unicode och icke JSON-tal/typer avvisas. Proxytraps är inte en exekveringssandbox; indata kommer från den betrodda SDK:ns JSON-svar.

Läsningarna är uttryckligen **non_transactional**: samtidiga ändringar kan ändra värden eller lägga till/ta bort rader mellan sidor. Insättning med UUID före redan passerad cursor kan missas. Slutlig Auth-kontroll är inte dataversionering/snapshotisolering. Den framtida exporten måste hantera detta och samtidiga rättelser/kontoradering före aktivering.

## Verifiering

`npm run test:personal-data-collection`: 45 lokala kontroller med simulerad Auth/Data API, inklusive installerad Supabase-SDK mot simulerad HTTP-transport. Separat kontraktskontroll jämför ägar-/nyckelkolumner och explicit projektion med inventeringen. 1 005 poster med servergräns sju rader hämtas i 145 anrop utan förlust. Proven omfattar fler egna/annan persons CV-session, sidfel utan delresultat, obehörig/försvunnen/bytt identitet, främmande rad, fel svar/ordning/kolumner, JSON-fällor, bevarad egen text, budgetar och avbruten/hängande Auth.

Repetition av verkligt DevStaging-prov: `MNW_COLLECTION_ANON_KEY=<publik dev-nyckel> npm run test:personal-data-collection:staging`. Skriptet är låst till DevStaging/dev-webbplatsen, skapar tre fiktiva konton (två ungdomar, ett företag), egna privata CV-sessioner/105+1 meddelanden och privat fakturaunderlag via befintlig RPC. Lösenord/token stannar i minnet. Kontona raderas via egen konto-API i finally; kvarvarande fixture-ID:n rapporteras utan credentials. Inga service-role-nycklar, direkt Auth-SQL, adminmedlemskap, riktiga jobb eller AI-anrop används. Resultat från den aktuella körningen följer nedan.

### Faktiskt liveprov 2026-10-29

Slutkörning `qa-l13-collection-1793263031183-75541692`: **36 kontroller passerar**, båda ungdomarna och företaget. Faktisk Auth/Data API/RLS och befintlig faktura-RPC; inget HTTP-/Auth-/databasmock i detta prov. Alla 15 valda källor lästes utan unavailable; 105 respektive ett eget privat CV-meddelande, ingen annan ungdoms meddelanden, inget ungdomsunderlag i företagets insamling, eget fakturaunderlag enbart hos företaget. Fel förväntat konto och anonym insamling nekades; direkt förfrågan med känd främmande session gav noll meddelanden. Insamlingarna tog cirka 53/44/29 sekunder i denna miljö. Detta är ingen generell prestandagaranti.

Alla tre slutkonton raderades via egen konto-API, exit 0. Separat SQL-efterkontroll visar **0 QA-konton, 0 QA-meddelanden och 0 QA-fakturaunderlag**. Inga kvarvarande fixture-ID:n. Tre tidigare försök är inte godkända liveprov: första fixture-RPC:n använde fel initialversionsvärde (rättat till null), därefter stoppade 60-sekundersgränsen två sekventiella insamlingar vid långsamma nätverkssvar. Även de nio tidigare kontona städades via konto-API. Felet ledde till fyra samtidiga källor, färre redundanta kontoqueries, separat avbrytning av Auth-väntan och 120 sekunders totalbudget; ägar-/granskningsgränserna bevarades. Slutprovet ovan kör hela den ändrade insamlingen.

Paketets 76 och inventeringens 21 regressioner, riktad ESLint utan fel/varningar, TypeScript, diff-check och standardproduktionsbygge/57 routes passerar med fiktiva publika byggvärden. Befintlig metadataBase-varning kvarstår. Verifieringen gäller denna interna insamling, inte fullständigt registerutdrag, transaktionssnapshot, ny lösenordsverifiering, gammal sessions revokering, nedladdning, paketfrist/gallring eller en aktiverad användarfunktion. De delarna och L13:s rättighets-/verksamhetsbeslut kvarstår.


## Fortsättning – ansökningar och gemensamma konversationer (#150)

Insamlingen omfattar nu 22 uttryckligt valda relationer. Tillkomna källor:

| Källor | Avgränsning |
| --- | --- |
| application_completions, application_followups | ungdomens egna svar och ansökningshistorik, även återkallade ansökningar |
| company_interest_actions, matches, conversations, employment_records | eget konto som ungdom eller företag i respektive rad |
| messages | enbart fullständigt insamlade egna konversationer, med avsändare bland konversationens två deltagare |

Alla sidors deltagarfilter bevaras. Föräldrafel blockerar meddelandeläsning; fel i en senare konversation kastar hela meddelandekällans delresultat. Dubbla meddelande-ID:n över olika konversationer avvisas. Inga främmande profiler hämtas. Interna analyshashar, request_key, asked_by och hired_by_user_id väljs inte. Gemensam fritext förblir internt underlag med pending-granskning, inte ett godkänt användarutdrag. Filer och video hämtas inte.

70 lokala insamlingskontroller passerar, inklusive båda deltagarrollerna, 1 005 matchningar med korta serversidor, 106 meddelanden över två egna konversationer, felaktig avsändare/konversation, föräldrafel och senare sidfel. Installerad Supabase-SDK verifierar OR-filtrets faktiska HTTP-serialisering mot simulerad transport. Tidigare liveprov för #149 gäller dess 15 källor; denna utökning har ännu inget liveprov med rekryterings-/chattfixtures. Ingen ny databas, RLS, publik endpoint, paketlagring eller AI-användning införs. Återstående insamling, innehållsgranskning, snapshotkonsistens, autentisering, nedladdning och gallring kvarstår.
