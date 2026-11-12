# L16 / L13 / F20 – skyddade personuppgiftsärenden

- Ansvarig: Vilgot / Codex
- Branch: `codex/l16-l13-f20-privacy-cases-20261112`
- Status: För granskning av denna avgränsade leverans; reservation före kodarbete från dev `8c7c4ed`. Huvudkorten L16/L13/F20 förblir Pågår.
- L16: särskild handläggarbehörighet, serververifierad tvåfaktor och versionsskyddad ärendekö med tilldelning/status.
- L13: kontobunden begäran och egen statusöversikt utan att likställa ett ärende med automatisk export eller utförd rättelse/radering.
- F20: ingångar från hjälp och kontoinställningar; mejlkontakt finns kvar utan konto.
- Endast egna fiktiva dev-prov. Inga verkliga handläggare tilldelas behörighet; ingen e-post eller incidentanmälan skickas. Bilagor, mejlintag, påminnelser och full incidenthantering tillhör fortsatt arbete.
- Intake måste neka nya ärenden när ingen särskilt behörig handläggare är konfigurerad, så att användaren får befintlig kontaktväg i stället för ett obevakat mottagningslöfte.


## Infört i leveransen

- `/account/privacy-requests`: kontobunden begäran, egen ärendeöversikt, publika handläggarsvar och egna kompletteringar. Ursprunglig begäran bevaras, och en begäran utför inte automatiskt export, rättelse eller kontoradering. Ingen bilaga eller automatisk mejlkanal införs.
- `/admin/privacy-cases`: separat ärendekö, uttryckligt övertagande, svar, inväntad komplettering, avslut och återöppning. Läsning och ändring kräver aktuell separat handläggarbehörighet, bekräftad mejl, aktiv originalsession och ny verifiering med lösenord/TOTP. Den isolerade verifieringssessionen avslutas före dataåtkomst; delad browserinloggning uppgraderas eller ersätts inte. Lösenord/kod töms vid submit, och ärendevyn kan tömmas manuellt och töms efter fem minuter.
- Ärendekön öppnar inga CV:n, chattar eller kandidatprofiler och tilldelar inga nya handläggare. Återkallad handläggarbehörighet, adminmedlemskap eller faktor spärrar nästa serverkontroll. Redan visat innehåll är inte fjärraderbart ur en annan persons minne eller externa kopior.
- Hjälpsida och gemensamma hjälp-/kontolänkar leder till ärendesidan; mejlkontakt fungerar fortsatt utan konto. Om ingen kvalificerad handläggare finns nekas nya begäranden och kontaktvägen visas. Egen tidigare historik kan fortfarande läsas.
- Skapande återanvänder ett stabilt ärende-ID. Ändringar kräver aktuell revision och har ett unikt händelse-ID; exakt upprepning skapar ingen ny händelse. Okänt resultat kräver återläsning före nytt försök. Gamla versioner får PT409, inte automatisk överskrivning.
- Svar är uttryckligen publika för ärendets ägare. Händelser lagrar inte en ny kopia av den ursprungliga begäran. Ägarvyn lämnar inte ut handläggar-ID:n eller interna anteckningar. De senaste 20 händelserna visas med tydlig markering om äldre historik finns.

## Databas och inventering

Två namngivna migrationer har införts enbart i DevStaging: `privacy_request_cases` och `privacy_case_identity_checks` (lokala filer skapade med Supabase CLI). Tre privata RLS-tabeller: `privacy_case_handlers`, `privacy_cases`, `privacy_case_events`. Vanliga authenticated-/anon-roller saknar tabellåtkomst och RPC-exekvering; service-rutterna verifierar aktuell identitet/ärendebehörighet och ny autentisering. Två privata, servicebegränsade booleanfunktioner med låst search_path gör nödvändiga identitets-/faktoruppslag. Auth-tabellernas breda läsbehörigheter har inte öppnats.

