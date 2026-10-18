# L04 / F06 – Anställningsgranskning och aktuell prisinformation

Ansvarig: Vilgot / Codex. Branch: `codex/l04-recruitment-20261018`.
Reserverad och publicerad före kodarbete 2026-10-18, från dev `895c17c`.

## Reproducerat problem

En ungdom kunde ha den ursprungliga befattningen/startdagen öppen, medan arbetsgivaren rättade uppgifterna. Den gamla godkännandeknappen godkände då de nya fakta som ungdomen inte hade sett. Detta reproducerades i DevStaging med fiktiv QA-match under riktiga authenticated-roller. Testet och dess notiser rullades tillbaka.

Flera anställningslänkar pekade dessutom på ett jobb-ID, vilket kan välja en annan kandidats samtal när annonsen har flera matchningar. Chattens generiska status kallade redan företagets registrering Anställd, före ungdomens godkännande. Prissidan visade gränser för en aktiv rekrytering/20 kandidater som inte motsvarar aktiva spärrar i den här versionen.

## Implementerat

- Företagets rättelse och ungdomens godkännande/invändning skickar de faktiskt visade fakta: befattning, startdatum och svarsstatus. Servern jämför dem medan befintliga match-/anställningsrader är låsta. Ändrade fakta ger en konflikt före skrivning.
- Ett gammalt formulär visar Hämta senaste uppgifter. Ett lyckat skrivförsök följt av hämtningsfel kan återhämta status utan en andra registrering. Dubbelklick spärras omedelbart. Byte av samtal återställer rekryteringspanelen och öppna dialoger.
- Formulärets fakta fryses när det öppnas. Bakgrundshämtning kan inte tyst byta vad ungdomen godkänner. Synlighet på profil och CV är separata frivilliga val. Efter godkännande heter sparandet Spara synlighet och CV; begäran om rättelse finns kvar.
- Sammanhängande status för registrerad/väntande, invänd och bekräftad anställning. Arbetsgivarens huvudåtgärd heter Registrera anställning.
- Sammanfattning och nya anställnings-/påminnelsenotiser pekar på exakt match. Chatten stödjer `?match=` med företräde framför äldre jobb-länkar och bevarar explicita `?conversation=`-länkar.
- Prissidan och företagets registreringsdialog delar samma information om att nuvarande version är kostnadsfri och att ingen faktura skapas av registreringen. De inaktiva antalsgränserna är borttagna från priskortet. Inga nya gränser aktiveras.
- Matchens befintliga interna status `hired` bevaras för kompatibilitet. Slutlig bekräftelse/erfarenhet avgörs fortfarande av `employment_records.response = approved`. Framtida N16 får inte tolka enbart `matches.status` som en bekräftad anställning.

## Databas och införande

Ny avgränsad migration: `20261018105704_l04_reviewed_employment_snapshot.sql`, skapad med Supabase CLI. Den ersätter befintliga privata funktioner med bevarad autentisering, ägar-/blockeringskontroll, låsning, sökväg och behörigheter. Inga nya tabeller, privilegier eller säkerhetsundantag. Fakturering, rabatt och betalstatus förblir inaktiva.

Inför frontend i dev först, vänta på godkänd driftsättning och applicera sedan endast denna nya migration i DevStaging. Äldre formulär utan granskade fakta får därefter hämta om uppgifterna. Ingen automatisk replay, ändrad äldre migrationshistorik eller produktionsändring ingår. Tidigare video-migrationsavstämning ligger kvar separat.

## Genomförd verifiering

- 60 transaktionella kontroller av föreslagen SQL i DevStaging passerar. Även DDL, testfakta, notifieringar, meddelanden och ändrad betalstatus i testet rullas tillbaka. Kontroller omfattar nya stale/missing snapshots, annan ungdom/annat företag/anonym åtkomst, rättelse och ny granskning, profil/CV-samtycke, exakt notislänk, historik, påminnelser, blockering/restriktion och inaktiv fakturering/belöning.
- `test:recruitment-review` kör komponentens faktiska formulärhandlers med simulerad transport: frysta fakta efter prop-uppdatering, konflikt/omhämtning, dubbelklick, lyckad skrivning med misslyckad statushämtning, profil/CV-val, rättelse efter godkännande samt val av exakt match bland flera samtal för samma annons.
- Befintliga `test:recruitment` och `test:matching` passerar. TypeScript och riktad ESLint passerar utan fel eller varningar.
- Produktionsbygge: `npm run build -- --webpack` passerar med typkontroll och 50 statiska sidor.
- Testwebbläsaren saknar inloggad session den 18 oktober. Inloggat visuellt end-to-end-test för båda rollerna är därför inte godkänt på förhand.

## Kvar

L04 står kvar För granskning tills inloggat visuellt användarflöde har verifierats. Fysisk mobil/tangentbord ligger under L08. Fullt inloggat webbtest av båda rollerna och PDF-generering efter nya val återstår om ingen QA-session finns.

F06:s framtida anställningsavgift är fortsatt blockerad av affärsbeslut: exakt belopp, fakturamottagare/uppgifter, avgiftsutlösande status och betalningsvillkor behöver fastställas innan en betald version byggs/aktiveras. Ingen avgift eller faktura har uppfunnits eller aktiverats i denna leverans. N16 kan utvecklas utifrån ungdomens godkända employment-record; det är nästa större punkt efter denna leverans.


## Infört 2026-10-18

- [PR #66](https://github.com/vilgotdidrikson/youth-job-mvp/pull/66) mergad till dev som `2da6ad7c6b1b9b2dafd011ddb35102f5917a7d0e`. Vercel dev har godkänt bygge.
- Därefter applicerades endast den nya migrationen i DevStaging. Supabase gav den version 20261018105704; den nya lokala filens namn anpassas till denna faktiskt registrerade version med oförändrat SQL-innehåll. Inga äldre migrationsnamn eller historikrader ändras.
- Alla 60 kontroller kördes om mot införda funktioner och passerade med rollback av all QA-data. Säkerhetsrådgivaren visar samma befintliga fynd som före införandet, inga nya.
- Publicerad företagsprissida verifierad i webbläsaren: kostnadsfritt läge, ingen faktura av registreringen och inga inaktiva antalsgränser i kortet. Ungdomsprissidan fungerar fortfarande.
- Testwebbläsaren har ingen inloggad session. Inga verkliga anställningar, nya konton, lösenord, betalningar eller mail har hanterats i den här leveransen. Testerna av andra roller, registrering/rättelse/ny granskning och notiser var isolerade databastester.
