# N10/L06/L13 – tvåfaktor vid känsliga kontoåtgärder

- Ansvarig: Vilgot / Codex
- Branch: `codex/n10-l06-l13-sensitive-mfa-20261109`
- Status: Pågår; reserverad före kodarbete.
- Omfattning: kodfält och flyktig hantering i kontoformulär (N10), serververifierad befintlig TOTP före egen kontoradering (L06), motsvarande verifiering före skapande/återhämtning av eget exportprov (L13).
- Separat tillfällig lösenordssession, kontobunden faktor och lokal sessionsstädning. Ingen rolltilldelning, ny databas/RLS eller produktionsändring. Full obligatorisk admin-MFA och återställning av borttappad faktor ingår inte.
- Syntetiska SDK-/route-/komponentprov och regressioner; verklig autentiseringsapp och inloggad browser redovisas separat.
