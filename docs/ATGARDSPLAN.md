# MatchnWork gemensam åtgärdsplan

Gemensam arbetslista för de kommande två veckorna och återstående lanseringsarbete. Omfattningen är större än en garanterad tvåveckorsleverans; prioriteringen styr vad som ska göras först. Följ den globala ordningen nedan. P1 ska vara klara före skarp lansering. P2 förbättrar kärnflödena och P3 är senare puts. Den globala ordningen tar hänsyn till beroenden; slutverifiering och lansering sker efter implementation även om de är P1. F = befintlig funktionalitet, N = ny funktion, D = design och text. L = lansering, tidigare beslut och kompletterande verifiering. N11/N12 (video) och N14/N15 (flera adresser och annonskopior) samt N16–N21/F26 (förenklad annonslivscykel, gemensamma jobbtyper, relevans och profilhjälp) är nya högt prioriterade funktioner. Inspelning N13 följer efter fungerande uppladdning och delning.

Videobeslut 2026-10-18: permanent profilvideo ska tas bort (N22). Video behålls i chatt (N12/N13), och företag ska kunna be om en frivillig video i samband med ansökan (N23). Ungdomen får avstå och ansökan skickas ändå; ingen väntan på videosvar eller uppladdning. Beslutet ersätter tidigare instruktioner om profilvideo och obligatoriska videokrav. Video ska hjälpa ungdomen att presentera sig. Psykologiskt personlighetstest och automatisk analys av personlighet från video ingår inte i denna plan. Befintliga egna exempel och motivation behålls.

För L-punkter innebär Ej påbörjad att denna samlade inventering/verifiering inte är avklarad, inte att all berörd funktion saknas. Tidigare byggda delar ska återanvändas. Fortsatt kodarbete är godkänt enligt prioriteringslistan, i avgränsade leveranser med publicering och verifiering.

## Arbetssätt

- Läs AGENTS.md och denna fil före arbetet. Hämta aktuell dev och kontrollera pågående uppgifter och PR:er.
- Reservera en punkt med ansvarig och branch i en publicerad ändring innan kodarbete börjar. En reservation i en opushad lokal fil är inte en gemensam reservation.
- En ägare per punkt. Vid samtidiga reservationer avgör första publicerade reservationen; samordna manuellt innan fortsatt arbete. Filen är ingen automatisk låsmekanism.
- Status: Ej påbörjad → Pågår → För granskning → Klar. Blockerad används med konkret blockerare och nästa steg.
- Egna branches och små PR:er till dev. Ändra bara egna punkter och samordna gemensamma filer, API:er och migrationer.
- Klar kräver att ändringen är införd i dev och kriteriet Klar när är verifierat. Implementerad kod eller godkända lokala kontroller räcker inte ensamt.
- Efter varje arbetsinsats: ange ändringar, verkligt genomförd verifiering, återstående begränsningar och länk till PR/commit. Skriv inte att webbflöden verifierats om bara bygg/typecheck har körts.
- Beroenden har företräde: gemensamma profilfakta före förifyllning, strukturerade jobbuppgifter före detaljerade filter. Vid avsteg dokumenteras orsaken.

## Gemensam prioriteringsordning

### Reviderad produktinriktning – beställt 2026-10-18

- Beslutat dokumenttillägg: Ersätt Mer om kandidaten med jobbspecifikt ansökningsunderlag enligt F26/N19 och docs/PROFIL_OCH_RELEVANS.md. Visa granskat CV, relevanta direkt läsbara praktiska fakta, källgrundade kriterier/belägg och uttryckligen delade ansökningssvar/frivillig video. Ingen generell företagsåtkomst till jobbprofilen, inte heller via API/databas. Ungdomen får förhandsvisa delningen och matchningens uppgiftsunderlag. Exakt bostadsadress utesluts från strukturerat underlag; arbetsplatsens adresser i annons/karta bevaras. Kontaktuppgifter i original-CV måste uppmärksammas. Beslutet är inte implementerat eller säkerhetsverifierat genom denna dokumentuppdatering (`codex/f26-n19-application-plan-20261018`).

- Beslut och acceptanskriterier: `docs/PROFIL_OCH_RELEVANS.md`. Framtidsidéer finns i det befintliga dokumentet MatchnWork-Idebank.md; de aktiveras inte genom denna plan.
- N16 ersätter det gamla kravet på antal tjänster och automatiskt lyft. N17 → N18 ger gemensamma jobbtyper före relevans; F26 granskar kärnmatchningen; N19 → N20/N21 ger gemensam profilgrund före nya AI-ingångar. Delordning 13.1–13.6 läggs före återstående ordinarie lista enligt beställningen; övriga uppgifters status ändras inte.
- Reserverat före kodarbete: N16, Vilgot / Codex, `codex/n16-annonsflode-20261018`. Första leveransen omfattar bara slopat platskrav; övriga nya punkter reserveras separat vid byggstart.

### Profilflöde och informationsöversyn – beställt 2026-10-14

