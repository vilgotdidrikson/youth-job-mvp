# L04/L03/N07 – kvarvarande versionskonflikter

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/l04-l03-n07-conflicts-20261105`
- Reservation 2026-11-05 före kodarbete, från dev `a8febe6`. Öppna PR:er kontrollerade; endast äldre #40.
- Avgränsad gemensam leverans inom redan pågående punkter: ersätt permanent 40001-konflikt med vanlig HTTP 409 i anställningsgranskning, fakturauppgifter och Ångra bortval. Bevara villkor, lås, behörigheter, datamodell och säker loggning. Anpassa befintliga klienter till ny och äldre konfliktkod.
- Verifiering: fakturauppgifter och bortval med fiktiva Auth-konton och verklig HTTP; anställningens två granskningskonflikter med riktiga databasroller i en återställd transaktion. Inga bestående testanställningar, fakturor, betalningar, AI-anrop eller produktionsändringar. Testkonton städas via eget konto-API.
- Ingen ny prisregel, fakturagenerering eller aktivering. Hela L04/L03/N07 behåller status tills deras övriga acceptans är klar.
