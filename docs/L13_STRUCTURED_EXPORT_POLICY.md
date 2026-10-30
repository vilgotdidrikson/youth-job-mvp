# L13 – automatisk projektion av strukturerade uppgifter

- Status: För granskning; L13 som helhet Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-structured-export-policy-20261030`
- Reservation publicerad före kodarbete i `7434ba4`, från aktuell dev efter PR #161. Öppna PR:er kontrollerade; inget överlappande aktivt arbete.

## Beteende

`buildStructuredPersonalDataExport` skapar ett verkligt ZIP-paket direkt från serverägt underlag från `preparePersonalDataReview`, med en fast fältpolicy. Inget granskar-ID eller manuellt godkännande fabriceras. Den tidigare explicita granskningsvägen finns kvar för andra uppgifter.

| Källa | Automatiskt tillåtna uppgifter |
|---|---|
| `public.profiles` | Eget ID och skyddad kontoroll youth/company/private |
| `public.youth_profiles` | Eget användar-ID, fyra onboarding/CV-flaggor, profilversion och uppdateringstid |
| `public.youth_application_drafts` | Egna rad-/jobb-ID och skapande-/uppdateringstid |
| `public.youth_saved_jobs` | Egna rad-/jobb-ID och skapandetid |
| `public.youth_job_impressions` | Eget användar-ID, jobb-ID och första visningstid |
| `public.youth_job_dismissals` | Eget användar-ID, jobb-ID och bortvalstid |
| `public.swipe_actions` | Egna rad-/jobb-ID, interested/skip och skapandetid |
| `public.application_workplace_preferences` | Eget användar-ID, jobb-/arbetsplats-ID och uppdateringstid |

Ungdomskällorna kräver skyddad youth-roll. UUID, begränsade versionsnummer, booleska värden, fast beslutsenum och tidsstämplar valideras. Nullable databasflaggor/tider/versioner bevaras som null; obligatoriska ID får inte saknas. Varje strukturerad post anger sin fasta källrelation. Ingen profiljoin görs för jobb-ID.

Alla kategorier med uppgifter markeras `partially_included`; övriga `requires_review`. Alla 24 kategorier förblir väntande och paketet `needs_completion`, även vid tomma synliga rader. RLS-tomhet tolkas aldrig som global frånvaro. Ursprunglig fritext, CV, meddelanden, arbetsplatssnapshots, URL:er och originalfiler följer inte med. Nya/okända kolumner kommer inte med automatiskt.

Fel ägare, blandad roll, upprepade källor/postidentiteter, fel kategori eller ogiltiga tillåtna fält stoppar hela paketet. En oläst källa kan lämnas väntande medan övriga tillåtna uppgifter exporteras. Vanlig objektvalidering körs före läsning av egenskaper; getters körs inte. Källunderlaget ändras inte.

## Faktiskt verifierat

- `test:structured-personal-data-export`: 41 lokala kontroller med fiktiva serverunderlag och faktisk ZIP-extraktion. Alla åtta källor, tre kontoroller, fel ägare, olästa/tomma källor, felaktig struktur, otillåtna skalärer, dubbletter och utebliven råtext/filbytes kontrolleras.
- `test:reviewed-personal-data-export`: 39 kontroller passerar.
- `test:personal-data-export`: 76 kontroller passerar, inklusive oberoende Python-CRC/UTF-8-extraktion.
- TypeScript, riktad ESLint och diff-check passerar. Vercel-byggstatus följs i PR.

## Begränsning och nästa steg

Intern paketering, ingen publik endpoint eller leverans till användare. Serverfunktionen är ingen autentiseringsgräns och får aldrig ta emot klientskickat insamlingsunderlag; framtida leverans måste kontrollera aktuell identitet. Lösenordsverifieringen finns i den befintliga insamlingskedjan. Databas, verklig Storage, inloggat UI och liveflöde har inte testats i denna leverans.

Denna första automatiska policy ersätter inte återstående innehålls-/rättighetsbedömning eller fullständigt svar på en tillgångsbegäran. Säker nedladdning, privat tillfällig lagring, bestämd paketfrist och fysisk gallring återstår. Ingen databasändring, extern AI eller produktion. Den globala åtgärdsplanen lämnas byteidentisk; leveransstatus och faktisk verifiering dokumenteras här och i PR.
