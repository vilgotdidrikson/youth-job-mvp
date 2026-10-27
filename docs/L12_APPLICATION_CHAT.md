# L12 – avslutade ansökningar och äldre textchattar

Leverans på `codex/l12-application-chat-retention-20261027`, reserverad av Vilgot / Codex före kodarbete från dev `56694c6`. Avser en sammanhängande del av L12, inte hela lagrings-/integritetsarbetet. Endast dev/DevStaging. Produktens beslutade tider används; detta dokument fastställer ingen rättslig grund.

## Omfattning och definitioner

- En ansökningsperiod avslutas vid återkallande, avslag/avslutad match, serverregistrerat avslut av rekryteringen eller slutförd anställning. Den första avslutstiden sätts på servern och förlängs inte av nya AI-jobb, profilredigering eller upprepad stängning. Paus är inget avslut. Ny rekrytering före tidsgränsen kan återöppna en ännu inte gallrad period; återöppning efter tidsgränsen får inte återställa utgånget underlag.
- Ansökans kopierade underlag utgår efter sex kalendermånader enligt databasklockan. Åtkomst spärras vid gränsen även när fysisk radering inte lyckats. Historiska AI-resultat, köjobb, kompletteringsfrågor/svar, arbetsplatsurval, utkastmarkör och den privata delningskopian tas bort för just ungdom/jobb-paret. En minimal avsluts-/gallringsrad finns kvar medan dess konto/jobb finns.
- En chatt räknar serverregistrerat accepterat meddelande från en autentiserad deltagare som aktivitet. Förfalskad klienttid, uppspelning, aviseringar och service-/bakgrundsarbete förlänger inte klockan. Vid sex kalendermånaders inaktivitet spärras meddelandeskrivning; vid tolv spärras läsning och meddelandetext raderas. Den här delen inför ingen automatisk återöppning efter arkiveringsgränsen.
- Ursprungliga CV-filer ägs av ungdomens profil och kan delas med flera ansökningar. De är inte separata ansökningskopior i dagens schema och raderas inte av denna arbetare. Match-/konversationsrader bevaras som minimala relationer så att anställningsbevis och videometadata inte kaskadraderas. Rapporternas avgränsade snapshots är en separat kategori; vanlig chatthistorik förlängs inte för att en rapport finns.
- Äldre avsluts-/aktivitetsklockor markeras som uppskattningar. Tidigare klientskrivna datum kan inte göras historiskt verifierade genom en migrering. Oklara äldre/övergivna ansökningar och tillåtna återöppningar måste granskas före aktivering.

## Infört i DevStaging

Migration `20261027095353_l12_application_chat_retention.sql` skapar privata livscykel-/konfigurationstabeller med RLS och utan klientgrants. Ny publicerad status läses bara för egna ansökningar eller en egen chatt. Vanliga konton kan inte köra arbetaren eller läsa konfigurationen.

Delnings-/CV-/bedömnings-/arbetsfunktionernas befintliga ägar- och blockeringsregler bevaras och kompletteras med gemensam tidskontroll. Restriktiva tabellpolicyer skyddar även direkta API-frågor. Gamla klienter/köjobb får inte skriva tillbaka gallrat underlag. Affärskonflikter använder `PT409`, inte `40001`.

`private.process_data_retention` arbetar i begränsade batcher, låser kandidatrader med SKIP LOCKED och använder befintligt ungdom/jobb-lås. Varje objekts SQL-radering är atomisk. Fel rullar tillbaka just objektets radering; nästa körning försöker igen. Loggen innehåller endast tidpunkt, antal och SQLSTATE-koder, inte CV-/chattinnehåll eller användar-ID. Tekniska sammanräkningar städas efter 90 dagar. Privilegierad körning kan avgränsas till ett jobb/en konversation för kontrollerad verifiering; vanliga konton får inte detta tillträde.

**Både applikations-/chattreglernas enforcement och cronjobbet `mnw-data-retention` är avstängda.** Schemat är installerat inaktivt (timvis vid minut 17). En vanlig körning i detta läge gör inget. Konfigurationen kräver dokumentreferens samt policy- och äldredata-granskning innan enforcement ens får sättas på. Ingen kontogallring eller ändring av videons avstängda schema ingår.

## Gränssnitt

