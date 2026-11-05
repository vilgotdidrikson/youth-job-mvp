# L09/N19 – faktisk företagsdelning

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/l09-n19-sharing-acceptance-20261105`
- Bas: dev `ed9d908`; öppna PR:er kontrollerade (endast äldre #40).
- Leverans: [PR #178](https://github.com/vilgotdidrikson/youth-job-mvp/pull/178). Offentlig reservation `a80d1e6` före kodarbete.
- Reservation före kodarbete 2026-11-05. Fortsätter pågående L09/N19: privat PDF före match, exakt delad version vid profilbyte/uttrycklig uppdatering, fel jobb/företag/anonym och återkallelse. Verklig Auth/Storage/HTTP och driftsatt mobil-/datorvy, fiktiva tillfälliga QA-identiteter med efterstädning. Ingen AI-bedömning eller ändrade säkerhetsregler. Testets jobb har endast utkast till kravprofil för att inte bli berättigade till automatisk analys.

Tidigare blockerare var en overifierad QA-arbetsgivare. Förberedelsen måste använda normala verifieringskontroller och lämna noll tillfälliga adminmedlemskap. Ingen verklig arbetsgivare eller rekrytering används. Hela L09/N19 markeras inte Klar utan kvarvarande acceptans.

## Reproducerat fel och rättning

Verklig HTTP-körning `qa-cv-sharing-1793884391403-d76640f9` nådde 22 kontroller: positiv PDF-åtkomst före match, samma filbytes, nekade främmande roller/jobb och bevarad delad A efter profilbyte till B. Provet stoppades när ett gammalt källtoken inte gav den förväntade felkoden. Databasloggen visade upprepade ”Profilen har ändrats. Läs förhandsvisningen igen.” från samma begäran. Körningen är ett reproducerat fel, inte ett helt godkänt acceptansprov. Alla fyra konton raderades.

N19:s permanenta versionskonflikter använde SQLSTATE 40001, vilket i PostgREST kan utlösa en intern återförsöksloop. Både `private.save_my_application_disclosure` och triggerfunktionen `private.snapshot_application_disclosure` använder nu PT409/HTTP 409 för denna affärskonflikt. Användaren måste läsa om förhandsvisningen och godkänna aktuell profil; ingen automatisk omsändning läggs till. Ägar-/källtokenkontroll, advisory-/radlås, funktionssignaturer och övriga beteenden bevaras.

Migration `20261105132128_n19_disclosure_http_conflicts.sql` är införd enbart i DevStaging. Filen skapades med Supabase CLI och fick därefter samma version som den verkliga fjärrhistoriken. Ett före/efter-prov i rollback jämförde pg_get_functiondef, OID, ägare, ACL, search_path och SECURITY DEFINER: exakt två felkoder ändrades, inget annat. Ingen tabell, kolumn, bucket, policy eller triggerkoppling ändras. Separat kontroll fann inga kvarvarande aktiva backendanrop för denna RPC efter det misslyckade provets städning; inga andras sessioner avbröts.

Källa: [Supabase om 40001 och oändliga RPC-återförsök](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Samma PT409-mönster finns redan för moderering i projektet. Andra versionerade RPC:er med 40001 finns kvar och ingår inte i denna avgränsade N19-rättning.

## Testprotokoll

`MNW_CV_ANON_KEY=<publik dev-nyckel> MNW_CV_CHROMIUM=<Chromium> npm run test:live-cv-sharing` är låst till dev-projekt och dev-app. Använder verkliga produktfunktioner för PDF/uppladdning/profilsparning med testkontots riktiga SDK; Auth/Data/Storage/HTTP mockas inte. Playwright hämtas ur testmiljön, inte som ny appdependency.

Skriptet skapar två ungdomar, två företag och två tydligt fiktiva annonser. Kravprofiler har status draft för att hålla automatisk analys obehörig. Checkpoint `/tmp/mnw-cv-sharing-fixtures.json` innehåller bara fiktiva ID:n/sökvägar. En behörig operatör måste verifiera rätt QA-arbetsgivare innan den tidsbegränsade handskakningen `/tmp/mnw-cv-sharing-seeded.json` får verified=true med exakt prefix. Utebliven förberedelse ger felkod. Lösenord och token finns bara i minnet. Slutligen raderas kontona via det egna konto-API:t; kvarvarande ID ger felkod och kräver efterstädning.

Under denna körning användes normala review_company_verification med exakt identitets-/tids-/draftkontroll. Ett tillfälligt QA-granskarmedlemskap skapades och raderades atomiskt i samma transaktion. Ingen annan session kunde se det som ett committat medlemskap. Båda företagen verifierades i det slutliga provet, så fel-företag-kontrollen begränsas inte till en overifierad angripare.

Lokalt: test:application-disclosure, test:disclosure-loading och test:cv-document passerar; riktad ESLint, Node-syntax och diff-check passerar. Det historiska verify-n19-staging.sql lämnas oförändrat med sina gamla hårdkodade QA-identiteter och sin äldre förväntan på 40001; det är inte ett aktuellt fullständigt acceptansprov mot denna ändring. Det nya isolerade liveprovet kontrollerar i stället faktisk PT409/HTTP 409, återställd ansökan och oförändrad delningsversion. Säkerhetsrådgivare före/efter: fem befintliga notiser, inga nya. Ingen ny produktionsbyggnad behövs lokalt för en ren SQL-/test-/dokumentändring; Vercels PR- och dev-byggen följs separat.

## Slutresultat 2026-11-05

`qa-cv-sharing-1793885198588-60e6499b` passerade **42 verkliga kontroller**, exit 0, remainingFixtureIds=[].

- Förhandsvisad PDF A kan läsas före match av rätt verifierat företag med identisk SHA-256. Fel jobb, annan verifierad arbetsgivare, annan ungdom, fel ungdoms-ID och anonym nekas. Ovalt motivationsfält visas inte i företagsunderlaget.
- Profilbyte till B bevarar A för redan skickad ansökan. B kan inte signeras av företaget före uttrycklig uppdatering. Gammalt godkännande ger PT409/HTTP 409 inom 15 sekunder och ändrar varken revision eller delad fil.
- Äldre sändningsväg genom prepare_my_application/trigger ger också PT409/HTTP 409 inom 15 sekunder. Den påbörjade andra ansökan rullas tillbaka; ingen application_completions-rad lämnas kvar.
- Raderad delad A ger HTTP 404; ingen fallback till privat B. Ny uttrycklig förhandsvisning/godkännande byter fil och höjer delningsversionen. Därefter hämtar företaget exakt B.
- Verklig UI-inloggning som företag, delningsversion och filöppning på 375/1280 px. Samma PDF-bytes, inget horisontellt dokumentspill och inget ovalt motivationsfält. Byte till annons utan skickad ansökan rensar underlaget. Båda skärmbilderna har granskats visuellt: läsbara rubriker, fakta och CV-kontroller. Inga browseranrop till AI-bedömning observerades.
- Verklig återkallelse stoppar ny auktorisering via kandidat-CV-endpointen och ny Storage-signering. Detta provar nya anrop; det återkallar inte redan utfärdade signerade URL:er eller hämtade filbytes.

Efterstädning: samtliga fyra konton raderade via eget konto-API. Separat SQL-efterkontroll visar noll QA-konton, noll QA-annonser, noll tillfälliga granskarbehörigheter, noll filer för de tre senaste filägande körningarna och noll analysjobb för slutkörningen. Tidigare första profilförberedelse nekades av den avsiktligt strikta JSON-valideringen; fixturen rättades till produktens normala profilform. Ett senare prov passerade båda HTTP-konflikterna men stoppades av att testet frågade efter en id-kolumn som saknas i application_completions; det rättades till job_id före den slutliga obrutna körningen. Dessa avbrutna prov räknas inte som fullständigt godkända.

## Kvarstående omfattning

L09/N19 förblir Pågår. Positiv företagsdelning, exakt filversion, återkallelse av nya filanrop och Chromium-vyerna ovan är nu verifierade. Fysisk mobil/Safari, fullständig samtidig flerklientgranskning och övriga N19-krav (bland annat generell profilfakta/CV-separation och separat modell-/dataskyddsavstämning) kvarstår. Ingen AI-kvalitet utvärderades här. Övriga versionerade RPC:ers 40001-konflikter behöver egna avgränsade regressioner. Den globala åtgärdsplanen hålls byteidentisk; detta protokoll uppdaterar evidensen för de redan pågående punkterna.
