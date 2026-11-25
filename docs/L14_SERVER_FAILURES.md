# L14 – privata fel vid servergränsen

Leverans: [PR #144](https://github.com/vilgotdidrikson/youth-job-mvp/pull/144), `codex/l14-private-error-boundary-20261028`, Vilgot / Codex. Reserverad före kodarbete 2026-10-28. Avgränsad koddel av P1 L14; konto-/avtalsgranskningen och hela L14 är fortsatt Pågår.

## Reproducerat

Röstsessionens felväg läste och loggade hela leverantörssvaret. Annonsgenerering och delar av kontoraderingen loggade hela felobjekt; CV-/röstintervju loggade okontrollerat `error.name`. Ansöknings-API:t skickade databasens `error.message` till webbläsaren. Leverantörs-/databasfel kan innehålla indata, privata identifierare, headers eller annan kontext som inte hör hemma i dessa utdata.

Testet kör den verkliga tidigare session-handlern respektive ansöknings-handlern med en fiktiv privat markör i ett simulerat leverantörssvar/databasfel. Båda fallerar sekretesskravet; ny kod passerar. Det visar felgränsens brist, inte att verkliga personuppgifter konstaterats i historiska loggar.

## Ändrat

- Gemensam serverfunktion i `lib/server-failures.ts`: fast händelsekod, nytt slumpat incident-ID, fast felkategori och valfri heltalsstatus 100–599. Ingen feltext, stack, body, header, URL, konto-/objekt-ID eller inkommande request-ID serialiseras. Okända fel/namn/koder blir fast `unknown`; rå kod/namn skrivs aldrig till loggen.
- Bara egna dataegenskaper läses för klassning, inte getters, prototypfält eller `toJSON`. Defensiv hantering av kastande descriptor/proxy och loggsink; loggfel blockerar inte fallback eller kontoradering. UUID skapas lokalt, inte från leverantörs-/användarvärde.
- Sex handlers använder gränsen: röstsession, röstintervju, CV-generering, annonsgenerering, kontoradering och ansökningsändringar. Röstsessionen läser inte misslyckade svarsbodyer utan avbryter/discardar dem; lyckad SDP-förhandling bevaras. Röstfunktionen aktiveras inte.
- Ansöknings-API:t ger fasta svenska feltexter, bibehåller 403/409 för returnerade RPC-fel och behåller särskild hjälp för den kända fasta CV-spärren. Kastande RPC-transport hanteras som 503 med uppmaning att hämta aktuell status före nytt försök. Felresultat schemalägger ingen AI-analys. Incident-ID ingår i sessionens/ansöknings-API:ts felsvar; inga privata felobjekt skickas med.
- Befintliga framgångssvar, annonsfallback, autentisering, ägarkontroller och raderingsordning bevaras. Inga databas-/RLS-/leverantörsinställningar, nycklar eller nya AI-pass.

## Verifierat

`test:server-failures` kör **42 kontroller**: fel från installerad OpenAI-SDK med simulerad HTTP, tillåtna metadata/kategorier/statusar, privata egna/prototypfält, getter-/proxy-/toJSON-fällor, okänd händelse, trasig loggsink och faktiska handlers med simulerad Auth/DB/leverantör. Samtliga fångade loggargument och berörda felsvar kontrolleras mot privat markör. Kontoraderingens filfel stoppar raderingen, medan notisfel fortsatt tillåter den. Lyckad ansökan schemalägger fortfarande analys. Avstängd röst och nekad autentisering når inte leverantör/DB. En AST-kontroll förbjuder direkta console-anrop i `app/api` så att nya loggvägar måste använda den avgränsade gränsen.

`test:account-deletion-flow`, `test:application-withdrawal`, `test:job-ai-review`, `test:job-categories`, ljudmigreringens transport-/WAV-prov och `test:cv-quality` passerar. Befintliga testladdare har kompletterats med den verkliga nya serverfunktionen. Riktad ESLint och diff-check passerar. Standardproduktionsbygge med TypeScript och 57 routes passerar med fiktiva publika Supabase-byggvärden; befintlig metadataBase-varning kvarstår.

Ingen verklig AI-/SMTP-transport eller användaruppgift användes. Inga nya testkonton/filer/databasrader skapades. Ingen webb-/mobil- eller faktisk logginspektion hos leverantör påstås.

## Kvarstående gränser

Den här granskningen gäller de egna hanterade serverfelen ovan. Plattformens access-/runtime-loggar, okontrollerade undantag, SDK-debuggning, klientloggar och externa leverantörers loggar/backup är inte generellt verifierade eller avstängda genom detta. Historiska loggar raderas inte av ändringen. Incident-ID/status är också teknisk metadata och kräver lämplig åtkomst och lagringstid.

L14:s avtal, rätt organisation/avtalspart, kontobehörigheter, miljöseparering, Vercel-abonnemang, OpenAI-delning/logginställningar och externa databehandlingsförteckning återstår. L13:s automatiska export och övriga rättighets-/innehållsbedömningar är inte införda genom denna leverans. Produktion är oförändrad.
