# N10/L02/L06 – e-post och lösenord med kontobunden verifiering

- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch: `codex/n10-l02-l06-account-settings-20261109`
- Bas: dev `66e99457d8db81613385827eaaee520fb080043a`, inklusive GDPR-plan PR #185. Öppna dev-PR:er kontrollerade före reservation.
- Tre samordnade delar enligt beställningen: N10 e-postbyte med lösenordsverifiering i kontoinställningar; L02 miljöriktig bekräftelseretur/väntande status och kontrollerat återförsök; L06 isolerad lösenordsändring med ägar-/livscykelkontroll och städning av tillfällig session.
- Ingen ny notiskanal eller preferenslagring: den återstående delen av N10 bevaras. Befintlig Supabase Auth och mejlmall används; ingen ändring av hosted SMTP/confirm-inställningar, databas/RLS, avtal, priser, AI eller produktion. GDPR-kraven i AGENTS och L12–L16 bevaras; privata autentiseringsvärden loggas/lagras inte av appen.
- Fiktiva SDK-/komponentprov och riktade regressioner planeras. Verklig mejlleverans, klickad verifieringskedja och mobil räknas inte som verifierade genom simulerad transport. Huvudpunkter förblir ofärdiga tills kvarvarande acceptans är verifierad.


## Leverans – PR #186

### N10 – e-postbyte i befintliga kontoinställningar

- Ny gemensam kontokomponent för ungdom, företag och privata uppdragsgivare, isolerad per användar-id. Aktiv adress, begärt byte och serverläst status hålls isär. Ny e-post normaliseras/valideras; aktuell adress och aktuellt lösenord verifieras innan begäran görs.
- Bekräftelsereglerna ligger kvar i Supabase Auth. Appen använder vanlig `updateUser({email})` med publik klient och en separat lösenordsverifierad session; inga admin-/service-anrop och ingen direkt uppdatering av auth-tabeller. Inget verifieringskrav stängs av. E-post är befintlig kontouppgift, ingen ny kontaktkategori eller egen lagring.
- N10:s notispreferenser är fortfarande ej byggda. Inga val för framtida mejl-/pushkanaler tillkommer. Hela N10 står Pågår.

### L02 – väntande bekräftelse och återförsök

- Returen från e-poständring använder exakt aktuell origin + `/login`, som redan ingår i miljöernas auth-returflöde. Befintlig svensk email_change-mall återanvänds. Ingen hosted Auth-/SMTP-/redirect-inställning ändras.
- Begärt byte visas som begäran, aldrig som bevis på levererad e-post eller färdig ändring. Användaren uppmanas följa bekräftelselänkarna och kontrollera båda inkorgarna. Statusknappen läser faktisk aktiv/väntande adress för rätt konto, med 15 s gräns, avbrott och skydd mot sena svar. Samtidig statusläsning och ändring spärras.
- 60 s lokal spärr efter begärt/okänt mejlförsök och serverns egna taktgränser kvarstår. Ingen automatisk omsändning. Nya begäranden kräver återigen lösenord; formulär skickar aldrig kandidat-/CV-data i mejlet.

### L06 – isolerad ändring och städning

- Både lösenord och e-post använder gemensam klientlogik med `persistSession:false`, `autoRefreshToken:false`, `detectSessionInUrl:false` och unik lagringsnyckel. Den delade sessionen används bara för identitetskontroll; den loggas inte ut eller byts genom verifieringen.
- Förväntat konto och ursprunglig e-post kontrolleras före och efter lösenordsverifieringen. Avbrott/kontobyte före nästa steg hindrar skrivning. UI har synkront dubbelklickslås, 30 s tidsgräns och avbrott vid avmontering. Lösenord läses från faktiskt skickade kontroller (inklusive autofill), hålls utanför React-state och töms vid start/avmontering.
- Den tillfälliga sessionen avslutas med explicit `scope:local`, även efter fel. Städning har separat 10 s transportsignal så att avbruten ändring inte blockerar utloggningen. Om städningen inte bekräftas visas ändringens verkliga resultat separat; återförsök avslutar bara samma session och upprepar aldrig lösenords-/e-poständringen. Nya ändringar spärras under väntande städning. En sen avslutning efter lämnad vy får försöka städa sin egen session men inte uppdatera gammal UI.
- Transportfel ersätts med fast feltext före SDK:ns logggräns. Inga egna lösenord, token, nya mejladresser eller råa leverantörsfel loggas.

## Faktisk verifiering 2026-11-09

- `test:account-settings` kör riktiga lib-funktioner med installerad SDK och simulerad HTTP: password/email-payload, tre miljöreturer, isolering/ägare, fel konto/lösenord, felaktig adress, nekad läsning, avbrott, osäkert skrivsvar, separat lokal städning och återförsök utan omskrivning. Testet kontrollerar även att privata transportfel inte når SDK-loggning.
- Riktiga komponentcallbacks/effects med simulerade hooks/DOM/HTTP: konto-nyckel, autofill, tömda lösenord, validering, dubbel-submit, lyckad ändring med misslyckad städning, städningsknapp, begärd kontra aktiv adress, 60 s spärr, statusläsningens timeout/återförsök, läs-/skrivspärr, avmontering och sena svar.
- Före/efter: `ACCOUNT_AUTH_REF=66e99457d8db81613385827eaaee520fb080043a node scripts/test-account-settings.mjs` faller därför att tidigare lösenordsfunktion inte stänger verifieringssessionen (0 logout-anrop). Ändrad funktion passerar. Befintligt återställningsprov bekräftar även att kontobyte före skrivningen stoppar ändringen och ändå städar isolerad session.
- `test:account-recovery`, `test:auth-email`, `test:profile-journey`, `test:account-reauthentication`, `test:account-deletion-flow`, TypeScript, riktad ESLint för ändrade kod-/testfiler och standardbygge passerade. Bygget har befintlig metadataBase-varning. Befintliga simulerade felgrenar i session-/profiltest skriver förväntade testvarningar.
- Ingen verklig mejlbegäran, nytt QA-konto, sessionsändring eller annan live-data skapades. Inga migreringar/RLS-/leverantörsinställningar eller produktion ändrades.

## Återstående acceptans och beroenden

- Verklig e-postleverans, säker e-poständringskonfiguration, klick på erforderliga länkar, session efter bekräftelse och inloggad mobil/browser måste verifieras i avsedd miljö. Befintlig `check:auth-email` kräver `mailer_secure_email_change_enabled:true`; inget antagande om hosted konfiguration eller lyckad leverans görs av dessa komponentprov.
- En redan påbörjad serverskrivning kan ha genomförts trots timeout. UI påstår då inte framgång och gör inget automatiskt nytt ändringsförsök. Lokal utloggning återkallar inte redan utfärdade JWT omedelbart före deras giltighetsslut; fullständig sessionspolicy ligger kvar i L06/L14.
- N10:s notispreferenser, L02:s övriga utskick/leveranshantering och återstående L06-acceptans kvarstår. Ingen av huvudpunkterna kryssas Klar genom denna leverans.
- PR: https://github.com/vilgotdidrikson/youth-job-mvp/pull/186. Slutlig commit/dev-status redovisas i PR:n.
