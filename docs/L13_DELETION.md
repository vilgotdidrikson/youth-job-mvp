# L13 – kontobunden självbetjäningsradering

Leverans: [PR #140](https://github.com/vilgotdidrikson/youth-job-mvp/pull/140), `codex/l13-safe-account-deletion-20261028`. Reservation publicerad före kodarbete. Återanvänder L05/L06:s raderingsgrund. Hela L13 förblir Pågår; automatisk export och övriga användarrättigheter återstår.

## Reproducerat och ändrat

Det tidigare UI:t bekräftade lösenordet med window.prompt/confirm och hämtade därefter token från den delade sessionen. Ett kontobytte kunde därför ge en annan identitet än den användaren bekräftat. Om kontona använde samma lösenord fanns ingen uttrycklig kontokoppling som stoppade fel radering. Regressionstestet kör den verkliga gamla DELETE-handlern mot simulerad Auth och får 204 där den nya ger 409. Inga verkliga konton raderades i det reproduktionsprovet.

Alla tre kontorollerna har nu samma återanvändbara dialog med synligt konto, dolt lösenord, konsekvenser och uttrycklig bekräftelse. Befintlig ModalDialog hanterar native-modalitet/fokus; PasswordInput återanvänds. Varje konto får egen nycklad instans. Lösenord/val töms efter försök och stängning, inga sådana uppgifter sparas lokalt eller i loggar. FormData tar med autofill. Synkron spärr stoppar dubbelklick även före omrendering. En bekräftad radering kan inte skickas igen från ett gammalt formulär.

Klienten kontrollerar den lokala sessionsidentiteten och tar en token-snapshot. Det är endast en UI-spärr: servern verifierar fortfarande token med Auth getUser. DELETE kräver nu `{password, expectedUserId}`. Fel bekräftad identitet nekas innan lösenordsverifiering, service-role-klient eller filhantering. Lösenordet verifieras med en separat serverklient utan sessionspersistens/automatisk refresh. Typ/längd, Auth-fel, taktbegränsning, adminspärr och fel verifierad användare hanteras före radering. Äldre dev-flikar/klienter utan expectedUserId behöver laddas om; de får 400 och kan inte fortsätta med det gamla oskopade kontraktet. Befintliga HTTP-QA-skript har uppdaterats.

30-sekundersgränsen avbryter UI-väntan, inte en redan påbörjad serveroperation. Okänt resultat visas uttryckligen, inga automatiska återförsök och inga sena svar får visa lyckad radering eller navigera ett nytt konto. Lösenordet töms även vid fel. Framgång följs inte av global signOut, som annars skulle kunna logga ut ett nyare konto; användaren går till startsidan med full navigation. En lyckad API-radering har redan tagit bort Auth-identiteten. Hantering av gamla lokala sessioner följer befintlig Auth-/sessionskod.

## Dataomfattning

Befintlig filinventering, Storage-radering, Auth-radering, FK-kedjor, adminspärr och generiska motpartsnotiser bevaras. Ingen databasmigration, inga gallringsflaggor eller produktionsinställningar ändras. Aktuella fakturauppgifter omfattas av den FK-kedja som verifierades i L03. [Raderingskartan](account-deletion.md) beskriver kategorier och undantag. Modereringssnapshot kan fortfarande innehålla anmält innehåll; dialogen lovar därför inte att alla anmälningar anonymiseras fullständigt. Ändringen genomför ingen ny backup-/cachegallring och inför inget generellt löfte om omedelbar radering överallt.

## Verifiering

- `test:account-deletion-flow`: verklig DELETE-handler, klient och formulärcallbacks med simulerad Auth/HTTP. Fel kontoid nekas före privilegierad åtkomst, strikt body, Auth-/lösenords-/taktfel, adminspärr, exakt 204-framgång, separat verifieringsklient, token-snapshot, uttrycklig bekräftelse, dubbelklick, tömt lösenord, timeout, sent svar och avmontering. Kontomismatchprovet fallerar mot föregående handler.
- `test:profile-journey`, `test:account-recovery`, riktad ESLint och standardproduktionsbygge/TypeScript (57 routes, fiktiva publika Supabase-byggvärden) passerar. React-granskning: nycklad kontolivscykel, cleanup, synkrona spärrar, etiketter, dolt lösenord och status-/felroller.
- `scripts/test-l13-deletion-http.mjs`: reproducerbar, avgränsad testlöpare för två nya fiktiva ungdomskonton med samma tillfälliga lösenord och en privat PDF. Den har en ofarlig rollout-probe före det riktiga mismatchprovet och städar konton/filer via eget konto-API. Endast DevStaging och det fasta dev-värdnamnet stöds. Inga riktiga rekryteringar eller betalningar. Körstatus/protokoll redovisas i [PR #140:s verifiering](https://github.com/vilgotdidrikson/youth-job-mvp/pull/140).

Återstår: verklig inloggad native-dialog-/mobil-/flerflikskontroll, alla L13-export-/rättelsefunktioner och fullständiga retention-/backupundantag. UI-/SDK-simulering är inte verklig browserverifiering. Automatisk export aktiveras inte genom denna leverans.