- Status: För granskning, Vilgot / Codex, `codex/profile-journey-20261014`, [PR #58](https://github.com/vilgotdidrikson/youth-job-mvp/pull/58), implementation `461476d`.
- Reserverat före kodarbete: F15/F16/F18/D02 och uppföljning N11/N13. Fast ordning CV → Video → övriga profildelar, stegantal och uttryckligt fortsätt/pausa. Profilen samlas i Översikt, Din jobbprofil och Inställningar, med öppningsbara CV-/video-/allmänprofilramar. Informationskällor, användning och sparning inventeras; överlapp förenklas utan dataförlust. Företagsdelarna av F10 ingår inte. Migrationshistorik och produktion ändras inte.
- Implementerat: Sex fasta steg med CV/video först, aktivt fortsätt/pausa efter sparning, stabil CV-bekräftelse utan timer, tre profilflikar och öppningsbara ramar. Kontaktuppdatering isolerad från CV, CV-ägda språk tydliggjorda och separat sparning av kompletterande delar. Chattens desktopnavigation och rubrik har komprimerats; meddelandeytan följer tillgänglig skärmhöjd. Se `docs/PROFILE_DATA_REVIEW.md` för datakällor, användning, avvägningar och acceptanstest.
- Verifierat lokalt: produktionsbygge med webpack och TypeScript, riktad ESLint, `test:profile-journey` inklusive profilhämtning, `test:profile-video`, `test:matching`, `test:application-supplement`, `test:recruitment`, CV-faktagranskning, CV-konsistens, godkänt CV-sparande och auth-route-kontrakt. Transport-/kameratester är simulerade.
- Återstår: användarens visuella acceptanstest i dev, fysisk kamera/mikrofon samt mobil med tangentbord. Autentiserad testwebbläsare blockerad av kvarvarande inloggningsskydd. Dessa kriterier markeras inte som verifierade.


### L11 OpenAI-modellmigrering – uttryckligt tillägg 2026-10-14

- [x] Klar
- Prioritet: P1, före fortsatt ordinarie lista enligt användarens beställning.
- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/l11-openai-migration-20261014`, [PR #53](https://github.com/vilgotdidrikson/youth-job-mvp/pull/53), mergad till dev `ec287b7`.
- Åtgärd: Flytta återstående GPT-4-textmodeller till GPT-6 Luna och migrera pensionerade ljudmodeller med korrekta API-kontrakt. Bevara dold röstfunktion, behörigheter, kostnadsgränser och faktagranskning.
- Klar när: Kod införd i dev, regressioner och bygge passerar, aktiva CV-anrop verifierade och ljudmigreringens verifieringsnivå uttryckligen redovisad.
- Implementerat: CV/faktahämtning och röstbeslut använder GPT-6 Luna med Responses och uttrycklig reasoning none. Kända gamla GPT-4-överstyrningar mappas till Luna; separata arbetslastinställningar behålls. Färdig röstinspelning använder gpt-transcribe med languages-array. Generiska frågor läses via gpt-realtime-2.1-mini på serverns Realtime-WebSocket och returneras som begränsad WAV; timeout, fel, avbrott, cachenyckel och ljudversion hanteras. WebRTC-modellen är gpt-realtime-2.1. Röstfunktionen förblir dold/avstängd. Dokumentation, livekontrollskript och låst ws-beroende uppdaterade.
- Verifierat: Modell-/parameterregressioner, simulerade Realtime-händelser (framgång, timeout, fel, tomt/ofullständigt ljud, för stor utdata, avbrott), WAV-header och verklig OpenAI-SDK-serialisering av languages[] mot simulerad transport passerar. F02, F03, samlad CV-sparning, sync-API, CV-quality och matching passerar. TypeScript, riktad ESLint utan fel och fullständigt webpack-produktionsbygge passerar.
- Webbverifierat efter merge 2026-10-14: Inloggat fiktivt QA-konto i driftsatt dev kunde skriva om CV med AI utan API-fel. Redigering av svenska från Flytande till Grundläggande följt av Uppdatera profilfakta från texten gav motsvarande strukturerad språknivå. Godkännanderutan förblev avmarkerad och sparknappen spärrad. Inga CV-ändringar sparades till profilen under detta test. Dev-driftsättningen av merge-commit har godkänd byggstatus.
- Återstår / begränsning: Lokal OpenAI-nyckel saknas, därför har ljudets modellåtkomst och svenska uppspelning/transkribering inte liveverifierats. Röstfunktionen är fortsatt avstängd och får inte aktiveras utan sådan separat verifiering. L11:s kriterium kräver uttryckligt redovisad ljudverifieringsnivå, inte aktivering. Inga nycklar har extraherats eller exponerats. N11 har reserverats separat efter denna leverans.

| Ordning | ID | Prioritet | Åtgärd | Status | Ansvarig |
|---|---|---|---|---|---|
| 1 | [L01](#l01) | P1 | Återställ ett godkänt produktionsbygge | Klar | Vilgot / Codex |
| 2 | [F01](#f01) | P1 | Gör profilbyggaren tillgänglig | Klar | Vilgot / Codex |
| 3 | [F02](#f02) | P1 | Stoppa påhittade fakta i AI CV | Klar | Vilgot / Codex |
| 4 | [F03](#f03) | P1 | Samordna CV text och strukturerade profilfakta | Klar | Vilgot / Codex |
| 4.1 | [N22](#n22) | P1 | Ta bort permanent profilvideo | För granskning | Vilgot / Codex |
| 5 | [N11](#n11) | P1 | Tidigare profilvideo – ersatt av N22, historik | För granskning | Vilgot / Codex |
| 6 | [N12](#n12) | P1 | Video i chatten | För granskning | Vilgot / Codex |
| 6.1 | [N23](#n23) | P2 | Frivillig videoförfrågan vid ansökan | Ej påbörjad | — |
| 7 | [N14](#n14) | P1 | Publicera samma annons på flera adresser | För granskning | Vilgot / Codex |
| 8 | [N15](#n15) | P1 | Kopiera befintliga annonser till nya utkast | Ej påbörjad | — |
| 9 | [F04](#f04) | P1 | Rätta företagets första navigation | Ej påbörjad | — |
| 10 | [F05](#f05) | P1 | Gör matchningsanalysen begriplig och användbar | Klar | Vilgot / Codex |
| 11 | [F06](#f06) | P1 | Förklara pris och anställningsavgift | Blockerad | Vilgot / Codex |
| 12 | [L04](#l04) | P1 | Färdigställ och verifiera anställningsbekräftelsen | För granskning | Vilgot / Codex |
| 13 | [N16](#n16) | P1 | Slopa obligatoriskt platsantal och behåll manuell annonsstatus | För granskning | Vilgot / Codex |
| 13.1 | [N17](#n17) | P1 | Gemensamma jobbtyper med fria annonstitlar | Ej påbörjad | — |
| 13.2 | [N18](#n18) | P2 | Relevant och varierat jobbflöde | Ej påbörjad | — |
| 13.3 | [F26](#f26) | P1 | Granska matchningens rättvisa och faktaunderlag | Ej påbörjad | — |
| 13.4 | [N19](#n19) | P2 | Samlad jobbprofil och ett kort grund-CV | Ej påbörjad | — |
| 13.5 | [N20](#n20) | P2 | Textbaserad profilguide och diskret formulärhjälp | Ej påbörjad | — |
| 13.6 | [N21](#n21) | P2 | Valfri genomläsning av uppladdat CV | Ej påbörjad | — |
| 14 | [L02](#l02) | P1 | SMTP och tillförlitliga e-postutskick | Ej påbörjad | — |
| 15 | [L03](#l03) | P1 | Automatiserad fakturering vid bekräftad anställning | Ej påbörjad | — |
| 16 | [F08](#f08) | P2 | Tydliggör verifieringsunderlag och handläggning | Ej påbörjad | — |
| 17 | [F09](#f09) | P2 | Anpassa publicering till verifieringsstatus | Ej påbörjad | — |
| 18 | [F07](#f07) | P1 | Bevara bilden i sparade annonsutkast | Ej påbörjad | — |
| 19 | [N01](#n01) | P1 | Redigera hela publicerade annonsen | Ej påbörjad | — |
| 20 | [N02](#n02) | P1 | Återkalla ansökan och väntande intresse | Ej påbörjad | — |
| 21 | [L05](#l05) | P1 | Säkerhet, blockering, rapportering och administration | Ej påbörjad | — |
| 22 | [L06](#l06) | P1 | Verifiera kontots grundläggande fel- och återställningsvägar | Ej påbörjad | — |
| 22.1 | [L12](#l12) | P1 | Inför beslutade lagringstider och automatisk gallring | Ej påbörjad | — |
| 23 | [F13](#f13) | P2 | Rätta status för väntande ansökningar | Ej påbörjad | — |
| 24 | [F14](#f14) | P2 | Gör notiser och lässtatus användbara | Ej påbörjad | — |
| 25 | [D02](#d02) | P2 | Håll chattens skrivfält inom vyn | För granskning | Vilgot / Codex |
| 26 | [N13](#n13) | P2 | Spela in presentationsvideo direkt | För granskning | Vilgot / Codex |
| 27 | [F10](#f10) | P2 | Återanvänd redan sparade uppgifter | Ej påbörjad | — |
| 28 | [N08](#n08) | P2 | Erbjud CV utan obligatorisk AI | Ej påbörjad | — |
| 29 | [F12](#f12) | P2 | Förbättra kompletteringsfrågornas innehåll | Ej påbörjad | — |
| 30 | [F11](#f11) | P2 | Visa vad AI överför till annonsfälten | Ej påbörjad | — |
| 31 | [F22](#f22) | P2 | Validera inmatning nära fälten | Ej påbörjad | — |
| 32 | [N03](#n03) | P2 | Visa annonsutkast i översikten | Ej påbörjad | — |
| 33 | [F20](#f20) | P2 | Gör integritet villkor och hjälp lätta att nå | Ej påbörjad | — |
| 34 | [F23](#f23) | P2 | Ge val och dialoger korrekt tillgänglighet | Ej påbörjad | — |
| 35 | [F15](#f15) | P2 | Förenkla ungdomens första steg | För granskning | Vilgot / Codex |
| 36 | [F16](#f16) | P2 | Ge ett stabilt nästa steg efter färdigt CV | För granskning | Vilgot / Codex |
| 37 | [N04](#n04) | P2 | Öppna en läsbar företagsprofil från annonsen | Ej påbörjad | — |
| 38 | [N05](#n05) | P2 | Lägg till strukturerade praktiska jobbuppgifter | Ej påbörjad | — |
| 39 | [F17](#f17) | P2 | Samla anställningsflödet i en tydlig ingång | Ej påbörjad | — |
| 40 | [N07](#n07) | P2 | Ångra det senaste bortvalet i swipe | Ej påbörjad | — |
| 41 | [N06](#n06) | P2 | Utöka jobbsökningen med relevanta val | Ej påbörjad | — |
| 42 | [F18](#f18) | P2 | Förbättra sparande i profilredigeringen | För granskning | Vilgot / Codex |
| 43 | [F24](#f24) | P2 | Gör kartans reservvy användbar | Ej påbörjad | — |
| 44 | [N09](#n09) | P2 | Spara CV utkast på kontot | Ej påbörjad | — |
| 45 | [L09](#l09) | P2 | Verifiera CV-uppladdning och PDF-layout | Ej påbörjad | — |
| 46 | [L08](#l08) | P1 | Verifiera mobil, tangentbord och kartinteraktion | Ej påbörjad | — |
| 47 | [L07](#l07) | P1 | Verifiera hela rekryteringskedjan i driftsatt dev | Ej påbörjad | — |
| 48 | [D01](#d01) | P2 | Rätta knapparna i profilintroduktionen | Ej påbörjad | — |
| 49 | [D05](#d05) | P2 | Förklara produkten direkt på startsidan | Ej påbörjad | — |
| 50 | [D09](#d09) | P3 | Placera feedback vid rätt åtgärd | Ej påbörjad | — |
| 51 | [F25](#f25) | P3 | Slå samman likvärdiga förmåner | Ej påbörjad | — |
| 52 | [D03](#d03) | P3 | Ge kriteriernas textfält mer plats | Ej påbörjad | — |
| 53 | [D06](#d06) | P3 | Gör status och profilprogress begripliga | Ej påbörjad | — |
| 54 | [D04](#d04) | P3 | Öka padding på kartans kortknapp | Ej påbörjad | — |
| 55 | [D07](#d07) | P3 | Rätta mikrocopy och varumärkestext | Ej påbörjad | — |
| 56 | [F21](#f21) | P3 | Förtydliga konto och företagsuppgifter | Ej påbörjad | — |
| 57 | [F19](#f19) | P3 | Gör filterdialogens beteende tydligt | Ej påbörjad | — |
| 58 | [D08](#d08) | P3 | Gör tomvyer och sidbredder konsekventa | Ej påbörjad | — |
| 59 | [N10](#n10) | P3 | Ge grundläggande kontoval | Ej påbörjad | — |
| 60 | [L10](#l10) | P1 | Lanseringsmiljö, domän och drift | Ej påbörjad | — |

## Nya funktioner

<a id="n11"></a>
### N11 Presentationsvideo i ungdomens profil – historik

**Ersatt beslut 2026-10-18:** Profilvideo ska inte längre erbjudas. N22 styr borttagningen; N23 styr frivillig video vid ansökan. Nedanstående beskriver tidigare implementation och verifiering, inte ett fortsatt uppdrag att lansera profilvideo. N11 markeras inte Klar genom detta beslut.

- [ ] Klar
- Prioritet: P1
- Global ordning: 5
- Typ: Ny funktion
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n11-profile-video-20261014`, [PR #54](https://github.com/vilgotdidrikson/youth-job-mvp/pull/54).
- Tidigare åtgärd: Låt ungdomen frivilligt ladda upp en kort presentationsvideo, förhandsvisa, ersätta och radera den. Ge enkla stödfrågor och tydliga gränser för längd, storlek och format; sikta på 30–60 sekunder. Visa videon i kandidatprofilen för behöriga företag. Lagra privat och kontrollera åtkomst som för övriga kandidatunderlag. Videon ska inte krävas för att ansöka och ska inte användas för automatisk personlighetsbedömning.
- Tidigare kriterium: En ungdom kan hantera sin video på mobil och dator, och endast behöriga mottagare kan spela upp den. Felaktigt format, avbruten uppladdning och radering hanteras begripligt.
- Implementerat: Frivillig videokort i ungdomens profil, filkontroll och lokal förhandsvisning, uttrycklig spara/ersätt/radera, avbrytbar uppladdning och återhämtningsbara fel. Privat bucket med 30 MB och MIME-allowlist; immutabla objekt, metadata med ägarkontroll, profilpekare, signerad uppspelning fem minuter. Behöriga företag kan spela upp videon i kandidatvyn. Säker återförsökshantering och jämförelse mot föregående profilpekare. Kontoradering inkluderar videofiler. Migration införd enbart i DevStaging.
- Verifierat: Validering och klientkontrakt tester passerar, inklusive gränser, CAS, förlorat skrivsvar, avbrott och städningsfel. `scripts/test-video-rls.sql` passerar i staging: ägare, mottagare, utomstående, ofärdig uppladdning, oföränderliga objekt, blockering, återkallande och anonym nekad åtkomst; samtliga testskrivningar rullades tillbaka. TypeScript och produktionsbygge passerar. Säkerhetsrådgivaren flaggar inga nya videoobjekt; befintliga projektanmärkningar lämnas orörda.
- Återstår / begränsningar: Driftsatt webbtest och manuella mobil-/datorfall enligt `docs/VIDEO_TESTGUIDE.md` återstår innan Klar. Den verkliga filens längd/playbarhet kontrolleras i webbläsaren; databasens längd är deklarerad metadata, inte serveravkodad media. Signerade länkar kan fungera tills de löper ut (högst fem minuter); redan nedladdade kopior kan inte återkallas. Vid avbrott kan privat, återkallad restfil kräva senare städning; kontoradering tar även sådana filer. Produktionsdatabasen har inte ändrats.
- Infört: PR #54 mergad till dev `c0c0d4e` 2026-10-14. Driftsatt autentiserat webbtest kunde inte genomföras på grund av kvarvarande inloggningsskydd i testwebbläsaren; inga verkliga uppladdningar eller kamerainspelningar påstås vara godkända. N11–N13 står kvar För granskning inför användarens acceptanstest.
- Migrationsavstämning: DevStaging registrerade samma namngivna migration som version `20261014171758`, medan CLI-skapade repofilen har version `20261014171115`. Föreslaget namnbyte stoppades av säkerhetskontrollen; varken repomigrationen eller fjärrhistoriken har skrivits om. Kör inte automatisk `db push`/migrationsreplay förrän historiken stämts av med uttryckligt godkännande. Den redan applicerade staging-DDL:n är verifierad och ska inte köras igen.
- Designuppföljning reserverad 2026-10-14 före kodarbete: Vilgot / Codex, `codex/video-chat-design-20261014`. Användaren har provat videoflödet och bekräftat att det fungerar. N11/N12/N13 följs nu upp med separat inspelningssida, förhandsvisning före uttrycklig inspelningsstart, speglad kameravy, mindre text och tydliga videoåtgärder i omarbetad chattfrontend. Ingen migrations-/databasändring ingår.
- Designuppföljning implementerad: separat `/video/record` för profil och chatt med korta stödfrågor, Öppna kamera → redo utan inspelning → Starta inspelning → granska → uttryckligt spara/skicka. Speglad egen kameravy, normalt orienterad film för mottagaren. Profilkortet har kort huvudtext och utfällbar åtkomstinformation. Chattens videoåtgärder är synliga vid skrivfältet; filvideo förhandsvisas i modal. Ny sammanhållen chattlayout med ljusa bubblor, tydlig inkorg, kompakt jobbpanel och enklare medieåtgärder. Samma befintliga lagrings-/RLS-kontrakt används.
- Designverifiering: uppdaterade tester av faktiska inspelningscallbacks med simulerade media-API:er passerar, inklusive bevis att Öppna kamera inte konstruerar/startar MediaRecorder, separat start, stängning före inspelning, speglad kameravy, avbrott och sena händelser. Fil-/klientregressioner, TypeScript, riktad ESLint utan fel och fullt produktionsbygge passerar. Visuell kontroll i driftsatt autentiserad webbläsare är fortfarande blockerad av dess inloggningsskydd; den nya layouten och fysisk kamera behöver användarens prov. Inga databas- eller migrationsändringar.
- Designleverans: [PR #56](https://github.com/vilgotdidrikson/youth-job-mvp/pull/56) mergad till dev `7cd4b566` 2026-10-14. Den nya sidan är `/video/record`; i ungdomens chatt nås inspelning och filval direkt vid skrivfältet. Befintlig textdraft bevaras i sessionen när användaren går till inspelningssidan. Testguiden är uppdaterad för två separata kamera-/inspelningssteg. Checklistan förblir För granskning inför prov av den nya designen.

<a id="n12"></a>
### N12 Video i chatten

- [ ] Klar
- Prioritet: P1
- Global ordning: 6
- Typ: Ny funktion
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n11-profile-video-20261014`, PR #54; gemensam videoleverans uttryckligen beställd 2026-10-14.
- Åtgärd (reviderad 2026-10-18): Låt ungdomen spela in eller ladda upp en separat frivillig video i en befintlig chatt. Visa förhandsvisning, uppladdningsstatus, hanterbara fel och uppspelning. Behåll privat mediehantering, deltagarbehörighet, blockering och rapportering. Ta bort valet att dela profilvideo enligt N22; befintliga profilvideodelningar hanteras enligt avvecklingsplanen utan att skada separata chattvideor.
- Klar när: Båda deltagarna kan spela upp skickad video på mobil och dator. Utomstående nekas åtkomst och fel kan återhämtas utan dubbletter.
- Implementerat: Ungdomen kan dela aktuell profilvideo eller ladda upp/spela in en separat video i en matchad chatt. Explicit skicka efter förhandsvisning, avbrott, retry med deterministiskt meddelande-ID, borttagning av egen separat video och anmälan per videomeddelande. Båda deltagarna får signerad uppspelning. Profilvideodelningar följer aktuell profilpekare; byte byter innehållet och borttagning gör delningen otillgänglig. Separata meddelanden har egna immutabla filer och påverkas inte av profilbyten. Rapporter sparar videoreferensen vid anmälan för behörig admin; borttagna videobytes arkiveras inte i en dold kopia.
- Verifierat: Klienttester för idempotenta skickförsök och fel; staging-RLS testar chattscope, utomstående, blockerade deltagare, ungdomsägarskap, ofärdig uppladdning, rapportreferens och återkallande. Alla testskrivningar återställda.
- Återstår / begränsningar: Driftsatt webbflöde och användarens mobil-/datoracceptans enligt testguiden. Inspelning och delning kräver inte AI. Kontrollera rapporterat innehåll före eventuell borttagning; metadatareferens bevarar inte raderade videobytes.

<a id="n14"></a>
### N14 Publicera samma annons på flera adresser

- [ ] Klar
- Prioritet: P1
- Global ordning: 7
- Typ: Ny uttryckligen beställd funktion
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n14-multiple-locations-20261014`, [PR #59](https://github.com/vilgotdidrikson/youth-job-mvp/pull/59), mergad till dev `ba847e5`. Webbverifiering och liten knappjustering reserverad på `codex/n14-web-verification-20261015` 2026-10-15.
- Åtgärd: Låt företaget lägga till, redigera och ta bort flera namngivna arbetsplatser med adress och ort i en och samma annons. Visa samtliga arbetsplatser i annonsen och kartan; listan ska visa annonsen en gång och närhetsfilter ska använda relevanta arbetsplatser. Ansökningar hör till den gemensamma annonsen och företaget kan se eventuell vald arbetsplats. Ungdomen ska kunna ange arbetsplatspreferens utan obligatoriskt stopp i swipeflödet. Bevara platsreferenser för befintliga ansökningar när en adress ändras eller tas bort. Samordna platsinformation med N05/N16; första versionen har gemensam annonsstatus utan obligatoriskt platsantal.
- Klar när: En annons med minst två adresser kan sparas, återupptas, publiceras och redigeras. Båda adresserna visas korrekt på kartan och fungerar i geografiska filter, utan dubbla listposter eller ansökningar.
- Implementerat: Upp till tio namngivna arbetsplatser i en gemensam annons, beständiga plats-ID, validerad JSON och primäradress synkroniserad för äldre flöden. Arbetsplatser sparas i kontobundet annonsutkast och kan redigeras separat på befintliga annonser. Alla orter omfattas av upptäcktsfilter och varje arbetsplats får en kartposition. Frivilligt arbetsplatsval efter skickat eller sparat intresse; företaget ser valet. Databasen sparar adressögonblicksbild vid valet, oberoende av senare annonsändringar.
- Verifierat: `test:job-workplaces` testar validering, geokodning, create/update, ägarkontroll, äldre annonser och ortsfilter. Matching- och application-supplement-regressioner samt fullständigt webpack-produktionsbygge passerar 2026-10-15. Staging-RLS-test med återställda fiktiva data: ägarredigering, dubletter/format/koordinater/sista arbetsplats, serverskapad adressögonblicksbild, kandidatens skrivning, företagets läsning utan ändring, borttagen arbetsplats och nekad utomstående/anonym.
- Webbverifierat 2026-10-15: QA-företaget sparade/återupptog två adresser efter omladdning, förhandsvisade, publicerade och redigerade samma annons. QA-ungdomen Alex Testsson hittade exakt en annons via Göteborg som andra ort, skickade ansökan utan stopp och sparade frivilligt Göteborg; både ansökan och val kvar efter omladdning. Kartlistan gav en annons och databasen två distinkta koordinater samt exakt en QA-ansökan. Se `docs/N14_WEB_VERIFICATION.md` för bevis, testdata och begränsningar.
- Återstår / blockerare: Testwebbläsaren saknar WebGL; faktiska kartnålar, zoom och klick måste verifieras i en webbläsare med WebGL före Klar. Företagets preferensläsning är RLS-testad, inte separat webbtestad. Migrationerna 20261014215942 och 20261014220115 matchar DevStaging. Produktion och tidigare videomigrationshistorik är orörda.

<a id="n15"></a>
### N15 Kopiera befintliga annonser till nya utkast

- [ ] Klar
- Prioritet: P1
- Global ordning: 8
- Typ: Ny uttryckligen beställd funktion
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Lägg Kopiera annons i företagets annonsöversikt. Kopiera titel, text, bild, praktiska uppgifter, arbetsplatser och matchkriterier till ett nytt redigerbart utkast som öppnas i befintliga annonsbyggaren. Originalet ändras inte. Ansökningar, matchningar, chattar, anställningar, publiceringsstatus och gammal statistik ska inte följa med. Markera datum och tidsberoende uppgifter för ny granskning. Ny publicering följer vanlig verifiering och eventuella faktiska kontogränser.
- Klar när: Företaget kan kopiera en egen aktiv, pausad eller stängd annons, granska/redigera och publicera kopian som en separat rekrytering utan att ändra originalet eller dess kandidater.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n16"></a>
### N16 Slopa obligatoriskt platsantal och behåll manuell annonsstatus

- [ ] Klar
- Prioritet: P1
- Global ordning: 13
- Typ: Reviderat användarbeslut 2026-10-18, ersätter tidigare minskning av platsantal och lyft vid anställning.
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n16-annonsflode-20261018`, [PR #68](https://github.com/vilgotdidrikson/youth-job-mvp/pull/68), implementation `d916552`; reservation publicerad före kodändring i `5da009b`.
- Åtgärd: Ta bort obligatoriskt antal tjänster från skapande, kopiering och publiceringskontroll. Företaget pausar/stänger när rekryteringen är färdig. En registrerad/bekräftad anställning ändrar inte automatiskt annonsstatus eller flödesdatum. Bevara befintliga annonser, ansökningar, chattar och äldre databasfält utan att framställa ett tekniskt standardvärde som ett faktiskt rekryteringsbehov. Ingen destruktiv datamigrering.
- Klar när: Ny annons och annonskopia kan publiceras utan platsantal; gamla utkast med platsantal kan fortsättas utan detta krav. Originalets uppgifter ändras inte av en kopia. Befintlig manuell paus/stängning och anställningsbekräftelse fungerar separat och historiken bevaras.
- Implementerat: Platsfält och publiceringskrav borttagna från annonsbyggaren och kopior. Gamla utkast återställs med nuvarande redigerbara fält så att ett övergivet/ogiltigt platsantal inte blockerar. Befintliga databasfält och annonser lämnas kvar; ingen migration eller automatisk annonsstatus/lyft har lagts till.
- Verifierat: test:job-copy (inklusive äldre utkast och originalisolering), test:job-workplaces, test:recruitment, test:recruitment-review och test:company-navigation passerar. TypeScript och fullständigt webpack-bygge passerar med 50 sidor. Riktad ESLint: 0 fel, 1 befintlig img-varning i företagssidan. Dokumentlänkar/uppgifts-ID:n kontrollerade.
- Återstår / blockerare: Driftsatt inloggat webbtest av ny annons, gammalt utkast och kopia återstår; ingen sådan verifiering påstås. Befintlig manuell paus/stängning och anställning har inte liveomtestats i denna insats. Se docs/N16.md. N17 byggs i en separat reserverad leverans.

<a id="n01"></a>
### N01 Redigera hela publicerade annonsen

- [ ] Klar
- Prioritet: P1
- Global ordning: 19
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Ge en tydlig Redigera annons-ingång för titel, publik text, bild, lön och praktiska uppgifter. Återanvänd annonsbyggaren. Håll den publika informationen och matchkriterierna samordnade och förklara konsekvenser för befintliga ansökningar.
- Klar när: Företaget kan korrigera annonsen utan att radera och skapa om den.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n02"></a>
### N02 Återkalla ansökan och väntande intresse

- [ ] Klar
- Prioritet: P1
- Global ordning: 20
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Ge ungdomar möjlighet att ta bort väntande intresse innan automatisk sändning och återkalla en skickad ansökan med tydlig status. Visa vad som händer med en eventuell match eller chatt.
- Klar när: Användaren kan ändra sig och får ingen oavsiktligt skickad ansökan.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n13"></a>
### N13 Spela in presentationsvideo direkt

- [ ] Klar
- Prioritet: P2
- Global ordning: 26
- Typ: Ny funktion
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n11-profile-video-20261014`, PR #54; reserverad före kodarbete efter uttrycklig beställning om hela videoflödet. Implementeras efter N11/N12:s grund.
- Åtgärd: Komplettera uppladdningen med inspelning via kamera och mikrofon. Ge förhandsvisning, ta om och uttryckligt spara/skicka. Hantera nekad behörighet och använd uppladdning som alternativ när inspelning inte stöds. Återanvänd N11/N12; inspelning publicerar inte automatiskt.
- Klar när: Inspelning fungerar i avsedda mobil- och datorwebbläsare, kan tas om och går att avbryta utan att video publiceras.
- Implementerat: Gemensam MediaRecorder-komponent i profil och chatt med användarinitierad kamera/mikrofon, lokal kameraförhandsvisning, stoppa/ta om/avbryt, automatstopp vid 60 sekunder och bytegräns. Ingen automatisk publicering. Spår stängs vid stopp, avbrott, navigering och sent behörighetssvar. Nekad/ej stödd inspelning visar filuppladdning som alternativ. MP4 väljs när stödet finns, annars WebM.
- Verifierat: Faktiska komponentcallbacks körda med simulerade media-API:er: förhandsvisning utan publicering, avbrott, avmontering, sent behörighetssvar, 60-sekundersstopp, för stor inspelning, nekad behörighet och stängda mediespår. TypeScript och riktad ESLint passerar.
- Återstår / begränsningar: Fysisk kamera/mikrofon samt avsedda mobil-/datorwebbläsare måste provas av användaren före Klar. Simulerade media-API:er är inte ett sådant acceptanstest. N13 genomförs före ordinarie senare punkter enligt uttrycklig beställning 2026-10-14.

<a id="n08"></a>
### N08 Erbjud CV utan obligatorisk AI

- [ ] Klar
- Prioritet: P2
- Global ordning: 28
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Visa Skriv själv som ett tydligt val från början, med samma sparade fakta och redigering som AI-guiden. AI ska vara en valfri hjälp och PDF-uppladdning ett separat alternativ.
- Klar när: Ungdomen kan skapa och färdigställa CV utan att generera AI-text.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n03"></a>
### N03 Visa annonsutkast i översikten

- [ ] Klar
- Prioritet: P2
- Global ordning: 32
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Lägg en synlig Återuppta utkast-post bland företagets annonser med titel, aktuell del och senast sparat. Skilj utkast från publicerade, pausade och stängda annonser. Koppla till bildsparandet i F07.
- Klar när: Ett sparat utkast går att hitta utan att välja Ny annons.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n04"></a>
### N04 Öppna en läsbar företagsprofil från annonsen

- [ ] Klar
- Prioritet: P2
- Global ordning: 37
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Gör företagskortet öppningsbart och visa verksamhetsbeskrivning, ort, verifiering och relevant arbetsplatsinformation. Ge en tydlig väg tillbaka till jobbet. Återanvänd uppgifter företaget redan fyllt i.
- Klar när: Ungdomen kan bedöma arbetsgivaren innan den visar intresse.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n05"></a>
### N05 Lägg till strukturerade praktiska jobbuppgifter

- [ ] Klar
- Prioritet: P2
- Global ordning: 38
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Komplettera annonsen med start eller flexibelt startläge, schema eller omfattning, anställningsperiod, sista ansökningsdag utan krav på platsantal enligt det reviderade N16-beslutet. Håll det enkelt och tillåt Ej bestämt där det är rimligt.
- Klar när: Ungdomen kan jämföra arbetstid och tidsram utan att leta i fri text.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n07"></a>
### N07 Ångra det senaste bortvalet i swipe

- [ ] Klar
- Prioritet: P2
- Global ordning: 40
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Lägg en diskret Ångra efter Inte nu så att ett oavsiktligt bortval kan tas tillbaka utan att lämna upptäcktsflödet.
- Klar när: Ett feltryck döljer inte ett intressant jobb utan enkel återväg.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n06"></a>
### N06 Utöka jobbsökningen med relevanta val

- [ ] Klar
- Prioritet: P2
- Global ordning: 41
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Börja med textsökning och ett användbart val för närhet eller pendling samt arbetstid. Lägg därefter till lön och ålder om underlaget stödjer pålitlig filtrering. Koppla arbetstidsfilter till N05 och behåll lätt återställning.
- Klar när: Ungdomen hittar relevanta jobb utan att behöva öppna varje annons; okända uppgifter hanteras tydligt.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n09"></a>
### N09 Spara CV utkast på kontot

- [ ] Klar
- Prioritet: P2
- Global ordning: 44
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Låt CV-utkast fortsätta mellan mobil och dator med synlig sparstatus. Skydda utkastet som övriga privata profiluppgifter och behåll platsen i guiden.
- Klar när: Ungdomen kan återuppta samma utkast på en annan enhet.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n10"></a>
### N10 Ge grundläggande kontoval

- [ ] Klar
- Prioritet: P3
- Global ordning: 59
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Gör det möjligt att ändra e-post genom säker verifiering och välja de notispreferenser som motsvarar fungerande kanaler. Lägg inte val för ännu otillgängliga mailutskick.
- Klar när: Användaren kan hålla sin kontaktuppgift aktuell och styra befintliga notiser.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

## Förbättringar av befintlig funktionalitet

<a id="f01"></a>
### F01 Gör profilbyggaren tillgänglig

- [x] Klar
- Prioritet: P1
- Global ordning: 2
- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch/PR: [PR #47](https://github.com/vilgotdidrikson/youth-job-mvp/pull/47), `fix/f01-profile-builder-20261013`
- Åtgärd: Åtgärda hämtningen i profilbyggaren så att tillgänglighet, kunskaper och egna exempel går att öppna. Ge fungerande återförsök och en väg tillbaka vid fel.
- Klar när: Profilbyggaren öppnas utan hämtningsfel och ett tillfälligt fel går att återhämta utan dataförlust.
- Implementerat: Införd i dev genom PR #47. Borttagen fråga efter saknade kolumnen `working_time`. Gemensam hämtning för första laddning och återförsök, tidsgräns och skydd mot inaktuella svar. Knappar för återförsök och tillbaka till profilen; sparade data behålls vid tillfälliga fel.
- Verifierat: Riktad ESLint och regressionstest med riktig Supabase-klient mot simulerad stagingstruktur godkända. Sparade delar, version, CV-fakta, nätverks-/serverfel, nekad/saknad profil och återförsök kontrollerade automatiserat. Tidigare även samma kolumner lästa i staging under testkontots authenticated/RLS-kontext utan dataändring. Kombinerat produktionsbygge med L01 passerar och Vercel dev success. Säker inloggning lyckades. I driftsatt webbläsare öppnar `/profile/build?welcome=1` → Bygg din profil samtliga fem delar utan hämtningsfel. Tillgänglighet, kunskaper/språk och egna exempel öppnas; återgång och full omladdning behåller synlig sparad CV-status. Inga profiluppgifter ändrades i webbtestet.
- Återstår / blockerare: Ingen blockerare för F01. Återförsök efter nätverksfel är automatiserat verifierat, inte framkallat i den driftsatta webbläsaren. Bredare mobil-/tillgänglighetstest och profilsparande hör till L08/F18.

<a id="f02"></a>
### F02 Stoppa påhittade fakta i AI CV

- [x] Klar
- Prioritet: P1
- Global ordning: 3
- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch/PR: [PR #49](https://github.com/vilgotdidrikson/youth-job-mvp/pull/49), `codex/f02-cv-fact-review-20261013`, mergad till dev 2026-10-13
- Åtgärd: AI får inte göra våren 2026 till exakta månader, ändra flytande svenska till modersmål eller lägga till en obekräftad yrkestitel. Bevara osäkerhet och använd bara uppgifter som ungdomen lämnat.
- Klar när: CV och profil innehåller inga nya sakuppgifter utan användarens uttryckliga godkännande.
- Implementerat: Gemensam faktagranskning i CV-hubben och äldre onboarding. Alla profilfakta visas och kan rättas före uttryckligt godkännande. Godkännande gäller exakt aktuell CV-text och strukturerade fakta och återanvänds inte efter redigering, ny generation eller omladdning. Sparfunktionerna avvisar ogranskade förslag. AI-instruktioner för bevarad osäkerhet; serverkontroll tar bort datum/perioder och språknivåer utan uttryckligt stöd i underlaget. Logiken ligger i lib/cv-fact-review.ts för framtida mobilåteranvändning.
- Verifierat: F02-regression, CV-quality, auth-route och TypeScript passerar. Fullt produktionsbygge av sammanslagen dev passerar, inklusive 49 genererade sidor; båda Vercel-kontrollerna success för dev-commit 8eab8f7. Riktad ESLint: 0 fel, 8 tidigare onboardingvarningar. I driftsatt dev med fiktivt Alex-QA-konto: ny faktahämtning tog bort gamla exakta månader och ersatte modersmål med Flytande enligt texten. Våren/hösten 2026 bevarades utan specifika månader. En verklig ny AI-CV-version höll Flytande och vag period; den var spärrad för sparning tills uttryckligt godkännande. Godkännandet återställs efter text-/faktaredigering, ny generation och återöppning. Granskade uppgifter sparades och lästes tillbaka efter omladdning. Kompletterande webbtest: praktik i den fiktiva Testbutiken våren 2026 gav tom yrkestitel och tomma start-/slutmånader; Svenska Flytande och Engelska Grundläggande bevarades. AI föreslog obestyrkt kundkontakt i ett kompetensbelägg som rättades i faktapanelen före godkännande. Sparknappen aktiverades efter godkännande och spärrades igen efter faktarättning. Korrigerad version sparades och återlästa separata profilfält visade rätt period, tom yrkestitel och språk. Inga nya ansökningar eller anställningar skapades.
- Återstår / blockerare: Ingen blockerare för granskningskravet. AI är ingen fullständig faktakontroll och kan fortfarande föreslå exempelvis en titel eller ett obestyrkt belägg; det syns i granskningen och får inte sparas utan godkännande. Ett granskat språkfält används för matchning; råa belägg/anteckningar utesluts enligt F03. Äldre onboardingvägen är automatiserat verifierad, inte separat inloggat webbtestad. PR-förhandsvisningens saknade miljövariabler kvarstår som miljöfråga; driftsatt dev fungerar. Produktionsdatabasen orörd.

<a id="f03"></a>
### F03 Samordna CV text och strukturerade profilfakta

- [x] Klar
- Prioritet: P1
- Global ordning: 4
- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch/PR: [PR #50](https://github.com/vilgotdidrikson/youth-job-mvp/pull/50), `codex/f03-cv-consistency-20261013`, mergad till dev 2026-10-13
- Åtgärd: Låt användaren granska och rätta både CV-text och profilfakta i samma flöde. En rättad text får inte lämna motsägande datum eller språknivåer i profilen som används för matchning.
- Klar när: Samma faktauppgifter används i CV, profil och matchningsunderlag; fria formuleringar kan fortfarande redigeras.
- Implementerat: Fri CV-text behålls exakt och måste synkas till nya profilfakta före godkännande. Gemensam granskning i CV-hubben, profilens textredigering och äldre onboarding. Endast aktuell text skickas till faktahämtning; tidigare borttagna fakta återanvänds inte. Äldre profilfält härleds från rättade fakta, aldrig intervjuanteckningar. CV, strukturerade fakta, profilfält, dokumentreferenser och berörda språk i rekryteringsprofilen sparas tillsammans. Saknat schema eller misslyckad skrivning avbryter hela uppdateringen. Föråldrade anteckningar/belägg utesluts ur matchningsunderlaget. Gemensam logik kan återanvändas i mobilappen.
- Verifierat: F03-regression, profilerad sparning med simulerad Supabase-klient och sync-API-test passerar: ägarfilter, kvot/roll, samlad uppdatering, borttagna fakta, källisolering, fel utan delvis sparning och rekryteringsspråk. F02, CV-quality, matching, application-supplement, profilhämtning och auth-route passerar. TypeScript och fullt produktionsbygge av sammanslagen dev passerar; Vercel success. Inloggat driftsatt dev: fri text ändrades från våren/Flytande till hösten/Grundläggande, synkades och behölls exakt före sparning och efter återöppning. Gamla exakta datum/modersmål fanns inte kvar i granskade sparade fakta. Direkt ändring av språk och period byggde om CV-texten och krävde nytt godkännande. Ny AI-version fungerade och krävde godkännande. Både CV-hubbens och profilens alternativa sparning fungerade; profilens sparning gav CV och profilfakta sparade och en ny PDF-referens. Full omladdning visade det nya språket och perioden.
- Återstår / blockerare: Ingen blockerare för F03. Faktahämtning kräver fortsatt användargranskning; faktapanelen bygger om CV-texten och kan ersätta fria formuleringar enligt informationen i vyn. Fel/nekad åtkomst och äldre onboarding är automatiserat testade, inte framkallade i driftsatt webb. Företagets fullständiga matchningsflöde ligger i L07; samordnat payload och källunderlag verifierades automatiserat här. PDF-referensens sparning verifierades, men fysisk PDF-layout hör till L09. Separat uppladdad PDF kan ha eget innehåll. Ingen schema- eller produktionsdataändring. Nästa punkt påbörjas inte i denna insats enligt användarens besked 2026-10-13.

<a id="f04"></a>
### F04 Rätta företagets första navigation

- [ ] Klar
- Prioritet: P1
- Global ordning: 9
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Säkerställ att Gå till mitt konto går till kontot och att Skapa din första annons samt Ny annons öppnar annonsbyggaren direkt. Rätt destination ska fungera även efter nyregistrering utan omladdning.
- Klar när: Varje startknapp leder till den vy som etiketten utlovar.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f05"></a>
### F05 Gör matchningsanalysen begriplig och användbar

- [x] Klar
- Prioritet: P1
- Global ordning: 10
- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/f05-match-analysis-20261015`, [PR #64](https://github.com/vilgotdidrikson/youth-job-mvp/pull/64), mergad till dev `e292a12`.
- Åtgärd: Utred varför bedömningen inte blir läsbar och säkerställ att beräkningen slutförs eller visar ett hanterbart fel. Visa Beräknar, Klart eller Kunde inte uppdateras, senaste uppdatering och återförsök.
- Klar när: Företaget kan läsa ett färdigt underlag eller förstå och återhämta ett fel; en avstängd knapp blir inte ett oklart slutläge.
- Implementerat: Tydliga lägen Beräknar/Klart/Kunde inte uppdateras, tid för färdigt underlag, synliga hämtningsfel, begränsad väntan och direkt återförsök via befintligt behörighetskontrollerat API. Tidigare underlag bevaras vid fel och tillstånd isoleras vid kandidatbyte.
- Verifierat: Lokalt test:assessment-progress (observer och faktiska komponentcallbacks), test:matching och test:company-navigation passerar. TypeScript passerar. Kompletteringsregression, riktad ESLint utan varningar och webpack-produktionsbygge passerar. Autentiserad QA-ansökan i driftsatt dev går från väntande kö till direkt Beräknar → Klart med läsbart underlag och tidpunkt. Upprepad uppdatering fungerar och bevarar cachetid. Se docs/F05.md.
- Återstår / begränsningar: Inga blockerare för F05:s kriterium. Timeout/nätverksfel är simulerade regressioner. QA-annonsen saknar bedömbara kriterier; inget nytt live-OpenAI-resultat påstås verifierat. Fysisk mobilkontroll ligger kvar under L08. Ingen databasändring.

<a id="f06"></a>
### F06 Förklara pris och anställningsavgift

- [ ] Klar
- Prioritet: P1
- Global ordning: 11
- Status: Blockerad
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/l04-recruitment-20261018`, reserverad före kodarbete 2026-10-18. L04: status, rättelse, samtidighet och båda rollerna. F06: korrekt information om nuvarande kostnadsfria läge; framtida avgiftsbeslut återstår.
- Åtgärd: Beskriv den avsedda avgiften, vad som utlöser den, vem som faktureras och när. Gör gratis konto och eventuell avgift vid anställning begripliga på prissidan och före anställningsregistrering. Förklara också en aktiv rekrytering och 20 kandidater, inklusive vad som händer vid gränsen.
- Klar när: Företaget kan förstå hela prismodellen innan ett avgiftsutlösande steg. Visa bara gränser som faktiskt gäller.
- Implementerat: Aktuell kostnadsfri version tydliggörs på prissidan och före registrering av anställning. Delad pristext anger att registreringen inte skapar en avgift/faktura nu. Inaktiva gränser för en rekrytering/20 kandidater borttagna från priskortet.
- Verifierat: test:recruitment-review, TypeScript, riktad ESLint och fullständigt produktionsbygge passerar. PR #66 införd i dev med godkänd driftsättning. Publicerad företagsprissida verifierad i webbläsaren: korrekt kostnadsfri information och inga inaktiva gränser. Se docs/L04_F06_REVIEW.md.
- Återstår / blockerare: Framtida betald modell kräver beslutat belopp, avgiftsutlösare, fakturauppgifter och betalningsvillkor före aktivering. Nuvarande kostnadsfria läge kan införas utan dessa beslut.

<a id="f08"></a>
### F08 Tydliggör verifieringsunderlag och handläggning

- [ ] Klar
- Prioritet: P2
- Global ordning: 16
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Skilj Uppgifter saknas, Inskickat, Under granskning, Godkänt och Behöver kompletteras. Visa obligatoriska uppgifter, uppskattad handläggning och hjälpväg. Validera organisationsnummer på ett sätt som stödjer UF och hindrar uppenbart orimliga nummer från att framstå som giltiga.
- Klar när: Företaget vet vad det behöver göra och om underlaget faktiskt är inskickat.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f09"></a>
### F09 Anpassa publicering till verifieringsstatus

- [ ] Klar
- Prioritet: P2
- Global ordning: 17
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Anpassa knapp, förhandsvisning och bekräftelse till om företaget är godkänt. Före godkännande ska det framgå om annonsen sparas eller väntar på publicering och om den publiceras automatiskt efter beslut.
- Klar när: Ingen vy lovar omedelbar publicering när annonsen fortfarande väntar på verifiering.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f07"></a>
### F07 Bevara bilden i sparade annonsutkast

- [ ] Klar
- Prioritet: P1
- Global ordning: 18
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Spara omslagsbilden och beskärningen tillsammans med resten av annonsutkastet. Använd inte en generell Utkast sparat-bekräftelse om någon del saknas; ange då exakt vad som återstår att spara.
- Klar när: Bild, text och praktiska uppgifter finns kvar när utkastet återöppnas efter omladdning.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f13"></a>
### F13 Rätta status för väntande ansökningar

- [ ] Klar
- Prioritet: P2
- Global ordning: 23
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Räkna väntande intresse konsekvent i Alla eller ge det en tydlig egen kategori. Visa Inte skickad ännu och vad som krävs för sändning. Ge annonslänk och korrekt knappstatus även innan CV är färdigt.
- Klar när: En synlig väntande ansökan motsäger inte räknaren eller texten om redan skickade ansökningar.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f14"></a>
### F14 Gör notiser och lässtatus användbara

- [ ] Klar
- Prioritet: P2
- Global ordning: 24
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Skriv person eller företag och jobb i match- och meddelandenotiser. Öppna rätt konversation direkt. Återställ lässtatus och badges när motsvarande händelse är hanterad; skilj historiska händelser från kvarvarande uppgifter. Ge diskret CV-påminnelse för väntande intresse.
- Klar när: Notiser leder till rätt ärende och signalerar bara det som fortfarande behöver uppmärksamhet.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f10"></a>
### F10 Återanvänd redan sparade uppgifter

- [ ] Klar
- Prioritet: P2
- Global ordning: 27
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Förifyll CV-guiden med erfarenhet, utbildning och språk från profilen. Förifyll annonsens stad från företaget och erbjud överföring av uttryckligt angiven lön till lönefälten. Alla förslag ska kunna rättas.
- Klar när: Användaren slipper skriva samma fakta två gånger och motstridiga värden blir synliga.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f12"></a>
### F12 Förbättra kompletteringsfrågornas innehåll

- [ ] Klar
- Prioritet: P2
- Global ordning: 29
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Skilj språk och nivå från fri kravtext så att Svenska behövs för kundkontakt inte blir ett språknamn. Använd kända profilfakta och undvik att fråga igen om uppgifter som redan är tydliga. Behåll frågor frivilliga efter skickad ansökan.
- Klar när: Frågorna är grammatiskt riktiga, relevanta och kompletterar faktiskt saknat underlag.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f11"></a>
### F11 Visa vad AI överför till annonsfälten

- [ ] Klar
- Prioritet: P2
- Global ordning: 30
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Överför uttryckliga ålders- och löneuppgifter till rätt fält eller markera att de behöver granskas. Sammanfatta AI:s ändringar och skilj arbetsform från absoluta krav; gör inte automatiskt varje önskemål till ett måste.
- Klar när: Företaget kan se vilka fakta som används i text och matchning innan publicering.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f22"></a>
### F22 Validera inmatning nära fälten

- [ ] Klar
- Prioritet: P2
- Global ordning: 31
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Hindra omvända löneintervall och orimliga åldersspann innan förhandsvisning och sparande. Ge begripliga svenska feltexter där appen styr dem och tydlig datumhjälp utan att förutsätta webbläsarens lokala format.
- Klar när: Fel kan rättas vid rätt fält utan att en missvisande annons visas.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f20"></a>
### F20 Gör integritet villkor och hjälp lätta att nå

- [ ] Klar
- Prioritet: P2
- Global ordning: 33
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Lägg tydliga ingångar till befintlig integritetsinformation, AI-användning, villkor och kontakt på publika sidor och vid registrering samt konsekvent i båda rollerna. Förklara hur CV och profil används.
- Klar när: Relevant information och hjälp är åtkomliga där användaren fattar beslut; den nödvändiga saktexten är genomgången.
- Tillägg 2026-10-18: Förklara skillnaden mellan egen jobbprofil, jobbspecifikt delat ansökningsunderlag och uppgifter som används i matchningen. Förklara självuppgivna exempel, eventuell sekundär procent/täckningsgrad och kontaktuppgifter i uppladdade CV. Samordna med N19:s förhandsvisning; generell företagsåtkomst till profil får inte utlovas.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f23"></a>
### F23 Ge val och dialoger korrekt tillgänglighet

- [ ] Klar
- Prioritet: P2
- Global ordning: 34
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Använd radioval för ett enda rollval och korrekt semantik för flikar och flervalsknappar. Ge tydliga namn, synligt fokus, tangentbordsstyrning och konsekvent fokus vid öppning och stängning av dialoger.
- Klar när: Rollval, filter och dialoger går att förstå och använda med tangentbord och hjälpmedel.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f15"></a>
### F15 Förenkla ungdomens första steg

- [ ] Klar
- Prioritet: P2
- Global ordning: 35
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/profile-journey-20261014`; reserverad före kodarbete 2026-10-14 enligt uttrycklig beställning om profilflöde och större chatt.
- Åtgärd: Låt kort onboarding leda direkt till jobbupptäckt med en diskret möjlighet att bygga profil senare. Förklara att CV behövs för att skicka ansökan, medan övriga profildelar och kompletteringsfrågor är valfria.
- Klar när: Ungdomen kan börja utforska utan ytterligare obligatorisk profilintroduktion eller stopp i swipeflödet.
- Implementerat: Valet Bygg profil/Bygg senare följs av sex ordnade steg med sparad progress, paus och återupptagning. Onboardingens befintliga länk till byggvalet återanvänds.
- Verifierat: Se leveransens faktiska lokala kontroller under Profilflöde och informationsöversyn ovan.
- Återstår / blockerare: Visuellt acceptanstest i dev; autentiserad testwebbläsare blockerad av inloggningsskydd. Ingen bock för Klar före användarflödets verifiering.

<a id="f16"></a>
### F16 Ge ett stabilt nästa steg efter färdigt CV

- [ ] Klar
- Prioritet: P2
- Global ordning: 36
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/profile-journey-20261014`; reserverad före kodarbete 2026-10-14 enligt uttrycklig beställning om profilflöde och större chatt.
- Åtgärd: Ta bort tidsstyrd navigation som gör succésrutans ansökningslänk svår att använda. Låt användaren själv välja nästa steg eller gå direkt till ansökningarna med tydlig bekräftelse på vad som skickats.
- Klar när: Bekräftelsen och dess länkar hinner läsas och användas.
- Implementerat: Båda timerstyrda CV-vidarekopplingarna borttagna. Sparbekräftelse och aktiva nästa-steg-/ansökningslänkar ligger kvar.
- Verifierat: Se leveransens faktiska lokala kontroller under Profilflöde och informationsöversyn ovan.
- Återstår / blockerare: Visuellt acceptanstest i dev; autentiserad testwebbläsare blockerad av inloggningsskydd. Ingen bock för Klar före användarflödets verifiering.

<a id="f17"></a>
### F17 Samla anställningsflödet i en tydlig ingång

- [ ] Klar
- Prioritet: P2
- Global ordning: 39
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Använd samma benämning och ingång i stället för både Registrera anställning och Markera som anställd. Förklara befattning, startdatum, ungdomens granskning och nästa status, tillsammans med prisinformationen i F06.
- Klar när: Användaren förstår vad registreringen innebär och vad som händer därefter.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f18"></a>
### F18 Förbättra sparande i profilredigeringen

- [ ] Klar
- Prioritet: P2
- Global ordning: 42
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/profile-journey-20261014`; reserverad före kodarbete 2026-10-14 enligt uttrycklig beställning om profilflöde och större chatt.
- Åtgärd: Låt användaren stanna vid den del som redigeras efter sparande. Använd sparknappar per del eller en tydlig gemensam sparfunktion. Skilj ifylld information från faktiskt sparad information i progressen.
- Klar när: Sparbekräftelsen är korrekt och användaren tappar inte sin plats.
- Implementerat: Sparande stannar vid redigerad del. Profilramar skyddar pågående sparande och osparade CV-/profiländringar; kontaktformuläret skriver bara kontaktfält.
- Verifierat: Se leveransens faktiska lokala kontroller under Profilflöde och informationsöversyn ovan.
- Återstår / blockerare: Visuellt acceptanstest i dev; autentiserad testwebbläsare blockerad av inloggningsskydd. Ingen bock för Klar före användarflödets verifiering.

<a id="f24"></a>
### F24 Gör kartans reservvy användbar

- [ ] Klar
- Prioritet: P2
- Global ordning: 43
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: När kartan inte kan visas, ersätt den stora tomma kartyta med jobbkort eller en fungerande lista och tydlig växling mellan vyerna. Behåll relevanta filter och resultat.
- Klar när: Kartfel hindrar inte fortsatt jobbupptäckt och lämnar inte huvuddelen av sidan tom.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f25"></a>
### F25 Slå samman likvärdiga förmåner

- [ ] Klar
- Prioritet: P3
- Global ordning: 51
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Samordna företagsprofilens AI-förslag med annonsens val så att Lunch under arbetspasset och Måltid ingår inte blir dubbla poster. Låt företaget granska och redigera den slutliga listan.
- Klar när: Annonsen visar en kort och konsekvent förmånslista utan upprepningar.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f21"></a>
### F21 Förtydliga konto och företagsuppgifter

- [ ] Klar
- Prioritet: P3
- Global ordning: 56
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Skilj Profil från Mitt konto genom rätt flik eller ta bort dubbleringen. Ge en tydlig väg att se och uppdatera bransch och administratör som lämnats i onboarding.
- Klar när: Navigationens etiketter har tydliga destinationer och grunduppgifter kan hållas aktuella.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f19"></a>
### F19 Gör filterdialogens beteende tydligt

- [ ] Klar
- Prioritet: P3
- Global ordning: 57
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Välj ett konsekvent beteende: direkt filtrering med tydlig stängning eller tillämpning med möjlighet att avbryta. Visa aktiva filter och gör rensning lätt att hitta.
- Klar när: Det är tydligt om stängning behåller eller avbryter valen.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

## Design och text

<a id="d02"></a>
### D02 Håll chattens skrivfält inom vyn

- [ ] Klar
- Prioritet: P2
- Global ordning: 25
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/profile-journey-20261014`; reserverad före kodarbete 2026-10-14 enligt uttrycklig beställning om profilflöde och större chatt.
- Åtgärd: Beräkna chattens höjd med hänsyn till navigation och sidrubrik. Låt meddelandeytan skrolla separat och håll skrivfält samt Skicka åtkomliga, även på liten skärm och när tangentbordet visas.
- Klar när: Skrivfältet hamnar inte nedanför den tillgängliga vyn.
- Implementerat: Desktopchattens tidigare höjdtak borttaget, bredare arbetsyta och kompakt navigation/rubrik. Befintliga mobilanpassningar behållna.
- Verifierat: Se leveransens faktiska lokala kontroller under Profilflöde och informationsöversyn ovan.
- Återstår / blockerare: Visuellt acceptanstest i dev; autentiserad testwebbläsare blockerad av inloggningsskydd. Ingen bock för Klar före användarflödets verifiering.

<a id="d01"></a>
### D01 Rätta knapparna i profilintroduktionen

- [ ] Klar
- Prioritet: P2
- Global ordning: 48
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: På /profile/build?welcome=1 ska Bygg din profil ha text och pil på samma rad. Centrera texten i Skapa den senare vertikalt och ge knapparna konsekvent höjd, mellanrum och padding.
- Klar när: Ingen pilrad eller stor tom yta under sekundärtexten.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d05"></a>
### D05 Förklara produkten direkt på startsidan

- [ ] Klar
- Prioritet: P2
- Global ordning: 49
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Lägg en statisk kort förklaring av ungdomsjobb och matchning i första vyn. Minska tomrum där det döljer nyttan. Låt eventuell skrivmaskinsanimation vara ett komplement och respektera reducerad rörelse.
- Klar när: Besökaren förstår tjänsten utan att vänta på en animerad rubrik.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d09"></a>
### D09 Placera feedback vid rätt åtgärd

- [ ] Klar
- Prioritet: P3
- Global ordning: 50
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Visa Pausar eller Sparar vid den knapp som används i stället för vid Ta bort. Förtydliga sista CV-frågans Hoppa över och använd Fortsätt utforska bara om användaren faktiskt kommer tillbaka till upptäck.
- Klar när: Knapptext och feedback beskriver det som händer och den destination användaren får.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d03"></a>
### D03 Ge kriteriernas textfält mer plats

- [ ] Klar
- Prioritet: P3
- Global ordning: 52
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Öka höjden eller använd innehållsanpassning för rollbeskrivning, grundkrav, lärande, egenskaper och frågor. Minska det stora tomrummet mellan fälten och behåll tydliga etiketter.
- Klar när: Flera rader går att läsa utan att skrolla i varje mycket lågt fält.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d06"></a>
### D06 Gör status och profilprogress begripliga

- [ ] Klar
- Prioritet: P3
- Global ordning: 53
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Byt abstrakt 1 av 5 och tekniska förklaringar mot exempelvis CV klart och valfria profildelar. Anpassa ansökningstext till väntande eller skickad status och skriv tydligt vad som återstår.
- Klar när: Texten beskriver användarens situation och nästa steg.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d04"></a>
### D04 Öka padding på kartans kortknapp

- [ ] Klar
- Prioritet: P3
- Global ordning: 54
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Ge Visa som kort tillräcklig horisontell padding och samma mått som andra sekundärknappar. Anpassa till reservvyn i F24.
- Klar när: Text och ikon ligger med tydlig marginal till knappens kanter.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d07"></a>
### D07 Rätta mikrocopy och varumärkestext

- [ ] Klar
- Prioritet: P3
- Global ordning: 55
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Rätta 1 ansökningar, blandade versaler och tekniska uttryck. Använd samma MatchnWork-namn och avsedd kontaktadress. Anpassa Tillbaka till Upptäck för företaget. Beskriv kort onboarding och manuell CV-väg korrekt; precisera lönecheck-löftet om tjänsten inte följer hela vägen.
- Klar när: Etiketter, produktlöften och kontaktvägar är konsekventa och sakligt riktiga.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d08"></a>
### D08 Gör tomvyer och sidbredder konsekventa

- [ ] Klar
- Prioritet: P3
- Global ordning: 58
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Visa ett relevant nästa steg i tom chattsida i stället för Välj en matchning när ingen finns. Samordna marginaler och innehållsbredder mellan upptäck, profil, ansökningar och chatt, med avsiktliga undantag för tvåspaltsvyer.
- Klar när: Tomvyer ger användbar väg vidare och layouten känns sammanhängande.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

## Lansering, tidigare beslut och kompletterande verifiering

<a id="l01"></a>
### L01 Återställ ett godkänt produktionsbygge

- [x] Klar
- Prioritet: P1
- Global ordning: 1
- Typ: Konstaterad teknisk blockerare
- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch/PR: [PR #48](https://github.com/vilgotdidrikson/youth-job-mvp/pull/48), `fix/l01-build-20261013`, införd i dev
- Åtgärd: Åtgärda det befintliga typfelet i app/login/page.tsx där sidans default-export har otillåtna props. Bevara inloggnings- och registreringsflöden och kontrollera aktuellt dev innan ändring. Detta är en separat uppgift från F01.
- Klar när: Produktionsbygget passerar och inloggnings-/registreringsvägarna fungerar efter ändringen.
- Implementerat: Återanvändbar AuthPage flyttad till components; login/signup exporterar giltiga routes utan specialprops. Äldre YouthOnboardingFlow flyttad ut från onboardingens routefil; kort onboarding behålls. Inga ändringar i formulärlogik, auth eller databassäkerhet.
- Verifierat: Hela `npm run build -- --webpack` passerar både separat och tillsammans med F01, inklusive typkontroll och 48 statiska sidor. Auth-route-regression och F01-regression passerar. Bytejämförelser visar bevarad formulär-/onboardinglogik. Riktad ESLint har 0 fel och 8 tidigare varningar i äldre onboardingkod. Vercel dev success. I driftsatt dev fungerar signup med vald företagsroll, växling signup/login och säker inloggning med befintligt ungdomstestkonto. Skyddad onboarding-rutt återgår korrekt till upptäck för kontot med redan färdig onboarding; skyddade profildelar öppnas.
- Återstår / blockerare: Ingen byggblockerare. Ny kontoregistrering och nya kontons hela onboarding har inte körts i denna leverans; ingår i L06/L07. Tidigare lintvarningar i äldre onboardingkod kvarstår men stoppar inte bygget.

<a id="l04"></a>
### L04 Färdigställ och verifiera anställningsbekräftelsen

- [ ] Klar
- Prioritet: P1
- Global ordning: 12
- Typ: Befintligt flöde / tidigare beslut som ska verifieras
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/l04-recruitment-20261018`, [PR #66](https://github.com/vilgotdidrikson/youth-job-mvp/pull/66), införd i dev. Reserverad före kodarbete 2026-10-18. L04: status, rättelse, samtidighet och båda rollerna. F06: korrekt information om nuvarande kostnadsfria läge; framtida avgiftsbeslut återstår.
- Åtgärd: Inventera redan byggt flöde för företagets registrering, ungdomens bekräftelse eller invändning, slutstatus och historik. Förtydliga skillnaden mellan väntande och bekräftad anställning. Koppla fakturering först till beslutad utlösande händelse. Kontrollera tidigare beslutad åtgärd mot utebliven registrering och eventuell profilmarkering för bekräftat jobb; bestäm eventuell belöning separat innan den utlovas. Samordna med F06/F17.
- Klar när: Båda rollerna förstår och kan genomföra bekräftelse eller invändning. Status, historik och fakturautlösning överensstämmer; företaget kan inte ensamt skapa en felaktigt bekräftad anställning.
- Implementerat: Registrering/rättelse/godkännande binds till faktiskt visad befattning, startdatum och svarsstatus. Konflikter kräver omhämtning; direkt dubbelklick och dubbelsparande efter hämtningsfel skyddas. Tydliga registrerad/väntande/invänd/bekräftad-lägen, separat profil/CV-samtycke och exakta matchlänkar i sammanfattningar/notiser/påminnelser. Befintliga behörigheter och inaktiv fakturering bevarade.
- Verifierat: Reproducerad stale-approval-bugg före fix i QA-transaktion. 60 transaktionella DevStaging-kontroller passerar både före och efter införandet och rullas tillbaka. Dev-driftsättning av PR #66 har godkänd byggstatus; migration 20261018105704 införd enbart i DevStaging. Säkerhetsrådgivare: inga nya fynd. Faktiska formulärhandlers, referens-/länkval och recovery testas i test:recruitment-review. Befintliga recruitment/matching, TypeScript, riktad ESLint och webpack-produktionsbygge passerar.
- Återstår / blockerare: Inloggad testwebbläsarsession saknas; visuellt end-to-end-test av båda rollerna och fysisk mobil är inte godkända. Se docs/L04_F06_REVIEW.md.

<a id="l02"></a>
### L02 SMTP och tillförlitliga e-postutskick

- [ ] Klar
- Prioritet: P1
- Global ordning: 14
- Typ: Tidigare beslutad funktion / återstående införande
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Inventera befintlig e-postkod och konfigurera fungerande avsändare och leverans. Prioritera verifiering, återställning av lösenord och fakturautskick. Koppla mallar, leveransstatus och återförsök till rätt händelser och undvik dubbla utskick. Match- och meddelandemail är en senare del, med notispreferenser.
- Klar när: Kritiska mejl når testmottagare, länkar leder till rätt miljö och misslyckade eller upprepade försök hanteras spårbart.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="l03"></a>
### L03 Automatiserad fakturering vid bekräftad anställning

- [ ] Klar
- Prioritet: P1
- Global ordning: 15
- Typ: Tidigare beslutad funktion
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Samla fakturauppgifter och fastställ pris, avgiftsutlösande händelse, betalningsvillkor och fakturamall innan skarp användning. Koppla bekräftad anställning till en unik faktura, PDF, e-post och administrativ betalningsstatus. Första versionen kan använda manuell betalningsavstämning. Hantera fel och rättelser utan dubbelfakturering. Premiumabonnemang och Swish Handel ingår inte i denna leverans.
- Klar när: En avsedd bekräftad testanställning ger exakt en testfaktura; mottagare, belopp och status är korrekta och flödet kan återförsökas säkert utan verkligt betalningsåtagande.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="l05"></a>
### L05 Säkerhet, blockering, rapportering och administration

- [ ] Klar
- Prioritet: P1
- Global ordning: 21
- Typ: Verifiering och komplettering av befintlig funktionalitet
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Inventera blockering, rapportering, företagsverifiering och adminhantering innan ny kod skrivs. Kontrollera att rapporter kan följas upp och att blockering påverkar kommunikation som avsett. Kör negativa åtkomsttester med egna ungdoms- och företagskonton: andra profiler, ansökningar, privata CV/video, matchningar och chattar samt pausade/stängda jobb. Lägg till verkligt saknade delar och bevara RLS.
- Klar när: Obehörig åtkomst nekas, rapporter kan hanteras av rätt administratör och blockerade konton kan inte fortsätta den kommunikation som spärren avser.
- Tillägg 2026-10-18 (F26/N19): Verifiera att företaget bara når jobbspecifikt ansökningsunderlag, inte hela jobbprofilen. Testa verkliga API-/RPC-svar, direkta databasfrågor/RLS och privata CV-/videolänkar med anonym, fel företag och fel jobb/ansökan. Kontrollera även äldre alternativa åtkomstvägar och AI-belägg: inga privata utkast, råa textsamtal, avvisade AI-förslag, orelaterade profilfält eller exakt bostadsadress i strukturerat underlag. Original-CV kan innehålla kontaktuppgifter och ska motsvara ungdomens granskade delning. Dold UI är inte åtkomstkontroll. Dessa nya kontroller är beställda, inte genomförda.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="l06"></a>
### L06 Verifiera kontots grundläggande fel- och återställningsvägar

- [ ] Klar
- Prioritet: P1
- Global ordning: 22
- Typ: Verifiering och komplettering
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Kontrollera registrering, verifieringsmejl, glömt lösenord, säkert lösenordsbyte, utloggning och utgången session. Inventera kontoradering och rätta eventuella luckor. Hantera privata dokument och video vid radering. Genomför känsliga tester med egna konton och enligt autentiseringsverktygets regler; begär aldrig lösenord i chatten. Utökade kontoval ligger i N10.
- Klar när: Användaren kan återfå åtkomst och förstå fel utan att fastna. Sessioner och eventuell radering får det avsedda, verifierade resultatet.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="l09"></a>
### L09 Verifiera CV-uppladdning och PDF-layout

- [ ] Klar
- Prioritet: P2
- Global ordning: 45
- Typ: Verifiering och eventuell designförbättring
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Kontrollera uppladdat PDF-CV, behörig visning före match och exporterat CV. Granska faktisk PDF-layout med kort och långt innehåll, sidbrytningar, svenska tecken och läsbarhet. En startad nedladdning räcker inte som layoutverifiering.
- Klar när: Uppladdat och genererat CV kan öppnas av rätt användare och PDF:en är läsbar utan klippt text eller felaktiga sidbrytningar.
- Tillägg 2026-10-18 (N19/N21): Förhandsvisa den faktiskt delade CV-versionen, även uppladdad original-PDF med mejl, telefon eller bostadsadress. Förklara att sådant innehåll blir synligt i dokumentet och låt ungdomen byta/rätta filen före delning; dold kontaktsektion räcker inte. Påstå inte automatisk PDF-maskning. Testa behörighet och att dokumentet motsvarar delningsförhandsvisningen; detta tillägg är inte verifierat ännu.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="l08"></a>
### L08 Verifiera mobil, tangentbord och kartinteraktion

- [ ] Klar
- Prioritet: P1
- Global ordning: 46
- Typ: Slutverifiering och korrigering
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Kontrollera alla centrala vyer i verklig mobil viewport och relevanta riktiga mobilwebbläsare: navigation, formulär, bildbeskärning/zoom/dragning, chatt med öppet tangentbord och video. Kontrollera fokus och tangentbordsanvändning. Testa kartpins, zoom och geografisk interaktion i miljö med WebGL, samt reservvy. F23/F24 och designpunkterna beskriver kända förbättringar; ytterligare fel dokumenteras separat.
- Klar när: Kärnflödena går att använda på mobil och med tangentbord utan dolda kontroller, horisontellt spill eller blockerande kartfel.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="l07"></a>
### L07 Verifiera hela rekryteringskedjan i driftsatt dev

- [ ] Klar
- Prioritet: P1
- Global ordning: 47
- Typ: Slutverifiering
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Kör med egna fiktiva konton: ny ungdom och nytt företag, verifiering före/efter adminbeslut, annonsutkast/AI/bild/publicering/redigering/paus/stängning, intresse före/efter CV, kandidater/filter/CV före match/analys/beslut, match/chatt/video/notiser och bekräftad eller invänd anställning med testfaktura. Kontrollera kvarstående och återkommande status efter omladdning. Dokumentera faktiskt testat och skilj verktygsproblem från produktfel.
- Klar när: Kärnflödet fungerar genom båda rollerna och admin utan verkliga ärenden eller betalningar; inga öppna blockerande fel återstår.
- Tillägg 2026-10-18: Verifiera ungdomens delningsförhandsvisning mot företagets faktiska jobbspecifika underlag och nätverkssvar. Praktiska fakta ska gå att läsa utan AI. Testa låg/okänd matchning, avstå/ingen video och kamera-/uppladdningsfel: ansökan skickas och förblir synlig. Kontrollera att arbetsplatsens adress/flera adresser fortsatt fungerar i annons och karta. Ingen generell Mer om kandidaten-vy får exponera hela jobbprofilen. N22/N23 gäller; testfallen är ännu inte genomförda.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="l10"></a>
### L10 Lanseringsmiljö, domän och drift

- [ ] Klar
- Prioritet: P1
- Global ordning: 60
- Typ: Tidigare planerad lanseringsförberedelse
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Koppla vald domän och företagsanpassat Vercel-upplägg när det är dags för skarp lansering. Kontrollera separata dev-/produktionsmiljöer, variabler, autentiseringens redirect-adresser, e-postlänkar, tillämpliga migrationer och privata lagringsbehörigheter. Ordna felövervakning, ansvar för support och en konkret återställningsväg. Visa enbart priser och tjänster som gäller vid lanseringen.
- Klar när: Skarp miljö är korrekt konfigurerad, kärnflödet röktestas på rätt domän och teamet kan upptäcka och återställa ett misslyckat släpp.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

## Avgränsningar och beslut som återstår

- Premiumfunktioner och abonnemangsbetalning kommer senare. Fakturering vid anställning ingår i den aktuella affärsmodellen.
- Kandidatdatabas, privatpersoners småjobb och en separat mobilapp ingår inte i denna utvecklingsperiod. Ny logik ska ändå gå att återanvända i framtida mobilapp.
- Besluta exakt anställningsavgift, fakturauppgifter/betalningsvillkor, avgiftsutlösande status och eventuell ungdomsbelöning innan skarpa belopp eller löften publiceras.
- Video gallras efter 14 dagar från skickandet enligt L12. Övriga mediagränser och hantering av delningar efter ersättning/radering återstår. Video ska omfattas av åtkomstkontroll, hjälp/integritetsinformation och rapportering.
- Testning av externa utskick, känslig kontohantering och administration sker bara med egna testkonton och tydligt märkta testuppgifter.

## Profil, relevans och matchningskvalitet – beställt 2026-10-18

<a id="n17"></a>
### N17 Gemensamma jobbtyper med fria annonstitlar

- [ ] Klar
- Prioritet: P1
- Global ordning: 13.1
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Behåll egen titel; föreslå rättningsbar gemensam jobbtyp från rollens titel/beskrivning, aldrig enbart företagets bransch. Använd stabila kategori-ID:n och synonymer i annons, profilönskemål och filter. Hantera äldre fria kategorier utan dataförlust, osäkra förslag och roller som ännu saknas.
- Klar när: Cafémedarbetare, caféjobb och cafépersonal hittas genom samma val Caféarbete; barista behåller sin inriktning. Ekonom på café blir inte caféarbete. Rättat förslag bevaras vid redigering/kopia/omladdning; okänd roll försvinner inte från flödet.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n18"></a>
### N18 Relevant och varierat jobbflöde

- [ ] Klar
- Prioritet: P2
- Global ordning: 13.2
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Bygg vidare på N17: uttryckliga filter är hårda val; profilönskemål, plats och känd tillgänglighet ger mjuk prioritering. Ovisade annonser, publiceringstid och variation mellan företag styr därefter. Behåll spärrar för tidigare val/ansökningar; ingen automatisk återvisning/lyft vid anställning eller textredigering. Visa begriplig anledning till relevans.
- Klar när: Tom profil kan upptäcka jobb och nybörjare utesluts inte för saknad erfarenhet. Filter respekteras, resultat/paginering är stabila, flera arbetsplatser räknas en gång och ett företag tar inte över flödet. Sparade jobb fungerar separat. Inga betalda lyft aktiveras.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f26"></a>
### F26 Granska matchningens rättvisa och faktaunderlag

- [ ] Klar
- Prioritet: P1
- Global ordning: 13.3
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Granska faktiskt kriterieflöde, AI-instruktioner, regler, belägg och beräkning; F05 täckte teknisk leverans, inte detta kvalitetskrav. Ersätt den generella rutan Mer om kandidaten med jobbspecifikt ansökningsunderlag tillsammans med N19. Låt jobbkrav, relevanta belägg från godkända uppgifter och skillnaden stöd/uttrycklig motsägelse/okänd dominera. Eventuell matchprocent visas sekundärt tillsammans med täckningsgrad. Förstå likvärdiga formuleringar utan nya sakpåståenden. Märk egna exempel som självuppgivna, aldrig verifierade personlighetsomdömen eller personlighetspoäng. Använd bara relevant godkänt underlag; läck inte hela profilen genom AI-resultat. Ingen ansökan nekas eller döljs automatiskt på grund av matchningsgrad eller saknad video.
- Klar när: Synonympar som punktlig/bra på att passa tider återges rättvist med självuppgivet belägg. Fotbollstränare ger inte automatiskt punktlighet, ansvar eller ledarskap. Saknad uppgift är okänd, inte underkänd. Kriterier/belägg är primära, eventuell procent sekundär med täckningsgrad; mer text ger inte i sig bättre poäng. Inaktuella/ogranskade/avvisade AI-förslag, råa textsamtal, orelaterade profiluppgifter och känsliga attribut används inte. Företagsunderlaget har rätt jobb-/ansökningsscope även via API/databas enligt L05; ungdomen ser vilka uppgifter som används. Testa låg/okänd matchning och ingen/nekad video: ansökan är fortsatt synlig och skickas enligt ordinarie behörighets-/CV-regler.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n19"></a>
### N19 Samlad jobbprofil och ett kort grund-CV

- [ ] Klar
- Prioritet: P2
- Global ordning: 13.4
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Gör Bygg din profil till övergripande flöde. Återanvänd F02/F03/F15/F18 och separera godkända profilfakta, CV-urval och privat arbetsmaterial. Ett generellt granskat grund-CV, normalt en sida, upp till två vid behov; ingen tyst kapning vid 500 ord. Företaget får ett jobbspecifikt ansökningsunderlag, inte generell tillgång till hela jobbprofilen: granskat CV, relevanta direkt läsbara praktiska uppgifter (tillgänglighet, tidigaste start, ungefärligt bostadsområde), F26:s kriterier/belägg och svar/frivillig video uttryckligen delade för aktuell ansökan. Använd postnummer vid behov, inte exakt bostadsadress. Bevara arbetsplatsens adress i annons/karta. Låt ungdomen förhandsvisa verklig delning och förstå vilka godkända uppgifter som används i matchningen, inklusive kontaktuppgifter som kan finnas i uppladdat CV. Begränsa åtkomsten även i API/RPC/databas/RLS och privata fillänkar; returnera inte hela profilrader för klientfiltrering.
- Klar när: Alla skapande-/redigeringsvägar använder samma granskningskrav och aktuella faktakällor. Ungdomen kan välja/rätta CV-urval, pausa/fortsätta och förhandsvisa delat ansökningsunderlag för rätt jobb inklusive PDF-innehåll/kontaktuppgifter. Dokumentera hantering av ändringar/versioner av redan skickat underlag. CV är kort/läsbart enligt L09; fler godkända fakta kan finnas i egen profil utan generell företagsåtkomst. Praktiska fakta är läsbara utan AI. Privata utkast, råa textsamtal, avvisade/ogranskade AI-förslag, orelaterade uppgifter och exakt bostadsadress läcker inte genom strukturerade företagsdata eller AI-belägg; original-CV hanteras med uttrycklig granskad delning. L05:s negativa API-/databastester passerar. Låg matchningsgrad/saknad video stoppar eller döljer inte ansökan.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n20"></a>
### N20 Textbaserad profilguide och diskret formulärhjälp

- [ ] Klar
- Prioritet: P2
- Global ordning: 13.5
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Erbjud valfritt textsamtal med en fråga åt gången, relevanta öppna följdfrågor, hoppa över och fortsätt senare. Samma profilmodell som N19 och vanliga formuläret. Hjälp mig utveckla texten öppnar lokalt i avsnittet, inte en kedja av modaler. Återanvänd relevanta frågeområden från avstängd röstfunktion utan att aktivera ljud.
- Klar när: Guiden undviker upprepade/ledande frågor, håller isär erfarenheter och producerar ett användbart utkast. Förslag kan godkännas/ändras/avvisas; nya lärdomar/egenskaper förs inte in utan bekräftelse. Godkännande gäller aktuell text, återställs efter ändring och krävs före profil-/CV-publicering och matchningsanvändning. Mobil med tangentbord och avbrott fungerar.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Tillägg 2026-10-18: Råa textsamtal, privata utkast och avvisade AI-förslag stannar utanför företagets underlag och matchning. Endast godkända relevanta fakta kan ingå enligt N19/F26; guiden ska hjälpa ungdomen förstå delningen utan att tillföra generell profilåtkomst.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n21"></a>
### N21 Valfri genomläsning av uppladdat CV

- [ ] Klar
- Prioritet: P2
- Global ordning: 13.6
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Behåll original-PDF och erbjud Få förbättringsförslag för struktur, tydlighet, upprepningar och saknade relevanta uppgifter. Ge konkreta frivilliga frågor utan att fylla i svar. Godkända kompletteringar kan läggas i profilen och användaren väljer om nytt grund-CV ska skapas. Återanvänd PDF-läsning och åtkomstkontroll.
- Klar när: Originalet ersätts aldrig utan uttryckligt val. Saknade fakta blir förslag/frågor, inte publicerade antaganden. Oåtkomlig/oläsbar/skannad PDF hanteras tydligt utan falskt genomläsningsbesked. Samma granskningskrav som N19/N20 gäller; uppladdning kräver inte AI-genomläsning.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Tillägg 2026-10-18: Uppladdat CV kan innehålla kontaktuppgifter/exakt bostadsadress. Samordna granskad dokumentdelning, tydlig information och förhandsvisning med N19/L09; dolda profilfält maskerar inte PDF-innehåll. Godkända kompletteringar ger inte generell företagsåtkomst till profilen.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

## Reviderad video – beställt 2026-10-18

Dokumentationsleverans: `codex/n22-n23-video-plan-20261018`. Detta tillägg ändrar planen, inte produktkoden eller lagrade filer. N22/N23 är Ej påbörjad och ska reserveras före respektive kodleverans. Prioriteringen placerar borttagning av profilvideo före den tidigare videolanseringen; nya ansökningsvideor följer fungerande chattvideo och får inte blockera ansökningar. Den äldre profilflödesbeställningen CV → Video → övrigt ovan är historik och ersätts för videosteget av N22.

<a id="n22"></a>
### N22 Ta bort permanent profilvideo

- [ ] Klar
- Prioritet: P1
- Global ordning: 4.1
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n22-remove-profile-video-20261018`; reservation före kodarbete.
- Åtgärd: Ta bort profilvideo från ungdomens profil, profilbyggandets steg/framsteg, kandidatvyer och chattens val Dela profilvideo. Uppdatera texter och nästa-steg-länkar så CV följs av övriga profildelar utan videosteg. Stäng även gamla direktlänkar och backendmöjligheten att skapa/ersätta eller hämta profilvideo som del av produkten; enbart dold UI räcker inte. Behåll inspelning/uppladdning av separat chattvideo. Inventera befintliga profilfiler, profilpekare och gamla chattdelningar och definiera tydlig avveckling/städning med hänsyn till behörighet och rapporterat innehåll. Ingen blind radering av delad videolagring, chattar eller migrationshistorik.
- Klar när: Profilvideo kan varken skapas, visas eller räknas som saknad i profil, kandidatvy eller profilguide. Gamla URL:er/API-vägar återinför inte funktionen. Separat chattinspelning/uppladdning/uppspelning fungerar fortsatt för rätt deltagare. Gamla profilvideodelningar har begriplig status och påverkar inte separata chattfiler. Datahantering/städning och faktisk verifiering dokumenteras.
- Samordning 2026-10-18: Det jobbspecifika ansökningsunderlaget i F26/N19 får inte innehålla permanent profilvideo eller öppna generell profilåtkomst. Borttagningen ska gälla även backend/äldre direktvägar; separat frivillig ansökningsvideo hanteras av N23.
- Implementerat: Profil-/kandidatvideovyer, profilsteget och delningsvalet borttagna. Fem steg med kompatibel återupptagning; gamla direktlänkar monterar ingen media. Gamla delningar får avvecklingsmarkering. DevStaging-migration 20261018165208 stänger pekare, profilmetadata, Storage och nya profilvideodelningar även för gamla klienter. Separat chattvideo behålls. Befintliga två profilassets/två pekare/en delning och två chattassets är oförändrade; ingen bytesradering. Se docs/N22.md.
- Verifierat: test:video-retirement (faktiska komponentcallbacks, simulerad transport), test:profile-video, test:profile-journey, matching, application-supplement och company-navigation passerar. TypeScript och webpack-bygge passerar (50 sidor). Riktad ESLint 0 fel/1 tidigare img-varning. Verkliga RLS-/triggertester passerar före/efter migration, alla fixture-skrivningar återställda. Befintliga säkerhets-WARN oförändrade; avsiktlig ny INFO för åtkomstindragen RLS-tabell utan policies dokumenterad.
- Återstår / blockerare: Inloggat visuellt dev-test, fysisk kamera och verklig filuppspelning återstår. Ingen automatiserad gallring eller fullständig dataradering påstås; avstängda profilfiler och rapportreferenser hanteras avgränsat enligt L12. N23/L12 byggs separat. Äldre migrationshistorik orörd; signerade gamla länkar kan leva till ursprunglig TTL (högst fem minuter enligt klienten).

<a id="n23"></a>
### N23 Frivillig videoförfrågan vid ansökan

- [ ] Klar
- Prioritet: P2
- Global ordning: 6.1
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Företaget kan lägga till en kort jobbspecifik videoförfrågan med instruktioner i annonsen. Video är alltid frivillig och får inte vara ett absolut ansökningskrav, inte heller via framtida premium. Ungdomen kan spela in/ladda upp och granska före uttryckligt skickande, välja Avstå eller helt lämna förfrågan obesvarad. Ansökan skickas till företaget enligt ordinarie CV-/behörighetsregler oavsett video. Intresse/swipe får inte stoppas av ett videoval, inspelning, kameraavslag, misslyckad uppladdning eller avbruten navigering. Erbjud komplettering efter skickad ansökan, med diskret ingång/notis i befintligt ansökningsflöde. Gör ingen väntande-videostatus till spärr för företagsvisning, matchning eller chatt.
- Klar när: Företagets instruktioner kan sparas, redigeras och ses av rätt sökande. Testa skicka med video, avstå, inget svar, kameran nekad, fel vid uppladdning och avbrott: ansökan skickas i samtliga fall när ordinarie ansökningskrav är uppfyllda, exakt en gång. Senare videokomplettering behåller samma ansökan utan dubbletter och blir tillgänglig endast för behörig mottagare. Ingen automatisk bortsortering, poängsänkning eller sämre ansökningsstatus för avstående/saknad video. Ingen AI-analys av video. Åtkomst, blockering, borttagning och eventuell chattreferens fungerar utan att återinföra permanent profilvideo.
- Samordning 2026-10-18 (F26/N19): Visa bara video och svar som ungdomen uttryckligen delat för aktuell ansökan, även i API/databas och fillänkar. Ungdomen kan förhandsvisa delningen. Saknad video får inte automatiskt neka eller dölja ansökan eller påverka personlighetspoäng; ingen AI-analys av video. Ingen generell företagsåtkomst till jobbprofilen.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: Produktkod och verifiering. Återanvänd privat videohantering; inför och verifiera beslutad 14-dagarsgallring från skickandet enligt L12 innan ansökningsvideo aktiveras. Ingen premiumkoppling eller debitering beställd. N23 ersätter den äldre idén om obligatoriska videokrav; den frivilliga funktionen är nu beställd, inte bara en pausad premiumidé.


## Lagring och gallring – beslutat 2026-10-18

<a id="l12"></a>
### L12 Inför beslutade lagringstider och automatisk gallring

- [ ] Klar
- Prioritet: P1, före skarp lansering; 14-dagarsgallring krävs före aktivering av ansökningsvideo.
- Global ordning: 22.1
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: Dokumentationsleverans `codex/l12-gdpr-retention-plan-20261018`. Implementationsbranch och ägare reserveras separat före kodarbete.
- Beslut: Användaren har godkänt nedanstående produktpolicy. Tiderna är inte lagstadgade GDPR-frister eller en färdig juridisk bedömning. Ändamål, rättslig grund och nödvändighet ska dokumenteras per uppgiftskategori före införandet.
- Beroenden/samordning: L02 (påminnelsemejl), L05 (åtkomst och rapporter), L06/N10 (kontoradering), L04 (anställningshistorik), F20 (integritetsinformation), F26/N19 (ansökningsunderlag), N12/N13/N22/N23 (video). Återanvänd befintlig raderingslogik och bevara andras pågående arbete.

| Uppgifter | Beslutad normalregel | Startpunkt och användarupplevelse |
|---|---|---|
| Skickad video i chatt eller ansökan | Radera efter 14 dagar | Från serverregistrerat skickande, oberoende av uppspelning. Visa exakt utgångsdatum för båda parter; därefter endast en neutral markering, exempelvis Videon har raderats. |
| Avslutad ansökan, dess CV-underlag och AI-bedömningar | Radera efter 6 månader | Från dokumenterat avslut av den enskilda ansökan. Tidigare ansökningar visar avslutsstatus och planerad radering. |
| Textchatt | Skrivskydda efter 6 månaders inaktivitet; radera efter 12 månader | Från definierad användaraktivitet i den aktuella konversationen. Arkivering och skrivskydd är inte radering. Exakt aktivitetsdefinition och hantering av återöppning fastställs före implementation. |
| Inaktivt ungdomskonto med jobbprofil och aktuellt CV | Radera efter 24 månaders inaktivitet | Från användarens egen definierade aktivitet. Påminn 30 och 7 dagar före; förklara vad som försvinner och hur kontot behålls. Automatiska mejl, AI-jobb och bakgrundsuppdateringar återställer inte tiden. |

#### Omfattning och skydd

- Ansökningsgallring avser den avslutade ansökans kopior, utdrag, kompletteringssvar, underlag, bedömningar och historiska bedömningsversioner samt företagets åtkomst till dessa. Ungdomens aktuella profil/CV och andra legitima ansökningar ska inte raderas för att en ansökan löper ut. Aktivt konto förlänger inte gamla ansökningars lagringstid.
- Definiera avslut för avslag, återkallande, avslutad rekrytering och anställning, samt regel för övergivna ansökningar som aldrig avslutas. Att pausa en annons är inte automatiskt att avsluta alla dess rekryteringar. Vid öppna frågor ska beslut dokumenteras; använd inte en status som gör att uppgifter kan sparas obegränsat.
- Video: radera faktiska lagringsobjekt, eventuella miniatyrbilder och obehövliga metadata/åtkomstreferenser. Utgången video får inte kunna hämtas genom API, gamla direktvägar eller nya signerade länkar. Dokumentera hur redan utfärdade länkar och cache hanteras vid tidsgränsen. Vid flera referenser får delning inte tyst förlänga filens första beslutade utgångstid. Fastställ separat kort städregel för oskickade/avbrutna uppladdningar.
- Förklara att arbetsgivaren kan hinna missa en video efter två veckor. Saknad, avböjd eller utgången video påverkar inte matchpoäng, ansökans synlighet eller möjligheten att skicka ansökan. Ingen AI-analys av video. Redan nedladdade externa kopior kan inte återkallas tekniskt; beskriv ansvarsfördelningen utan att utlova detta.
- Kontogallring ska omfatta autentiseringskonto, profil, CV/filer och relaterade personuppgifter i den omfattning de ska raderas. Samordna med andra deltagare i chatt och delade filer. En ny verklig aktivitet under påminnelseperioden ska stoppa felaktig inaktivitetsradering. Verifiera påminnelseleverans, återförsök och konflikter; inför ingen destruktiv gallring utifrån enbart antagen mejlleverans.
- Separata kategorier återstår: bekräftad anställningshistorik, fakturor/bokföring, konkreta rättsliga anspråk, rapporterat innehåll/moderationsärenden, säkerhetsloggar samt privata utkast/råa textsamtal/avvisade AI-förslag. Bestäm och dokumentera nödvändiga tider och rättsligt stöd för dessa innan skarp användning. Ingen generell permanent lagring eller automatisk förlängning av hela ansökan/chatten/video får motiveras med möjliga framtida tvister. Eventuellt undantag ska vara avgränsat, åtkomstbegränsat, dokumenterat och omprövas med bestämd tidpunkt.
- Inventera säkerhetskopior, cache och relevanta leverantörskopior. Dokumentera raderings-/rotationsfrister och rutin så att återställning inte återinför gallrade uppgifter. Lova inte fullständig radering i samtliga kopior på exakt samma dag utan verifierat stöd.
- Bygg schemalagd, idempotent och återförsökbar gallring med minimal revisionsinformation utan kvarvarande CV-/chattinnehåll. Om fysisk radering misslyckas ska åtkomst ändå spärras vid utgången tid; felet följs upp tills radering lyckas. Testkör först med tydligt fiktiva data i dev/DevStaging.

#### Klar när

- Beslutade tider, exakt aktivitets-/avslutsdefinition, övergivna ärenden och separata kategorier är dokumenterade med ändamål och rättslig grund. Integritetsinformation och UI överensstämmer med faktiskt beteende.
- Verifiera strax före, vid och efter varje tidsgräns; återförsök, avbruten filradering, samtidiga meddelanden/inloggningar, ändrad ansökningsstatus, delade referenser och åtkomst via gamla länkar. Gallringen får inte ta bort aktivt underlag för andra ansökningar.
- Verifiera 30-/7-dagarspåminnelser och avbruten kontogallring efter verklig aktivitet. Testa att bakgrundsjobb och mejlutskick inte räknas som användaraktivitet.
- Verifiera backup-/återställningsrutinen och dokumentera driftsatta scheman, bevakning, genomförda tester och kvarstående begränsningar. Markera inte Klar efter enbart skriven kod eller dokumentation.
- Implementerat: Ingen produktkod, inget schema och inga lagrade användaruppgifter ändras genom denna dokumentationsleverans.
- Verifierat: Dokumentationskontroll; funktionella gallrings- och mejltester återstår.
- Återstår / blockerare: Implementering, ändamåls-/rättslig-grund-bedömning, preciserade aktivitets-/avslutsregler, separata uppgiftskategoriers tider, leverantörs-/backupinventering och faktisk verifiering.
