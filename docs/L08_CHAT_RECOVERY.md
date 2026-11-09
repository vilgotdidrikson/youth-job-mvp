# L08/D02 – chattens läsning och sändningsåterhämtning

- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch: `codex/l08-chat-recovery-20261109`
- Bas: dev `d563581cb0afa199004e73f95df74a834936e671`; öppna PR:er kontrollerade, inga returnerade.
- Reservation 2026-11-09 före kodarbete. Fortsätt egen L08/D02 med en sammanhängande chattleverans: konto-/konversationsisolering, begränsade läsningar/återförsök och bevarade meddelandeutkast vid osäkert sändningssvar. Tidigare högre punkter har kvar browser-/aktiverings-/pris-/dataskyddsberoenden enligt arbetsplanen. Ingen ny AI, persondatakategori, migration, RLS eller produktion.
- Granskningsfokus: sena list-/historiksvar, bytt konto, avmontering, timeout och sändningsförsök med samma innehåll efter osäkert svar. Återanvänd gemensam läshantering och befintliga datakällor. Ingen kontakt med riktiga mottagare; klient-/SDK-prov använder fiktiva uppgifter och simulerad transport.
- Verifiering planeras med verkliga callbacks/installerad SDK, relevanta regressioner och bygge. Fysisk mobil och inloggad browser räknas inte som verifierade genom komponentprov. Huvudpunkterna markeras inte Klar utan kvarvarande acceptans.

## Leverans – PR #182

- Arbetsytan monteras om per konto. Inkorg, vald konversation, sökning, meddelanden och utkast delas inte över kontobyte; sessionStorage använder fortsatt konto och samtal i nyckeln.
- Inkorg och historik använder gemensam latest-read-hantering: avbryt tidigare läsning, 15 sekunders tidsgräns, explicit återförsök och ignorera sena svar även om transporten inte respekterar AbortSignal. Konversation som försvinner ur ny inkorg avmarkeras. Historik/realtime från annat samtal accepteras inte. Bakgrundsfel syns med återförsök även utan vald chatt och får inte lämna första laddningen i en evig spinner.
- Textsändning har synkront dubbelklickslås och 20 sekunders tidsgräns. Osäkert svar behåller texten. Manuellt återförsök med samma text/samtal återanvänder UUID under arbetsytans livstid. Endast en exakt egen befintlig textrad i samma samtal får bekräfta en primärnyckelkrock. Ingen upsert eller automatisk omsändning. En ny avsiktlig identisk sändning efter bekräftelse får ett nytt id.
- SDK-läsningar har AbortSignal. Ägaren kontrolleras före sändning och efter åtkomstläsning; inboxresultat kontrolleras mot förväntat konto och deltagare. Befintlig serverautentisering och RLS gäller fortsatt. Kontrollen ersätter inte dessa.
- Logiken för inkorg och textsändning är fristående från sidans JSX och kan återanvändas i en framtida mobilapp.

## Faktisk verifiering 2026-11-09

- `npm run test:chat-recovery`: verkliga lib-funktioner genom installerad Supabase SDK med simulerad HTTP, samt verkliga sidcallbacks/effects med simulerade React-hooks. Verifierar UUID/ägare/filter, exakta kvittenser och felaktiga kollisioner, avslag, kontobyte, avbrott, dubbelklick, bevarade utkast, återförsök, timeout, sena svar, bytt samtal, förlorad konversation och bakgrundsfel under första laddningen.
- Regression före/efter: `CHAT_PAGE_REF=d563581cb0afa199004e73f95df74a834936e671 node scripts/test-chat-page-recovery.mjs` faller på konto-isolering i tidigare sida; samma test passerar mot ändrad sida. Det är ett komponentprov, ingen reproduktion i riktig browser.
- `npx tsc --noEmit --pretty false`, riktad ESLint och `npm run build` passerade. ESLint har två befintliga oanvända hjälpfunktioner i `lib/matching.ts`; inga nya lintfel. Bygget har befintlig metadataBase-varning.
- Regressioner `test:recruitment-review`, `test:application-withdrawal`, `test:notifications`, `test:matching`, `test:data-retention`, `test:video-playback` passerade.
- Inga konton, meddelanden eller rekryteringar skapades i DevStaging för dessa prov. Ingen migration eller schema-/RLS-ändring.

## Kvarstående acceptans och begränsningar

- UUID-återförsök finns endast under aktuell arbetsytas livstid. Omladdning/utloggning ger ingen beständig utkorg. Timeout kan inträffa efter att servern redan sparat meddelandet; inget påstående om återställning av den skrivningen.
- Inloggad browser, fysisk mobil med virtuellt tangentbord, verkligt nätverksavbrott, realtime och live-RLS för denna leverans är inte verifierade. Lokal Chromium är blockerad av miljön; ingen ny inloggning eller privilegierad QA-roll användes.
- Ingen ny historikpaginering eller bred CSS-migrering ingår. D02/L08:s tidigare acceptans och övriga designägares arbete kvarstår; huvudpunkterna kryssas inte Klar.
- PR: https://github.com/vilgotdidrikson/youth-job-mvp/pull/182. Slutlig commit och dev-deployment kopplas till PR:n.
