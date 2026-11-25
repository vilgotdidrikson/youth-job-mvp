# L12 – videors åtkomst och gallringsgrund

Avgränsad leverans 2026-10-18, branch `codex/l12-video-retention-20261018`, [PR #73](https://github.com/vilgotdidrikson/youth-job-mvp/pull/73), kodcommit `25c7d40c79248582948caaad0b9ad94d4305f570`.
Status: För granskning. Databasens åtkomstgräns är införd i DevStaging. Gallringsarbetaren är driftsatt och ett verkligt Storage-test har passerat efter användarens uttryckliga godkännande. **Automatisk gallring är fortfarande avstängd**. N23 förblir Ej påbörjad.

Uppföljning 2026-10-27: L05 ersätter direkt klienthämtning av videobytes med serverkontrollerad `POST /api/videos/playback` för färsk åtkomstkontroll. Ansöknings-/textchattens separata, avstängda gallringsgrund dokumenteras i [L12_APPLICATION_CHAT.md](L12_APPLICATION_CHAT.md). Nedanstående beskriver videoleveransens ursprungliga verifiering.

## Implementerat

- Nya videor registreras med serverns tid och 24 timmars frist som oskickad uppladdning. Det ger ett dygn för återförsök efter avbrott utan att övergivna filer ska sparas obegränsat. Detta är en teknisk städregel inom L12, inte en lagstadgad frist.
- Första lyckade meddelandereferensen sätter `first_sent_at` till serverns skicktid och `expires_at` till 14 dagar senare. Ett klientangivet `messages.created_at` påverkar inte fristen. Samtidiga delningar och gallringsanspråk låser samma videorad; nya referenser förlänger inte fristen. En utgången uppladdning får varken laddas upp eller delas igen.
- För befintliga filer används äldsta referensens `messages.created_at`, den historiska skickuppgift som finns tillgänglig. Äldre klienter kunde ange detta fält; backfillen bevisar därför inte den historiska tidens riktighet. Oskickade äldre filer utgår från registreringstiden. Äldre profilvideo är fortsatt avstängd enligt N22 och undantas från denna fysiska gallringsleverans.
- RLS och privata åtkomstfunktioner stänger byteåtkomst vid `expires_at <= statement_timestamp()`, även om gallringsarbetaren är stoppad eller filradering misslyckas. Företag ser bara videor som redan delats i deras egen oblockerade chatt; profilåtkomst öppnas inte.
- Klienten kan inte ändra serverns tidsfält eller sätta dem vid INSERT. Storage SELECT begränsas med en restriktiv operationspolicy till autentiserad objekthämtning och dess informationsanrop. Signering, listning, direkt tabelläsning och den tidigare ägarvägen för signering spärras. Klientens direkta filradering är borttagen; raderingsarbetaren ska hantera rapportundantag och återförsök centralt.
- Spelaren hämtar metadata utan att hämta videobytes. Den visar exakt utgångstid inklusive sekunder i svensk tid för båda parter. Vid uppspelning görs autentiserad Storage-hämtning med `cache: no-store`; därefter används en lokal Blob-URL. Vid utgångstiden stoppas uppspelningen och URL:en frigörs, även efter återgång från bakgrundsflik. Sen ankomst efter avmontering frigörs också. Neutral text: ”Videon är inte längre tillgänglig.” Den texten påstår inte att fysisk radering redan har lyckats.
- Avsändaren informeras före delning om tvåveckorsfristen och att mottagaren kan hinna missa videon. Video påverkar inte matchpoäng eller ansökans synlighet. Ingen AI-analys införs.

## Förberedd, avstängd filgallring

`lib/video-cleanup-worker.ts` återanvänds av `supabase/functions/video-cleanup/index.js`. Tjänsten tar enbart POST och en oberoende slumpad 256-bitars token i Authorization. Token lagras i Vault och valideras med en service-only RPC. Användar-JWT eller sökvägar i request body ger ingen behörighet. Gatewayens JWT-kontroll ersätts för just denna interna funktion av funktionens egen autentisering; funktionen är inte en anonym raderings-API.

Migreringen installerar `mnw-video-cleanup` var femte minut men `private.video_cleanup_config` är tom och `enabled=false`. Ingen HTTP-förfrågan skickas av det avstängda schemat. Driftsättning och det avgränsade verkliga Storage-testet är verifierade i DevStaging; övriga kontroller och rapportundantagen nedan återstår före aktivering.

Arbetaren hämtar högst tio objekt per körning, med tvåminuterslease, `FOR UPDATE SKIP LOCKED`, ny låstoken och återtagning av övergiven lease. Endast servern väljer bucket och sökväg. Filen tas bort genom Storage API, aldrig genom SQL i `storage.objects`. Saknat objekt ska kunna raderas idempotent. Misslyckande ger återförsök med ökande väntetid; byteåtkomst förblir spärrad. Fel eller utebliven kvittens efter borttagning återhämtas via ny lease.

Efter kvitterad borttagning rensas sökväg, MIME, filstorlek och längd. En minimal metadatarest med id, ägare/chatt, första skicktid, utgångstid och raderingstid bevarar meddelandets neutrala markering; den innehåller ingen filåtkomstreferens. Dessa rader behöver senare omfattas av besluten om chatt-/kontogallring. Inga miniatyrbilder genereras av nuvarande videoflöde.

Rapporterade videor väljs inte för fysisk radering. Ordinarie uppspelning stängs ändå vid utgångstiden, även i produktens adminspelare. Detta är en uttrycklig kvarstående blockerare, **inte ett beslut om permanent lagring**. Befintlig 12-månadersregel för avslutade moderationsrapporter i `docs/account-deletion.md` löser inte i sig öppna ärenden, videofiler eller avgränsade omprövningsfrister. Rapport efter att radering redan påbörjats kan inte återställa filen; samtidighet och hantering av sådana ärenden måste verifieras före aktivering.

## Faktiskt verifierat

- `npm run test:video-retention`: delade tidsgränser före/vid/efter; verkliga spelarcallbacks för metadatavisning utan automatisk nedladdning, stopp/frigöring vid utgång och sent svar efter avmontering; arbetarens lyckade svar, återförsök, kastat transportfel, kvittensfel och tom kö; Edge-handlerns POST-krav, utebliven/felaktig token, RPC-fel och godkänd autentisering. Media/transport är simulerade.
- `scripts/test-video-retention.sql` mot DevStaging, med rollback: serverstyrd första skicktid trots framtida klientdatum, 24-timmarsfrist, nekad tidsmutation, flera referenser, tillåten hämtning före utgång, nekad signering/listning, spärr vid/efter utgång, nekad utgången uppladdning/delning, utgångsmetadata för företag, service-only gallring, lås/lease/återtagning, felaktig token, återförsök och väntetid, rapportundantag, skrapad metadata och bevarade meddelanden. Kvitterad filradering simuleras i SQL; SQL-testet raderar inga verkliga bytes.
- Uppdaterat `scripts/test-video-rls.sql` passerar med N22-regressionerna och nya hämtnings-/återkallanderegler. Alla fixtures rullas tillbaka.
- `test:video-retirement`, `test:profile-video`, `test:profile-journey`, `test:matching`, `test:application-supplement`, TypeScript och berörd ESLint passerar. Webpack-byggnad passerar med 50 sidor. PR anges i åtgärdsplanen vid publicering.
- Säkerhetsrådgivaren före/efter: samma 33 WARN. Två nya INFO gäller avsiktligt stängda `private.video_cleanup_jobs` och `private.video_cleanup_config` med RLS och utan användargrants/policies. [Förklaring till RLS utan policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Efter tester: fyra befintliga videometadatarader och fyra Storage-objekt kvar; inga gallringsjobb kvar och `enabled=false`. Migrering `20261018170906_l12_video_retention.sql` applicerad endast i DevStaging. Äldre migrationshistorik orörd.

## Verifieringsuppföljning efter användarens godkännande

Användaren godkände uttryckligen filtestet 2026-10-18. Uppföljningen reserverades på `codex/l12-storage-verification-20261018` före körningen och dokumenteras i [PR #74](https://github.com/vilgotdidrikson/youth-job-mvp/pull/74), verifieringscommit `7b499b0bd8bd25165811094b5c0a999b5c1e460b`. Det tidigare avslaget från automatisk godkännandegranskning gällde bristande uttryckligt godkännande av testdriftsättningen; den nya driftsättningen godkändes efter användarens svar. Ingen kringgående väg användes.

- Testvariant av `video-cleanup`, version 1, körde `scripts/manual-video-storage-smoke.mjs` bakom samma Vault-tokenkontroll som den vanliga funktionen. Projektet låstes till DevStaging, namngivna fiktiva QA-fixturer kontrollerades och kön måste vara tom före testet. Inga verkliga rekryteringar användes som testdata.
- HTTP 200: `passed=true`, två verkliga Storage-objekt uppladdade och borttagna, två metadatarester rensade, upprepad körning `claimed=0`. Hämtning av båda borttagna objekten nekades. Slutstädningen kunde dessutom ta bort redan saknade objekt utan fel. Testfilerna bestod av 100 syntetiska bytes per fil med video/mp4; detta verifierar filhantering, inte en spelbar videokodek eller fysisk kamera.
- Testets egna filer och metadata togs bort i finally. Efteråt fanns exakt de fyra befintliga videometadataraderna och fyra befintliga Storage-objekten kvar, inga gallringsjobb och `enabled=false`.
- Testläget ersattes omedelbart av den ordinarie Edge-handlern, version 2. Den driftsatta ordinarie bundlens SHA-256 är `e1f2cd9f441310cd86c33fd17a02fe9f3bb45d3bb259744f8dc6de461664643e`. Manuellt testunderlag ingår inte i den ordinarie bundlen.
- Verkliga HTTP-anrop till den ordinarie versionen: saknad token → 401, felaktig men formmässigt giltig token → 401, korrekt Vault-token → 200 med `claimed=0, deleted=0, retry=0`. Det sista svaret verifierar den återställda ordinarie handlern; det skapar inga testfiler.
- PR #73 är införd i dev som `3e1c7719398f7936b5a8c9b1c473510e3d8eb990`; dev-deploymentens Vercel-status är success. Ingen ny produktkod eller databasmigrering behövdes för denna uppföljning.

## Återstår före aktivering

Automatisk gallring förblir avstängd. Den tidigare tillståndsblockeringen och det grundläggande verkliga filtestet är lösta, men hela L12 är inte Klar.

Verifiera verkliga autentiserade klient-HTTP-anrop som nekar signering och utgångna nedladdningar, inloggad visuell kontroll och fysisk uppspelning i stödda webbläsare. Verifiera ett faktiskt avbrutet/felande Storage-anrop och återförsöket över tid; de befintliga fel-/leaseproven är simulerade transportfel respektive rollback-SQL. Testa verklig parallell delning/gallring/rapportering och avbruten uppladdning nära städgränsen. Rapportundantagens avgränsade tider/omprövning och hantering av rapport efter påbörjad radering återstår. Bevaka misslyckade HTTP-körningar, försenade jobb och rapportundantag utan filinnehåll i loggarna.

Tidigare utfärdade signerade länkar kan fungera till sin ursprungliga utgångstid; tidigare klient använde 300 sekunder men direkt API-signering tillät tidigare andra tider. Ingen fullständig återkallelse av sådana länkar påstås. Nya länkar kan inte utfärdas av klienten efter denna migration. En redan inledd nedladdning, webbläsarminne, sparade externa kopior och cache kan inte återkallas genom RLS. Nya hämtningar använder no-store och nya uppladdningar har cacheControl=0. Inventering av äldre cache, backuprotation och leverantörskopior återstår före lansering.

Övriga L12-kategorier, rättslig grund per kategori, avvecklade profilfiler och moderationsundantag återstår. Integritetssidan beskriver uttryckligen att automatisk filradering ännu inte är aktiverad i utvecklingsversionen. Varken hela L12 eller N23 markeras Klar av denna leverans.
