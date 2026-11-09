# N10/L06/L16 – autentiseringsapp och verifierad säkerhetssession

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/n10-l06-l16-totp-20261109`
- Bas: dev `ac99aef7688f32cec673ec6cd5213bfea9f864ec`. Befintliga reservationer/öppna dev-PR:er kontrollerade före kodarbete.
- Tre samordnade delar: N10 kontobunden TOTP-installation med granskning/kodkontroll och avbruten installation; L06 andra faktor i isolerad lösenordsverifiering före känsliga kontoändringar samt återanvändning av den säkra kontokomponenten på adminprofilen; L16 serververifierad AAL2/aktiv session som förberedelse för skyddade ärendeåtgärder.
- TOTP-installation och känsliga ändringar sker i separata tillfälliga sessioner. Ingen sen kodkontroll får ersätta ett annat kontos delade session. Inga faktorer eller riktiga konton skapas av agenten. Hemligheter/QR/koder hålls i flyktigt minne, aldrig i repo/loggar/egen lagring.
- Ingen ny generell admin-/ärendebehörighet, rolltilldelning, databas/RLS, tvingande aktivering på befintliga adminvägar, hosted Auth-konfiguration, AI eller produktion. Full obligatorisk admin-MFA och ärendeåtkomst kräver fortsatt integration/verifiering enligt L16/L05; denna förberedelse är ingen sådan auktorisering.
- Riktiga SDK-/komponent-/routefunktioner med syntetiska data och simulerad transport verifieras. Fysisk autentiseringsapp, verklig faktorinstallation, inloggad browser och slutlig obligatorisk åtkomstgräns återstår som acceptans.
