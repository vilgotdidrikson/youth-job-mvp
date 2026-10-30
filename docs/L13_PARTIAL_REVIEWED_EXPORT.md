# L13 – delvis granskade kategorier

Reserverad före kodarbete 2026-10-30: Vilgot / Codex, `codex/l13-partial-reviewed-export-20261030`, från dev efter #160. Aktuell dev och öppna PR:er kontrollerade. Låt uttryckligen granskat innehåll paketeras inom en delvis färdig kategori, med kvarvarande granskning synlig i HTML/JSON/täckningsstatus. Bevara konto-/fil-/granskningsgränser. Ingen automatisk bedömning av fritext eller publik exportaktivering. L13 fortsatt Pågår.


## Problem och leverans

Paketbyggaren kunde tidigare antingen inkludera en hel kategori eller utelämna dess dataposter medan granskning återstod. Det hindrade ett ärligt delutdrag med redan granskade poster, särskilt när en kategori även innehåller olästa källor. Ny kategoristatus partially_included låter uttryckligen granskat innehåll ingå samtidigt som kategorin står kvar som väntande.

Valideringen kräver minst en granskad post i en delvis inkluderad kategori och samma kontokoppling, sammanfattning och hemlighetskontroller som för included. Tillhörande JSON får status=partially_included och needsCompletion=true även om filen läses separat. HTML visar Delvis inkluderad och länkar till de tillgängliga posterna. Manifestets pendingCategories innehåller kategorin och coverage förblir needs_completion, även om allt annat är markerat ej tillämpligt.

Granskningsgränsen från #160 kräver fortfarande explicit betrott beslut och rätt fingerprint. Olästa källor kan inte uppgraderas till included/not_applicable; delvis inkluderat underlag är däremot tillåtet. Rå insamling kopieras aldrig automatiskt. Granskad filmetadata kan vara delvis inkluderad och bära uttryckligen godkända originalfiler. Filer får INTE själva status partially_included: filbytes måste fortfarande matcha originalet, eller hållas inne som requires_review/unavailable. Detta inför ingen automatisk fältpolicy eller rättighetsbedömning.

## Verifiering och begränsningar

39 granskade paketprov (åtta nya) och 76 tidigare paketregressioner passerar, totalt 115. Nya proven extraherar faktisk ZIP och kontrollerar partial-markering i HTML/JSON/manifest, bevarade granskade poster, uteslutna råsentinels, kontofrämmande rad, tom partial, hemligt fält, delvis filmetadata med korrekt original, ogiltig partial-filstatus, fortsatt ofullständigt paket och HTML-escaping. Riktad ESLint, TypeScript, diff-check och produktionsbygge/57 routes passerar. Befintlig metadataBase-varning kvarstår.

Enbart lokala fiktiva uppgifter. Ingen liveexport eller databasändring; inga AI-anrop. Återstår: faktiska automatiska fältpolicyer/betrodd granskningsprocess, liveintegration, fullständiga källor, nyautentiserad beställning/hämtning och automatisk gallring. Ingen publik användarexport aktiveras. Gemensamma ATGARDSPLAN.md lämnas oförändrad enligt publiceringsbegränsningen; status redovisas här. L13 fortsatt Pågår, produktion orörd.
