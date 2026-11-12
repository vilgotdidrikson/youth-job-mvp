# N21 – valfri genomläsning av uppladdat CV

- Status: För granskning (leveransen), kortet N21 står på Pågår tills inloggad kontroll i L17
- Ansvarig: Vilgot / Claude
- Branch: `claude/n21-cv-feedback-20261112`, reservation `1d9d241` publicerad före kodarbete

## Vad som levereras

- Efter uppladdad PDF visas en valfri panel **Få förbättringsförslag** på CV-sidan. Uppladdningen är klar utan den.
- Servern läser ägarens egen fil med befintlig privat PDF-läsning. Skannad eller oläsbar fil ger ett tydligt besked och inget AI-anrop; inget falskt genomläsningsbesked.
- Namn, adress, postnummer, e-post, telefon och känsliga uppgifter tas bort lokalt med befintlig minimering innan texten skickas. Blir för lite text kvar görs inget anrop.
- Högst fem tips (saknas, otydligt, struktur, upprepning) med öppna frågor. Modellen instrueras att inte hitta på fakta, inte fylla i svar och inte ge betyg. Tips om ålder, kön, ursprung, familj, foto, hälsa eller religion filtreras bort även om modellen ger dem.
- Kontaktuppgifter och personnummer i filen upptäcks lokalt och ungdomen får veta att företag ser hela filen.
- En fråga kan besvaras frivilligt och sparas i profilen via de sparade svaren från F12/N19. Fältet är alltid tomt från början.
- Originalfilen ändras aldrig, förslagen sparas inte och inget nytt CV skapas. Ingen databasändring. Egen kvot: sex anrop per timme.

## Faktiskt körda kontroller

- `test:cv-feedback`: 45 kontroller av delad modul och verklig route-hanterare med kontrollerad inloggning, fil och AI-svar. Bland annat att identitets- och kontaktuppgifter inte skickas, oläsbar fil och saknat CV utan anrop, felaktigt eller avbrutet AI-svar utan läckta detaljer, nekad roll, utfiltrerade känsliga tips och att varken route eller panel skriver till filen.
- Regressioner: cv-save-recovery, profile-journey, server-failures, saved-answers, cv-document och uploaded-cv-binding passerar. TypeScript, riktad ESLint och standardbygge passerar.

## Begränsningar

- Ingen verklig modellkörning och ingen inloggad webb- eller mobilkontroll; ingår i [L17](ATGARDSPLAN.md#l17).
- Lokal rensning och ämnesfilter är heuristiska och kan missa ovanliga formuleringar.
