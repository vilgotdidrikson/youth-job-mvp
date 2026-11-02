# L13 – tre grupper av strukturerad historik

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-structured-history-groups-20261102`
- Offentlig reservation före kodarbete från dev `65a1446`; aktuell dev och öppna PR:er kontrollerade. Reservationen är branchens första commit.

## Tre avgränsade delpunkter

### 1. Egna kontostatusar och fakturaunderlagets version

Företagsprofilens verifieringsstatus, inlämnings-/verifieringstid och uppdateringstid ingår nu med eget konto-ID. Privat uppdragsgivares profil får konto-ID och uppdateringstid. Företagets fakturaunderlag får eget ID, fast landkod SE, versionsnummer och uppdateringstid. Skyddad profiles.role styr rätt kontotyp; en rad för fel roll eller ägare stoppar paketet.

Namn, kontaktperson, mejl, adress, referens, organisationsnummer, verifierarens identitet och avslagets fritext ingår inte i denna automatiska policy. De är fortfarande väntande för separat bedömning, inte undantagna från tillgångsrätten.

### 2. Egna ansökningars status och versionshistorik

| Källa | Automatiskt urval |
| --- | --- |
| application_completions | Eget ungdoms-/jobb-ID, profil-/frågebatchversion, ansökningsstatus och skapande-/skickande-/kompletterings-/återkallelsetid |
| application_followups | Eget fråge-/ungdoms-/jobb-ID, kravprofilversion, svarstatus, fast källa automatic/company och skapande-/svarstid |
| private.application_disclosures | Eget ungdoms-/jobb-ID, revision och skapande-/uppdateringstid |
| candidate_assessments | Eget bedömnings-/ungdoms-/jobb-ID, kravprofilversion och skapandetid, även historiska rader |

Den befintliga service-only privata läsaren kopplas nu in i dev-provets serverägda insamlingskedja efter ny autentisering. Endast den validerade skalärprojektionen går vidare till ZIP. Originalfrågor, svar, kriterier, råa AI-resultat, matching_input, packet, motpartens identitet, request_key, source_token och hashar exporteras inte automatiskt.

Ett främmande privat historikunderlag stoppar hela leveransen. En oläsbar källa ligger kvar som väntande; den markeras aldrig fullständigt saknad. Företagets roll/ägarskap till en annons ger ingen automatisk tillgång till kandidaternas historik i företagets export.

### 3. Egna annons- och rekryteringsstatusar

Egna jobs får ID/konto, aktiv/pausad/stängd status, publiceringsstatus, jobbtyp, två befintliga booleska flaggor och skapande-/först publicerad tid. Egna företagsmatchprofiler får konto/version/tider. Egna rekryteringskontroller får konto, fast restriction och ändringstid. Egna rekryteringsutfall får konto-/jobb-ID, fast utfall och registreringstid.

Befintlig definition av is_company_account omfattar både company och private; motsvarande jobbägarfältpolicy stödjer därför båda utan att öppna ungdomskällorna. Annonsutkast/stängda annonser filtreras inte bort av exporten. Annonsfritext, arbetsplatser, källanteckningar, beslutsmotiveringar och administratörers identiteter stannar utanför urvalet. Ingen premium-, video- eller rekryteringsfunktion aktiveras.

## Gemensamma gränser

Den stängda policyn omfattar nu **19 källor, elva fler än tidigare**. Enbart egna ID, fasta enumvärden, booleska värden, begränsade heltal/versioner och tidsstämplar tillåts. Obligatoriska nya fält kan inte ersättas med null; nullable tider och frågebatchversion bevaras enligt källkontraktet. Okända statusar, ogiltiga värden, fel kategori/roll/ägare och dubbletter stoppar paketet. Ingen rå rad sprids eller JSON/fritext kopieras in.

Samtliga 24 kategorier förblir väntande och paketet needs_completion. Dataförsedda kategorier är partially_included. Tom RLS-läsning blir aldrig global frånvaro. Fullständiga tillgångsuppgifter, transaktionssnapshot och juridisk bedömning påstås inte.

## Faktiskt verifierat 2026-11-02

- Skrivskyddad DevStaging-metadata för de elva nya källorna kontrollerades före implementation: alla **58 nya tillåtna kolumner** matchar verkligt schema; relevanta databasenum, nullable fält och versionskontrakt granskades. Inga användarrader, fixtures eller hemligheter lästes. Inget schema eller inventeringsunderlag ändras.
- test:structured-personal-data-export: **178** lokala prov med verklig ZIP-extraktion. Alla nya källor och tre kontoroller, exakta utdatafält/värden, fel ägare/roll, dubbletter, olästa/tomma källor, samtliga tillåtna statusar, fel skalärer, 105 historiska bedömningar och utebliven råtext/hash/motpartsidentitet kontrolleras.
- test:export-preview-download: **57** prov. Hela faktiska route-/SDK-/sessions-/gransknings-/paket-/lagringskedjan körs med simulerad fjärrtransport. Ungdomens privata revision/historik, företagets fakturaversion och stängda annonser samt privat uppdragsgivares annonser når faktisk ZIP. Nekad privat läsning lämnar väntande status; främmande privat rad nekar hela paketet. Fel lösenord, återkallad session, lagringsfel och korrupt/utgånget paket nekar filen.
- Insamling **120**, granskningsorkestrering **20**, granskat paket **39** och paketbyggare **76** regressioner passerar. Paketprovet inkluderar oberoende Python-extraktion/CRC/UTF-8.
- Totalt **490 lokala kontroller**, riktad ESLint, diff-check samt standardproduktionsbygge med TypeScript passerar.

De verkliga metadatakontrollerna är inga positiva Auth/RLS-/innehållsprov. Fjärrtransporten i lokala integrationstester är simulerad. Inga nya inloggade stagingflöden, verkliga paket, browser-/fysiska mobil- eller Safari-prov påstås i denna leverans; UI ändras inte.

## Införande och kvarstående arbete

Leveransen innehåller tre implementerade och lokalt verifierade delpunkter inom L13. Hela L13 förblir Pågår. Inloggad acceptans mot verkliga fiktiva konton, komplett innehåll och rättighetsbedömning, konsistens vid samtidiga ändringar samt övervakad fysisk paketgallring återstår före aktivering.

Ingen flagga, cron, databas, RLS, bucket, produktion eller extern AI ändras. Exportprovet är fortsatt avstängt. Global åtgärdsplan lämnas byteidentisk; leveranschecklista och faktisk verifiering finns här och i PR.
