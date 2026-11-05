# N19/N02 – samtidiga profiländringar och återkallelser

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/n19-n02-concurrent-conflicts-20261105`
- Reservation 2026-11-05 före kodarbete, från dev `542cfa4`. Öppna PR:er kontrollerade; endast äldre #40.
- Omfattning: samma återförsöksrisk som rättades i #178 finns i profilens versionskontroll och återkallelsens förväntade status. Bevara kontrollernas villkor och behörigheter, använd vanlig HTTP-konflikt och verifiera verkliga samtidiga förfrågningar. Kontrollera även profilformulärets felmeddelande och att osparad text bevaras. Två pågående punkter följs upp tillsammans; inga nya datafält, AI-anrop eller produktionsändringar.
- Slutprov: två sparningar med samma profilversion, gammal återkallelsebekräftelse, konkurrerande sändning/återkallelse, idempotent dubbel återkallelse och gammal klient efter återkallelse. Fiktiva QA-konton med egen städning. Hela N19/N02 markeras inte Klar genom enbart kod eller lokala kontroller.
