# N19/N02 – samtidiga profiländringar och återkallelser

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/n19-n02-concurrent-conflicts-20261105`
- Reservation 2026-11-05 före kodarbete, från dev `542cfa4`. Öppna PR:er kontrollerade; endast äldre #40.
- Leverans: [PR #179](https://github.com/vilgotdidrikson/youth-job-mvp/pull/179), offentlig reservation `260ef82` före kodarbete.
- Omfattning: samma återförsöksrisk som rättades i #178 finns i profilens versionskontroll och återkallelsens förväntade status. Bevara kontrollernas villkor och behörigheter, använd vanlig HTTP-konflikt och verifiera verkliga samtidiga förfrågningar. Kontrollera även profilformulärets felmeddelande och att osparad text bevaras. Två pågående punkter följs upp tillsammans; inga nya datafält, AI-anrop eller produktionsändringar.
- Slutprov: två sparningar med samma profilversion, gammal återkallelsebekräftelse, konkurrerande sändning/återkallelse, idempotent dubbel återkallelse och gammal klient efter återkallelse. Fiktiva QA-konton med egen städning. Hela N19/N02 markeras inte Klar genom enbart kod eller lokala kontroller.

## Genomförd rättning

De två befintliga funktionerna public.save_my_recruitment_profile och private.withdraw_application använder nu PT409 i stället för 40001 för permanenta versions-/statuskonflikter. Migration 20261105164023_n19_n02_http_conflicts.sql är införd enbart i DevStaging. Funktionen för profil sparas fortsatt som invoker; återkallelsens privata definer, båda funktionernas ägare, ACL, search_path och OID bevaras. Exakt jämförelse i rollback bekräftar att endast felkoderna ändras. Inga tabeller, kolumner, buckets, policys, lås eller tillåtna övergångar ändras.

Profilformuläret känner igen både PT409 och äldre 40001 och visar befintlig konflikttext. Det rensar inte användarens osparade text eller sparar automatiskt igen. Serverns felklassning känner igen PT409/HTTP 409 utan att läsa godtyckliga getters eller logga privata felpayloads.

Lokalt passerar standardbygge med TypeScript, test:server-failures (45 kontroller), test:application-withdrawal och test:profile-journey inklusive verklig SDK-serialisering. Riktad lint är ren för övriga ändrade filer. Profilkomponenten har en befintlig react-hooks/set-state-in-effect på rad 89; samma fel är reproducerat med filen från oförändrad dev. Ingen ny lintavvikelse läggs till och regeln stängs inte av. Säkerhetsrådgivaren före/efter: fem befintliga notiser, inga nya.

Källa: [Supabase om permanenta konflikter och återförsöksloopar](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Övriga 40001-funktioner utanför N19/N02 ingår inte i denna leverans.

## Reproducerbara prov

`npm run test:live-concurrent-applications` med publik MNW_CV_ANON_KEY för fast DevStaging-projekt skapar två fiktiva ungdomar, ett fiktivt företag och tre fiktiva annonser. Ingen kravprofil godkänns; draft håller automatisk analys obehörig. Checkpoint och tidsbegränsad operatörshandskakning ligger i /tmp/mnw-concurrent-fixtures.json respektive /tmp/mnw-concurrent-seeded.json. Endast QA-ID:n skrivs där; lösenord/token finns i minnet. Verifiering av testarbetsgivaren använder ordinarie granskningsfunktion med identitets-/tids-/draftguard; tillfälligt QA-adminmedlemskap skapas och raderas i samma transaktion. Skriptet skapar inga adminmedlemskap.

MNW_CONCURRENT_UI_ONLY=1 och MNW_CV_CHROMIUM kör separat UI-acceptans med ett enda tillfälligt ungdomskonto på driftsatt dev. Ändra i en laddad vy, spara en konkurrerande ändring med verklig SDK, kontrollera 409 och bevarat utkast, läs om uttryckligt och spara den på nytt granskade texten. Ingen nätverks-/Auth-/databastransport mockas. Båda lägen raderar alltid egna konton via eget konto-API i finally; kvarvarande ID ger felkod.

## Verifierat backendresultat

Slutkörning `qa-concurrent-1793897183443-042c65b8`: **21 verkliga kontroller**, exit 0, remainingFixtureIds=[]. Två sparningar med samma profilversion gav exakt en vinnare och en PT409 inom 15 sekunder; förloraren ändrade varken sparat innehåll eller versionsräknare. Ny uttrycklig läsning/sparning lyckades. Företag nekades ungdomens spar-RPC och annan ungdom kunde inte skriva ägarens rad.

En gammal återkallelsebekräftelse gav PT409 inom 15 sekunder och lämnade skickad ansökan orörd. Den driftsatta sändningsendpointen gav också HTTP 409. Två parallella riktiga återkallelser gav samma tidsstämpel, endast en företagsnotis och bestående återkallad status. Gammal sändning kunde inte återuppliva ansökan och företaget nekades nytt underlag.

Två verkliga konkurrerande sändnings-/återkallelsepar gav båda tillåtna ordningar: återkallad först (sändningen såg tombstone) respektive skickad först (återkallelsen fick PT409). RPC-svaren tog 5049 respektive 5078 ms. En separat efterläsning kontrollerade slutstatus, och efter uttrycklig återkallelse fanns inget intresserat swipe kvar. Detta är två observerade förlopp, inte ett bevis för samtliga möjliga schemaläggningar.

Första körningen nådde 19 kontroller men stoppades efter slutläget Återkallad. Tidskontrollen inkluderade då även separat efterläsning och saknade diagnostik som skiljde väntetid från förlopp. Slutprovet mäter RPC-tid före efterläsningen och loggar bara fasta status-/felkoder. Första försöket räknas inte som helt godkänt. Alla egna konton städades även då.

Skrivskyddad efterkontroll: noll QA-konton, noll QA-annonser, noll tillfälliga granskarbehörigheter och noll analysjobb för slutkörningen. Ingen filuppladdning, AI-utvärdering, faktisk anställning eller betalning ingick.

## Efter integration och kvarstående omfattning

Driftsatt profil-UI kontrolleras efter att denna rättning integrerats; slutresultatet och eventuell begränsning redovisas i PR #179. Det separata UI-läget i samma skript provar faktisk 409, bevarad osparad text, uttrycklig omladdning och ett nytt godkänt sparförsök på 375/1280 px. Enbart lokal rendering påstås inte som liveacceptans.

Hela N19/N02 behåller tidigare status. Fysisk mobil/Safari, övriga samtidiga aktörer (exempelvis registrerad anställning), generell profilfakta/CV-separation och andra kvarstående kriterier är inte färdigverifierade här. Global åtgärdsplan lämnas byteidentisk; denna avgränsade evidens följer de redan pågående punkterna.
