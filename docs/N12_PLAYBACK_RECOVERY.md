# N12 – återhämtning vid videouppspelning

Ansvarig: Vilgot / Codex. Branch: `codex/n12-playback-recovery-20261116`, från dev `890675e`. Reservation `14a6b7f` publicerad före kodarbete 2026-11-16. Endast äldre PR #40 till master var öppen vid kontrollen.

## Reproducerat problem och slutligt beteende

Det nya provet av spelarens faktiska callbacks/effects fallerade på den gamla koden: ett metadatasvar efter avmontering startade ändå en begäran om videobytes. Metadataläsningen saknade även tidsgräns. Reproduktionen använder simulerade hooks och transport, inte en webbläsare.

Spelaren har eget tillstånd per video-ID och återanvänder `createLatestRead` för inledande metadata och uttryckligt uppspelningsval. Varje läsning har en total tidsgräns på 45 sekunder. Fel och timeout lämnar uppspelningsknappen tillgänglig för nytt försök. Ett synkront lås hindrar två läsningar från dubbelklick före nästa rendering. Inledande metadata laddar inga videobytes.

Stängning, videobyte och utgången tillgänglighet avbryter läsningen. Ett sent metadatasvar får inte fortsätta till bytehämtning; sena blob-adresser frigörs även om transporten ignorerar avbrottet. Befintlig uppspelning pausas och dess lokala adress frigörs vid stängning. Klienten förmedlar avbrott till Supabase-frågan och uppspelningsanropet och kontrollerar avbrott efter sessions- och kroppsläsning, före nya anrop/lokala adresser.

Privat API, autentisering, serverns dubbla RLS-kontroll, cacheförbud och gallringsregler bevaras. Inga schema-, Storage-, behörighets- eller produktionsändringar. Befintlig spelare, knappar och stilar återanvänds; inga CSS-ändringar.

## Verifiering

- `test:video-playback`: befintliga routeprov samt nytt prov av faktiska spelarkomponentens callbacks/effects. Stängning under metadata, metadata-/hämtningstimeout, nytt försök, sena svar, dubbelklick, videobyte, frigjord sen blob-adress och otillgänglig video.
- `test:video-recovery`: installerad Supabase-SDK med simulerad HTTP verifierar signal till metadatafråga, ID-filter, föravbruten läsning och nekad sen metadata efter avbrott. Befintliga överförings-/studio-/chattprov passerar.
- `test:profile-video`: befintlig validering/inspelning och klientprov, kompletterat med avbrott före uppspelning, under sessionsläsning och under bytehämtning. Avbruten kroppsläsning skapar ingen blob-adress.
- `test:video-retirement` och `test:video-retention`: profilvideo förblir avvecklad; utgången video stoppas och sena adresser frigörs. Gallringsharness använder den verkliga gemensamma läsaren och inväntar dess mikrouppgifter. Dess importborttagning accepterar även Windows-radslut. Worker-/Edge-kontroller bevaras.
- TypeScript (`npx tsc --noEmit`), riktad ESLint för samtliga ändrade kod-/testfiler, `git diff --check` och slutligt `npm run build` passerar. Bygget genererade 66 sidor och har befintlig metadataBase-varning. Ombyggets första försök stoppades av `EPERM` vid städning av en tidigare OneDrive-byggkatalog. Den gamla `.next`-utmatningen bevarades i `node_modules/.cache/n12-build-backup-20261116`; därefter passerade slutbygget från tom byggkatalog. Inga källfiler raderade.
- `check:design-tokens` kördes men är inte godkänt på Windows: skriptets `join` ger bakåtsnedstreck medan undantaget för `styles/theme.css` och baslinjens nycklar använder framåtsnedstreck. Det räknar därför även temafilens 35 färger (434 → 469) och rapporterar befintliga filer som nya. Ingen baslinje eller CSS ändrad för att dölja detta.

## Återstående acceptans

Inga inloggade browser-, mobil-, fysiska kamera-/uppspelnings-, verkliga nätavbrotts- eller live-RLS-prov ingår. Samtliga nya komponent-/transportfall är simulerade. Ingen ny QA-data skapad i DevStaging. N12 förblir För granskning; denna avgränsade leverans uppfyller inte hela kortets acceptanskrav. Kodcommit `eb351d0`, [PR #218](https://github.com/vilgotdidrikson/youth-job-mvp/pull/218) till dev. Publicerad för granskning, inte införd i dev.

## Granskning inför införande 2026-11-17

Vilgot / Codex granskade PR #218 och kontrollerade dess sammanslagning med aktuell dev `a53b049`. Max senare CSS-/färgtokenarbete bevaras. Inga ytterligare produktändringar behövdes.

- N12: de faktiska spelar-/klientproven passerar för avmontering, video-ID-byte, försenad metadata/blob, timeout, återförsök och dubbelklick. Metadata laddar inga videobytes automatiskt. Privat endpoint, autentisering/RLS och cacheförbud är bevarade.
- N13: inspelnings-/studio-/kompositörsregressioner passerar för stängda mediespår, sent behörighetssvar, avbrott, nekad kamera och uttryckligt skickande. Simulerade media-API:er; ingen fysisk kamera har använts.
- L12: utgångsgräns, stoppad befintlig spelare, sena frigjorda blob-adresser samt befintliga worker-/Edge-prov passerar. Ingen ändrad serverfrist eller aktiverad gallring.
- Samtliga `test:video-playback`, `test:video-recovery`, `test:profile-video`, `test:video-retirement`, `test:video-retention`, riktad ESLint och TypeScript passerar. Produktionsbygget på den sammanslagna koden passerar. Spelar-/gallringsproven och designtokens kördes även efter sammanslagningen.
- `check:design-tokens` passerar på Linux med aktuell dev-baslinje: 309 färgliteraler, 139 textstorlekar, 56 radier och 10 vikter. Det tidigare dokumenterade Windows-problemet är inte rättat här.
- Inloggad browser/mobil, verklig mediaöverföring, fysisk kamera och live-RLS är fortsatt inte verifierade. De tre huvudkorten markeras inte Klar. Införandets slutliga commit/driftsättning följs i PR #218.
