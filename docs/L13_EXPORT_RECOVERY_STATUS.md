# L13 – återhämtning och paketstatus

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-export-recovery-status-20261102`
- Offentlig reservation före kodarbete från dev `cefd005`; öppna PR:er kontrollerade. Reservationens commit är branchens första tillägg.

## 1. Återhämta befintligt paket

`POST /api/account/export-preview/recover` hämtar det senaste egna paketet. Aktiv originalsession verifieras före och efter arbetet. Ny lösenordsverifiering sker i isolerad klient vars tillfälliga session stängs; kvoten begränsar försök. Inga exporter beställs, samlas in, skrivs över, markeras felaktiga eller förlängs vid återhämtning. Paketets ursprungliga ID och entimmesfrist bevaras. Den befintliga privata läsningen verifierar ägare, storlek, SHA-256 och metadata före/efter Storage-läsningen. Ingen signerad eller publik länk lämnas ut.

Ny service-only `latest_personal_data_export(uuid)` använder SECURITY INVOKER, tom search_path, kontroll av databasrollen, uttryckligt konto och befintlig profil. Vanliga klienter saknar EXECUTE. Den lämnar bara intern status/ID/konto/frist; inga filvägar, hashar, innehåll eller lås. Ett index på konto och fallande skapandetid/ID stödjer den begränsade senaste-läsningen. Migration `20261102155109_l13_export_recovery_status.sql` är införd i DevStaging. Tabeller, kolumner, ägarrelationer, buckets och inventering ändras inte.

## 2. Paketstatus i dialogen

Samma lösenordsfält och dialog har separata val för Skapa och hämta respektive Hämta befintligt paket. Status utan fil kan vara inget sparat paket, skapas fortfarande, utgånget eller misslyckat. Ett klart paket startar nedladdning och visar ursprunglig giltighetstid. Statussvar är fasta, högst 1 KiB och kontrolleras mot oförändrad lokal session även efter läsningen. ZIP återanvänder samma strikta filvalidering som tidigare.

Lösenordet töms, dubbeltryck spärras och båda åtgärderna avbryts vid stängning, kontobyte och avmontering. Inga automatiska statuspollningar, nya beställningar, lösenordsbesparingar eller återförsök. Ingen ny jobbarbetare införs: skapandet är fortfarande synkront, och ett avbrutet skapande behöver inte bli klart i bakgrunden. Återhämtning hjälper när paketet faktiskt hann bli färdigt och kvarstår inom fristen.

## Faktiskt verifierat 2026-11-02

| Kontroll | Resultat |
| --- | --- |
| test:export-recovery | 34 prov: verklig route, Auth-/sessions-/lagringshjälpare, SDK och ZIP; fjärrtransport simulerad |
| test:account-export | 31 klientprov, inklusive strikta statusar, gränser, kontobyte och avbrott |
| test:export-control | 18 komponentprov, inklusive båda submit-valen, statusar och ingen ny beställning vid återhämtning |
| test:export-browser | 63 riktiga Chromium-kontroller vid 375/768/1280 px, verklig ZIP-nedladdning även via återhämtning, samtliga statusar utan skapa-anrop; Auth/HTTP simulerad |
| test:export-preview-download | 53 regressioner passerar |
| test:temporary-personal-data-export | 33 regressioner passerar |
| ESLint, diff-check, TypeScript och standardproduktionsbygge | Passerar |

Totalt 232 lokala kontroller. Skärmbild vid 375 px granskad: dialogtext, lösenordsfält och tre knappar ryms, med synlig fokusmarkering. Gemensam ModalDialog, responsiva kontroller och befintliga stilar återanvänds. React-granskning: inga nätverkseffekter på rendering, samma synkrona spärr och kontonycklade livscykel för båda valen.

Verklig skrivskyddad DevStaging-kontroll: anon och authenticated saknar EXECUTE, service_role har EXECUTE och funktionen är invoker. Två anrop som service_role för null/fast obefintligt QA-konto returnerar exakt none. Ett anrop som postgres nekades av den avsiktliga rollkontrollen. Metadata för den befintliga tabellen/indexen kontrollerades före ändringen. Säkerhetsadvisories är identiska före/efter när observationstid tas bort. Efterkontroll: noll QA-konton för detta testnamn.

## Begränsningar och återstående acceptans

`scripts/test-export-recovery-status.sql` innehåller ett transaktionellt återställt protokoll för positiva statusar, ägarskap, frist/dubblett, nekade roller och kontoradering. Det är **inte godkänt som kört**: execute_sql gav två gånger `This confirmation expired after 2 minutes`. CLI-alternativet saknar åtkomsttoken. Ingen ny token eller inloggning har begärts och inget bekräftelseflöde har kringgåtts. Positiva fixture-/samtidighetsprov i verklig databas och autentiserat HTTP-/browserhelflöde återstår före aktivering. De lokala SDK-/browserproven ersätter inte detta.

Browser-fixturen använder riktig komponent/klient och befintlig dialog-CSS, men inte hela profilsidan eller produktionsbyggd Tailwind. Ingen fysisk mobil/Safari eller verklig backendnedladdning påstås. Fullständigt registerutdrag, asynkron återhämtning och övervakad gallring återstår i L13/L12.

Alla exportflaggor och cron förblir avstängda. Ingen produktionsändring eller AI-kostnad. Global åtgärdsplan lämnas byteidentisk; checklistan och faktisk verifiering finns här och i PR.
