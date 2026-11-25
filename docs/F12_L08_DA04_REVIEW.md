# Tillägg till MatchnWorks åtgärdsplan

## N26 Betalning via Stripe

**Status:** Ej påbörjad. Placering 15.1, efter L03. Föreslagen prioritet P2. MatchnWork har ett förberett Stripe-konto enligt Vilgot.

Låt företaget betala anställningsavgiften från den befintliga fakturavyn. Hämta belopp, valuta och fakturareferens från servern och stäm av betalningen mot fakturan. Visa betalningsstatus för företaget och admin.

Klart för granskning när rätt företag kan öppna, betala, avbryta och återuppta betalning i Stripes testmiljö. Försenade eller upprepade betalningshändelser ska behandlas en gång. Verifiera företagets fakturaåtkomst och samordna betalning och rättelser med L03 innan skarp aktivering.

## Arbetsomgång 2026-11-21

Vilgot / Codex reserverade F12, L08 och DA-04 på `codex/f12-l08-da04-review-20261121` från `dev` (`3fedeaa`). Ändringarna ligger i [PR #246](https://github.com/vilgotdidrikson/youth-job-mvp/pull/246).

| Punkt | Status för kodleveransen | Ändring och verifiering |
|---|---|---|
| F12 Kompletteringsfrågor | För granskning | Skiljer startdatum från praktiska krav och undviker dubbletter för samma B-körkort. Matchning, rättvisa, följdfrågebatch, sparade svar och komplettering passerade. Två ansökningar med verklig modell återstår i L17. |
| L08 Mobil och tangentbord | För granskning | Mobilchattens skrivfält följer den synliga vyn. Vid öppning fokuseras tillbaka-knappen och vid återgång fokuseras samma kontakt. Komponentprov för fokus, krympt vy och zoom, kartreserv och tillgänglighet passerade. Chromium stoppades vid start. Fysisk mobil, Safari och återstående liveprov enligt L08 behöver verifieras. |
| DA-04 Färgtokens | För granskning | Gemensamma CSS-färger ligger i temat. Kontroll av 396 ändrade deklarationer bekräftade samma färg- och alfavärden och oförändrade selektorer. Bokstavliga färgvärden enligt tokenkontrollen minskade från 308 till 27, huvudsakligen karta och jobbillustrationer. Plattformsgrafik och tillgänglighet passerade. Visuell acceptans återstår. |

Ett gemensamt produktionsbygge med TypeScript, riktad ESLint och diffkontroll passerade. Inga av punkterna markeras Klar före dev-införande och godkänd acceptans.

## Arbetssätt för omgångar med tre punkter

Reservera och bygg alla tre på samma branch och i samma PR mot dev. Kör därefter ett gemensamt produktionsbygge och de berörda regressionssviterna parallellt. Återanvänd samma webbläsarsession och testdata där flödena tillåter det. Kör om de kontroller som berörs av rättningar.
