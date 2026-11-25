# N10 / L06 / L13 – kontots notismarkeringar

- Ansvarig: Vilgot / Codex
- Branch: `codex/n10-l06-l13-indicator-preferences-20261111`
- Status: För granskning; reserverad före kodarbete. Publicering till dev verifieras i PR.
- N10: uttryckliga kontosparade val för befintliga markeringar vid meddelanden, frivilliga frågor och notisklocka.
- L06: kontobundna anrop och återläsning efter osäkert svar; inga ändringar av lösenord, sessioner eller behörigheter.
- L13: egen avgränsad export av de booleska inställningarna. Inga övriga Auth-metadata eller hemligheter lämnas ut.
- Valen är presentation, aldrig behörighetskontroll. Meddelanden, ansökningar och notishistorik finns kvar; inga framtida mailkanaler visas.


## Leverans 2026-11-12

- Kontoinställningarna erbjuder uttrycklig sparning av tre olästmarkeringar. Företag ser bara relevanta val; standardval räknas inte som sparade inställningar.
- Separata kontobundna Auth-anrop ändrar endast `notification_indicators`. Befintlig metadata och databasroller bevaras. Inställningarna tilldelar inga behörigheter och styr inga mejlutskick.
- Ett osäkert sparsvar spärrar ny sparning tills sparade val har lästs. Skrivna val bevaras. Kontobyte, avmontering och dubbelklick hanteras utan automatisk omsparning.
- Navigationen visar bekräftade egna val och behåller dem vid tillfälligt läsfel. Innehållet i meddelanden, frågor och notishistorik påverkas inte.
- Insamling och strukturerad ZIP tar endast med den egna slutna projektionen av inställningarna. Övriga Auth-uppgifter förblir utanför; paketet anger fortsatt ofullständig täckning.

## Verifiering

- 21 modell-/transportkontroller och komponent-/provider-/navigationstest passerar (simulerade Auth-svar och hooks).
- Insamlings-, strukturerad export-, exportorkestrerings- och inventeringsregressioner passerar, inklusive 232 strukturerade exportkontroller.
- Kontoinställningar, kontoåterhämtning och notisregressioner passerar. Auth-routetestet kontrollerar nu Suspense-strukturen oberoende av fallbackens innehåll; tidigare test förutsatte den gamla tomma fallbacken trots befintliga hjälplänkar.
- TypeScript, riktad ESLint och produktionsbygge passerar.
- 23 faktiska DevStaging-kontroller passerar med två fiktiva konton: ungdom/företag, separat session, tappat avslutat sparsvar med enbart återläsning, kontogräns, bevarad metadata/roll och faktiskt ZIP-innehåll utan orelaterad metadata. Testet använder den verkliga Auth-/Data-API-transporten; endast klientkontext och ett avsiktligt tappat svar injiceras.
- Testkommando: `MNW_LIVE_INDICATORS_ALLOW_WRITES=true npm run test:live-indicator-preferences` (kräver lokala DevStaging-byggvärden).
- Fysisk mobil och sammanhängande inloggad browseracceptans återstår. N10/L06/L13 som helhet markeras inte Klar. Ingen databasstruktur, behörighetsregel, extern mejlkanal eller produktion ändras.

- Slutstädning verifierad med separat DevStaging-SQL: 0 QA-konton, 0 QA-sessioner och 0 QA-profiler kvar, inklusive båda kontona från det avbrutna försöket.
