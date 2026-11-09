# F12/N24/N02 – frivilliga kompletteringar

- Ansvarig: Vilgot / Codex
- Branch: `codex/f12-n24-n02-supplement-recovery-20261109`
- Status: För granskning, PR #192; reserverad före kodarbete.
- F12: begriplig språkformulering för obesvarade automatiska följdfrågor. Besvarad historik och företagets egen formulering bevaras.
- N24: separera bekräftad sparning från återläsning, återförsök utan ny skrivning och skydd mot dubbelklick/okänt resultat.
- N02: kontobunden hantering, statuskontroll och sena svar efter konto-/ansökningsbyte eller avmontering.
- Inga nya AI-anrop, profilfakta, delningsregler, schema/RLS eller produktionsändringar. Frågorna förblir frivilliga efter skickad ansökan.

## Leverans

- Separat kontobunden klient använder kontrollerad token för varje skriv-/läsfas; den delade sessionen ersätts inte. Serverns befintliga RPC/RLS och återkallelsespärr bevaras. Återläsningen avgränsas till samma ungdom och annons och kontrollerar ägare igen före visning.
- Bekräftad skrivning följd av läsfel ger separat läsåterförsök. Okänt skrivresultat måste kontrolleras innan nytt utskick. Text/avståenden bevaras tills aktuella svar lästs och jämförts med den inskickade kopian. Läsåterförsök gör ingen ny skrivning; ett nytt utskick efter utebliven bekräftelse är ett uttryckligt användarval efter granskning.
- Synkront lås, tidsgränser, avbrott, konto-/annonsnyckel och statuskontroll stoppar dubbla klick och sena UI-svar efter avmontering/återkallelse. Detta tillför ingen generell server-idempotens eller versionskontroll för parallella redigeringar i flera flikar.
- Endast känd obesvarad automatisk språkfrågemall formateras om i vyn. Språknamn skiljs från fri kravtext, annonsens sammanhang bevaras, sparad frågetext/bedömningsunderlag ändras inte. Egen företagsformulering och besvarad/avstådd historik lämnas kvar.

## Verifiering och återstående acceptans

- Nya `test:supplement-recovery` kör verklig service/installerad SDK mot simulerad HTTP samt verkliga komponentcallbackar med kontrollerade hooks/DOM. Testar kontobunden token, förnyad samma-kontosession, ägarfilter, skriv-/läsfel, okänt resultat, läsåterförsök utan extra RPC, fel konto/rad, återkallad ansökan, avbrott, dubbelklick, kvarvarande text och sena svar.
- Regressioner: `test:application-supplement`, `test:company-questions`, `test:application-withdrawal`, `test:followup-batch`, `test:application-overview`, `test:matching`. TypeScript och riktad ESLint passerar; fullständigt bygge kontrolleras före merge. Driftsättningsstatus i PR.
- Verklig inloggad webb-/mobilacceptans återstår. Inga riktiga svar, konton, faktorer eller ansökningar ändras i testerna. F12:s bredare arbete med kravinformation och godkänd profilåteranvändning ingår inte här. Ingen punkt markeras Klar genom denna delimplementation.

