# L08 – inloggad Chromium-verifiering

[PR #145](https://github.com/vilgotdidrikson/youth-job-mvp/pull/145), `codex/l08-browser-verification-20261028`, Vilgot / Codex. Reserverad före arbete 2026-10-28. Avgränsad P1-verifiering av dev; hela L08 förblir Pågår.

## Faktiskt genomfört

Mot `https://youth-job-mvp-dev.vercel.app`, DevStaging, med två nya fiktiva konton och tre tydligt märkta fiktiva annonser. Chromium **153.0.8010.0**, Playwright **1.62.1**, headless med programvarurenderad WebGL/SwiftShader. Browserautomationens nätverk använder miljöns proxy; inga proxyuppgifter skrivs ut. Webbläsaren installerades separat via `@sparticuz/chromium@153.0.0`, utan ändrade projektberoenden.

Slutkörning: **153 browserkontroller passerar**, exit 0. Detta är assertions inom nedanstående flöden, inte 153 separata användarresor. Kontrollen använder riktig Auth, riktiga RPC-/databas-/konto-API:er och driftsatt UI. Inga HTTP-svar ersätts med testdata. Reservvyn framtvingas genom att browserns canvas vägrar WebGL-kontext.

| Flöde | Verifierat |
|---|---|
| Inloggning | Båda rollerna loggar in genom det riktiga formuläret. Lösenord/token genereras och hålls enbart i processminnet. |
| Profilinställningar | Båda rollerna vid 375 × 812, 768 × 812 och 1280 × 812. Ingen horisontell dokumentoverflow. |
| Raderingsdialog | Verklig native-modal, rätt kontomejl, dolt lösenord och dialog inom viewport. 16 Tab-steg per roll/bredd stannar i modalens fokuscykel; Escape stänger och återför fokus till öppningsknappen. |
| Felaktig radering | Vid 375 × 667: fel lösenord nekas, dubbelklick ger ett DELETE-anrop, lösenord och kryssruta töms, Avbryt fungerar och kontot finns kvar. Ingen lyckad radering via UI påstås i detta prov. |
| Karta | WebGL2 tillgängligt, Mapbox-canvas och nio pins i den aktuella publicerade dev-datan. En pin aktiveras med Enter och får expanderat tillstånd. Ingen dokumentoverflow i mobilbredd. |
| Reservvy | Framtvingad WebGL-brist visar fel-/listvyn, tillgängliga jobbkort och ingen kartcanvas. Ingen dokumentoverflow. |
| Overifierat företag | De tre egna testannonserna förblir `pending_verification` och syns inte i listan. Ungdomens direkta Data API-läsning av företagets annonser ger noll rader. Företagsverifieringen kringgås inte. |

Testföretaget är avsiktligt overifierat. Publicerade befintliga dev-jobb används enbart för kartans läs-/pinprov; inga andra användares annonser/ansökningar ändras. Ingen verklig rekrytering, matchning, anställning, betalning, AI-/e-postleverans eller mediauppladdning utfördes.

Slutprotokoll:

```json
{"fixturePrefix":"qa-l08-1793190436262-ad8fe61a","passed":153,"observations":[{"kind":"map","webgl":true,"canvas":true,"pins":9,"fallback":false},{"kind":"fallback","qaJobs":0}],"remainingFixtureIds":[]}
```

Kontona raderades via eget konto-API i `finally`; annonserna följer FK-kaskaden. Separat SQL-efterkontroll visar **0 QA-konton, 0 QA-annonser och 0 QA-adminmedlemskap**. Slutuppsättningen skapar inga adminmedlemskap. Ingen schema-/behörighetsändring eller produktkodfix behövdes för dessa slutliga prov. Riktad ESLint och diff-check passerar.

## Tidiga försök och avgränsning

Tidiga körningar avbröts av stängd stdin, ett indirekt väntvillkor och felaktigt förväntad synlighet för overifierade annonser. En separat korrigering av seed-steget hade ett syntaxfel; försök med ett tillfälligt adminsteg stoppades också av databasverktygets `Invalid or expired requestState`. Dessa räknas inte som godkända slutprov. Alla deras konton/annonser städades. Slutleveransen använder en mindre privilegierad uppsättning utan adminsteg och verifierar i stället den verkliga spärren för overifierade annonser.

Viewport är inte fysisk mobil/Safari eller ett öppet skärmtangentbord. Chatt med tangentbord, video/kamera, beskärning/zoom/dragning av bilder, kartzoom/geolokalisering, kluster/popupens fullständiga layout, skärmläsare, bakåt-Tab, kontobyte/flerflik och lyckad native-UI-radering återstår. Företagsverifieringens adminflöde och hela rekryteringskedjan är separata kvarstående prov. L08/L13 markeras inte Klar.

## Upprepa

1. Ha Playwright och en Chromium-installation tillgängliga. Kör i en interaktiv TTY med den publika DevStaging-nyckeln som `MNW_L08_ANON_KEY`: `npm run test:browser:staging`. Verktyget är låst till de två dev-värdnamnen. Utan TTY stoppas det före kontoskapande; även den spärren är verifierad.
2. Ersätt de tre `__QA_*__`-platshållarna i [seed-frågan](../scripts/test-l08-browser-seed.sql) med scriptets `FIXTURE`-utskrift och kör endast i DevStaging. Exakta fiktiva mejladresser kontrolleras före uppdatering. Seed-frågan kräver att företaget och annonserna förblir overifierade.
3. Skriv `seeded` inom två minuter. Vid seed-fel: skriv `abort`; kontona städas ändå. Scriptet skickar aldrig rätt lösenord till raderingsdialogen; slutstädningen använder eget konto-API. Kontrollera alltid `remainingFixtureIds` och efterkontrollera SQL vid avbrott.

`MNW_PLAYWRIGHT_MODULE` kan ange en extern Playwright-moduls sökväg. `MNW_CHROMIUM_MODULE` kan ange en separat Sparticuz-modul (`build/index.js`); standardfallet använder Playwrights installerade Chromium. Inga lösenord/token ska läggas i filer eller kommandon. Eventuell felscreenshot sparas endast lokalt för QA; loggarna skriver fas, räknare och fiktiva fixture-ID:n, inte hemligheter.
