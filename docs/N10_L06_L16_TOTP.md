# N10/L06/L16 – autentiseringsapp och verifierad säkerhetssession

- Status: För granskning, PR #189
- Ansvarig: Vilgot / Codex
- Branch: `codex/n10-l06-l16-totp-20261109`
- Bas: dev `ac99aef7688f32cec673ec6cd5213bfea9f864ec`. Befintliga reservationer/öppna dev-PR:er kontrollerade före kodarbete.
- Tre samordnade delar: N10 kontobunden TOTP-installation med granskning/kodkontroll och avbruten installation; L06 andra faktor i isolerad lösenordsverifiering före känsliga kontoändringar samt återanvändning av den säkra kontokomponenten på adminprofilen; L16 serververifierad AAL2/aktiv session som förberedelse för skyddade ärendeåtgärder.
- TOTP-installation och känsliga ändringar sker i separata tillfälliga sessioner. Ingen sen kodkontroll får ersätta ett annat kontos delade session. Inga faktorer eller riktiga konton skapas av agenten. Hemligheter/QR/koder hålls i flyktigt minne, aldrig i repo/loggar/egen lagring.
- Ingen ny generell admin-/ärendebehörighet, rolltilldelning, databas/RLS, tvingande aktivering på befintliga adminvägar, hosted Auth-konfiguration, AI eller produktion. Full obligatorisk admin-MFA och ärendeåtkomst kräver fortsatt integration/verifiering enligt L16/L05; denna förberedelse är ingen sådan auktorisering.
- Riktiga SDK-/komponent-/routefunktioner med syntetiska data och simulerad transport verifieras. Fysisk autentiseringsapp, verklig faktorinstallation, inloggad browser och slutlig obligatorisk åtkomstgräns återstår som acceptans.


## Infört i koden

- Kontoformuläret kan förbereda en autentiseringsapp, visa tillfällig QR/manuell nyckel och bekräfta aktuell sexsiffrig kod. Status läses från kontots Auth-data. Kontobyte, avmontering, dubbelklick, tidsgränser och sena svar hanteras separat från den delade sessionen.
- Befintlig verifierad TOTP kräver kod även i den isolerade sessionen före känslig kontoändring. Adminprofilen återanvänder samma formulär och hanterar separat sessionsstädning.
- Serverhjälparen kontrollerar verifierade claims, AAL2, aktuell identitet och aktiv session via befintlig sessionskontroll. GET `/api/account/mfa-session` ger endast ett innehållsfritt verifieringsresultat, aldrig en roll eller ärendeåtkomst.

## Kontroller och begränsningar

- `test:account-totp`: verkliga SDK-/komponent-/serverfunktioner med simulerade Auth-, HTTP- och databasgränser. Prov för egen faktor, fel ägare, befintlig kod, kontobyte, avbrott, städningsåterförsök, timeout och sena svar; nekad svag/avslutad session och innehållsfritt serverresultat.
- Baslinjeprovet mot dev `ac99aef` faller på saknat explicit kodkrav i klienthjälparen. Det är ingen demonstration av en hosted Auth-bypass.
- Regressioner: `test:account-settings`, `test:account-recovery`, `test:auth-email`, `test:personal-data-session`, `test:profile-journey`, `test:moderation`. TypeScript, riktad ESLint och Next-bygge kontrolleras före merge.
- Avbrott före kodförsök tar bara bort en egen overifierad installation. Efter ett påbörjat kodförsök tas faktorn aldrig bort automatiskt, eftersom ett förlorat svar kan följa lyckad verifiering. En kvarvarande overifierad faktor kan därför kräva separat hantering; inga löften om fullständig faktoråterställning.
- Den vanliga inloggningssessionen uppgraderas inte här. Obligatorisk MFA för alla adminvägar, roll-/ärende-/bilagekontroller, faktoråterställning och fysisk autentiseringsapp med verklig installation måste fortfarande integreras/verifieras innan L16 kan bli Klar. Ingen skarp faktor eller ny behörighet har skapats av agenten.
