# N12/N13 – återhämtning och kontoavgränsning i videoflödet

- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch: `codex/n12-n13-video-recovery-20261109`
- Bas: dev `30778f66be4381e409066aa42454ab6202d9ba89`; inga öppna dev-PR:er vid reservation 2026-11-09.
- Reservation publicerad före kodarbete. Fortsätt egna N12/N13: separera konto/samtal, stoppa nya sändningssteg efter avbrott/avmontering, begränsa åtkomstläsning/uppladdning/sändning och återanvänd video/meddelande-id vid osäkert svar. Möjliggör återkallelse i båda videovyerna. Återanvänd befintlig privat video, RLS och gallring; ingen migration, ny datakategori, AI eller produktion.
- SDK- och komponentprov med fiktiva värden/simulerad transport planeras. Fysisk kamera/mobil, inloggad browser och verkligt nätavbrott räknas inte som verifierade genom sådana prov. Huvudpunkterna förblir ofärdiga tills kvarvarande acceptans är verifierad.


## Leverans – PR #183

- Chattens videoförhandsvisning och inspelningssidan har egna arbetsytor per konto och samtal. Byte av konto tömmer den tidigare arbetsytans valda video, meddelande-id, uppladdningsreferens, fel och lyckad-status.
- Gemensam överföringslogik i `lib/chat-video-transfer.ts`: synkront lås för sändning/återkallelse, 120 s gräns för uppladdning och 20 s för sändning/återkallelse. Stopp av arbetsytan avbryter aktuell signal, förhindrar nästa steg och ignorerar sena UI-resultat även om transporten ignorerar avbrott.
- Osäkert sändningssvar behåller förhandsvisning och privat uppladdning. Manuellt återförsök använder samma videoreferens och meddelande-UUID. Endast exakt kvittens för rätt id, konto, samtal och video godtas vid nyckelkrock. Inget upsert, ingen automatisk omsändning.
- Explicit återkallelse finns nu även i studion. Misslyckat/okänt resultat behåller den väntande videon för nytt försök; bekräftad återkallelse låter användaren välja/spela in en annan. Byte av video är spärrat medan en tidigare uppladdad video fortfarande har osäker sändningsstatus.
- Studions åtkomstläsning har 15 s tidsgräns, avbrott, match-/konto-/samtalskontroll och synligt återförsök. Sparknappen spärras tills åtkomsten kunnat läsas.
- SDK-anrop för metadata, meddelande och återkallelse får uppgiftens AbortSignal. Förväntat konto kontrolleras före skrivning och före Storage-uppladdningens tokenanvändning; återkallelse filtreras även på ägare. Befintlig serverautentisering, privata bucket, RLS, videogränser och 14-dagarsregler bevaras.
- Befintliga dialoger, videoförhandsvisning, knappar och CSS-ytor återanvänds. Inga nya färger eller visuella hjälppaneler; relevanta status-/återförsökskontroller ligger i befintlig vy.

## Faktisk verifiering 2026-11-09

- `test:video-recovery`: verkliga klientfunktioner genom installerad Supabase SDK med simulerad HTTP. Ägar-/samtalsfilter, AbortSignal, avslag, felaktiga dubblettkvittenser och återkallelse verifieras. Verklig överföringslogik samt komponenternas callbacks/effects körs med simulerade transporter/hooks: konto/samtal, dubbelklick, bibehållen video/UUID, upload- och send-timeout, sena svar, avbryt, avmontering och återkallelse/nytt försök.
- Före/efter: `VIDEO_PAGE_REF=30778f66be4381e409066aa42454ab6202d9ba89 node scripts/test-video-workspaces.mjs` faller på den tidigare studions kontoisolering; ändrad studio passerar. Detta är ett komponentprov, inte en browserreproduktion.
- `test:profile-video`, `test:video-retirement`, `test:video-retention`, `test:video-playback` och `test:chat-recovery` passerade. Befintliga videoharness anpassades till de nya arbetsytegränserna och kör fortsatt verkliga funktioner/callbacks. Upload-provet verifierar att bytt sessionsägare efter metadata inte börjar Storage-uppladdning.
- TypeScript, riktad ESLint för samtliga ändrade kod-/testfiler, `git diff --check` och `npm run build` passerade. Bygget har befintlig metadataBase-varning.
- `test:accessibility` är inte godkänt: det stannar vid en äldre förväntan om `<TabList id="company-applications">` i företagssidan. Testfilen och företagssidan är oförändrade från bas-dev (bekräftat med Git-diff). Detta åtgärdas inte genom att ändra företagets pågående navigation i denna leverans.
- Ingen ny QA-data, uppladdning, videodelning eller privat mottagarkontakt skapades i DevStaging. Ingen databas-/RLS- eller produktionsändring.

## Kvarstående acceptans

- Inloggad browser, fysisk kamera/mobil, verkligt nätverksavbrott, Storage och live-RLS behöver fortfarande verifieras. Simulerad SDK/media/hooks är inte sådan evidens. N12/N13 kryssas inte Klar.
- Avbrott/tidsgräns är inte server-rollback: en redan påbörjad skrivning kan ha nått servern. Samma UUID kan bara återanvändas under aktuell arbetsytas livstid; ingen beständig videoutkorg efter omladdning eller utloggning införs.
- Befintlig återkallelse vid avbruten/misslyckad upload är ett försök med användarens behörighet; ingen utlovad omedelbar fysisk filradering. Befintlig central gallring och rapportundantag bevaras.
- PR: https://github.com/vilgotdidrikson/youth-job-mvp/pull/183. Slutlig commit/dev-status redovisas även i PR:n.
