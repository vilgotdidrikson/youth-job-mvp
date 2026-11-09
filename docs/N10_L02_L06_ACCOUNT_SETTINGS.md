# N10/L02/L06 – e-post och lösenord med kontobunden verifiering

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/n10-l02-l06-account-settings-20261109`
- Bas: dev `66e99457d8db81613385827eaaee520fb080043a`, inklusive GDPR-plan PR #185. Öppna dev-PR:er kontrollerade före reservation.
- Tre samordnade delar enligt beställningen: N10 e-postbyte med lösenordsverifiering i kontoinställningar; L02 miljöriktig bekräftelseretur/väntande status och kontrollerat återförsök; L06 isolerad lösenordsändring med ägar-/livscykelkontroll och städning av tillfällig session.
- Ingen ny notiskanal eller preferenslagring: den återstående delen av N10 bevaras. Befintlig Supabase Auth och mejlmall används; ingen ändring av hosted SMTP/confirm-inställningar, databas/RLS, avtal, priser, AI eller produktion. GDPR-kraven i AGENTS och L12–L16 bevaras; privata autentiseringsvärden loggas/lagras inte av appen.
- Fiktiva SDK-/komponentprov och riktade regressioner planeras. Verklig mejlleverans, klickad verifieringskedja och mobil räknas inte som verifierade genom simulerad transport. Huvudpunkter förblir ofärdiga tills kvarvarande acceptans är verifierad.
