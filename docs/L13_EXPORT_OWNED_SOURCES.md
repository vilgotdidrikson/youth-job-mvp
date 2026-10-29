# L13 – egna företags-, media- och säkerhetskällor

Reservation före kodarbete 2026-10-29: Vilgot / Codex, `codex/l13-owned-export-20261029`, från dev f25b04b. Aktuell dev och öppna PR:er kontrollerade. Fortsättning inom egen L13; ingen annan aktiv reservation övertas.

Utöka intern insamling med uttryckligen avgränsade egna företagsannonser, rekryterings-/premiumuppgifter, egna videometadata och egna säkerhetsåtgärder. Bevara RLS, ägarfilter, pending-granskning och fel utan delresultat. Ingen publik export, aktivering av premium/video, filhämtning, databasändring eller AI-anrop. Implementation och verifiering följer i samma leverans. L13 fortsatt Pågår.


## Implementation

Den interna insamlingen omfattar nu 32 relationer, tio fler än i #150. Den återanvänder samma gräns på fyra samtidiga läsningar, budgetar, ägarvalidering per rad och fullständig sidindelning. Ingen fil eller URL hämtas. Allt är fortsatt pending för rättighets-/innehållsgranskning.

| Källor | Kontofilter och avgränsning |
| --- | --- |
| company_match_profiles, company_recruitment_controls | company_user_id = eget konto; changed_by utesluts |
| jobs | company_user_id = eget konto, även utkast och stängda annonser; ingen statusfiltrering |
| recruitment_outcomes, recruitment_rewards | company_user_id = eget konto; ingen aktivering av belöningar |
| premium_orders, premium_entitlements | company_user_id = eget konto; idempotency_key och source_reference i ordern utesluts; ingen betalningsfunktion aktiveras |
| youth_videos | owner_id = eget konto, även kvarvarande metadata för återkallade/raderade videor; ingen fysisk fil återställs |
| moderation_reports | reporter_user_id = eget konto; reviewed_by_user_id, resolution_note och target_snapshot utesluts |
| user_blocks | blocker_user_id = eget konto; blocked_user_id är unik cursor inom den egna blockeraren |

Även admin/publikt synliga rader kräver uttryckligt eget konto i queryn. Inga rapporter om andra anmälare, dold blockerare, råa auditloggar eller breda jobb-/profiljoins samlas in. Uteslutna personuppgifter är fortfarande en återstående bedömningsuppgift, inte automatiskt befriade från tillgångsrätten. Redan inventerade källor och kategorier står kvar i täckningsredovisningen.

## Verifiering

94 lokala insamlingskontroller passerar. Nya prov kontrollerar egen/främmande rad i samtliga tio källor, återkallade/raderade videometadata, utkast/stängda annonser med korta sidor, fel på senare annonssida utan delresultat samt uttryckligt bortval av tekniska/reviewer-fält. Installerad SDK mot simulerad HTTP, paketets 76 och inventeringens 21 regressioner, riktad ESLint, TypeScript och produktionsbygge/57 routes passerar. Befintlig metadataBase-varning kvarstår.

Faktisk read-only SQL i DevStaging 2026-10-29: samtliga tio projektioner och filter kördes med lokal roll authenticated och ett fast fiktivt sub (00000000-0000-4000-8000-000000000000), RLS på. Alla gav noll rader utan fel. Transaktionen rullades tillbaka. Inga användarrader returnerades, fixtures skapades inte, Auth verifierades inte i detta SQL-prov. Detta verifierar verkliga kolumner/läsprivilegier och frågorna för det tomma kontot; det verifierar inte positiva ägarfall, HTTP/Auth eller komplett rättighetsutdrag.

Första SQL-försöket omfattade också youth_profile_videos och nekades av tabellens återkallade läsprivilegier. Inga privilegier ändrades. Den avvecklade tabellen har därför tagits bort ur runtime-insamlingen och behåller not_collected i inventeringen. Kvarvarande legacydata måste hanteras separat inför export; inga automatiska tomhets-/gallringspåståenden görs.

Återstår: faktiskt innehålls-/RLS-prov med fiktiva ägda uppgifter, privata delningsunderlag och historiska AI-bedömningar, föräldraägda jobbprofiler/versioner, Auth/Storage/legacy och drift-/externa/lokala källor. Innehållsgranskning, konsistens, ny autentisering, pakethämtning och gallring återstår före aktivering. L13 är fortsatt Pågår.