Ansökningar visar planerad tid när reglerna aktiveras och ersätter utgånget innehåll med en minimal historikpost. Chatten stänger kontroller vid arkivering, visar rätt datum och skiljer mellan otillgängligt och bekräftat raderat innehåll. Tidigare laddade meddelanden/ansökningsformulär återges inte som aktuellt efter tidsgränsen. Videokompositören stängs med de övriga meddelandekontrollerna; servern skyddar även fristående/gamla skrivvägar.

Klienten använder serverns tid och monotont förlopp, behåller senaste giltiga klocka vid ett läsfel och döljer föregående identitets cache direkt vid konto-/chattbyte. Timeout, återförsök och avmontering hanteras. Deadline-timer och synlighetsuppdatering ersätter kontinuerlig pollning. Befintliga komponenter, typografi och färgtokens återanvänds; inga nya guidepaneler tillkommer när reglerna är avstängda.

## Verifiering

- Nio grupper riktiga SQL-tester med fiktiva aktörer och rollback: avslut/paus/återöppning, säkra defaultgrindar, återöppning efter gränsen, före/exakt vid utgång, RLS/RPC/CV/AI, atomisk och idempotent radering, skydd för andra ansökningar/profil/original-CV/anställning, injicerat fel med lyckat återförsök och radering av alla bedömningsversioner, serveraktivitet/klienttid samt chattens sex-/tolvmånadersgränser och åtkomst för fel roller. Testet skapar inga faktiska filbytes.
- `npm run test:data-retention`: faktiska klient-/hook-callbacks, serverklocka, levande tidsgräns medan omläsning misslyckas, sena svar, chatt-/kontobyte, kvarvarande cache, avmontering och visningsstatus. Verklig installerad SDK verifierad med simulerad HTTP-transport och rätt scope/abort-parametrar.
- N19- och L05-stagingregressionerna passerade med den nya migrationen i samma återställda transaktion. Befintlig ansökningsöversikt och videoflödesregression passerade. Riktad ESLint och standardbygge med TypeScript/56 routes passerar.
- Riktiga HTTP-prov före gallring: åtta kontroller passerade med fem nya engångskonton och dolda testannonser. Egen status/tillgång fungerade; anonym/fel företag/annan ungdom nekades; ett verkligt privat original-CV laddades upp och hämtades genom uttrycklig delning.
- Den efterföljande testförberedelsen gav `Invalid or expired requestState` från databasverktyget och utfördes inte. Miljön startade sedan om och PTY-processen kunde inte återupptas. **HTTP-sviten efter gallring är inte godkänd/körd**, även om motsvarande SQL-/klienttester passerar. `l12-http-purged-state.sql` är ett märkt underlag för att skapa enbart testkohortens efterläge utan ändring av driftinställningarna; det är inte ett påstående om genomförd livekörning av arbetaren.
- Efter migrationen och avbrotten verifierades båda enforcement-flaggorna=false, schema active=false och noll körningsloggar. Inga riktiga rekryteringar användes som testdata. Uppgifter/nyckel lämnas på dold stdin och sparas inte i repo.

## Återstår före aktivering och för hela L12

Testungdomens kontoradering via dev-API gav 204 och verifierad bekräftelse; Storage-kontroll visar noll testfiler. Fyra andra engångskonton återstår: exakt avgränsad radering nekades av verktygsfelet `Invalid or expired requestState` även vid slutkontrollen. Annonserna är dolda. Dessa konton ska städas när databasverktygets mutationssession fungerar igen. Slutför eftergallringens faktiska API-/Storage-prov, flerparts-/samtidighetstest i separata transaktioner och inloggad/visuell mobilkontroll. Transaktions- och klienttester ersätter inte dessa.

Besluta och godkänn ändamål/rättslig grund, exakt hantering av övergivna ansökningar och återöppning samt äldre klockor. Avgränsa separata tider för anställnings-/bokföringsunderlag, moderationssnapshots/undantag, privata AI-utkast och andra kvarvarande kategorier. Granska tidigare utfärdade CV-länkar, leverantörscache/backup och återställningsrutiner. Delade ursprungsfiler/äldre föräldralösa uppladdningar kräver egen livscykelinventering; den här arbetaren raderar dem inte.

Kontogallring efter 24 månader samt verifierade 30-/7-dagarspåminnelser beror på L02/L06 och ingår inte i denna del. Ett underlag får inte raderas för att ett påminnelsemejl antas ha levererats. Hela L12 förblir För granskning.
