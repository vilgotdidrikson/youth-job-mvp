# Arbetsomgång 2026-11-21

Vilgot / Codex reserverade N26, L13, L16, F20 och DA-12 på `codex/n26-l13-l16-f20-da12-20261121`. Kodleveransen ligger i [PR #247](https://github.com/vilgotdidrikson/youth-job-mvp/pull/247).

| Punkt | Byggt i omgången | Återstår |
|---|---|---|
| N26 | Stripe Checkout för testfakturor. Köp på 500 kr och automatisk avstämning verifierade i dev. | Eventuell skarp aktivering är en separat leverans. |
| L13 | Säkrare återhämtning av ett befintligt exportpaket. | Fullständigt exportinnehåll och inloggad acceptans. |
| L16 | Tillförlitlig tömning av handläggarvyn efter inaktivitet. | Teknik och acceptans för resterande delar av huvudkortet. |
| F20 | Information där användaren skapar CV och söker jobb. | Slutliga villkor och inloggad acceptans. |
| DA-12 | Ungdomsprofilens stilar ligger i en CSS-modul. | Visuell jämförelse och återstående vyer. |

Produktionsbygge med TypeScript, riktad ESLint, regressionssviter och lokala HTTP-prov passerade. Stripe-handlern provades med signerade testhändelser och simulerad leverantörstrafik. Lokala PostgreSQL-prov och en kontroll av den uppdaterade testmiljön passerade. Huvudkortens återstående kriterier gäller fortfarande.

### N26 – verifiering av testköp

En fiktiv företagsfaktura gav HTTP 409 eftersom Stripe använde `/g/pay/` i Checkout-länken. [PR #249](https://github.com/vilgotdidrikson/youth-job-mvp/pull/249) (`6779ccf` på dev) validerar Stripes HTTPS-domän och att länken hör till samma testsession. Regressionstestet täcker länken från sandboxen, det tidigare `/c/pay/`-formatet och avvisning av fel sessions-ID.

Ett Stripe-testköp på 500 SEK genomfördes i webbläsaren med fiktiva uppgifter. Efter återgång visade fakturan **Betalning avstämd** utan manuell avstämning. DevStaging bekräftade belopp, betald status och att avstämningsreferensen motsvarade samma Stripe-testsession. Inga riktiga pengar drogs.
