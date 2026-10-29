# L13 – annonsprofiler och historik

Reservation före kodarbete 2026-10-29: Vilgot / Codex, `codex/l13-job-history-export-20261029`, från dev 3e946ac. Aktuell dev och öppna PR:er kontrollerade; fortsättning inom egen L13 utan övertagning av andra uppgifter.

Samla annonsens kravprofil och historiska versioner via fullständigt lästa egna annonser. Inför validerad numerisk sidnyckel och scoped dubblettkontroll för versioner. Bevara konto-/föräldrakontroller, caller-RLS, pending-granskning och fel utan delresultat. Ingen publik export, nya behörigheter, databasändring eller AI-anrop. L13 fortsatt Pågår.


## Implementation

Insamlingen omfattar nu 34 relationer. Två nya barnkällor läses först när jobs har lästs färdigt med company_user_id = kontot: job_match_profiles per job_id och job_match_profile_versions per job_id. Inga publika främmande annonser kan bli föräldrar. Om annonskällan fallerar markeras båda barnkällorna unavailable/dependency_unavailable utan fallback. Fel i senare annonsversioner kastar hela historikkällans delresultat.

Historiken använder en strikt validerad SQL integer-nyckel (heltal inom signed int32, ingen typkonvertering). Jämförelse och gt är numeriska; även noll skickas som cursor. Schemat saknar positivt versionsvillkor, därför bevaras även representerbara icke-positiva heltal. Sidindelningen fortsätter till tom sida. Versionsnummer dedupliceras med job_id + profile_version; UUID-källor behåller global dubblettkontroll, bland annat över meddelandekonversationer. Originalsnapshot bevaras oförändrad för senare innehållsgranskning; det är inte automatiskt godkänt att lämna ut den.

## Verifiering

109 lokala insamlingskontroller passerar. Nya fall omfattar flera egna och främmande annonser, samma version på flera annonser, 107 historikrader med korta sidor, numerisk ordning över 9/10/100, gt.0, ogiltiga typer/gränsvärden/dubbletter/ordning, främmande barnrad, föräldrafel och senare läsfel utan delresultat. Installerad Supabase-SDK provas med faktisk HTTP-serialisering till simulerad transport, inklusive eq.job_id och gt.0/gt.10. Första SDK-fixturen saknade Authorization och nekades före dataläsning; testuppsättningen rättades och hela slutkörningen passerar. Ingen produktbehörighet ändrades.

Paketets 76 och inventeringens 21 regressioner, riktad ESLint, TypeScript, diff-check och produktionsbygge/57 routes passerar. Befintlig metadataBase-varning kvarstår.

Read-only SQL i DevStaging 2026-10-29: båda projektionerna med egna annonsrelationer och numerisk cursor kördes som authenticated med RLS och ett fast fiktivt sub (00000000-0000-4000-8000-000000000000). Båda gav noll rader utan fel, transaktionen rullades tillbaka. Inga användarrader returnerades eller fixtures skapades. Detta verifierar aktuella kolumner/läsprivilegier och tomkontots frågor, inte positiva innehållsfall, Auth/HTTP eller snapshotkonsistens.

L13 fortsatt Pågår. Positiva livefixtures, privata delningsunderlag och historiska AI-bedömningar, Auth/Storage/legacy och övriga lokala/externa källor återstår. Innehållsgranskning, konsistens vid samtidiga ändringar, ny autentisering, säker pakethämtning och gallring krävs före aktivering. Ingen ny sida/API, filhämtning, AI-användning, databasändring eller privilegieutökning.