Första DevStaging-provet hittade att service_role saknar direkt Auth-tabelläsning. Den första testtransaktionen återställdes och räknas inte som godkänd. Den andra migrationen inför de begränsade uppslagen; lokala testfixturen rättades att också sakna bred Auth-läsning. Det fullständiga DevStaging-provet passerade därefter och återställdes.

Vid avslut sparas en planerad gallringstid tolv månader senare. Återöppning tar bort den inaktuella avslutsmarkören men flyttar inte ursprungligt beräknat svarsdatum. Kontoradering nullar berörd konto-/aktörskoppling; ärendeinnehåll kan behöva bevaras enligt separat ärenderutin och betraktas inte som anonymt genom nullning. Automatisk ärendegallring/backuphantering är ännu inte aktiverad; detta är ingen generell fristförlängning eller bekräftelse på färdig L12.

Färsk metadata före/efter: 89 → 92 relationer, oförändrat fyra buckets, enbart tre avsedda privata tabeller tillagda. Källregistret och additions-only-katalogen är uppdaterade; faktisk katalogkontroll passerar. De nya ärendekällorna markeras uttryckligen not_collected i automatisk export och kvarstår för individuell rättighetsbedömning. Ingen ofullständig export kallas komplett.

## Kontroller

- `test:privacy-cases`: 23 faktiska routekontroller med simulerade Auth/session/RPC-gränser, 17 modell-/klientkontroller och 14 faktiska komponentcallbackkontroller med kontrollerade hooks/DOM/tjänster. Fel konto, nekad behörighet/kod, utgången session, konflikt, avbrott, storleksgräns, privat projektion, dubbelklick, osäkert svar och read-only återhämtning täcks.
- `test:privacy-cases:postgres`: 40 verkliga lokala PostgreSQL-kontroller via PGlite 0.5.16, med syntetiska Auth-/sessionsfixturer. Behörigheter, idempotens, gammal revision, ägargränser, dialogstatus, deadline/retentionsmarkör, paginering och återkallelse. Kör med `MNW_CASE_PGLITE_MODULE=/sökväg/till/@electric-sql/pglite/dist/index.js`.
- `scripts/test-privacy-cases-staging.sql`: faktiskt återställt DevStaging-prov för hela SQL-livscykeln och direktåtkomstspärrar. Det är ingen verklig Auth-kodverifiering eller samtidig flertransaktionskörning.
- Separat DevStaging-efterkontroll: noll QA-konton, admins, sessioner, faktorer, ärenden och händelser; noll konfigurerade handläggare.
- Insamlings-/strukturerad export-/inventeringsregressioner, befintlig nyautentisering/tvåfaktor, TypeScript, riktad ESLint, designtokens och produktionsbygge passerar. Säkerhetsrådgivarens fyra befintliga WARN är oförändrade; INFO för privata RLS-tabeller utan klientpolicy är väntad när roller saknar åtkomst.
- `test:privacy-cases:browser` finns för faktisk Chromium-kontroll av gränssnittet över kontrollerade Auth/API-fixturer. Lokalt startförsök stoppades av miljöns socket-begränsning och inga browserkontroller räknas som passerade. Fysisk mobil och verklig autentiseringsapp återstår.
- `test:live-privacy-cases` är ett uttryckligt opt-in-prov för verklig Auth och driftsatt dev: egen historik, nekat obevakat intake/fel konto/obehörig admin och städning. Positiv handläggaråtkomst ingår inte; verkliga handläggare/faktorer ska inte skapas av testet.

## Kvarvarande arbete

Koppla de av användaren beslutade fem personliga handläggarkontona efter verifierad identitet och egen tvåfaktorsinstallation; inga verkliga behörigheter har tilldelats i leveransen. Fysisk autentiseringsapp och full inloggad browseracceptans krävs. Manuellt mejlintag, ärenden utan konto i admin, privata bilagor, incidentflöde, fem arbetsdagars intern återkopplingsuppföljning, fristjusteringar/påminnelser, faktisk gallring och mottagarrättelser återstår. L16/L13/F20 som helhet markeras inte Klar; produktion är orörd.
