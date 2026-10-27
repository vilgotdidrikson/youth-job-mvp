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

## Design inom varje leverans

Beslutat 2026-10-26: Följ auditens visuella målbild även när nya funktioner och knappar byggs. Återanvänd gemensamma komponenter/tokens och gör avgränsad designputs på det som berörs, enligt relevanta designkort. Den större designmigreringen följer befintlig ordning; inga nya vägledningskrav eller orelaterade ombyggnader införs. Se även AGENTS.md.

Precisering 2026-10-26: Den förenklade företagsdemon ska erbjuda färdiga annonser/rekryteringsdelar att öppna direkt och fri möjlighet att prova egna ändringar. Målbilden är fortsatt simplistisk: minska onödiga textelement, små etiketter, upprepad kontext och kontroller utan tydligt syfte. Detta preciserar designutförandet, inte befintliga produktregler eller övriga uppgifters status. Annonsbaserad kandidatvisning dokumenteras separat i [N25](#n25); produktbygget är pausat enligt användarens aktuella avgränsning.

## Gemensam prioriteringsordning

### Designreferens från företagsdemon – beställt 2026-10-26

- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch: `codex/design-demo-reference-20261026`.
- Omfattning: Dokumentera användarens önskade designriktning (stilren, clean och informativ) med företagsdemon som konkret referens. Endast dokumentation; befintlig prioritering, ägare och status för övriga punkter är oförändrade.
- Reserverat före ändringen: publicerad dokumentreservation `4b20447`; ingen frontendimplementation eller övertagning av D05, DA-04–DA-06 eller andra pågående punkter.
- Levererat: [Jämförelse och designriktning i auditplanen](DESIGN_AUDIT_2026-10-22_1.md#demo-design-direction), implementation av dokumenttillägget `35b2dd9`. Beskriver hierarki, neutrala arbetsytor med återhållna rosa accenter, typografi, luft, diskreta kanter/skuggor och hur detta samordnas med befintliga punkter. Företagsvyn är första referens inom DA-12 utan att ändra globala ordningen. Demons mindre text/tryckytor, kortare formulär och simulerade regler ska inte kopieras till produkten.
- Faktiskt kontrollerat: aktuell audit/åtgärdsplan och relevanta frontendfiler; driftsatt dev-startsida och /features visuellt; demo och dess tidigare webbtest i denna session. Dokumentkontroll bekräftar att allt ursprungligt auditinnehåll är oförändrat och att interna uppgiftslänkar/ankare är giltiga.
- Användarens precisering 2026-10-26: Det är demons visuella design som är referensen: layout, typografi, luft, gruppering, ytor och återhållna rosa accenter. Informativ betyder väl presenterad befintlig information. Tillägget inför inget krav på mer vägledning, förklaringspaneler eller guidade steg. Tidigare planerade hjälptexter, validering och tomvyer behåller sin ursprungliga omfattning.
- Förtydligande 2026-10-26: Designreferensen vägleder utförandet av befintliga uppgifter och ersätter ingen tidigare plan. Se [avstämningen mot befintliga mål](DESIGN_AUDIT_2026-10-22_1.md#demo-design-direction). Denna fil styr fortsatt global ordning, beroenden, ansvar, status och produktbeslut; auditens tekniska kriterier och tillgänglighetskrav gäller fortsatt. Inga nya lanseringskrav eller återöppnade klara funktionskort införs.
- Avstämt: DA-04–DA-06 (befintliga tokens/skalor/kontrast), DA-12 (företagsvyn först, en vy per leverans), D05/DA-15 (marknadsstruktur), D07/D08/F20 (text, tomvyer och hjälp), F04/F05/F26/N19 (navigation och underlag), N16/N23/N24/L04 (produktregler) samt DA-16/F23/L08 (mobil och tillgänglighet). Befintliga mål, ordningsnummer, ägare och status är bevarade.
- Begränsning: /company krävde inloggning; jämförelsen av inloggade produktvyer bygger på kod. Ingen ny inloggad visuell acceptans, inget produktbygge eller funktionstest påstås. Dokumentet är ett designunderlag, inte genomförd frontendmigrering.

- Infört i dev: [PR #114](https://github.com/vilgotdidrikson/youth-job-mvp/pull/114), merge `f041f38`. Visuell precisering och löpande designprincip införda; ingen frontendändring i den PR:n.

### Reviderad produktinriktning – beställt 2026-10-18

- Beslutat dokumenttillägg: Ersätt Mer om kandidaten med jobbspecifikt ansökningsunderlag enligt F26/N19 och docs/PROFIL_OCH_RELEVANS.md. Visa granskat CV, relevanta direkt läsbara praktiska fakta, källgrundade kriterier/belägg och uttryckligen delade ansökningssvar/frivillig video. Ingen generell företagsåtkomst till jobbprofilen, inte heller via API/databas. Ungdomen får förhandsvisa delningen och matchningens uppgiftsunderlag. Exakt bostadsadress utesluts från strukturerat underlag; arbetsplatsens adresser i annons/karta bevaras. Kontaktuppgifter i original-CV måste uppmärksammas. Beslutet är inte implementerat eller säkerhetsverifierat genom denna dokumentuppdatering (`codex/f26-n19-application-plan-20261018`).

- Beslut och acceptanskriterier: `docs/PROFIL_OCH_RELEVANS.md`. Framtidsidéer finns i det befintliga dokumentet MatchnWork-Idebank.md; de aktiveras inte genom denna plan.
- N16 ersätter det gamla kravet på antal tjänster och automatiskt lyft. N17 → N18 ger gemensamma jobbtyper före relevans; F26 granskar kärnmatchningen; N19 → N20/N21 ger gemensam profilgrund före nya AI-ingångar. Delordning 13.1–13.6 läggs före återstående ordinarie lista enligt beställningen; övriga uppgifters status ändras inte.
- Reserverat före kodarbete 2026-10-20: F26/N19 avgränsad synlighetsändring, Codex, `codex/f26-public-job-information-20261020`, [PR #84](https://github.com/vilgotdidrikson/youth-job-mvp/pull/84). Ungdomsvyn visar enbart publicerat annonsinnehåll; interna kriterier/rollsammanfattningar/vikter förblir företags-/serverunderlag. Företaget får tydliga fasta avsnitt, inga synlighetsval per fält. Godkända egna källuppgifter och delningsförhandsvisning bevaras. Profil-/CV-utökning och nya AI-datafält inväntar separat GDPR-avstämning.

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
| 8 | [N15](#n15) | P1 | Kopiera befintliga annonser till nya utkast | För granskning | Vilgot / Codex |
| 9 | [F04](#f04) | P1 | Rätta företagets första navigation | Klar | Vilgot / Codex (kod), Max / Claude (verifiering) |
| 10 | [F05](#f05) | P1 | Gör matchningsanalysen begriplig och användbar | Klar | Vilgot / Codex |
| 11 | [F06](#f06) | P1 | Förklara pris och anställningsavgift | Blockerad | Vilgot / Codex |
| 12 | [L04](#l04) | P1 | Färdigställ och verifiera anställningsbekräftelsen | För granskning | Vilgot / Codex |
| 13 | [N16](#n16) | P1 | Slopa obligatoriskt platsantal och behåll manuell annonsstatus | För granskning | Vilgot / Codex |
| 13.1 | [N17](#n17) | P1 | Gemensamma jobbtyper med fria annonstitlar | För granskning | Codex |
| 13.2 | [N18](#n18) | P2 | Relevant och varierat jobbflöde | För granskning | Codex |
| 13.3 | [F26](#f26) | P1 | Granska matchningens rättvisa och faktaunderlag | Pågår | Codex |
| 13.4 | [N19](#n19) | P2 | Samlad jobbprofil och ett kort grund-CV | Pågår | Codex |
| 13.5 | [N20](#n20) | P2 | Bygg hela jobbprofilen med chatt eller formulär | Ej påbörjad | — |
| 13.6 | [N21](#n21) | P2 | Valfri genomläsning av uppladdat CV | Ej påbörjad | — |
| 14 | [L02](#l02) | P1 | SMTP och tillförlitliga e-postutskick | Ej påbörjad | — |
| 15 | [L03](#l03) | P1 | Automatiserad fakturering vid bekräftad anställning | Ej påbörjad | — |
| 16 | [F08](#f08) | P2 | Tydliggör verifieringsunderlag och handläggning | Klar | Max / Claude |
| 17 | [F09](#f09) | P2 | Anpassa publicering till verifieringsstatus | För granskning | Codex |
| 18 | [F07](#f07) | P1 | Bevara bilden i sparade annonsutkast | För granskning | Codex |
| 19 | [N01](#n01) | P1 | Redigera hela publicerade annonsen | Klar | Max / Claude |
| 20 | [N02](#n02) | P1 | Återkalla ansökan och väntande intresse | För granskning | Vilgot / Codex |
| 21 | [L05](#l05) | P1 | Säkerhet, blockering, rapportering och administration | Klar | Vilgot / Codex |
| 22 | [L06](#l06) | P1 | Verifiera kontots grundläggande fel- och återställningsvägar | För granskning | Vilgot / Codex |
| 22.1 | [L12](#l12) | P1 | Inför beslutade lagringstider och automatisk gallring | För granskning | Codex – videodel |
| 22.2 | [L13](#l13) | P1 | Automatisk personuppgiftsexport och användarrättigheter | Ej påbörjad | — |
| 22.3 | [L14](#l14) | P1 | Verifiera leverantörsavtal och produktionskonton | Ej påbörjad | — |
| 23 | [F13](#f13) | P2 | Rätta status för väntande ansökningar | Klar | Max / Claude |
| 24 | [F14](#f14) | P2 | Gör notiser och lässtatus användbara | Klar | Max / Claude |
| 25 | [D02](#d02) | P2 | Håll chattens skrivfält inom vyn | För granskning | Vilgot / Codex |
| 26 | [N13](#n13) | P2 | Spela in presentationsvideo direkt | För granskning | Vilgot / Codex |
| 27 | [F10](#f10) | P2 | Återanvänd redan sparade uppgifter | För granskning | Max / Claude (företagsdelen) |
| 28 | [N08](#n08) | P2 | Erbjud CV utan obligatorisk AI | För granskning | Vilgot / Codex |
| 29 | [F12](#f12) | P2 | Förbättra kompletteringsfrågornas innehåll | Ej påbörjad | — |
| 29.1 | [N24](#n24) | P2 | Företagets egna kompletteringsfrågor före matchning | För granskning | Vilgot / Codex |
| 30 | [F11](#f11) | P2 | Visa vad AI överför till annonsfälten | Klar | Max / Claude |
| 31 | [F22](#f22) | P2 | Validera inmatning nära fälten | För granskning | Max / Claude (annonsbyggaren) |
| 32 | [N03](#n03) | P2 | Visa annonsutkast i översikten | För granskning | Codex |
| 32.1 | [N25](#n25) | P2 | Välj annons före kandidatgranskning | För granskning | Vilgot / Codex |
| 33 | [F20](#f20) | P2 | Gör integritet villkor och hjälp lätta att nå | Ej påbörjad | — |
| 34 | [F23](#f23) | P2 | Ge val och dialoger korrekt tillgänglighet | För granskning | Max / Claude |
| 35 | [F15](#f15) | P2 | Förenkla ungdomens första steg | För granskning | Vilgot / Codex |
| 36 | [F16](#f16) | P2 | Ge ett stabilt nästa steg efter färdigt CV | För granskning | Vilgot / Codex |
| 37 | [N04](#n04) | P2 | Öppna en läsbar företagsprofil från annonsen | Klar | Max / Claude |
| 38 | [N05](#n05) | P2 | Lägg till strukturerade praktiska jobbuppgifter | Klar | Max / Claude |
| 39 | [F17](#f17) | P2 | Samla anställningsflödet i en tydlig ingång | Ej påbörjad | — |
| 40 | [N07](#n07) | P2 | Ångra det senaste bortvalet i swipe | För granskning | Vilgot / Codex |
| 41 | [N06](#n06) | P2 | Utöka jobbsökningen med relevanta val | För granskning | Vilgot / Codex |
| 42 | [F18](#f18) | P2 | Förbättra sparande i profilredigeringen | För granskning | Vilgot / Codex |
| 43 | [F24](#f24) | P2 | Gör kartans reservvy användbar | För granskning | Vilgot / Codex |
| 44 | [N09](#n09) | P2 | Spara CV utkast på kontot | Ej påbörjad | — |
| 45 | [L09](#l09) | P2 | Verifiera CV-uppladdning och PDF-layout | Pågår | Vilgot / Codex |
| 46 | [L08](#l08) | P1 | Verifiera mobil, tangentbord och kartinteraktion | Ej påbörjad | — |
| 47 | [L07](#l07) | P1 | Verifiera hela rekryteringskedjan i driftsatt dev | Ej påbörjad | — |
| 48 | [D01](#d01) | P2 | Rätta knapparna i profilintroduktionen | Ej påbörjad | — |
| 49 | [D05](#d05) | P2 | Förklara produkten direkt på startsidan | Pågår | Max / Claude |
| 50 | [D09](#d09) | P3 | Placera feedback vid rätt åtgärd | Ej påbörjad | — |
| 51 | [F25](#f25) | P3 | Slå samman likvärdiga förmåner | Ej påbörjad | — |
| 52 | [D03](#d03) | P3 | Ge kriteriernas textfält mer plats | Ej påbörjad | — |
| 53 | [D06](#d06) | P3 | Gör status och profilprogress begripliga | Ej påbörjad | — |
| 54 | [D04](#d04) | P3 | Öka padding på kartans kortknapp | Ej påbörjad | — |
| 55 | [D07](#d07) | P3 | Rätta mikrocopy och varumärkestext | Pågår | Vilgot / Codex – logotillägg |
| 56 | [F21](#f21) | P3 | Förtydliga konto och företagsuppgifter | Ej påbörjad | — |
| 57 | [F19](#f19) | P3 | Gör filterdialogens beteende tydligt | Ej påbörjad | — |
| 58 | [D08](#d08) | P3 | Gör tomvyer och sidbredder konsekventa | Ej påbörjad | — |
| 59 | [N10](#n10) | P3 | Ge grundläggande kontoval | Ej påbörjad | — |
| 60 | [L10](#l10) | P1 | Lanseringsmiljö, domän och drift | Ej påbörjad | — |
| 61 | [DA-01](#da-01) | P1 | Landningssidans illustrationer är tomma under 1024px | Klar | Max / Claude |
| 62 | [DA-02](#da-02) | P1 | Favicon, appikoner, delningsbild och sidtitlar | Klar | Max / Claude |
| 63 | [DA-04](#da-04) | P2 | Samla färgtokens och ta bort hårdkodade och drivande färger | Pågår | Max / Claude |
| 64 | [DA-05](#da-05) | P2 | Inför skala för typografi, vikter, radier och skuggor | För granskning | Max / Claude |
| 65 | [DA-06](#da-06) | P2 | Rätta textfärger som inte klarar WCAG AA | Klar | Max / Claude |
| 66 | [DA-11](#da-11) | P2 | Serverrendera marknadssidorna och ladda Mapbox-CSS bara med karta | För granskning | Max / Claude |
| 67 | [DA-12](#da-12) | P2 | Flytta äldre inline-stilar till CSS-moduler och ta bort överskrivningar | Ej påbörjad | — |
| 68 | [DA-13](#da-13) | P3 | Gör prissidans huvudknapp till primär knapp | Klar | William / Claude |
| 69 | [DA-14](#da-14) | P3 | Rätta autentiseringssidornas kort, pil och textsymboler | Klar | William / Claude |
| 70 | [DA-15](#da-15) | P3 | Korta och variera funktionssidan | Ej påbörjad | — |
| 71 | [DA-16](#da-16) | P3 | Större text och tryckytor på mobil | Ej påbörjad | — |
| 72 | [DA-18](#da-18) | Beslut | Ska utloggade besökare kunna se publicerade jobb? | Ej påbörjad | — |

Reserverat 2026-10-20: F07/N03 tillsammans för bild/text i lokala kontobundna annonsutkast och synlig återupptagning. Inga nya ungdomsuppgifter, AI-anrop, serverlagring eller publicering av utkast införs. Avsteg från mellanliggande punkter: profil/AI/data- och leverantörsbeslut inväntar separat GDPR-arbete; utkastets översikt är direkt beroende av F07.

Reserverat 2026-10-22: Profilbygget leverans 1 enligt `docs/profilbygget/SPEC.md` – gemensamma komponenter, StepHeader/StepRail och steg 2 (Vad jag söker) i ny design. Max / Claude, `claude/profilbygget-steg2-20261022`. Status: För granskning (ingen PR öppnad). Ändrar `components/recruitment-profile-editor.tsx` (section preferences), nya `components/profile-steps/` och `lib/profile-steps.ts`; `lib/recruitment-profile.ts`, `lib/job-categories.ts`, RPC och databas ändras inte. Samordning: profilflödet ägs av F15/F16/F18 (Vilgot / Codex); avstämning med Vilgot har inte gjorts av Claude och behöver ske innan merge.
  - Implementerat: `components/profile-steps/` med FormCard, ChipGroup (flerval `aria-pressed`, enval `role="radio"` med piltangenter), TagInput, SegmentedControl, NumberStepper, ChoiceTile, StickyActions, StepHeader, StepRail och sidlayouten, i en CSS-modul med SPEC:ens tokens. Steg 2 i resan: 15 jobbchips (korta etiketter, sparar kategorins fulla label i `roles`), egna formuleringar som egna chips, ”+ Eget jobb”, max 8; orter som taggar (max 8); resväg 15/30/45/60+ (60+ = ”60”) med ”Annat” för andra sparade värden; ”Vill lära mig” med förslagschips. Text som skrivits men inte lagts till i ort-/jobbfältet sparas också. ”Hoppa över”/”Avbryt” varnar vid osparade ändringar. Logik och konstanter i nya `lib/profile-steps.ts`. Ikonerna chevron-left, plus och lås tillagda. Ungdomens nederkantsmeny döljs på mobil i steg 2 i resan (stegets egen knapprad). Steg 2 i inbäddat läge och fristående sida använder samma nya fält. Spara-RPC, versionskontroll, felmeddelanden, `onDirtyChange`/`onBusyChange`, `ProfileStepComplete` och `lib/recruitment-profile.ts`/`lib/job-categories.ts` oförändrade.
  - Verifierat: Full `npm run lint` utan problem i ändrade filer (25 befintliga problem i andra filer), TypeScript, produktionsbygge, `test:profile-journey` och nya `test:profile-steps` (mot oförändrad validering och kategorilogik) samt övriga relevanta offline-tester. Chromium mot lokalt produktionsbygge kopplat till DevStaging med tillfälligt fiktivt QA-konto (raderat efteråt), 40/40: 375 px (rubrik, steg 2 av 5, paus- och tillbakalänk, ingen horisontell scroll, sparade data visas rätt inklusive eget jobb och resväg 10 som ”Annat”, chips med mus och tangentbord, spärr vid 8, taggar med Enter/komma/×, förslag, fast primärknapp 52 px, varning vid Hoppa över, sparning till ProfileStepComplete med kontrollerade värden i databasen) och 1280 px (stegmeny med aktuellt steg, ”Visa alla 15”, etiketter, h1 36 px/600, formulär ≤640 px) samt inbäddat läge på /profile med sparning.
  - Tillägg på användarens begäran: Stegmenyn (StepHeader på mobil, StepRail på desktop) används nu i alla steg 2–5 i resan och på mellanskärmen efter sparning, inte bara i steg 2. Även CV-steget (`/youth/cv?return=build`) har stegmenyn via `JourneyStepFrame`; CV-hubbens gamla rubriker är borttagna. Utanför resan (och med jobbkoppling) visas CV-sidan som tidigare. Steg 3–5 har fortfarande sina gamla formulär inuti. Kontrollerat med TypeScript, lint, produktionsbygge, `test:profile-journey` och `test:profile-steps`; inte webbtestat.
  - Rättat: ”Ja, fortsätt” på mellanskärmen bytte bara adress till nästa avsnitt på samma sida medan vyn låg kvar; redigeraren följer nu `section` i adressen. Webbtestat: sparat steg 2 → ”Ja, fortsätt” → steg 3 visas (Chromium, lokalt produktionsbygge, fiktivt QA-konto).
  - Ändrat på användarens begäran: I CV-stegets startval i resan visas ingen tillbakalänk och ingen tillbakapil i stegraden (steg 1 har inget tidigare steg); ”← Tillbaka” visas först efter ”Skapa med guidat formulär”. Utanför resan finns startsidans tillbakalänk kvar. Webbtestat vid 375 och 1280 px med fiktivt QA-konto, 11/11.
  - Rättat på användarens begäran 2026-10-23: CV-steget i resan (`/youth/cv?return=build`) saknade huvudnavigationen (Upptäck, Ansökningar …) även på desktop, eftersom hela `/youth/cv` var undantagen i `components/mobile-nav.tsx`. Nu visas den på desktop som i steg 2–5 och designen, och döljs på mobil som i steg 2. CV-sidan utanför resan eller med jobbkoppling är oförändrad (ingen navigation). Kontrollerat med TypeScript, riktad ESLint, produktionsbygge och `test:profile-journey`. Webbtestat i Chromium mot lokalt produktionsbygge kopplat till DevStaging med tillfälligt fiktivt QA-konto (raderat efteråt), 10/10: 1280 px (navigation med Upptäck/Ansökningar, stegmeny kvar, ingen överlappning, ingen horisontell scroll), 375 px (navigation dold, ingen horisontell scroll) samt oförändrat beteende för CV utanför resan och steg 2. Inte kontrollerat i driftsatt dev.
  - Fynd utanför leveransen: Versionskonflikt fungerar inte i DevStaging. En sparning med inaktuell version svarar efter 125 s med HTTP 504 ”upstream request timeout” i stället för 40001, så användaren ser ”Sparar…” i två minuter och sedan det generella felet. Gäller alla profilsteg och kräver databasändring (felkoden 40001 i `save_my_recruitment_profile`, sannolikt omförsök i API-lagret); inte ändrat här.
  - Återstår: Avstämning med Vilgot, PR och införande i dev, kontroll i driftsatt dev. Infoytan ”Redan i ditt CV” och grön bock för CV är inte webbtestade (QA-kontot saknade CV). Öppna beslut i SPEC: korta eller fulla jobbetiketter, förval för resväg, förslag för ”Vill lära mig”, och om ”Hoppa över” ska gå till nästa steg (nu som tidigare till profilbygget).

Reserverat 2026-10-25 (uttrycklig beställning): Profilbygget leverans 3 och 4 enligt `docs/profilbygget/SPEC.md` – steg 4 (Kunskaper) och steg 5 (Egna exempel) i ny design. Steg 3 (leverans 2) hoppas över på användarens begäran. Max / Claude, branch `Max`. Status: För granskning (inte committat, ingen PR). Ändrar `components/recruitment-profile-editor.tsx` (section qualifications och examples), nya stegkomponenter i `components/profile-steps/` och konstanter i `lib/profile-steps.ts`; `lib/recruitment-profile.ts`, RPC och databas ändras inte. Samordning: profilflödet ägs av F15/F16/F18 (Vilgot / Codex); avstämning behövs före merge, som för leverans 1.
  - Implementerat: Steg 4 (`components/profile-steps/qualifications-step.tsx`): rubrik ”Vad kan du?”, körkort/behörigheter och verktyg som TagInput med förslag och räknare (max 8 respektive 12, bredvid varandra på desktop), CV-språk skrivskyddat i rosa yta med ”Ändra i CV:t”, extra språk med nivå som enval-chips (tidigare fritextnivå behålls som eget chip), ”+ Ett språk till” inom max 8. Steg 5 (`examples-step.tsx`): tips med glödlampa (i stegmenyn på desktop i resan), sparade exempel som kompakt rad med ”Ändra”, nytt exempel i kort med brand-kant, styrka som enval-chips med ”+ Eget” (max 30 tecken), situation och egen insats med hjälptext, ”+ Ett exempel till (X av 5)”, primärknapp ”Spara och bli klar”. Text kvar i taggfälten sparas, tomma exempelkort och tomma språkrader sparas inte, påbörjat exempel utan styrka ger ”Välj vad exemplet visar.”. Konstanter och hjälpfunktioner i `lib/profile-steps.ts`, ikonen `bulb` i `ui-icon.tsx`, valfritt `tip` i `ProfileStepPage`. Nederkantsmenyn döljs nu på mobil även i steg 4 och 5 i resan (den täckte stegets fasta knapprad). Rättat i delade komponenter: förslagschips i TagInput saknade chip-stil, och formuläret sträcktes ut vertikalt när stegmenyn var högre än innehållet.
  - Verifierat: TypeScript, produktionsbygge, `test:profile-steps` (utökat med steg 4/5 och sparkontraktet), `test:profile-journey` och `test:accessibility`. Riktad ESLint utan nya problem (ett befintligt fel om setState i effekt på rad 87 i redigeraren finns redan i dev). Playwright/Chromium mot lokal dev-server kopplad till DevStaging med tillfälligt fiktivt QA-konto med CV-språk (raderat efteråt), 31/31: 375 px (rubrik, CV-språk, ingen horisontell scroll, förslag och Enter blir taggar, räknare, nivå med piltangent, fast primärknapp 52 px, varning vid Hoppa över, sparning till mellanskärmen med kontrollerade värden i databasen inklusive text kvar i verktygsfältet; tips och tomt kort, felmeddelande för påbörjat exempel, eget val, räknare, borttaget kort, sparat exempel i databasen), 1280 px (taggkort bredvid varandra, förslag med chip-ram, sparade värden, stegmeny, ingen horisontell scroll, sparat exempel som rad, tips bara i stegmenyn, Ändra öppnar kortet) och utanför resan (rubrik som h2, Avbryt/”Spara den här delen”, tips i formuläret, sparning). Inga konsolfel.
  - Återstår: Commit, PR och införande i dev, kontroll i driftsatt dev. Inbäddat läge på `/profile` är inte klickat igenom (samma formulärväg som fristående sidan, som är testad). Versionskonflikt inte testad (känt DevStaging-fel, se leverans 1). Öppet beslut i SPEC: vilka förslag som ska finnas för behörigheter och verktyg (nu designfilernas exempel).

Reserverat 2026-10-22: DA-01 enligt `docs/DESIGN_AUDIT_2026-10-22_1.md` (landningssidans plattformsillustrationer är tomma under 1024px), Max / Claude, `claude/da01-platform-visuals-20261022`, [PR #95](https://github.com/vilgotdidrikson/youth-job-mvp/pull/95), mergad till dev `50d6a49`. Status: Klar. Övriga DA-punkter är förslag och inte reserverade om inget annat anges nedan.
  - Reproducerat: I webbläsare vid 375 och 800px var alla sex gradient-id dubblerade och samtliga fem synliga mobilillustrationer pekade på gradienter i den dolda desktopkolumnen; illustrationerna visades som tomma mörka rutor.
  - Implementerat: `components/ui/platform-visuals.tsx` ger varje SVG-instans egna gradient-id via `useId()`. `platform-showcase.tsx`, text, logik och databas oförändrade. Nytt `test:platform-visuals` renderar alla fem illustrationer två gånger i samma dokument och kräver unika, URL-säkra id som bara refereras inom egen kopia.
  - Verifierat: Testet passerar och fallerar på gamla koden. TypeScript, ESLint och produktionsbygge med webpack passerar. Chromium mot lokal dev-server vid 375, 800 och 1280px: inga dubblerade id, alla referenser lösta, inga synliga illustrationer med dold gradient, inga konsolfel; skärmbilder visar rosa gradienter i alla fem mobilillustrationer och oförändrad desktopvy.
  - Verifierat i driftsatt dev 2026-10-22: Samma Chromium-kontroll mot https://youth-job-mvp-dev.vercel.app vid 375, 800 och 1280px – inga dubblerade id, alla referenser lösta, inga synliga illustrationer med dold gradient; skärmbild vid 375px visar rosa gradient.
  - Begränsning: Ej provat i Safari/Firefox eller på fysisk mobil.

Reserverat 2026-10-22 (uttrycklig beställning, utanför global ordning): CV-hubbens erfarenhetssteg – ”Jag har ingen erfarenhet ännu” ska inte vara förvald, och det ska framgå att inget behöver skrivas när rutan är ikryssad. Max / Claude, branch `Max`. Status: För granskning. Endast `components/youth-cv-hub.tsx` och tillhörande CSS; ingen databasändring.
  - Reproducerat (kod): rutan härleddes som ikryssad när ingen erfarenhet fanns sparad, alltså alltid för nya ungdomar och för sparade CV utan erfarenhet.
  - Implementerat: Rutan kryssas bara i av personen själv. Den ligger nu före textfältet; ikryssad döljs instruktion och textfält och en notis visar ”Du behöver inte skriva något här.” Har personen redan skrivit något står det att texten inte sparas så länge rutan är ikryssad; texten finns kvar om rutan avmarkeras. Sparad data och spara-logik oförändrade. Exempeltexten ”Skriv när, var, vad och hur länge …” borttagen på användarens begäran; textfältets platshållare finns kvar. Kontrollerat i Chromium mot lokal dev-server att exempeltexten inte visas och att övriga kontroller fortsatt passerar.
  - Verifierat: TypeScript, riktad ESLint och produktionsbygge passerar; `test:profile-journey`, `test:accessibility`, `test:video-retirement`, `test:recruitment` och CV-faktagranskningen passerar. Chromium (390px) mot lokalt produktionsbygge kopplat till DevStaging med tillfälligt fiktivt QA-konto (raderat efteråt), utan att spara CV: ny ungdom får ej ikryssad ruta och synligt textfält; ikryssad döljer textfält/instruktion och visar formaterad notis; varning om skriven text; text kvar efter avmarkering – 9/9.
  - Begränsning: Ett CV-utkast som redan sparats lokalt i webbläsaren före ändringen kan fortfarande öppnas med rutan ikryssad. Ett sparat CV utan erfarenhet visar nu ”Inte ifyllt ännu” i sammanfattningen tills rutan kryssas i igen. Ej kontrollerat i driftsatt dev eller på fysisk mobil.

Reserverat 2026-10-22: DA-02 enligt `docs/DESIGN_AUDIT_2026-10-22_1.md` (standardfavicon, appikoner, manifest, delningsbild och sidtitlar), Max / Claude, branch `Max`. Status: För granskning. Sidtitlar för klientrenderade sidor sätts via segmentlayouter i stället för att vänta på DA-11. Ingen text på sidorna, logik eller databas ändras.
  - Implementerat: M-märket i landningslogotypens form på `--color-brand` som `app/icon.svg`, `app/favicon.ico` (16/32/48), `app/apple-icon.png` (180) och manifestikoner i `public/icons/` (192, 512, maskable 512), alla genererade av `scripts/generate-brand-icons.mjs`. `app/manifest.ts` med namn, `theme_color` `#b84164` och `background_color` `#fffafb`; `viewport.themeColor` `#fffafb`. `app/opengraph-image.tsx` (1200×630) med befintlig text (”Ditt första jobb börjar här.” och sidfotens tagline). Titelmall `%s · MatchnWork` och egna titlar för Funktioner, Priser, Logga in, Skapa konto, Återställ lösenord, Välj nytt lösenord och Integritet och AI. Fem oanvända startfiler i `public/` borttagna.
  - Verifierat: TypeScript, riktad ESLint och produktionsbygge med webpack passerar. Chromium mot lokal dev-server: alla åtta publika sidor har rätt titel; ikon-, apple-touch-icon- och manifestlänkar, theme-color, og:/twitter:-taggar med 1200×630-bild och rätt innehållstyp för alla ikoner, manifest och delningsbild; `/file.svg` ger 404. Ikonerna och delningsbilden granskade visuellt.
  - Återstår / begränsning: Kontroll i driftsatt dev efter merge, inklusive att `og:image` pekar på en publikt nåbar adress (lokalt byggvarning för `metadataBase`; Vercel använder distributionens adress om `NEXT_PUBLIC_SITE_URL` saknas). Länkförhandsvisning i en riktig delningstjänst och ”Lägg till på hemskärmen” på fysisk mobil ej provade. Delningsbilden använder next/og:s inbyggda typsnitt (en vikt), inte Inter.

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
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n15-copy-job-20261015`, [PR #61](https://github.com/vilgotdidrikson/youth-job-mvp/pull/61), mergad till dev `26a71a1394eeb5895671a1f718817778e5687390`. Statusavstämning 2026-10-20: `codex/n15-status-review-20261020`.
- Åtgärd: Lägg Kopiera annons i företagets annonsöversikt. Kopiera titel, text, bild, praktiska uppgifter, arbetsplatser och matchkriterier till ett nytt redigerbart utkast som öppnas i befintliga annonsbyggaren. Originalet ändras inte. Ansökningar, matchningar, chattar, anställningar, publiceringsstatus och gammal statistik ska inte följa med. Markera datum och tidsberoende uppgifter för ny granskning. Ny publicering följer vanlig verifiering och eventuella faktiska kontogränser.
- Klar när: Företaget kan kopiera en egen aktiv, pausad eller stängd annons, granska/redigera och publicera kopian som en separat rekrytering utan att ändra originalet eller dess kandidater.
- Implementerat: Kopiera annons från egen aktiv, pausad eller stängd annons till ett nytt redigerbart utkast. Text, bildreferenser, exakt lönetext, arbetsplatser med nya ID och matchkriterier följer med. Kandidater, chattar, statistik och originalets status följer inte med. Befintligt utkast skyddas med bekräftelse; tidsberoende villkor kräver ny granskning. Se docs/N15.md.
- Verifierat: PR #61 är mergad och funktionen finns i aktuell dev. Förnyat 2026-10-20: `test:job-copy` och `test:job-workplaces` passerar, inklusive främmande ägare och kontobyte, gransknings-/bildspärr, originalets oföränderlighet och nya arbetsplats-ID. Tidigare leverans har dokumenterat godkänt TypeScript och produktionsbygge; de kördes inte om i denna dokumentationsavstämning.
- Återstår / blockerare: Inloggat driftsatt webbtest av kopiering, återläsning och separat publicering samt fysisk mobilkontroll återstår. Ingen sådan kontroll påstås utförd. Tidigare status Ej påbörjad var inaktuell; ingen ny produktkod behövdes vid denna avstämning.

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

- [x] Klar
- Prioritet: P1
- Global ordning: 19
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: `claude/n01-edit-published-job-20261020`; reserverad före kodarbete 2026-10-20. Återanvänder annonsbyggaren och befintliga separata redigerare (jobbtyp, arbetsplatser, matchkriterier). Ingen databasändring.
- Åtgärd: Ge en tydlig Redigera annons-ingång för titel, publik text, bild, lön och praktiska uppgifter. Återanvänd annonsbyggaren. Håll den publika informationen och matchkriterierna samordnade och förklara konsekvenser för befintliga ansökningar.
- Klar när: Företaget kan korrigera annonsen utan att radera och skapa om den.
- Implementerat: Redigera annons på varje annonskort öppnar en adressstyrd redigeringsvy (`view=redigera&edit=<id>`). Den använder annonsbyggaren i alla tre delar, med fri navigering, förhandsvisning och sparning från valfri del. Redigeringen hålls i minnet, åtskild från det lokala annonsutkastet, och varnar för osparade ändringar. Endast ändrade publika fält sparas via befintliga updateJob (ägarkontroll, ingen ny geokodning av oförändrad plats, varken status- eller publiceringsfält). Matchkriterier sparas bara vid faktisk ändring, med versionskontroll. Arbetsplats-ID behålls. Om bara annonsen sparas visas det tydligt och nästa försök skickar endast det som återstår. Konsekvenser för synlighet, ansökningar, chattar, omgjord matchningsanalys, nya frågor och valda arbetsplatser visas i formuläret. Mappningen delas med N15:s kopiering, som behåller nya ID. Ingen migration. Se docs/N01.md.
- Verifierat: test:job-edit (ändringsdiff, publik/intern separation, kriterieändring, nytt försök efter delvis sparning, texter, verklig updateJob-väg mot simulerad databas, nekat fel företag eller kontobyte samt isolerad koppling) och regressionerna test:job-copy, test:job-drafts, test:job-publication, test:job-workplaces, test:job-categories, test:company-navigation, test:company-verification, test:recruitment och test:recruitment-review passerar. TypeScript och produktionsbygge passerar. Riktad ESLint: 0 fel, befintliga img-varningar. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, 21/21: Redigera annons öppnar `view=redigera&edit=<id>` med vilken annons som redigeras och konsekvenser; byggaren är förifylld; ändrad titel (dator och mobil) och tillagd arbetstid sparas; status, publicering, beskrivning, ort och arbetsplats-ID är oförändrade; ungdomen ser ändringarna på annonssidan; inga sidfel. Iakttagelser: på mobil har stegknapparna bara 1/2/3 som tillgängligt namn, och konsekvensrutan fyller hela första skärmen.
- Återstår / blockerare: Annonsfälten saknar versionskontroll (den senaste sparningen vinner); ersatta bilder tas inte bort från lagringen.

<a id="n02"></a>
### N02 Återkalla ansökan och väntande intresse

- [ ] Klar
- Prioritet: P1
- Global ordning: 20
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n02-withdraw-application-20261025`; [PR #102](https://github.com/vilgotdidrikson/youth-job-mvp/pull/102), implementation `d295dd27`. Reserverad före kodarbete 2026-10-25. Återkallelse av väntande intresse och skickad ansökan; GDPR-/AI-utbyggnad och gallring ingår inte.
- Åtgärd: Ge ungdomar möjlighet att ta bort väntande intresse innan automatisk sändning och återkalla en skickad ansökan med tydlig status. Visa vad som händer med en eventuell match eller chatt.
- Klar när: Användaren kan ändra sig och får ingen oavsiktligt skickad ansökan.
- Implementerat: Bekräftad återkallelse av privat intresse eller skickad ansökan i Ansökningar, tydlig Återkallad-historik och korrekta räknare. Transaktionell ägarkontrollerad RPC samt databasguard för gamla utkast-/ansöknings-/matchskrivningar; återkallat skickas inte igen automatiskt. Aktivt intresse tas bort, företagets nya underlagsåtkomst upphör via befintliga regler, match avslutas och chatthistorik blir skrivskyddad. Företaget får återkallelsenotis endast för redan skickat. Registrerad anställning skyddas och hanteras via rättelseflödet. Migration 20261025123102 införd enbart i DevStaging. Se docs/N02.md.
- Verifierat: 38 transaktionella DevStaging-kontroller före/efter införande, med rollback av QA-data: roll/ägarskap, privat/skickat/pausat, gamla klienter och CV-sändning, statuskonflikt, idempotens, kandidatåtkomst, avslutad match, läsbar historik och nekad sändning i båda rollerna, analyskö och anställningsskydd. test:application-withdrawal (verklig UI-handler och API med simulerad transport) samt application-overview, application-disclosure, application-supplement, recruitment-review, notifications, job-discovery, matching, recruitment och profile-journey passerar. TypeScript, riktad ESLint och webpack-produktionsbygge passerar. Säkerhetsrådgivaren har oförändrade fynd.
- Återstår / blockerare: Inloggat visuellt dev-prov på dator/mobil, native dialog/fokus, flera öppna flikar och verkligt samtidiga transaktioner är inte slutverifierade. Ingen ny betald webbläsarkörning gjord. Ny aktiv ansökan efter återkallelse ingår inte; gammal begäran/CV-sparande får inte återaktivera. Redan hämtade underlag/fillänkar kan inte tas tillbaka. Ingen GDPR-/AI-utbyggnad, gallring eller produktionsändring.

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
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n08-manual-cv-20261027`, reservation före kodarbete från dev `d52f5d2`. Avgränsad manuell CV-väg med befintliga profilfakta, granskning och sparning. Tidigare obesvarade profil-/AI-beslut, e-post/pris/leverantörsberoenden samt slutverifiering bevaras; inga nya AI-dataflöden införs. Öppna PR:er kontrollerade.
- Åtgärd: Visa Skriv själv som ett tydligt val från början, med samma sparade fakta och redigering som AI-guiden. AI ska vara en valfri hjälp och PDF-uppladdning ett separat alternativ.
- Klar när: Ungdomen kan skapa och färdigställa CV utan att generera AI-text.
- Kodreferens: `abbaa9bdf4899acbac23e14dc7b790823115eb3a`, målbranch `dev`; källträdet matchar det verifierade lokala bygget.
- Implementerat 2026-10-27: Tydliga val Skriv själv, Ta hjälp av AI och Ladda upp ett CV. Manuellt och AI använder samma formulär/faktamodell/granskning/sparfunktion. Manuell förhandsvisning renderas lokalt utan CV-generation eller AI-synk. Texten ändras genom samma formulär-/faktaredigering så text och profilfakta hålls ihop. Metodval sparas i enhetens befintliga utkast; äldre utkast väljer inte AI automatiskt. Kontobyte monterar om arbetsytan. PDF och befintlig profil-/ansökningslogik bevaras; ingen AI-chatt enligt N20 byggs här. Se [N08.md](N08.md).
- Verifierat: `test:manual-cv` kör faktiska komponentcallbacks för metodval, metodbyte, återöppnat utkast, formulär → förhandsvisning → rättelse → godkännande → sparning, befintliga strukturerade fakta, kontonycklar och spärrad AI-synk; ingen nätverksbegäran för CV-generation/synk i den manuella vägen. Explicit AI-fel kan följas av manuell förhandsvisning med bevarade svar utan nytt AI-anrop. Spartransporten är simulerad. F02/F03-, profilflödes-/profilhämtningstester, riktad ESLint och produktionsbygge med TypeScript/56 routes passerar.
- Återstår / blockerare: Verkligt inloggat spara/återläs/PDF-/ansökningsprov samt visuell kontroll på dator/mobil och med tangentbord. Inget live-AI-anrop eller nytt backend-acceptanstest påstås. N09:s kontolagrade utkast och N20:s profilchatt förblir separata; befintliga utkast sparas bara på enheten. Manuellt metodval gäller CV-skrivandet; redan beslutade matchnings-/ansökningsflöden ändras inte. Markeras inte Klar före verklig slutverifiering.

<a id="n03"></a>
### N03 Visa annonsutkast i översikten

- [ ] Klar
- Prioritet: P2
- Global ordning: 32
- Status: För granskning
- Ansvarig: Codex
- Branch/PR: `codex/f07-n03-durable-job-drafts-20261020`, reserverad före kodarbete 2026-10-20, [PR #85](https://github.com/vilgotdidrikson/youth-job-mvp/pull/85).
- Åtgärd: Lägg en synlig Återuppta utkast-post bland företagets annonser med titel, aktuell del och senast sparat. Skilj utkast från publicerade, pausade och stängda annonser. Koppla till bildsparandet i F07.
- Klar när: Ett sparat utkast går att hitta utan att välja Ny annons.
- Implementerat: Separat utkastskort bland företagets annonser med titel, aktuellt steg, sparstatus, verkligt sparat datum och Återuppta utkast. Tydligt märkt inte publicerat och endast på denna enhet/webbläsare. Se docs/F07_N03.md.
- Verifierat: test:job-drafts med IndexedDB-emulator och hookens faktiska callbacks, test:company-navigation (inklusive återupptagning), test:job-copy, test:job-workplaces och test:job-categories. Produktionsbygge/TypeScript (51 routes) och riktad ESLint passerar; en befintlig img-varning kvarstår. Inget inloggat webbprov påstås genomfört.
- Återstår / blockerare: Inloggat driftsatt test av spara/omladdning/återupptagning/beskärning/kopia/publicering och fysisk mobil. Lokal webbläsarlagring kan rensas; ingen synkning mellan enheter utlovas. Ingen ny serverlagring, AI-data eller migration. Avgränsad leverans införs i dev innan Klar kan övervägas.

<a id="n04"></a>
### N04 Öppna en läsbar företagsprofil från annonsen

- [x] Klar
- Prioritet: P2
- Global ordning: 37
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: branch `Max`; reserverad före kodarbete 2026-10-25. Avsteg från global ordning enligt användarens avgränsning (inga GDPR-, domän- eller betalningsberoende punkter): samma överhoppade punkter som F14 och F23 (N23, L03, N02, L05, L06, L12–L14, N08, F12, F20). Planerad migration (godkänd av användaren): säker läsfunktion med utvalda publika företagsfält för företag med synlig annons; RLS på `company_profiles` öppnas inte.
- Åtgärd: Gör företagskortet öppningsbart och visa verksamhetsbeskrivning, ort, verifiering och relevant arbetsplatsinformation. Ge en tydlig väg tillbaka till jobbet. Återanvänd uppgifter företaget redan fyllt i.
- Klar när: Ungdomen kan bedöma arbetsgivaren innan den visar intresse.
- Implementerat: Migration `20261025120000_n04_job_company_profile.sql`: `private.get_job_company_profile` (security definer, `search_path=''`) med publik invoker-wrapper `public.get_job_company_profile`, bara för inloggade. Den speglar annonsens synlighetsregel (ägaren eller aktiv publicerad annons), respekterar blockeringar och lämnar bara ut namn, bransch, beskrivning, ort, storlek, logga, webbplats, verifiering och antal öppna jobb. Administratör, organisationsnummer, adress, sociala länkar och matchprofil (internt bedömningsstöd) lämnas aldrig ut; RLS och tabeller oförändrade. Logik och säker länkhantering (bara http/https) i `lib/company-public-profile.ts`. Annonssidan har ett företagskort direkt under rubriken (`components/job-company-card.tsx`) med Om företaget som öppnar en dialog med beskrivning, verifiering, öppna jobb och webbplats och knappen Tillbaka till jobbet; det gamla statiska företagskortet (bara desktop) är ersatt. Kortet visas för inloggade; utan profil visas bara namnet.
- Införd i DevStaging: migrationen kördes av användaren i SQL Editor 2026-10-25 (inte i CLI-historiken).
- Verifierat: TypeScript, produktionsbygge, riktad ESLint, nytt `test:company-public-profile` (länkar, publik form, migrationens fält, synlighet, blockering, inga RLS-ändringar), `test:accessibility` och `test:job-discovery`. Mot DevStaging med fiktiva konton och annonser (raderade efteråt), 28/28: ungdom läser publik profil med exakt de publika fälten och utan skyddade värden; stängd annons ger ingen profil; ägaren kan läsa via egen stängd annons; utloggad nekas; ungdom kan fortfarande inte läsa `company_profiles` direkt; blockerat företag visas inte. Chromium vid 375 och 1280 px: kortet före Om jobbet, ingen horisontell scroll, dialog med beskrivning, webbplats och öppna jobb, inga skyddade uppgifter i sidan, Tillbaka till jobbet och Escape stänger och fokus återgår, inga sidfel. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, 2×10: företagskortet visas under rubriken; Om företaget öppnar en dialog med namn, bransch, ort, storlek, verifiering, beskrivning, 1 öppet jobb och https-länk till webbplatsen (ny flik, noopener); organisationsnummer och kontaktperson visas inte; Tillbaka till jobbet stänger dialogen och återför fokus; inga sidfel.
- Återstår / blockerare: Migrationen ska köras i master-projektet före release (samordnas). Logga ej provad med riktig bild.

<a id="n05"></a>
### N05 Lägg till strukturerade praktiska jobbuppgifter

- [x] Klar
- Prioritet: P2
- Global ordning: 38
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: branch `Max`; reserverad före kodarbete 2026-10-25. Avsteg från global ordning som för N04. Planerad migration (godkänd av användaren i samma insats): ny kolumn `jobs.practical_details jsonb` med objektkontroll; inga RLS-ändringar. Samordning: annonsbyggaren och redigeringen (N01/F10/F22, Max / Claude) och N17 (Codex) berörs; matchningens jobbkontext (F26, Codex) ändras inte.
- Åtgärd: Komplettera annonsen med start eller flexibelt startläge, schema eller omfattning, anställningsperiod, sista ansökningsdag utan krav på platsantal enligt det reviderade N16-beslutet. Håll det enkelt och tillåt Ej bestämt där det är rimligt.
- Klar när: Ungdomen kan jämföra arbetstid och tidsram utan att leta i fri text.
- Implementerat: Migration `20261025140000_n05_job_practical_details.sql`: kolumn `jobs.practical_details jsonb not null default '{}'` med objekt- och storlekskontroll; inga RLS- eller dataändringar. Regler, tolerant inläsning, utkaståterställning och visningstext i `lib/job-practical.ts`. Annonsbyggarens steg 3 har rutan Tid och period (`components/job-practical-fields.tsx`): start (så snart som möjligt, datum, flexibel, Ej bestämt), timmar per vecka från–till, när på veckan (vardagar dagtid, kvällar, helger), anställningsperiod (tills vidare, tidsbegränsad till datum, Ej bestämt) och sista ansökningsdag. Allt är valfritt; Ej bestämt visas inte. Ofullständiga datum, timmar utanför 1–60, slut före start och en ny sista ansökningsdag som passerat stoppar publicering/sparning med fokus på fältet; vid redigering behålls en redan passerad dag. Uppgifterna följer med i förhandsvisning, kopiering, redigering (bara vid ändring) och lokala utkast, och visas i Snabb överblick på annonssidan (passerad sista dag markeras). Annonsen pausas inte automatiskt. `createJob` skickar fältet bara när det har innehåll, så annonser utan uppgifter fungerar även innan migrationen finns i en miljö.
- Införd i DevStaging: migrationen kördes av användaren i SQL Editor 2026-10-25 (inte i CLI-historiken).
- Verifierat: TypeScript, produktionsbygge, riktad ESLint (inga nya problem), nytt `test:job-practical` samt `test:job-fields`, `test:job-copy`, `test:job-edit`, `test:job-workplaces`, `test:recruitment`, `test:job-discovery`, `test:company-navigation` och `test:accessibility`. Playwright/Chromium mot lokal dev-server kopplad till DevStaging med fiktivt verifierat företag och fiktiv ungdom (raderade efteråt), 15/15: Ej bestämt förvalt, saknat startdatum stoppar publicering med fokus, förhandsvisningen visar uppgifterna, publicerad annons har exakt rätt `practical_details` i databasen, redigering förifyller och sparar ändrade timmar, inga sidfel; ungdom ser Start, Omfattning, Anställningsperiod och Sista ansökningsdag i Snabb överblick vid 375 och 1280 px utan horisontell scroll. Två fel hittades och rättades under verifieringen: fältet saknades i insert-/uppdateringsobjektet i `lib/jobs.ts`, och datumetiketterna flöt på samma rad. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px: annonsbyggarens Tid och period stoppar timmar till < från, över 60 timmar och passerad sista ansökningsdag vid fältet; publicerad annons sparar start, timmar, helger, tills vidare och sista dag i `practical_details` (dator och mobil); Snabb överblick på annonssidan visar uppgifterna; tillagd kvällstid via redigering syns för ungdomen.
- Återstår / blockerare: Migrationen ska köras i master-projektet före release (samordnas). Uppgifterna används inte av matchningen (F26) eller i swipekortet.

<a id="n07"></a>
### N07 Ångra det senaste bortvalet i swipe

- [ ] Klar
- Prioritet: P2
- Global ordning: 40
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n07-undo-discovery-20261025`; [PR #103](https://github.com/vilgotdidrikson/youth-job-mvp/pull/103), implementation `74f30c6f`. Reserverad före kodarbete 2026-10-25. Avsteg: kvarstående profil-/AI-/GDPR-punkter inväntar avstämning, SMTP/fakturering och F17 inväntar domän-/prisberoenden; inga andra ägares uppgifter tas över.
- Åtgärd: Lägg en diskret Ångra efter Inte nu så att ett oavsiktligt bortval kan tas tillbaka utan att lämna upptäcktsflödet.
- Klar när: Ett feltryck döljer inte ett intressant jobb utan enkel återväg.
- Implementerat: Diskret Ångra efter bekräftat Inte nu; samma privata historik med/utan CV. Senaste val i aktuell vy, skrivkö i klickordning, versions-/dubbelklicksskydd och ny behörighetsstyrd flödeshämtning före återställt kort. Bevarar filter, visningshistorik och bokmärken. Ändrar aldrig ansökningar, återkallelser eller matchningar. Migration 20261025201656 införd endast i DevStaging; publik invoker-wrapper och ägarkontrollerad privat funktion. Se docs/N07.md.
- Verifierat: 33 transaktionella SQL-kontroller före/efter införande med återställda testdata. test:discovery-undo kör verklig hook, transport och sidhandlers med simulerad miljö (kö, sena svar, dubbelklick, skrivfel och läsfel efter lyckad ångring). test:job-discovery, test:application-withdrawal, test:application-overview, TypeScript, riktad ESLint och webpack-bygge passerar. Säkerhetsrådgivarens fynd/antal oförändrade.
- Återstår / blockerare: Inloggad visuell acceptans på dator/mobil, tangentbord, sista kortet, sidgräns och annan öppen flik. Inga verkligt samtidiga databasanslutningar eller betald TinyFish-körning.

<a id="n06"></a>
### N06 Utöka jobbsökningen med relevanta val

- [ ] Klar
- Prioritet: P2
- Global ordning: 41
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n06-discovery-filters-20261025`; [PR #104](https://github.com/vilgotdidrikson/youth-job-mvp/pull/104), implementation `12cd8052`. Reserverad före kodarbete 2026-10-25. Fritext, N05-arbetstid och lokalt uppskattat avstånd från vald orts centrum; inga bostads-/GPS-/AI-data eller databasändringar. Kvarstående profil/GDPR/SMTP/prisberoenden och andra ägares uppgifter hoppas över enligt tidigare avgränsning.
- Åtgärd: Börja med textsökning och ett användbart val för närhet eller pendling samt arbetstid. Lägg därefter till lön och ålder om underlaget stödjer pålitlig filtrering. Koppla arbetstidsfilter till N05 och behåll lätt återställning.
- Klar när: Ungdomen hittar relevanta jobb utan att behöva öppna varje annons; okända uppgifter hanteras tydligt.
- Implementerat: Sökfält med synonym-/flerordssökning, N05-arbetstider och lokalt uppskattad fågelväg från vald orts centrum (12 referensorter, 5/10/25/50 km). Jobb med okänd vald uppgift kan behållas och märks, flera arbetsplatser hanteras utan dubblett. Filter före paginering, totalräknare, tydlig rensning och bibehållna sökval mellan kort/karta. Ångra behåller filtren. Inga nya profil-/GPS-/AI-data, databas- eller behörighetsändringar. Se docs/N06.md.
- Verifierat: test:job-search kör verklig filterlogik/avstånd/URL och renderar faktisk filterkomponent med simulerad React. Synonymer, extra ord, svenska tecken, okända uppgifter, fleradresser, koordinatgränser, direktlänk, 45 resultat över sidgränser och rensning. test:job-discovery, test:discovery-undo, test:job-practical, test:job-workplaces och test:job-categories passerar, liksom TypeScript, riktad ESLint och webpack-bygge.
- Återstår / blockerare: Inloggad visuell dator-/mobilacceptans, tangentbord/dialog, tomt resultat, sidgräns och växling kort–karta med sökval. Lön/ålder enligt planens därefter-del inväntar pålitligt strukturerat underlag och produktavstämning. Avstånd är en uppskattning från centrum, inte faktisk pendlingstid; inga nya platsdata samlas in.

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
- Tillägg 2026-10-19: Integritetssektionens export/rättelse/radering hanteras separat som P1 i L13 och ska inte skjutas till denna P3-punkt.
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

- [x] Klar
- Prioritet: P1
- Global ordning: 9
- Status: Klar
- Ansvarig: Vilgot / Codex (kod, commits `8a1bdf2` och `e1db40a` i dev 2026-10-15, se `docs/F04.md`); Max / Claude (verifiering, reserverad 2026-10-25)
- Branch/PR: verifiering på branch `Max`. Koden är redan införd i dev men kortet uppdaterades aldrig. Ingen ny kod planeras om inte verifieringen hittar fel.
- Åtgärd: Säkerställ att Gå till mitt konto går till kontot och att Skapa din första annons samt Ny annons öppnar annonsbyggaren direkt. Rätt destination ska fungera även efter nyregistrering utan omladdning.
- Klar när: Varje startknapp leder till den vy som etiketten utlovar.
- Implementerat: Knapparnas destinationer infördes av Vilgot / Codex 2026-10-15 (`8a1bdf2`, `e1db40a`). Rättat vid verifieringen 2026-10-25 (Max / Claude): företagets onboarding läser in sparade företagsuppgifter igen när sessionen uppdateras, och skrev då över det som redan skrivits med tomma värden. Organisationsnumret försvann efter ifyllning och nyregistrerade företag kom inte vidare till startknapparna. Inlästa värden fyller nu bara tomma fält (`app/company/onboarding/page.tsx`). Rättat vid verifieringen i driftsatt dev 2026-10-26 (Max / Claude): efter inloggning via `/login` fastnade företagets (och ungdomens) målsida på Kontrollerar session... tills sidan laddades om. `refresh()` i `hooks/use-session.ts` delar en pågående körning via en referens, men en körning utan `await` (utloggad startsession) rensade referensen innan den sattes, så ett avslutat löfte låg kvar och refresh efter `SIGNED_IN` hämtade aldrig profilen. Referensen rensas nu i en senare mikrouppgift. Felet fanns sedan `d41bd1b` (2026-09-29); registrering påverkades inte eftersom den gör en full navigering.
- Verifierat: `test:company-navigation`, TypeScript och riktad ESLint (inga nya problem). Playwright/Chromium mot lokal dev-server kopplad till DevStaging med fiktiva företagskonton registrerade via formuläret `/signup?role=company` och påhittade organisationsnummer (raderade efteråt), vid 1280 och 375 px, 14/14 två körningar i rad: registrering leder till onboarding; efter onboarding öppnar Gå till mitt konto kontot (`/profile?tab=settings`, ”Ditt konto”), Fortsätt skapa min jobbannons, Skapa din första annons och Ny annons öppnar annonsbyggaren (”Berätta om jobbet”), alla utan omladdning (markör i `window` kvar); inga sidfel. Före rättningen föll samma test på organisationsnumret i båda körningarna. Driftsatt dev 2026-10-26 (Max / Claude), Playwright/Chromium med sex fiktiva företag registrerade via `/signup?role=company` (raderade efteråt), vid 375 och 1280 px: registrering leder till onboarding; namn, bransch, organisationsnummer och kontaktperson sparas; Fortsätt skapa min jobbannons, Skapa din första annons och Ny annons öppnar annonsbyggaren, Gå till mitt konto öppnar Ditt konto, utan omladdning och utan sidfel. Inloggning via `/login` fastnade däremot på Kontrollerar session... för både företag och ungdom tills omladdning; reproducerat lokalt, rättat på branch `Max` (`efc34fd`) och provat lokalt mot DevStaging: företag landar i annonsvyn, ungdom med CV i Upptäck och ungdom utan CV i onboarding, utan omladdning. `test:session-events`, TypeScript och ESLint utan fel. Efter merge till dev ([PR #118](https://github.com/vilgotdidrikson/youth-job-mvp/pull/118), `1e4f49d`), driftsatt dev 2026-10-26, nya fiktiva QA-konton (raderade): inloggning via `/login` utan omladdning och utan sidfel, 9/9 – godkänt företag och företag som ska komplettera landar färdigladdade i annonsvyn, ungdom med CV i Upptäck och ungdom utan CV i onboarding (laddar klart), vid 375 och 1280 px.
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

- [x] Klar
- Prioritet: P2
- Global ordning: 16
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: `claude/f08-verification-status-20261020`, [PR #87](https://github.com/vilgotdidrikson/youth-job-mvp/pull/87), mergad till dev `52ed570` 2026-10-20; reserverad före kodarbete 2026-10-20. Bygger på F09 i dev (Codex lämnade F08:s underlag, handläggning och organisationsnummervalidering separat). Användarbeslut 2026-10-20: ingen fast handläggningstid utlovas, hjälpvägen är vägledning i appen tills en kontaktadress finns, och UF-företag behöver eget organisationsnummer (ingen databasändring).
- Åtgärd: Skilj Uppgifter saknas, Inskickat, Under granskning, Godkänt och Behöver kompletteras. Visa obligatoriska uppgifter, uppskattad handläggning och hjälpväg. Validera organisationsnummer på ett sätt som stödjer UF och hindrar uppenbart orimliga nummer från att framstå som giltiga.
- Klar när: Företaget vet vad det behöver göra och om underlaget faktiskt är inskickat.
- Implementerat: Gemensam, ramverksfri verifieringslogik med lägena Uppgifter saknas, Inskickat – under granskning, Behöver kompletteras och Godkänt (samt okänd status), härledda från sparade uppgifter. Ett statuskort med steg, obligatoriska uppgifter som saknas och hjälptext visas i företagsvyn, profilöversikten och Företagsuppgifter. Organisationsnumret kontrolleras med kontrollsiffra och rimliga siffergrupper; föreningar i 8-serien (UF-enheter) och enskild firma godkänns, och felet visas vid fältet. Kontaktperson kan redigeras i profilen. Godkända företag varnas innan ett ändrat nummer leder till ny granskning, och en ändring som bara gäller bindestreck startar ingen ny granskning. Profilen läser tillbaka lagrad status efter sparning och adminvyn flaggar nummer med fel kontrollsiffra. Ingen migration. Se docs/F08.md.
- Verifierat: test:company-verification (validering, statuslägen, ingen utlovad handläggningstid, varning om ny granskning, serverrenderat statuskort) samt regressionerna test:job-publication, test:company-navigation, test:job-copy, test:job-drafts, test:job-workplaces, test:recruitment, test:recruitment-review och test:profile-journey passerar. TypeScript och produktionsbygge passerar. Riktad ESLint: 0 fel, 2 befintliga img-varningar. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, 26/26: företagsvyn visar Uppgifter saknas, Inskickat – under granskning (med datum) och Behöver kompletteras (med adminens skäl) med länk till Företagsuppgifter; godkänt företag ser inget statuskort; för kort nummer och fel kontrollsiffra ger fel vid fältet (aria-invalid) och sparas inte; UF-nummer i 8-serien godtas; komplett sparning ger Inskickat – under granskning, kvar efter omladdning; ingen horisontell scroll. Iakttagelser (inte blockerande): statuskortet i företagsvyn säger ”Fyll i uppgifterna nedan” fast fälten finns under Företagsuppgifter, och stegindikatorn ser ut som radioknappar.
- Återstår / blockerare: Kontaktadress och eventuell handläggningstid är öppna produktbeslut. Kontrollsiffran kontrolleras inte av databasen (kräver samordnad migration).

<a id="f09"></a>
### F09 Anpassa publicering till verifieringsstatus

- [ ] Klar
- Prioritet: P2
- Global ordning: 17
- Status: För granskning
- Ansvarig: Codex
- Branch/PR: `codex/f09-verification-publication-20261020`, reserverad före kodarbete 2026-10-20, [PR #86](https://github.com/vilgotdidrikson/youth-job-mvp/pull/86).
- Åtgärd: Anpassa knapp, förhandsvisning och bekräftelse till om företaget är godkänt. Före godkännande ska det framgå om annonsen sparas eller väntar på publicering och om den publiceras automatiskt efter beslut.
- Klar när: Ingen vy lovar omedelbar publicering när annonsen fortfarande väntar på verifiering.
- Implementerat: Gemensamma verifieringsanpassade knappar, väntetexter och förhandsvisning i båda annonsvägarna. Bekräftelse i översikten utifrån faktisk serverstatus för den egna annonsen. Automatisk publicering efter godkännande förklaras med bevarad paus/stängning; lokala utkast skiljs från sparade väntande annonser. Okänd status framställs inte som publicerad. Se docs/F09.md.
- Verifierat: test:job-publication med verklig rendering, test:company-navigation, test:job-copy, test:job-drafts, test:job-workplaces samt produktionsbygge/TypeScript (51 routes) passerar. Riktad ESLint utan fel, tre befintliga img-varningar. Verkligt rollbackprov i DevStaging verifierar publiceringsspärr, egen verifiering nekad, dold väntande annons, automatisk publicering vid adminbeslut och fortsatt dold paus/stängning.
- Återstår / blockerare: Inloggat visuellt test i driftsatt dev på mobil/dator för status, förhandsvisning och bekräftelse återstår. Inga schema-, AI-, personuppgifts- eller produktionsändringar. F08:s verifieringsunderlag/handläggning ingår inte.

<a id="f07"></a>
### F07 Bevara bilden i sparade annonsutkast

- [ ] Klar
- Prioritet: P1
- Global ordning: 18
- Status: För granskning
- Ansvarig: Codex
- Branch/PR: `codex/f07-n03-durable-job-drafts-20261020`, reserverad före kodarbete 2026-10-20, [PR #85](https://github.com/vilgotdidrikson/youth-job-mvp/pull/85).
- Åtgärd: Spara omslagsbilden och beskärningen tillsammans med resten av annonsutkastet. Använd inte en generell Utkast sparat-bekräftelse om någon del saknas; ange då exakt vad som återstår att spara.
- Klar när: Bild, text och praktiska uppgifter finns kvar när utkastet återöppnas efter omladdning.
- Implementerat: Bildens beskurna bytes, text och steg sparas atomärt i ett lokalt kontobundet IndexedDB-utkast; autosparning, uttrycklig sparning, tydliga fel och bakåtkompatibel återläsning. Kopiering/publicering använder ordnad sparning/rensning. Se docs/F07_N03.md.
- Verifierat: test:job-drafts med IndexedDB-emulator och hookens faktiska callbacks, test:company-navigation (inklusive återupptagning), test:job-copy, test:job-workplaces och test:job-categories. Produktionsbygge/TypeScript (51 routes) och riktad ESLint passerar; en befintlig img-varning kvarstår. Inget inloggat webbprov påstås genomfört.
- Återstår / blockerare: Inloggat driftsatt test av spara/omladdning/återupptagning/beskärning/kopia/publicering och fysisk mobil. Lokal webbläsarlagring kan rensas; ingen synkning mellan enheter utlovas. Ingen ny serverlagring, AI-data eller migration. Avgränsad leverans införs i dev innan Klar kan övervägas.

<a id="f13"></a>
### F13 Rätta status för väntande ansökningar

- [x] Klar
- Prioritet: P2
- Global ordning: 23
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: `claude/f13-pending-applications-20261020`; reserverad före kodarbete 2026-10-20. Avsteg från global ordning enligt användarens avgränsning 2026-10-20 (inga GDPR- eller domänberoende punkter): N02 (återkallad delning av ansökningsunderlag), L05 (GDPR-åtkomstkontroller) och L06 (e-post kräver SMTP/domän) hoppas över. Ingen databasändring planerad.
- Åtgärd: Räkna väntande intresse konsekvent i Alla eller ge det en tydlig egen kategori. Visa Inte skickad ännu och vad som krävs för sändning. Ge annonslänk och korrekt knappstatus även innan CV är färdigt.
- Klar när: En synlig väntande ansökan motsäger inte räknaren eller texten om redan skickade ansökningar.
- Implementerat: Räknaren Alla omfattar varje visat kort, inklusive sparade intressen. Ny flik Inte skickade. Kortet för sparat intresse har företagsruta, status Inte skickad ännu, förklaring att intresset inte är skickat och skickas automatiskt när CV:t sparas så länge annonsen är öppen, länken Visa annons och knappen Gör klart CV:t (med jobbet förvalt). Om CV:t redan är klart visas Skicka ansökan för just det jobbet via befintliga prepareApplication. Pausade och stängda annonser visas som Tar inte emot ansökningar, utan CV-uppmaning. Annonssidan erbjuder inte längre Jag är intresserad igen vid sparat intresse. Logiken ligger i lib/application-overview.ts. Ingen migration. Se docs/F13.md.
- Verifierat: test:application-overview (räknare, kategori, texter, stängd annons, skickaknapp, tillgänglighet via simulerad klient och koppling) samt regressionerna test:application-supplement, test:application-disclosure, test:followup-batch, test:job-discovery, test:matching, test:recruitment, test:recruitment-review, test:profile-journey, test:job-edit och test:company-navigation passerar. TypeScript och produktionsbygge passerar. Riktad ESLint utan fel. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, 22/22: ungdom utan CV med sparat intresse (öppen och pausad annons) ser Alla 2 och Inte skickade 2; öppen annons visar Inte skickad ännu, förklaring, Visa annons och Gör klart CV:t (länk med jobbet förvalt); pausad visar Tar inte emot ansökningar utan CV-uppmaning; inget kort säger Skickad; annonssidan erbjuder inte Jag är intresserad igen utan förklarar att intresset är sparat; inga sidfel.
- Återstår / blockerare: Titeln på en dold annons visas som Jobbannons (RLS). Skicka ansökan för ungdom med klart CV och sparat intresse provades inte i webbläsaren.

<a id="f14"></a>
### F14 Gör notiser och lässtatus användbara

- [x] Klar
- Prioritet: P2
- Global ordning: 24
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: `claude/f14-notifications-20261021`; reserverad före kodarbete 2026-10-21. Avsteg från global ordning enligt användarens avgränsning (inga GDPR- eller domänberoende punkter): N23 (väntar på L12-gallring), F04 (redan införd i dev av Vilgot / Codex, kortet ej uppdaterat; tas inte över), L03 (pris/villkor blockerade via F06 samt e-post), N02, L05, L06 och L12–L14. Planerad migration: notisernas innehåll, länk till exakt matchning och en oläst meddelandenotis per samtal.
- Åtgärd: Skriv person eller företag och jobb i match- och meddelandenotiser. Öppna rätt konversation direkt. Återställ lässtatus och badges när motsvarande händelse är hanterad; skilj historiska händelser från kvarvarande uppgifter. Ge diskret CV-påminnelse för väntande intresse.
- Klar när: Notiser leder till rätt ärende och signalerar bara det som fortfarande behöver uppmärksamhet.
- Implementerat: Migration `20261021090000_f14_notification_context.sql`: `notifications.match_id` och ny trigger. Match- och meddelandenotiser namnger motparten och jobbet och öppnar exakt samtal (`/chats?match=`, `/chats?conversation=`). En matchning har högst en oläst meddelandenotis per mottagare. Statusnotisen anger företag, jobb och status. Kandidatintresset anger jobbet. Meddelandetext kopieras inte. Chatten markerar matchningens notiser som lästa när samtalet visas och sidan är synlig, och uppdaterar klockan och märket på Meddelanden. Notissidan delar upp Olästa och Tidigare, har Markera alla som lästa och typikoner. CV-påminnelsen anger antalet sparade intressen för öppna annonser, utan ny notis eller prick. Logiken ligger i lib/notifications.ts, lib/youth-activity.ts och lib/application-overview.ts. Ingen RLS-ändring. Se docs/F14.md.
- Verifierat: test:notifications. Triggern körd på isolerad Postgres (PGlite) med fiktiva data: namn, länkar, en oläst meddelandenotis, statustext, reservord, kaskad och idempotent migration. Regressionerna test:application-overview, test:company-navigation, test:job-discovery, test:matching, test:recruitment, test:recruitment-review, test:application-supplement, test:application-disclosure, test:followup-batch, test:profile-journey och test:job-edit passerar. TypeScript och produktionsbygge passerar. Riktad ESLint utan fel. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, 15/15: meddelande- och matchnotiser namnger företag och jobb; klick på meddelandenotisen öppnar exakt samtal (`/chats?conversation=`) med meddelandet; notiserna markeras lästa i databasen och märket på Meddelanden försvinner; notislistan har inga olästa kvar; CV-påminnelsen för ungdom utan CV anger 1 sparat intresse (bara öppna annonser); inga sidfel.
- Verifierat i dev 2026-10-21 (efter merge #92): `test:notifications:staging` mot DevStaging med tillfälliga, fiktiva QA-konton (företag, ungdom, admin) som raderas efteråt; inga rester kvar. 21/21 kontroller passerar med verkliga triggrar, RLS och sessioner:
  - Kandidatintresset nämner jobbet.
  - Matchnotiserna namnger motparten och jobbet och länkar till exakt matchning.
  - Meddelandenotisen namnger avsändaren och jobbet och länkar till exakt samtal.
  - Avsändaren får ingen notis för eget meddelande, och två meddelanden ger en oläst notis.
  - Den verkliga `markMatchNotificationsRead` med ungdomens session släcker matchningens notiser och ändrar inte andras.
  - Ett nytt meddelande efter läsning ger en ny notis, och svaret namnger ungdomen.
  - Statusnotisen nämner företag, jobb och status.
  - Markera alla fungerar, och meddelandetext kopieras aldrig in i notiser.
  - Driftsatt dev (youth-job-mvp-dev.vercel.app) levererar nya notissidan och chattens läsmarkering.
- Återstår / blockerare: —

<a id="f10"></a>
### F10 Återanvänd redan sparade uppgifter

- [ ] Klar
- Prioritet: P2
- Global ordning: 27
- Status: För granskning
- Ansvarig: Max / Claude – företagsdelen (stad från företaget, överföring av angiven lön). Ungdomsdelen (CV-guiden) tas inte: överlappar N19 och väntar på profil-/GDPR-avstämning.
- Branch/PR: `claude/f10-f22-job-builder-fields-20261021`; reserverad före kodarbete 2026-10-21. Samlad leverans F10 (företagsdel) + F22 (annonsbyggaren): samma ålders- och lönefält. Avsteg från global ordning: F11 tas som egen leverans eftersom den ändrar AI-routen; N08, F12 och ungdomsdelen av F10 överlappar N19 (Codex, Pågår) och väntande profil-/GDPR-beslut. Ingen databasändring planerad.
- Åtgärd: Förifyll CV-guiden med erfarenhet, utbildning och språk från profilen. Förifyll annonsens stad från företaget och erbjud överföring av uttryckligt angiven lön till lönefälten. Alla förslag ska kunna rättas.
- Klar när: Användaren slipper skriva samma fakta två gånger och motstridiga värden blir synliga.
- Implementerat: Företagsdelen: en ny annons får ort från företagsprofilen när den når steg 3, med synlig förklaring. Redigerade och kopierade annonser, ifylld ort och tillagda arbetsplatser skrivs aldrig över. Sparad lönetext som anger belopp och enhet uttryckligen (till exempel 120–145 kr/tim, Från 130 kr/h eller 25 000 kr/mån) kan föras över till lönefälten med Fyll i lönefälten efter en förhandsvisning. Vag text lämnas orörd. Samma belopp visas som 130 kr/tim. Logiken ligger i lib/job-fields.ts. Ingen migration. Se docs/F10-F22.md.
- Verifierat: test:job-fields. Regressionerna test:job-copy, test:job-edit, test:job-drafts, test:job-publication, test:job-workplaces, test:job-categories, test:company-navigation, test:company-verification, test:application-overview och test:matching passerar. TypeScript och produktionsbygge passerar. Riktad ESLint utan fel. Inget webbtest har körts. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px (företagsdelen): ny annons får ort Stockholm från företagsprofilen med förklaringen; vid redigering skrivs orten inte över och förklaringen visas inte; sparad lönetext 130–150 kr/tim förs till lönefälten (130/150) med Fyll i lönefälten.
- Återstår / blockerare: Ungdomsdelen (förifylld CV-guide) är inte gjord: den överlappar N19 och väntar på profil-/GDPR-avstämning. Företagsdelen är verifierad i driftsatt dev.

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
- Beslut 2026-10-19 – kravinformation för ungdomen: Lägg till frivillig öppningsbar vy ”Se vad företaget söker” vid ansökan/kompletteringsfrågor. Visa relevanta bedömningsområden och konkreta avgörande jobbkrav, inte personens exakta AI-bedömning, poäng, procent, vikter eller interna trösklar. Förklara saknade uppgifter med neutrala jobbspecifika frågor; lova inte bättre matchning eller högre poäng. Undvik upprepning av kända svar. Låt ungdomen svara, rätta egna uppgifter eller avstå utan att blockera skickad ansökan/swipe. Fullständig specifikation: ”Ungdomens kravinformation och kompletteringar” i `docs/PROFIL_OCH_RELEVANS.md`.
- Tillkommande klart-kriterium: Verifiera rätt annons/kravområden, synliga avgörande krav, neutrala frågor utan poänglöften, inga upprepade kända svar och frivillig komplettering utan spärr. Den vanliga vyn visar inte individuella AI-omdömen/poäng; delningsförhandsvisning och L13:s tillgång/rättelse bevaras.
- Dokumentleverans: Vilgot / Codex, `codex/f12-criteria-insight-plan-20261019`. Endast plan/specifikation ändrade och genomlästa; ingen produktkod eller webbverifiering. Befintlig status och ansvar för implementation bevaras.

- Beslut 2026-10-20 – återanvändbara kompletteringssvar (F12/N19): Relevanta generella fakta i ungdomens svar på kompletteringsfrågor ska kunna stärka den egna jobbprofilen och återanvändas vid senare ansökningar. Matchningen ska använda aktuella godkända svar även när nästa fråga är annorlunda formulerad, så att samma sak inte behöver kompletteras varje gång. Behåll originalsvaret, frågans sammanhang och källa; tillskriv inte ungdomen nya egenskaper eller verifierad kompetens.
- Profilflöde – uttryckligt val efter svar: När ungdomen har svarat på en kompletteringsfråga ska de få frågan **Vill du spara det här svaret i din profil så att det kan återanvändas i framtida ansökningar?**, med tydliga val **Ja, spara i min profil** och **Nej, bara för den här ansökan**. Inget ja får vara förvalt; ett obesvarat val innebär ingen profilsparning. Ett nej eller avstående får inte stoppa att svaret skickas för den aktuella ansökan. Visa valet diskret i det befintliga svarsflödet, utan en onödig kedja av popuper. Låt ungdomen granska den uppgift som ska sparas, rätta den och senare ändra/ta bort den. Ett tidigare godkännande av en annan uppgift ersätter inte detta val för ett nytt svar; samma redan sparade och oförändrade profilfakta behöver däremot inte godkännas om vid varje senare ansökan. Skilj generella profilfakta från svar som bara gäller ett visst jobb; ett visst startdatum eller vissa arbetstider ska inte behandlas som permanenta utan aktualitetskontroll.
- Delning och versioner: Att ett svar stärker den egna profilen innebär inte generell företagsåtkomst eller automatisk delning till andra företag. Följ N19:s jobbspecifika delning och förhandsvisning. Uppdatera inte tyst redan skickade ansökningsunderlag eller grund-CV:t. Den ursprungliga ansökans svar och källsammanhang ska fortsatt kunna skiljas från en senare rättad profiluppgift.
- Verifiering för återanvändning: Svara i ansökan A och kontrollera att godkänd generell fakta kan användas i ansökan B utan samma följdfråga, även med synonym formulering. Verifiera att Ja sparar först efter granskning, att Nej/obesvarat val inte sparar i profilen men låter den aktuella ansökans svar skickas, och att valet inte är förvalt. Testa rättelse/borttagning, motstridiga uppgifter, ändrad tillgänglighet, jobbspecifika svar, avstådd profilsparning och att ett annat företag inte får ospecificerad åtkomst till svar från A. Svar eller avstående får inte blockera ansökan.
- Implementation av denna profilåteranvändning samordnas med den pausade profil-/AI-utvecklingen och pågående GDPR-/databeslut. Detta tillägg är ett beslutat produktkrav, inte en uppgift om genomförd funktion eller verifiering. Befintlig status och implementationsägare bevaras.
- Dokumenttillägg 2026-10-20: `codex/f12-n19-reusable-followup-answers-20261020`, [PR #90](https://github.com/vilgotdidrikson/youth-job-mvp/pull/90). Krav och acceptanstest genomlästa; endast dokumentation ändrad, ingen funktion byggd eller aktiverad.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f11"></a>
### F11 Visa vad AI överför till annonsfälten

- [x] Klar
- Prioritet: P2
- Global ordning: 30
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: `claude/f11-ai-job-fields-20261021`; reserverad före kodarbete 2026-10-21. Bygger på `claude/f10-f22-job-builder-fields-20261021` (återanvänder lönetolkning och fältregler i lib/job-fields.ts) och ska granskas och mergas efter den. Planerat: uttryckliga ålders- och löneuppgifter förs till fälten eller markeras för granskning, en sammanfattning av AI:s ändringar, AI-krav som arbetsgivaren inte angett blir förslag, och en vald anställningsform skrivs aldrig över. Ingen databasändring planerad.
- Åtgärd: Överför uttryckliga ålders- och löneuppgifter till rätt fält eller markera att de behöver granskas. Sammanfatta AI:s ändringar och skilj arbetsform från absoluta krav; gör inte automatiskt varje önskemål till ett måste.
- Klar när: Företaget kan se vilka fakta som används i text och matchning innan publicering.
- Implementerat: Uttrycklig ålder och lön läses enbart ur arbetsgivarens egen text, aldrig ur AI-texten, och förs till tomma fält. Ifyllda fält och kopierad lön skrivs aldrig över. Oklara uppgifter och avvikelser markeras som Behöver granskas. Bara krav som arbetsgivaren angett blir absoluta matchkrav; övriga AI-krav blir förslag med Lägg till som krav, som läggs till både i annonsen och i matchningen. En vald anställningsform skrivs aldrig över, och utan AI sätts inte längre Deltid. Prompten skiljer arbetsform och arbetstider från absoluta krav och behandlar inte önskemål som krav. Panelen Granska AI-förslaget före publicering delar upp ändringarna i annonsen (syns för sökande), överförda fält, matchningen (internt), föreslagna krav och sådant som behöver granskas. Logiken ligger i lib/job-ai-review.ts. Ingen migration och inga nya AI-anrop. Se docs/F11.md.
- Verifierat: test:job-ai-review, som kör den verkliga apply-funktionen och routens normalizeResult och fallback. Regressionerna test:job-fields, test:job-categories, test:job-copy, test:job-edit, test:job-drafts, test:job-publication, test:job-workplaces, test:company-navigation, test:matching och test:matching-fairness passerar. TypeScript och produktionsbygge passerar. Riktad ESLint utan fel. test:openai-migration misslyckas redan i dev på lib/application-analysis-worker.ts (senast ändrad i F26/N19 #82); generate-routen uppfyller testets krav. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, ett riktigt AI-anrop: panelen Granska AI-förslaget före publicering delar upp I annonsen, Överfört till fälten från er egen text (ålder 16–19, lön 135 kr/tim) och I matchningen; åldersfälten fylldes; vald anställningsform (Heltid) behölls; meriterande butikserfarenhet blev inget krav; inga sidfel. Iakttagelse: arbetsgivarens ”Du måste kunna jobba helger” blev en frivillig kompletteringsfråga, inte ett matchkrav, i linje med att prompten skiljer arbetstider från absoluta krav; värt ett produktbeslut.
- Återstår / blockerare: Faktaläsningen täcker vanliga svenska formuleringar; andra skrivsätt förs inte över.

<a id="f22"></a>
### F22 Validera inmatning nära fälten

- [ ] Klar
- Prioritet: P2
- Global ordning: 31
- Status: För granskning
- Ansvarig: Max / Claude – annonsbyggaren (lön, ålder, svenska fältfel). Datumhjälpen ligger i ungdomens onboarding/profil (F15/F18/N19) och rekryteringspanelen (L04) och samordnas separat.
- Branch/PR: `claude/f10-f22-job-builder-fields-20261021`; reserverad före kodarbete 2026-10-21. Samlad leverans F10 (företagsdel) + F22 (annonsbyggaren): samma ålders- och lönefält. Avsteg från global ordning: F11 tas som egen leverans eftersom den ändrar AI-routen; N08, F12 och ungdomsdelen av F10 överlappar N19 (Codex, Pågår) och väntande profil-/GDPR-beslut. Ingen databasändring planerad.
- Åtgärd: Hindra omvända löneintervall och orimliga åldersspann innan förhandsvisning och sparande. Ge begripliga svenska feltexter där appen styr dem och tydlig datumhjälp utan att förutsätta webbläsarens lokala format.
- Klar när: Fel kan rättas vid rätt fält utan att en missvisande annons visas.
- Implementerat: Annonsbyggaren: ålder 13–30 år och lön i hela kronor kontrolleras, liksom omvända intervall och orimlig tim- eller månadslön. Svenska fel visas vid fältet med aria-invalid och role=alert. Förhandsvisa, nästa steg, publicering och sparade ändringar stoppas, och formuläret går till fältet med felet. Åldersfälten använder appens text i stället för webbläsarens felbubbla. Logiken ligger i lib/job-fields.ts. Ingen migration. Se docs/F10-F22.md.
- Verifierat: test:job-fields. Regressionerna test:job-copy, test:job-edit, test:job-drafts, test:job-publication, test:job-workplaces, test:job-categories, test:company-navigation, test:company-verification, test:application-overview och test:matching passerar. TypeScript och produktionsbygge passerar. Riktad ESLint utan fel. Inget webbtest har körts. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, annonsbyggaren: ålder under 13 och omvänt åldersspann stoppas vid fältet med svensk text, aria-invalid och fokus på fältet; omvänd lön stoppar förhandsvisningen; för hög timlön (2 500 kr) stoppas; fel annons publiceras inte; korrekt annons publiceras med ålder 16–20. Iakttagelse: en orimligt låg lön (5 kr/tim) godtas och publicerades i provet (raderad direkt); reglerna har bara en övre gräns.
- Återstår / blockerare: Datumhjälpen är inte gjord (datumfälten ägs av F15/F18/N19 och L04). Besluta om en nedre lönegräns. Annonsbyggarens del är verifierad i driftsatt dev.

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
- Tillägg 2026-10-19: Inställningar → Integritet och personuppgifter samlar automatisk export, rättelse, säker kontoradering och kontaktväg enligt L13. Rättighetsinformation och kontakt ska även kunna nås utan inloggning. Leverantörsuppgifter och AI-lagring ska bygga på verifieringen i L14, inte antaganden om kontonamn eller EU-region.
- Tillägg från designaudit 2026-10-25 (DA-08, DA-09 i `docs/DESIGN_AUDIT_2026-10-22_1.md`): en gemensam marknadssidfot med länk till Integritet på alla publika sidor och en rad under skapa konto-knappen; `/privacy` visar marknadsnavigering för utloggade och profillänk bara med session. Notisen om juridisk granskning tas bort med den slutliga policyn (L10/L14).
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f23"></a>
### F23 Ge val och dialoger korrekt tillgänglighet

- [ ] Klar
- Prioritet: P2
- Global ordning: 34
- Status: För granskning
- Ansvarig: Max / Claude
- Branch/PR: `claude/f23-accessibility-20261022`; reserverad före kodarbete 2026-10-22. Avsteg från global ordning enligt användarens avgränsning (inga GDPR- eller domänberoende punkter): samma överhoppade punkter som F14, därtill N08 (överlappar pågående N19 för CV-skapandevägar och pausat CV-/profilarbete), F12 (profilåteranvändning inväntar GDPR-avstämning) och F20 (integritet). Ingen databasändring planerad.
- Åtgärd: Använd radioval för ett enda rollval och korrekt semantik för flikar och flervalsknappar. Ge tydliga namn, synligt fokus, tangentbordsstyrning och konsekvent fokus vid öppning och stängning av dialoger.
- Klar när: Rollval, filter och dialoger går att förstå och använda med tangentbord och hjälpmedel.
- Implementerat: Rollvalet vid registrering är nativa radioknappar i fältgruppen ”Jag är...” med oförändrat utseende och synlig fokusram. Ny återanvändbar `TabList` (`components/tab-list.tsx`) med tangentbordslogik i `lib/tab-keyboard.ts` (piltangenter, Home/End, en tabbstopp, inaktiverade flikar hoppas över) och flikpaneler märkta med vald flik. Används för ungdomens och företagets profilflikar, ansökningarnas flikar, företagets Mina annonser/Ny annons (fortsatt URL-styrt), företagets ansökningsfilter, adminfiltret för rekryteringar och videosidans Spela in/Välj video. Kartans och förhandsvisningens vyväxlare samt flervalschips (annonsbyggaren, CV-hubben, matchprofil, tillgänglighet) är namngivna grupper; anställningsformens fristående label ersatt. `ModalDialog` återför fokus till öppnande kontroll när dialogen avmonteras. Global fokusram med nollspecificitet för ytor utan egen. Ingen databasändring.
- Verifierat: TypeScript, riktad ESLint (inga nya varningar), produktionsbygge med webpack och 24 offline-testsviter passerar; `test:video-retirement` uppdaterad för nya moduler. Nytt `test:accessibility` testar tangentlogik, faktisk TabList och faktisk ModalDialog-fokusåtergång samt panel-/gruppmärkning; mutationskontroll bekräftar att testet fallerar utan fokusåtergång respektive tabbstoppsreserv. Tangentbordstest i Chromium mot lokalt produktionsbygge kopplat till DevStaging med tillfälliga fiktiva QA-konton (raderade efteråt): registreringens radioval, ungdomens profilflikar inklusive dialog som öppnas med Enter och stängs med Escape med fokus tillbaka, ansökningsflikar, företagets annonsflikar med URL-byte samt företagsprofilens flikar – 49/49 kontroller godkända, inga API-anrop. Verifierat i driftsatt dev 2026-10-26 (Max / Claude): Playwright/Chromium mot https://youth-job-mvp-dev.vercel.app (DevStaging) med tillfälliga fiktiva QA-konton och QA-annonser (alla raderade efteråt, kontrollerat: 0 kvar), vid 375 och 1280 px, 10/10 med tangentbord: rollvalet är en radiogrupp ”Jag är...” där piltangent byter roll och fokus syns; ansökningarnas flikar har ett tabbstopp och piltangenter/Home/End som väljer flik, panelen är märkt med vald flik; företagsdialogen öppnas med fokus inuti och Escape återför fokus till Om företaget.
- Återstår / blockerare: Test med verklig skärmläsare (VoiceOver/NVDA) och fysisk mobil återstår; adminfiltret och videosidans flikar är inte webbtestade. På mobil saknar annonsbyggarens stegknappar beskrivande namn (bara 1/2/3).

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
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/f24-map-fallback-20261025`; [PR #106](https://github.com/vilgotdidrikson/youth-job-mvp/pull/106), implementation `7897c669`. Reserverad före kodarbete 2026-10-25. Nästa fristående punkt efter N06; kvarstående profil/AI/GDPR-, SMTP- och prisberoenden hoppas över enligt tidigare avgränsning. Endast kartans presentation/felhantering, inga databas-/AI-/profiländringar.
- Åtgärd: När kartan inte kan visas, ersätt den stora tomma kartyta med jobbkort eller en fungerande lista och tydlig växling mellan vyerna. Behåll relevanta filter och resultat.
- Klar när: Kartfel hindrar inte fortsatt jobbupptäckt och lämnar inte huvuddelen av sidan tom.
- Implementerat: Kartfel ger automatiskt full listvy med samma filtrerade jobb, antal och länkar på dator/mobil. Felkartan avmonteras; användaren kan försöka igen med ny instans eller växla vy manuellt även på dator. Stöd för start-/WebGL-/behörighetsfel, timeout, tappad kontext och saknade kartpositioner. Fokus återgår bara om det låg i kartan; jobbhämtningsfel har eget återförsök. Ingen databas-/AI-/profiländring. Se docs/F24.md.
- Verifierat: test:map-fallback kör faktiska komponenter med simulerad React/Mapbox/DOM/transport: saknad nyckel/WebGL, kastade startfel, timeout/403, lyckad stil, tile-fel, kontextförlust, resize/städning, bibehållna filter/resultat, återförsök/fokus och datafel/tomt resultat. test:job-search, test:job-discovery, test:job-workplaces, test:accessibility, TypeScript, riktad ESLint och webpack-bygge passerar.
- Återstår / blockerare: Inloggad visuell acceptans i dev på dator/mobil med blockerade kartanrop/avstängt WebGL, scroll, tangentbord/fokus, återförsök och faktisk grafikåterställning. Lokalt saknas installerad Chromium; ingen betald TinyFish eller verklig Mapbox-felkörning.

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
- Status: Pågår
- Ansvarig: Max / Claude
- Branch/PR: `claude/d05-landing-polish-20261019`; reserverad före kodarbete 2026-10-19 enligt användarens uttryckliga beställning om visuell finputs av startsidan.
- Åtgärd: Lägg en statisk kort förklaring av ungdomsjobb och matchning i första vyn. Minska tomrum där det döljer nyttan. Låt eventuell skrivmaskinsanimation vara ett komplement och respektera reducerad rörelse.
- Klar när: Besökaren förstår tjänsten utan att vänta på en animerad rubrik.
- Tillägg 2026-10-19: Leveransen omfattar även visuell finputs av hela startsidan: justering, avstånd, färgpalett, typografi och responsiv layout. Befintlig struktur, innehåll och funktion bevaras. Delad marknadsnavigation kontrolleras även på /features och /pricing.
- Tillägg från designaudit 2026-10-25 (DA-03, DA-10, DA-17 i `docs/DESIGN_AUDIT_2026-10-22_1.md`): visa produkten i första vyn (ett tydligt fiktivt swipekort i telefonram), låt skrivmaskinen animera bara sista ordet med statisk rubrik för skärmläsare och reducerad rörelse, flytta eller anpassa arbetslöshetsstatistiken till målgruppen; stoppa WebGL-bakgrunden när hjälten inte syns, när fliken är dold och vid reducerad rörelse; avsluta startsidan med Kom igång och För företag.
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
- Status: Pågår
- Ansvarig: Vilgot / Codex – logotillägg
- Branch/PR: `codex/d07-brand-logo-n24-plan-20261025`; [PR #105](https://github.com/vilgotdidrikson/youth-job-mvp/pull/105), implementation `bb04598d`. Reserverad före kodarbete 2026-10-25 på uttrycklig beställning. Endast gemensam logotyp och avgränsad uppdatering av DA-02:s ikon-/delningsbildskällor; Max/Claudes övriga DA-02-arbete och status bevaras. Övrig D07-mikrocopy ingår inte.
- Åtgärd: Rätta 1 ansökningar, blandade versaler och tekniska uttryck. Använd samma MatchnWork-namn och avsedd kontaktadress. Anpassa Tillbaka till Upptäck för företaget. Beskriv kort onboarding och manuell CV-väg korrekt; precisera lönecheck-löftet om tjänsten inte följer hela vägen.
- Klar när: Etiketter, produktlöften och kontaktvägar är konsekventa och sakligt riktiga.
- Tillägg från designaudit 2026-10-25 (DA-07 i `docs/DESIGN_AUDIT_2026-10-22_1.md`): en gemensam logotypkomponent (`components/brand-logo.tsx`, varianter full/märke och ljus/mörk) som används i marknadsnavigering och sidfot, på autentiseringssidorna, `/privacy`, ungdoms- och företagsnavigeringen och admin.
- Implementerat: Uppladdad original-PNG bevarad i public/brand. Gemensam BrandLogo i marknadsnavigation/sidfot, autentisering, onboarding, integritet, ungdoms-/företagsnavigation, Upptäck och admin. Ikonpipeline och delningsbild använder samma original; favicon 16/32/48, Apple 180, manifest 192/512 och maskbar 512.
- Verifierat: Originalfil oförändrad, ikonstorlekar/ICO-ramar och renderbar SVG kontrollerade. TypeScript, produktionsbygge, riktad ESLint utan fel (två befintliga img-varningar), test:accessibility, test:job-search, test:company-navigation och test:profile-journey passerar. Lokal produktionsserver: 200/rätt MIME för original, favicon, SVG, Apple, manifest och delningsbild; loggan finns i HTML för startsida/funktioner/priser/integritet.
- Återstår / blockerare: D07 förblir Pågår eftersom övrig mikrocopy inte ingår. Visuell acceptans i dev, inloggade ytor och fysisk mobil/appinstallation återstår; lokalt saknas installerad Chromium. DA-02:s tidigare ägare/status och övriga verifiering bevaras.

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

- Fortsättning reserverad före kodarbete 2026-10-27: Vilgot / Codex, `codex/l02-confirmation-flow-20261027`. Återanvänd Supabase Auth för ny bekräftelselänk, tydlig utgången-länkhantering och dubbelförsöksskydd. Användaren bekräftade att mejl från info@matchnwork.se når mottagaren och återställningslänken fungerar i dev efter rättad redirect-lista. Ingen ny automatiserad leveransverifiering påstås; obligatorisk verifiering aktiveras inte. Föregående leverans införd genom PR #135, merge 24e87fd.

- [ ] Klar
- Prioritet: P1
- Global ordning: 14
- Typ: Tidigare beslutad funktion / återstående införande
- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/l02-auth-email-20261027`, reserverad före kodarbete. Avgränsad första leverans: auth-mejl, miljöriktiga länkar, svenska mallar och konfigurationskontroll. SMTP-uppgifter och verklig leverans saknas; ingen produktionskonfiguration eller aktivering.
- Åtgärd: Inventera befintlig e-postkod och konfigurera fungerande avsändare och leverans. Prioritera verifiering, återställning av lösenord och fakturautskick. Koppla mallar, leveransstatus och återförsök till rätt händelser och undvik dubbla utskick. Match- och meddelandemail är en senare del, med notispreferenser.
- Klar när: Kritiska mejl når testmottagare, länkar leder till rätt miljö och misslyckade eller upprepade försök hanteras spårbart.
- Implementerat 2026-10-27: Explicit miljöriktig bekräftelseretur till /login, svenska bekräftelse-/återställnings-/e-postbytesmallar, lokala exakta returadresser och read-only hosted Auth-preflight utan känslig loggning. Inventering och anslutnings-/acceptanssteg i docs/L02.md. Inga hosted inställningar eller produktionsändringar.
- Verifierat: test:auth-email kör faktiska auth-funktioner och installerad SDK mot simulerad HTTP i tre miljöer, negativa konfigurationsprov och mallkontroller. test:account-recovery, riktad ESLint och standardproduktionsbygge inklusive TypeScript/56 routes passerar (fiktiva publika Supabase-byggvärden). Verkliga utskick har inte körts.
- Återstår / blockerare: Beslutad Zoho-avsändare: info@matchnwork.se (MatchnWork), bekräftad av användaren 2026-10-27. Kan användas efter verifierad SMTP-åtkomst, hosted konfiguration och verkliga leverans-/länkprov. SMTP-autentisering anges direkt i tjänstens inställningar. Fakturamejl och beständig leverans-/retryhantering återstår. L02 markeras inte Klar.

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

- [x] Klar
- Prioritet: P1
- Global ordning: 21
- Typ: Verifiering och komplettering av befintlig funktionalitet
- Status: Klar
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/l05-moderation-security-20261026`, [PR #127](https://github.com/vilgotdidrikson/youth-job-mvp/pull/127), införd i dev som `136ad2195982e6f49ca42b2a8a0fc6fc346b29b7`. Slutlig verifiering och konfliktfix via [PR #128](https://github.com/vilgotdidrikson/youth-job-mvp/pull/128), dev `0023105f62748cea2c32e9175c2244ed44bde57e`, verifierad READY på dev-aliasen.
- Åtgärd: Inventera blockering, rapportering, företagsverifiering och adminhantering innan ny kod skrivs. Kontrollera att rapporter kan följas upp och att blockering påverkar kommunikation som avsett. Kör negativa åtkomsttester med egna ungdoms- och företagskonton: andra profiler, ansökningar, privata CV/video, matchningar och chattar samt pausade/stängda jobb. Lägg till verkligt saknade delar och bevara RLS.
- Klar när: Obehörig åtkomst nekas, rapporter kan hanteras av rätt administratör och blockerade konton kan inte fortsätta den kommunikation som spärren avser.
- Tillägg 2026-10-18 (F26/N19): Verifiera att företaget bara når jobbspecifikt ansökningsunderlag, inte hela jobbprofilen. Testa verkliga API-/RPC-svar, direkta databasfrågor/RLS och privata CV-/videolänkar med anonym, fel företag och fel jobb/ansökan. Kontrollera även äldre alternativa åtkomstvägar och AI-belägg: inga privata utkast, råa textsamtal, avvisade AI-förslag, orelaterade profilfält eller exakt bostadsadress i strukturerat underlag. Original-CV kan innehålla kontaktuppgifter och ska motsvara ungdomens granskade delning. Dold UI är inte åtkomstkontroll. Kontrollerna är nu genomförda enligt verifieringen nedan.
- Implementerat: Blockrelation skyddad mot utomstående, rapportmålets åtkomst kontrollerad, samtidiga rapporter/beslut idempotenta, slutligt beslut låst och interna adminanteckningar skyddade. Adminvy med aktiva/avslutade ärenden, uttrycklig spara/avbryt, sparad anteckning och bevisreferenser. Kontobyte/dubbelklick/sena svar hanteras. Videouppspelning flyttad till ocachad serverväg med aktuell användar-RLS före/efter filhämtning; separat migration stänger direkt Storage-läsning efter serverpublicering. Se [L05-verifiering](L05.md).
- Verifierat: Bygge inklusive TypeScript (56 routes), riktad ESLint, moderation-/SDK-/videotester och tolv SQL-testgrupper med rollback, inklusive pausat/stängt/opublicerat jobb. Riktiga HTTP-anrop: 49 godkända kontroller med privata CV-bytes, 5 MB strömmad video, direkt Storage nekad, blockering och adminbeslut. Ett efterföljande anrop reproducerade API-retry med 40001; båda funktionerna rättade till PT409 genom migration 20261027082053. Därefter passerade tolv riktade HTTP-kontroller, inklusive båda faktiska 409-svaren, dubbelsidig avblockering och nekad företags-CV-API. Båda batcherna städade; noll testkonton/rapporter verifierat 2026-10-27. Migrationerna 20261026141513, 20261026214719 och 20261027082053 införda endast i DevStaging. Se docs/L05.md.
- Återstår / blockerare: Full fysisk mobil-/skärmläsarkontroll och kompletta inloggade resor ligger kvar i L07/L08. Redan nedladdade bytes och tidigare utfärdade CV-bearerlänkar återtas inte omedelbart vid blockering. Befintliga rådgivarvarningar hör till sina övriga uppgifter. Detta är dokumenterade avgränsningar, inte godkända tester av dessa delar.

<a id="l06"></a>
### L06 Verifiera kontots grundläggande fel- och återställningsvägar

- [ ] Klar
- Prioritet: P1
- Global ordning: 22
- Typ: Verifiering och komplettering
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/l06-account-recovery-20261027`, remote-branch och ansvar publicerade 2026-10-27 före kodarbete; bas dev `0023105`; kodcommit `8b8fe840e44fe8f3c8453098b082d2e4094aff76` (GitHub). Verifieringsprotokoll i `docs/L06.md`.
- Åtgärd: Kontrollera registrering, verifieringsmejl, glömt lösenord, säkert lösenordsbyte, utloggning och utgången session. Inventera kontoradering och rätta eventuella luckor. Hantera privata dokument och video vid radering. Genomför känsliga tester med egna konton och enligt autentiseringsverktygets regler; begär aldrig lösenord i chatten. Utökade kontoval ligger i N10.
- Klar när: Användaren kan återfå åtkomst och förstå fel utan att fastna. Sessioner och eventuell radering får det avsedda, verifierade resultatet.
- Tillägg 2026-10-19: L13 preciserar säker självbetjäningsradering och ny autentisering före export/radering. Inventera och återanvänd befintlig raderingsfunktion; verifiera även återkallad åtkomst/sessioner och faktiska filer. Vanliga lagringstider i L12 är inte i sig skäl att neka tidigare radering.
- Implementerat: Samlad förstärkning av konto-/återställningsflöden. Sessionsgeneration skyddar mot sena svar efter logout/kontobyte/avmontering; läsning har tidsgräns och verkligt nytt försök. Tillfälliga serverfel raderar inte delad session, och gamla Auth-svar loggar inte ut ett nyare konto. Logout-fel hanteras av anroparna. Isolerad lösenordsbekräftelse, robust återställningsläsning, ett lösenordsbyte vid dubbelklick, separat logout-retry efter sparat lösenord, kontobunden recovery och autofyllningssäker begäran om länk. Bekräftelsemejlets fallback hanterar olika miljöinställningar. Befintliga formulär/designtokens återanvänds. Se [L06](L06.md).
- Verifierat: Fel med gammalt profilsvar efter SIGNED_OUT reproducerat före fix. Faktiska klient-/hook-callbacks testade för logout, kontobyte, timeout/retry, avmontering och recovery; tjänstekontrakt och isolerad lösenordsbekräftelse testade. Moderation-regression passerar. 18 riktiga DevStaging/dev-HTTP-kontroller: lösenordsbyte, nekat gammalt lösenord, spärrad refresh-token efter logout samt säker kontoradering med privat PDF och nekad åtkomst efteråt. Engångskonto/filer städade och noll kvar bekräftat. Det är backend-HTTP och styrda klienttester, inte verklig mejlleverans.
- Återstår / blockerare: Verklig testinkorg/SMTP-leverans och hela återställningslänken inklusive redirect, använd/utgången länk och eventuell e-postbekräftelse (L02/L14), samt full inloggad webb-/mobil-/flerflikskontroll (L07/L08). Access-token kan leva till utgång efter logout; inga nya RLS/sessiongrants införda. DevStaging kräver för närvarande inte e-postbekräftelse; konfigurationen är inte ändrad. L06 markeras inte Klar.

<a id="l09"></a>
### L09 Verifiera CV-uppladdning och PDF-layout

- [ ] Klar
- Prioritet: P2
- Global ordning: 45
- Typ: Verifiering och eventuell designförbättring
- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/l09-cv-pdf-layout-20261026`, [PR #117](https://github.com/vilgotdidrikson/youth-job-mvp/pull/117); reserverad före kodarbete. Avgränsat till befintlig CV-export, textbevarande, sidbrytningar och visuell PDF-kontroll med fiktiva uppgifter. Tidigare profil-/AI-/GDPR-, SMTP-, pris- och andra ägares pågående punkter inväntar sina beroenden. Ingen utökning av data-/AI-flöden eller åtkomstregler; inloggad fil-/uppladdningsverifiering i hela L09 återstår separat.
- Åtgärd: Kontrollera uppladdat PDF-CV, behörig visning före match och exporterat CV. Granska faktisk PDF-layout med kort och långt innehåll, sidbrytningar, svenska tecken och läsbarhet. En startad nedladdning räcker inte som layoutverifiering.
- Klar när: Uppladdat och genererat CV kan öppnas av rätt användare och PDF:en är läsbar utan klippt text eller felaktiga sidbrytningar.
- Tillägg 2026-10-18 (N19/N21): Förhandsvisa den faktiskt delade CV-versionen, även uppladdad original-PDF med mejl, telefon eller bostadsadress. Förklara att sådant innehåll blir synligt i dokumentet och låt ungdomen byta/rätta filen före delning; dold kontaktsektion räcker inte. Påstå inte automatisk PDF-maskning. Testa behörighet och att dokumentet motsvarar delningsförhandsvisningen; detta tillägg är inte verifierat ännu.
- Implementerat: Separat ren PDF-mall och texttolkning som bevarar fristående rubriker och inledande profiltext; namn från exportens namnargument utan att ta bort avvikande första textrad. Rubrik och inledande styckerader hålls ihop, långa namn radbryts utan automatisk avstavning, sida/antal och namn på fortsättningssidor. Inbäddad Inter (statiska 400/600 från befintlig licensierad font) och 11 pt brödtext med återhållna varumärkesfärger. PDF-motorn laddas först vid export. Exporterna körs i ordning med förnyad glyphdata så upprepade/samtidiga exporter inte kan förvanska extraherbar text. Auth och hämtning av verifierad erfarenhet bevaras.
- Verifierat: Före/efter-PDF:er med fiktiv Åsa Öberg; tidigare förlust av fristående PROFIL/SPRÅK/ENSAMRUBRIK och felaktig jättestor namnrubrik reproducerad. test:cv-pdf kör riktiga PDF-exporter och PDF.js: 1, 2 och 4 sidor, svenska tecken, långa namn/URL:er, samtliga slutmarkörer, text-/sidgränser, inga ensamma avsnittsrubriker, upprepade och parallella exporter, auth-/historikfel och tomtext. Fontintegritet och licens kontrolleras. Slutliga korta/rubrikseparerade PDF:er samt alla fyra stressidor renderade med Poppler och granskade visuellt; jämförelse även med PDFium. Inter är inbäddat enligt pdffonts. test:application-disclosure, test:cv-quality, test:local-fonts, riktad ESLint och standardbygge med TypeScript passerar.
- Återstår / blockerare: Inloggat dev-flöde för verklig uppladdning, originalfil, delad CV-version och före-match-åtkomst; negativ API-/Storage-verifiering i fullständigt användarflöde och faktisk fontladdning/export i avsedda webbläsare. De lokala PDF-proverna och simulerad auth/historik är inte dessa tester. L09 förblir Pågår; inga databas-/RLS-/AI-ändringar.

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
- Tillägg 2026-10-19: L14 är lanseringsberoende för rätt avtalspart, Vercel Pro/DPA och granskade leverantörs-/AI-inställningar. Uppgradering eller ett nytt konto innebär inte automatiskt GDPR-efterlevnad.
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
- Status: För granskning
- Ansvarig: Codex
- Branch/PR: `codex/n17-job-categories-20261018`, [PR #75](https://github.com/vilgotdidrikson/youth-job-mvp/pull/75), kodcommit `07be8228c0b83f2aeab380b13f01d4e939113b33`. Reservation publicerad före kodarbete.
- Åtgärd: Behåll egen titel; föreslå rättningsbar gemensam jobbtyp från rollens titel/beskrivning, aldrig enbart företagets bransch. Använd stabila kategori-ID:n och synonymer i annons, profilönskemål och filter. Hantera äldre fria kategorier utan dataförlust, osäkra förslag och roller som ännu saknas.
- Klar när: Cafémedarbetare, caféjobb och cafépersonal hittas genom samma val Caféarbete; barista behåller sin inriktning. Ekonom på café blir inte caféarbete. Rättat förslag bevaras vid redigering/kopia/omladdning; okänd roll försvinner inte från flödet.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Implementerat: Gemensam katalog med 15 stabila kategori-ID:n/synonymer, fri titel och rättningsbar valfri klassificering (högst tre roller). Rättat/uttryckligt tomt val bevaras vid AI, kopiering, redigering och omladdning. Samma begrepp används i profilönskemål, filter och synonymtolkning; originaltexter bevaras. Additiv migrering `20261018174543_n17_job_categories.sql` införd i DevStaging. Se [N17.md](N17.md).
- Verifierat: Kategoritester med verkliga komponentcallbacks/discovery-logik, annonskopiering, arbetsplatser, företagsnavigation, matchning, profilflöde, följdfrågor och analysarbetare passerar; TypeScript och berörd ESLint passerar. DevStaging-rollbackprov verifierar kategorigränser, ägare/främmande användare, kompatibla profiler och sparning av ID:n/fritext. Säkerhetsrådgivare oförändrad (33 WARN, 8 INFO). Webpack-build passerar med 50 sidor. PR #75 publicerad mot dev.
- Återstår / blockerare: Inloggad visuell kontroll av publicering, AI/rättning, kopia/omladdning, befintlig annonsredigering, profilönskemål och filter på mobil/dator. Försiktiga regler kan lämna äldre breda eller okända roller under Övriga jobb tills företaget rättar; ingen titel/fritext masskrivs om. N18:s sortering/paginering är separat.

<a id="n18"></a>
### N18 Relevant och varierat jobbflöde

- [ ] Klar
- Prioritet: P2
- Global ordning: 13.2
- Status: För granskning
- Ansvarig: Codex
- Branch/PR: `codex/n18-feed-relevance-20261019`, [PR #79](https://github.com/vilgotdidrikson/youth-job-mvp/pull/79). Reservation publicerad före kodarbete.
- Åtgärd: Bygg vidare på N17: uttryckliga filter är hårda val; profilönskemål, plats och känd tillgänglighet ger mjuk prioritering. Ovisade annonser, publiceringstid och variation mellan företag styr därefter. Behåll spärrar för tidigare val/ansökningar; ingen automatisk återvisning/lyft vid anställning eller textredigering. Visa begriplig anledning till relevans.
- Klar när: Tom profil kan upptäcka jobb och nybörjare utesluts inte för saknad erfarenhet. Filter respekteras, resultat/paginering är stabila, flera arbetsplatser räknas en gång och ett företag tar inte över flödet. Sparade jobb fungerar separat. Inga betalda lyft aktiveras.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Implementerat: Återanvändbar sortering med ovisat först, relevans, första publicering och företagsrundor; hårda filter före sortering och direktlänkar. Stabilt urval med 20 poster per steg och återställning på ursprunglig plats om ett val misslyckas. Privata första kortvisningar och bortval före CV, med RLS/kolumngrants; tidigare val/utkast förblir uteslutna. Saknad erfarenhet spärrar inte. Inga betalda lyft i upptäcktsflödet; sparade jobb separata. Förklaringar från egna önskemål/ort och endast uttryckligen kända arbetstider. `first_published_at` skyddas av servertrigger; historiskt publicerade jobb använder skapandetid som approximation. Nyckelbaserad hämtning undviker API:s standardgräns. Kontrakt: `docs/N18.md`. Migration `20261019093616_n18_discovery_history.sql` införd i DevStaging 2026-10-19.
- Verifierat: Produktionsbygge (50 routes), TypeScript, riktad ESLint, `test:job-discovery`, `test:job-categories`, `test:job-workplaces`, `test:job-copy` och `test:profile-journey` passerar. Testerna kör faktisk sortering/historiktransport (1 201 ID:n), simulerade synlighets-API:er och fel/återförsök. Rollbacktest i DevStaging med befintliga fiktiva QA-identiteter verifierar ägande, nekad företags-/annan ungdomsåtkomst, kolumnbehörigheter, idempotens, serverdatum, oföränderlig första publicering vid redigering/paus/återöppning och FK-radering; inga testdata lämnas kvar.
- Återstår / blockerare: Inloggad visuell kontroll på mobil/dator av filter, kort/synlighetsmätning, sparade jobb, flera sidor, omladdning, för-CV-bortval och verkligt nätverksfel. Kontrollera också första publicering efter företagsverifiering i fullständigt UI-flöde. Kartmarkörer/förhämtade poster räknas inte som visade. Hela urvalet hämtas i klienten; serverbaserat urval behövs vid större volym. Ingen transaktionsögonblicksbild över hämtningens SQL-sidor.

<a id="f26"></a>
### F26 Granska matchningens rättvisa och faktaunderlag

- [ ] Klar
- Prioritet: P1
- Global ordning: 13.3
- Status: Pågår
- Ansvarig: Codex
- Branch/PR: `codex/f26-evidence-review-20261019`, [PR #81](https://github.com/vilgotdidrikson/youth-job-mvp/pull/81), avgränsad leverans 1. Fortsättning: `codex/f26-n19-application-disclosure-20261019`, [PR #82](https://github.com/vilgotdidrikson/youth-job-mvp/pull/82), för jobbspecifikt underlag och åtkomst. Reservation publicerad före kodarbete.
- Åtgärd: Granska faktiskt kriterieflöde, AI-instruktioner, regler, belägg och beräkning; F05 täckte teknisk leverans, inte detta kvalitetskrav. Ersätt den generella rutan Mer om kandidaten med jobbspecifikt ansökningsunderlag tillsammans med N19. Låt jobbkrav, relevanta belägg från godkända uppgifter och skillnaden stöd/uttrycklig motsägelse/okänd dominera. Eventuell matchprocent visas sekundärt tillsammans med täckningsgrad. Förstå likvärdiga formuleringar utan nya sakpåståenden. Märk egna exempel som självuppgivna, aldrig verifierade personlighetsomdömen eller personlighetspoäng. Använd bara relevant godkänt underlag; läck inte hela profilen genom AI-resultat. Ingen ansökan nekas eller döljs automatiskt på grund av matchningsgrad eller saknad video.
- Klar när: Synonympar som punktlig/bra på att passa tider återges rättvist med självuppgivet belägg. Fotbollstränare ger inte automatiskt punktlighet, ansvar eller ledarskap. Saknad uppgift är okänd, inte underkänd. Kriterier/belägg är primära, eventuell procent sekundär med täckningsgrad; mer text ger inte i sig bättre poäng. Inaktuella/ogranskade/avvisade AI-förslag, råa textsamtal, orelaterade profiluppgifter och känsliga attribut används inte. Företagsunderlaget har rätt jobb-/ansökningsscope även via API/databas enligt L05; ungdomen ser vilka uppgifter som används. Testa låg/okänd matchning och ingen/nekad video: ansökan är fortsatt synlig och skickas enligt ordinarie behörighets-/CV-regler.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Förtydligande 2026-10-19: AI-underlaget ska bevara allt relevant godkänt innehåll från CV (även fritext), jobbprofil, egna exempel och delade ansökningssvar samt jobbets krav/praktiska uppgifter. Begränsa inte underlaget till några få förvalda fält. Rensa känsliga uppgifter, uppgifter om lagöverträdelser och onödiga identitets-/kontaktuppgifter före AI-anropet; instruktion att ignorera dem efter överföring räcker inte. Geografisk närhet får ingå som uppskattat avstånd beräknat från postnummer, utan slutsatser om lämplighet från bostadsområde. AI-bedömning ingår i varje skickad ansökan och visas när företaget öppnar den; AI:n rangordnar inte kandidatlistor eller fattar beslut. AI-fel får inte hindra ansökan. Rättslig grund/DPIA återstår före lansering. Se den nya specifikationsdelen ”AI-underlag med bevarad bredd” i `docs/PROFIL_OCH_RELEVANS.md`.
- Tillkommande verifieringskrav: Kontrollera verklig utgående AI-payload med fiktiva blandade CV-texter: relevanta detaljer/fritext ska bevaras samtidigt som känsliga/otillåtna uppgifter utesluts före överföring. Testa indirekta avslöjanden, ofullständig dokumentläsning, osäker rensning, geografiska uppskattningar, inga AI-rangordnade kandidatlistor och ansökan vid AI-fel. Dokumentera metodens begränsningar; markera inte ett automatiskt filter som ofelbart.
- Dokumentleverans 2026-10-19: Vilgot / Codex, `codex/f26-rich-matching-plan-20261019`. Endast byggkrav och acceptanskriterier ändrade; inga produktfunktioner implementerade eller verifierade. Uppgiftens status/ägare bevaras.
- Beslut 2026-10-19 – kravinformation för ungdomen: Ungdomens vanliga vy visar vad företaget söker och vilka områden bedömningen gäller, inte den individuella AI-bedömningen eller ett personligt betyg. Arbetsgivarens källgrundade bedömning enligt F26 bevaras. Konkreta obligatoriska jobbkrav ska vara synliga; interna vikter/trösklar behöver inte visas i produktvyn. Ingen separat fullständig bedömningsvy för ungdomen beställs. Tillgång till personuppgifter och rättelse enligt L13 hanteras separat och begränsas inte av detta visningsval. Fullständig specifikation: ”Ungdomens kravinformation och kompletteringar” i `docs/PROFIL_OCH_RELEVANS.md`.
- Tillkommande klart-kriterium: Verifiera rätt annons/kravområden, synliga avgörande krav, neutrala frågor utan poänglöften, inga upprepade kända svar och frivillig komplettering utan spärr. Den vanliga vyn visar inte individuella AI-omdömen/poäng; delningsförhandsvisning och L13:s tillgång/rättelse bevaras.
- Dokumentleverans: Vilgot / Codex, `codex/f12-criteria-insight-plan-20261019`. Endast plan/specifikation ändrade och genomlästa; ingen produktkod eller webbverifiering. Befintlig status och ansvar för implementation bevaras.
- Implementerat: Första avgränsade F26-leveransen 2026-10-19: kriterier/belägg före sekundär matchgrad och täckning; självuppgivna synonymbelägg utan personlighetspoäng; gemensam lokal minimering före AI-anrop och gemensam leverantörsgräns; ingen tyst 14k/32k-kapning. Rensat underlag markeras begränsat och skapar inga nya automatiska frågor. Ny cache-engine 9 för nya beräkningar. Se `docs/F26.md` för exakt omfattning och begränsningar. Hela F26 förblir Pågår. Fortsättning 2026-10-19: jobbspecifikt, versionerat ansökningsunderlag med delningsförhandsvisning, separerad intern AI-indata, belägg begränsade till delat underlag, jobbfakta i AI-kontext, begränsade RPC/Storage/resultat/historik och ungdomens kravinformation. Engine 10 och delningsversion ersätter engine 9 för nya beräkningar. Se `docs/N19.md`. Uppföljning 2026-10-20: ungdomens kravvy begränsad till publikt annonsinnehåll, interna kriterier borttagna även ur äldre kompletterings-RPC och läses separat på servern efter ansökningsbehörighet. Tydliga fasta avsnitt för publik annons och internt bedömningsstöd, utan synlighetsval per fält. Egna källuppgifter och delningsförhandsvisning bevaras.
- Verifierat: Produktionsbygge (50 routes), TypeScript, riktad ESLint, `test:matching-fairness`, `test:matching`, `test:followup-batch`, `test:assessment-progress`, bakgrundsanalysens testspecifikation och `test:application-supplement` passerar. Den exakta utgående SDK-payloaden fångas med fiktiva blandade texter och simulerad AI-klient; ingen verklig modell-/webbverifiering.
- Fortsättning verifierad: Produktionsbygge 51 routes, TypeScript, riktad ESLint, faktisk gemensam rendering/källprojektion och PDF.js-prov för delvis läsbar PDF samt befintliga matching-/profil-/CV-regressioner. Faktiska SQL-rollbacktester före och efter införande i DevStaging: ägande, samma delning, privata fält, fel jobb/ungdom/anonym, server-RPC, alternativ jobbhistorik, CV-/resultatversion och Storage-predikat. `docs/N19.md` skiljer detta från ej utförd inloggad webb-/modellverifiering.
- Återstår / blockerare: Den nya delningsgränsen är byggd/SQL-testad men inloggat end-to-end-flöde, riktiga filnedladdningar och verklig modellbedömning återstår. Tillförlitlig geografisk uppskattning och N19:s fullständiga profilfakta/CV-urval återstår. Heuristisk minimering kan missa namn/okända indirekta känsliga uppgifter och får inte betraktas som ett fullständigt integritetsskydd; fortsatt metod- och rättelseverifiering krävs före lansering. Inloggade flöden, verklig modellbedömning, negativa åtkomsttester samt ansökan vid AI-fel/ingen video återstår.

<a id="n19"></a>
### N19 Samlad jobbprofil och ett kort grund-CV

- Fortsättning 2026-10-26, Vilgot / Codex, `codex/n19-followup-race-20261026`: Reserverad i arbetschatten och med publicerad branch före kodarbete. Reproducerat att långsam första läsning av kompletteringsfrågor kan skriva över nyare svar efter manuell bedömningsuppdatering. Den första läsningen kontrollerar nu samma revisionsräknare som senare läsningar. Inga nya anrop, datafält, modellinställningar eller åtkomster. Regressionstest kör verkliga effekter och levererar svar i omvänd ordning; det fallerade före rättningen och passerar efter. N19 förblir Pågår; inloggad server-/webbverifiering återstår. Verifierat lokalt: `test:assessment-progress`, riktad ESLint och standardproduktionsbygge inklusive TypeScript och 55 routes passerar. Lokalt kodunderlag: `fa8ad3b`; publicerad leverans följs på branch `codex/n19-followup-race-20261026` och dess PR till dev.


- Avgränsad fortsättning 2026-10-26, Vilgot / Codex, `codex/n19-assessment-history-20261026`: Historik för matchningsbedömningar får egen laddning/fel/återförsök och 15 s tidsgräns. Läs först när historiken öppnas, avbryt vid stängning/byte och läs om vid ny bedömning. Återanvänder befintlig kandidats-/jobbisolering, datakälla och RLS; inga nya datafält i databasen, modell-/videoflöden eller åtkomster. Reservation redovisad i arbetschatten före kodändring; GitHub-publicering godkänd av användaren 2026-10-26 efter föregående automatiska granskningsspärr. Ingen annan ägares arbete övertas och hela N19 behåller status Pågår.
- Implementerat lokalt i denna fortsättning: Egen historikkomponent med infällbar, behovsstyrd läsning; separat laddning/fel/återförsök, 15 s gräns via gemensam latest-read, dubbelklicksspärr och avbrott vid stängning/avmontering. Ny bedömningsversion eller kandidat/jobb ger nytt historikinnehåll. Historikfel skriver inte längre över fel/status för aktuell bedömning. Befintlig tabell/RLS, avgränsning på jobb+ungdom, fallande datum och högst 20 rader bevaras. Felaktigt scoperade/ofullständiga svar avvisas före rendering. Enkel CSS-modul med befintliga färg-/texttokens, tangentbordsfokus och 44 px kontroller; inga extra guider eller statistikpaneler.
- Verifierat lokalt: `test:assessment-history` kör verkliga komponentcallbacks/effekter och installerad Supabase-SDK med simulerad HTTP-transport: rätt filter/ordning/gräns/signal, tomt/nekad läsning, fel jobb/ungdom, ogiltig data, sen respons efter tidsgräns, retry/dubbelklick, stängning/avmontering, Strict Mode och nya scope-/versionsnycklar. `test:assessment-progress`, `test:disclosure-loading`, `test:application-disclosure`, riktad ESLint, TypeScript och standardproduktionsbygge (55 routes) passerar. En första fristående TypeScript-körning fann gamla genererade .next-typfiler för borttagna layouts; bygget regenererade filerna och efterföljande TypeScript passerade.
- Leverans för historikdelen: [PR #121](https://github.com/vilgotdidrikson/youth-job-mvp/pull/121), `codex/n19-assessment-history-20261026`. Publicerad källa matchar det lokalt testade Git-trädet; Vercel-status följs för PR och dev. Återstår: verklig inloggad browser-/databaskontroll på dator och mobil. Ingen ändrad behörighet eller migration; simulerade SDK-tester räknas inte som verkliga negativa RLS-tester. N19 förblir Pågår.



- Fortsättning reserverad 2026-10-26, Vilgot / Codex, `codex/n19-disclosure-loading-20261026`: kandidat-/jobbisolerad läsning av befintligt delningsunderlag, begränsad laddning och återförsök i företagsvy och ungdomens förhandsvisning. Misslyckat byte av delningsval ska inte lämna gamla val skickbara. Återanvänder befintliga RPC/behörigheter; inga nya personfält, AI-anrop eller databasändringar. Profilarkiv/N20 och nya AI-dataflöden inväntar befintlig GDPR-avstämning enligt planen.
- Bygguppföljning reserverad före ändring 2026-10-26 i samma PR #116: L01/N19, Vilgot / Codex, `codex/n19-disclosure-loading-20261026`. Vercel-loggen för preview `dpl_GSWyVovUu4zmrFYi4HSwfwNgWZwy` visar Turbopack/next-font-importfel för Fraunces på commit `6f795ea`. Standardisera npm build till det tidigare verifierade Webpack-bygget. Ingen produktionsdriftsättning, miljövariabel eller Vercel-projektinställning ändras.
- Utökad bygguppföljning reserverad före ändring: Webpack gav också next/font-fel i samma Vercel-projekt (`Cannot read properties of null` i Googles font-loader). Bevara Inter/Fraunces genom att checka in de oförändrade WOFF2-filerna och unicode-intervallen från det lyckade lokala bygget, med OFL-licenser och samma fallback-mått. Ta bort Googles bygghämtning och återställ standardbundlern; verifiera båda Vercel-previewprojekten. Ingen produktionspublicering.
- Slutlig byggfix för PR #116: oförändrade Inter/Fraunces-WOFF2-filer lagras med licenser/integritetsmanifest i public/fonts. Samtliga tidigare unicode-intervall, vikter, fallback-mått och Latin-preloads bevaras i app/fonts.css; Googlefont-hämtning under bygget tas bort. npm build använder åter Next.js standardbundler. `test:local-fonts`, standard-Turbopack-bygge/TypeScript, riktad ESLint och disclosure-loading passerar lokalt. Visuell acceptans och remote-previewkontroll särredovisas. Font-face-deskriptorn 100–900 är bevarad från originalfonten, ingen ny UI-vikt.



- Implementerat i [PR #116](https://github.com/vilgotdidrikson/youth-job-mvp/pull/116): Kandidat-/jobbisolerad företagsvy och konto-/jobbisolerad ungdomsvy. Gemensam läshantering med 15 s gräns, avbrott, senaste svar gäller, feldisplay och återförsök. Företagsvyn tar bort föregående underlag direkt vid kandidatbyte/ny åtkomstkontroll. Ungdomens egna tidigare förhandsvisning kan ligga kvar under ny läsning men skickandet spärras även i händelsehanteraren; önskade delningsval bevaras vid fel och snabb ändring. Ansökningsstatus måste läsas utan fel och återkallad ansökan öppnar inte delningsformuläret. Dubbelklick spärras synkront och ett avmonterat formulär startar inte nästa sändningssteg eller navigering. Responsiv förhandsvisning med befintliga tokens/ytor och återanvändbar komponent för laddning/fel, utan nya guider eller datafält.
- Verifierat för PR #116: `test:disclosure-loading` kör riktiga komponentcallbacks/effekter, race/timeout/avbrott, ny kandidat/jobb/konto, Strict Mode-omstart, felaktigt scoperat RPC-svar, bevarat önskat urval, spärrat inaktuellt skickande, dubbelklick, lyckad delning/sändning respektive uppdatering utan omsändning, återkallelse och installerad Supabase-SDK med simulerad HTTP-transport (rätt parametrar/filter och signal). `test:application-disclosure`, `test:cv-document`, `test:application-withdrawal`, riktad ESLint och TypeScript/webpack-produktionsbygge passerar. Ingen verklig inloggad webb-/databasverifiering påstås för denna leverans.
- Återstår för PR #116: visuell/inloggad kontroll på dator/mobil och verkliga samtidiga serverhändelser. Redan påbörjad serverlagring kan slutföras efter att vyn lämnats; UI-avbrott är ingen rollback. Befintlig design-tokenkontroll förblir underkänd (562 färgliteraler, 58 radier; denna leverans lägger enbart till referens till befintlig `--text-2xl`, ingen ny rå färg/textstorlek/vikt/radie). Baslinjen ändras inte. Hela N19 förblir Pågår.


- Avgränsad fortsättning reserverad 2026-10-26, Vilgot / Codex, `codex/n19-disclosure-view-20261026`: gemensamma ansökningsunderlagets layout/komponenter och begränsad CV-hämtning med återförsök. Samordnas med F26 och DA-12 i just denna komponent. Ingen databas-/delningsändring och inget övertagande av DA-04–DA-06; övriga N19-delar/status bevaras.
- Föregående leverans införd i dev genom [PR #115](https://github.com/vilgotdidrikson/youth-job-mvp/pull/115), merge `6f3bfb7`: Gemensam CSS-modul för ansökningsunderlagets rubriker, CV, praktiska fakta, valda uppgifter och svar; samma innehållskomponent för ungdom/företag. CV-hämtning har 15 s tidsgräns, dubbelklicksspärr, återförsök, stängt popupfönster vid fel/avbrott och skydd mot sen navigering efter byte av underlag. Befintlig CV-åtkomst, 5 min signerad länk och originalfilsvarning bevaras; inga nya databasregler.
- Verifiering av denna leverans: `test:cv-document`, `test:application-disclosure`, `test:matching-fairness`, `test:assessment-progress`, TypeScript, riktad ESLint och webpack-produktionsbygge passerar. CV-testet kör faktisk dokumentöppningslogik med simulerat fönster/transport: lyckat svar, blockerad popup, nekat svar, uteblivet/sent svar, avbrott, saknad URL, stängt fönster och nytt försök. Ingen verklig filnedladdning eller inloggad webbverifiering påstås.
- Begränsning för denna leverans: Chromium saknas och nedladdningen gav ogiltigt arkiv; visuell kontroll vid 375/768/1280 px och fysisk mobil återstår. `check:design-tokens` underkänns redan på aktuell dev (562 färgliteraler mot baslinje 555, radier 58 mot 57). Den nya CSS-modulen tillför inga färgliteraler eller råa storleks-/vikt-/radievärden; kontrollen räknar även fyra nytillkomna referenser till befintliga texttokens och två vikttokens som nya värden. Baslinje/kontrollskript och andra ägares CSS är inte ändrade. N19 förblir Pågår.


- [ ] Klar
- Prioritet: P2
- Global ordning: 13.4
- Status: Pågår
- Ansvarig: Codex
- Branch/PR: `codex/f26-n19-application-disclosure-20261019`, [PR #82](https://github.com/vilgotdidrikson/youth-job-mvp/pull/82), samordnad F26/N19-leverans; reservation publicerad före kodarbete.
- Åtgärd: Gör Bygg din profil till övergripande flöde. Återanvänd F02/F03/F15/F18 och separera godkända profilfakta, CV-urval och privat arbetsmaterial. Ett generellt granskat grund-CV, normalt en sida, upp till två vid behov; ingen tyst kapning vid 500 ord. Företaget får ett jobbspecifikt ansökningsunderlag, inte generell tillgång till hela jobbprofilen: granskat CV, relevanta direkt läsbara praktiska uppgifter (tillgänglighet, tidigaste start, ungefärligt bostadsområde), F26:s kriterier/belägg och svar/frivillig video uttryckligen delade för aktuell ansökan. Använd postnummer vid behov, inte exakt bostadsadress. Bevara arbetsplatsens adress i annons/karta. Låt ungdomen förhandsvisa verklig delning och förstå vilka godkända uppgifter som används i matchningen, inklusive kontaktuppgifter som kan finnas i uppladdat CV. Begränsa åtkomsten även i API/RPC/databas/RLS och privata fillänkar; returnera inte hela profilrader för klientfiltrering.
- Klar när: Alla skapande-/redigeringsvägar använder samma granskningskrav och aktuella faktakällor. Ungdomen kan välja/rätta CV-urval, pausa/fortsätta och förhandsvisa delat ansökningsunderlag för rätt jobb inklusive PDF-innehåll/kontaktuppgifter. Dokumentera hantering av ändringar/versioner av redan skickat underlag. CV är kort/läsbart enligt L09; fler godkända fakta kan finnas i egen profil utan generell företagsåtkomst. Praktiska fakta är läsbara utan AI. Privata utkast, råa textsamtal, avvisade/ogranskade AI-förslag, orelaterade uppgifter och exakt bostadsadress läcker inte genom strukturerade företagsdata eller AI-belägg; original-CV hanteras med uttrycklig granskad delning. L05:s negativa API-/databastester passerar. Låg matchningsgrad/saknad video stoppar eller döljer inte ansökan.
- Tillägg 2026-10-20 (F12/N19): Godkända generella fakta ur kompletteringssvar ska kunna stärka jobbprofilen och återanvändas i senare ansökningar utan upprepade frågor. Fråga uttryckligen efter varje nytt svar om det ska sparas i profilen för återanvändning; inget förvalt ja och inget automatiskt profilsparande vid nej eller uteblivet val. Bevara ungdomens kontroll, källa, sammanhang, aktualitet och skillnaden mellan profilsparning och jobbspecifik delning. Detaljer och acceptanstest finns under F12 ovan. Ingen tyst uppdatering av redan skickade ansökningsversioner eller automatisk överföring till grund-CV:t. Implementation inväntar samordning med pågående profil-/GDPR-beslut.
- Specifikation: `docs/PROFIL_OCH_RELEVANS.md`, beslutad 2026-10-18.
- Förtydligande 2026-10-19: Bevara relevanta CV-detaljer och godkända profilfakta även utanför korta grund-CV:t. Intern AI-användning och företagets jobbspecifika åtkomst är separata; ingen generell profilåtkomst införs. Behåll källor, sammanhang och förhandsvisning av underlaget. Hantera original-CV separat från rensad AI-indata och beräkna ungefärlig närhet från postnummer utan att skicka exakt bostadsadress. Se den nya specifikationsdelen ”AI-underlag med bevarad bredd” i `docs/PROFIL_OCH_RELEVANS.md`.
- Tillkommande verifieringskrav: Kontrollera verklig utgående AI-payload med fiktiva blandade CV-texter: relevanta detaljer/fritext ska bevaras samtidigt som känsliga/otillåtna uppgifter utesluts före överföring. Testa indirekta avslöjanden, ofullständig dokumentläsning, osäker rensning, geografiska uppskattningar, inga AI-rangordnade kandidatlistor och ansökan vid AI-fel. Dokumentera metodens begränsningar; markera inte ett automatiskt filter som ofelbart.
- Dokumentleverans 2026-10-19: Vilgot / Codex, `codex/f26-rich-matching-plan-20261019`. Endast byggkrav och acceptanskriterier ändrade; inga produktfunktioner implementerade eller verifierade. Uppgiftens status/ägare bevaras.
- Beslut 2026-10-19 – kravinformation för ungdomen: Behåll förhandsvisning av verkligt delade uppgifter och vilka godkända källuppgifter matchningen använder. Skilj den från ”Se vad företaget söker”, som visar annonsens kravområden utan exakt individuell AI-bedömning. Håll även CV-feedback enligt N21 separat. Kompletteringar förklarar neutralt vilken relevant uppgift som saknas; svar/rättelse/avstående får inte blockera ansökan. Fullständig specifikation: ”Ungdomens kravinformation och kompletteringar” i `docs/PROFIL_OCH_RELEVANS.md`.
- Tillkommande klart-kriterium: Verifiera rätt annons/kravområden, synliga avgörande krav, neutrala frågor utan poänglöften, inga upprepade kända svar och frivillig komplettering utan spärr. Den vanliga vyn visar inte individuella AI-omdömen/poäng; delningsförhandsvisning och L13:s tillgång/rättelse bevaras.
- Dokumentleverans: Vilgot / Codex, `codex/f12-criteria-insight-plan-20261019`. Endast plan/specifikation ändrade och genomlästa; ingen produktkod eller webbverifiering. Befintlig status och ansvar för implementation bevaras.
- Implementerat: Jobbspecifikt ansökningsunderlag och gemensam delningsförhandsvisning, explicit val av extra profiluppgifter, sparad CV-/ansökningsversion och kontrollerad uppdatering. Intern AI-indata separeras från företagsåtkomst; gamla RPC:er, bekräftad jobbhistorik, Storage och AI-resultat begränsas till delningen. Ungdomens kravinformation visar inga individuella betyg/vikter. Ingen tyst 500-ordskapning; gemensam granskning visar ordantal. Två migreringar införda i DevStaging: `20261019155114_n19_application_disclosures.sql`, `20261019155522_n19_private_disclosure_rpcs.sql`. Se `docs/N19.md`. Uppföljning 2026-10-20: publika krav separata från interna kriterier även i nya/äldre utkast; RPC-/databastester efter införd migration, renderings-/frågebatchregressioner och produktionsbygge passerar. Inloggad visuell kontroll återstår; denna avgränsning gör inte hela N19 Klar.
- Verifierat: Produktionsbygge (51 routes), TypeScript, riktad ESLint, `test:application-disclosure` och relevanta matching-/fråge-/profil-/CV-regressioner passerar. Rollbacktest i faktisk DevStaging verifierar samma företag/ungdomspaket, ägande och negativa åtkomster, versions-/stale-skydd, nästlade privata anteckningar/bilagor, alternativ jobbhistorik och Storage-predikat. Rådgivare körda; privata tabellens RLS utan klientpolicy och nya oanvända FK-index är avsiktliga informationsnotiser.
- Återstår / blockerare: Hela N19 förblir Pågår. Fullständig separering mellan alla godkända profilfakta och CV-urval återstår; nuvarande CV-synkning är inte ett generellt profilfaktaarkiv. Tillförlitlig postnummerbaserad närhet, inloggad mobil/dator, verkliga filnedladdningar, modell-/minimeringsverifiering och L09:s PDF-layout återstår. Live-testet `test:cv` kunde inte köras utan lokal API-server (ECONNREFUSED); räknas inte som godkänt. Se detaljer i `docs/N19.md`.


- Beslut 2026-10-25: Chatten bygger hela jobbprofilen, inte bara CV:t. Startvalen är Bygg med AI-chatt och Fyll i själv. Båda använder samma profilfakta och kan bytas utan omstart eller dataförlust. Samtalet täcker jobbönskemål, erfarenheter från arbete/skola/fritid, kunskaper, språk, egna exempel och praktisk tillgänglighet; återanvänd kända uppgifter. Visa en redigerbar sammanställning under samtalet. Efteråt granskar ungdomen Din jobbprofil och Ditt CV separat; CV:t är ett kort urval. Hoppa över, pausa och fortsätt senare ska fungera. Ingen publicering, matchningsanvändning eller ändring av skickade ansökningar utan relevant uttrycklig granskning. Nya egenskaper/lärdomar kräver bekräftelse; råchatten är privat arbetsmaterial och inget matchningsunderlag. Detta är beslutat produktflöde, inte implementerad chatt eller godkända nya AI-dataflöden.

<a id="n20"></a>
### N20 Bygg hela jobbprofilen med chatt eller formulär

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


- Beslut 2026-10-25: Chatten bygger hela jobbprofilen, inte bara CV:t. Startvalen är Bygg med AI-chatt och Fyll i själv. Båda använder samma profilfakta och kan bytas utan omstart eller dataförlust. Samtalet täcker jobbönskemål, erfarenheter från arbete/skola/fritid, kunskaper, språk, egna exempel och praktisk tillgänglighet; återanvänd kända uppgifter. Visa en redigerbar sammanställning under samtalet. Efteråt granskar ungdomen Din jobbprofil och Ditt CV separat; CV:t är ett kort urval. Hoppa över, pausa och fortsätt senare ska fungera. Ingen publicering, matchningsanvändning eller ändring av skickade ansökningar utan relevant uttrycklig granskning. Nya egenskaper/lärdomar kräver bekräftelse; råchatten är privat arbetsmaterial och inget matchningsunderlag. Detta är beslutat produktflöde, inte implementerad chatt eller godkända nya AI-dataflöden.

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
- Branch/PR: `codex/n22-remove-profile-video-20261018`, [PR #72](https://github.com/vilgotdidrikson/youth-job-mvp/pull/72), implementation `ed84bc6`; reservation `d062063` publicerad före kodarbete.
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
- Status: För granskning (video samt ansöknings-/textchattgrund; aktivering och övriga kategorier återstår)
- Ansvarig: Codex
- Branch/PR: `codex/l12-video-retention-20261018`, [PR #73](https://github.com/vilgotdidrikson/youth-job-mvp/pull/73), kodcommit `25c7d40c79248582948caaad0b9ad94d4305f570`. Reservation före kodarbete; 14-dagars åtkomstgräns och gallring för chattvideo, med återanvändbar grund för N23. Övriga L12-kategorier och N23 aktiveras inte i denna leverans.
- Pågående 2026-10-27: Vilgot / Codex, `codex/l12-application-chat-retention-20261027`, remote-reservation publicerad före kodarbete från dev `56694c6`. Sammanhängande ansöknings-/chattlivscykel och gallringsgrund; ingen aktivering av kontogallring eller produktionsschema. Tidigare videoleverans och verifieringsnivå bevaras.
- Kodreferens 2026-10-27: `78ac09a696ca33035d20d4e8940f992f7f39fb12`, branch `codex/l12-application-chat-retention-20261027`, mål `dev`. Hela L12 förblir För granskning.
- Leverans 2026-10-27: Serverstyrda avslut, sexmånadersgräns för ansökningsunderlag och sex-/tolvmånadersgränser för textchatt; privata klockor, atomisk/idempotent arbetare och ägarskyddad klientstatus. Migration `20261027095353_l12_application_chat_retention.sql` införd i DevStaging. Båda enforcement-flaggorna och cron är avstängda; inga körningsloggar. Se [L12_APPLICATION_CHAT.md](L12_APPLICATION_CHAT.md).
- Verifiering 2026-10-27: Nio SQL-rollbackgrupper, N19/L05-regressioner, faktiska klient-/hooktester, ansöknings-/videoregressioner, riktad ESLint och produktionsbygge med TypeScript/56 routes passerade. Åtta verkliga HTTP-kontroller före gallring passerade inklusive privat PDF. Eftergallringens HTTP-prov återstår efter verktygsfel och miljöavbrott; får inte räknas som godkända. Testungdom raderad via eget konto-API (204), noll testfiler; fyra andra dolda testkonton kvar eftersom mutationsverktyget ger `Invalid or expired requestState`. Rättslig grund, äldre/övergivna ärenden, separata kategorier, kontopåminnelser, samtidighet, visuella mobilprov och backup-/cachekontroll återstår före aktivering. Hela L12 är fortfarande För granskning.
- Verifieringsuppföljning: Codex, `codex/l12-storage-verification-20261018`, [PR #74](https://github.com/vilgotdidrikson/youth-job-mvp/pull/74), verifieringscommit `7b499b0bd8bd25165811094b5c0a999b5c1e460b`. Användaren godkände 2026-10-18 uttryckligen det avgränsade verkliga filtestet i DevStaging: två fiktiva filer genom tillfällig tokenkontrollerad serverfunktion. Automatisk gallring förblir avstängd.
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
- Implementerat 2026-10-18: Videodelens serverstyrda 14-dagars åtkomstgräns, 24 timmar för oskickade uppladdningar, skydd mot förlängning, operationstyrd Storage-hämtning utan nya signerade länkar, exakt utgångstid och neutral markering i spelaren. Gallringsarbetaren är nu driftsatt i DevStaging efter användarens uttryckliga godkännande av filtestet. Schemat förblir avstängt. Migrering `20261018170906_l12_video_retention.sql` införd i DevStaging. Se [L12_VIDEO.md](L12_VIDEO.md) för omfattning och begränsningar.
- Verifierat: Lokala videotester, matchnings-/profilregressioner, TypeScript och berörd ESLint passerar. DevStaging-rollbacktester verifierar åtkomstgränser, tidsmutation, delade referenser, återtagning/återförsök, rapportundantag och metadata. SQL-test simulerar lyckad filradering. Separat godkänt verkligt test: två syntetiska filer uppladdade/raderade, borttagna filer ej hämtbara, metadata rensade och upprepning utan nya jobb. Ordinarie Edge-handler återställd till version 2; verkliga HTTP-prov ger 401 utan/fel token och 200 med rätt token. De fyra befintliga filerna/metadata är oförändrade och enabled=false. Samma 33 säkerhets-WARN; två förväntade INFO för stängda privata arbetartabeller. Webpack-byggnad passerar (50 sidor); PR #73 införd i dev (`3e1c771`), dev-deployment success. Uppföljningen ändrar bara verifieringsdokumentation.
- Återstår / blockerare: Det tidigare automatiska granskningsavslaget är löst genom användarens uttryckliga godkännande och det verkliga filtestet passerar. Schemakonfiguration är fortfarande avstängd; verkligt transportfel/återförsök över tid återstår. Inloggat/visuellt HTTP-/uppspelningsprov, verklig samtidighet, rapportundantagens avgränsning, avvecklade profilfiler samt alla övriga L12-kategorier, rättslig grund och backupinventering återstår. N23 får inte aktiveras på basis av denna del.


## Användarrättigheter och leverantörer – beställt 2026-10-19

Dokumentationsleverans: `codex/l13-l14-gdpr-plan-20261019`. L13/L14 är nya krav och kontroller, inte införda funktioner eller verifierade kontoändringar. Inget nytt konto, abonnemang, leverantörsavtal eller datadelning aktiveras genom detta dokument. Pågående leveranser och L12:s status bevaras.

<a id="l13"></a>
### L13 Automatisk personuppgiftsexport och användarrättigheter

- [ ] Klar
- Prioritet: P1, före skarp lansering
- Global ordning: 22.2
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: Implementationsägare/branch reserveras separat före kodarbete.
- Beslut: Automatisk export är huvudlösningen, inte enbart ett manuellt ärende. Manuell hjälp finns som komplement för frågor, fel, avgränsningar och begäranden som kräver särskild bedömning.
- Samordning: L05/L06 (behörighet, session och befintlig radering), L12 (gallring och undantag), F20 (information/kontakt), N19/F26 (profil och härledda bedömningar), N10 (övriga kontoval). Håll gemensam export-/raderingslogik återanvändbar för framtida mobilapp.

#### Funktion och omfattning

- Lägg Integritet och personuppgifter under Inställningar i båda rollerna. Ge ingångar till Ladda ned mina uppgifter, rättelse, Radera mitt konto och kontakt om integritet. En person utan åtkomst till sitt konto ska också kunna kontakta verksamheten; kräv inte enbart inloggad självbetjäning.
- Export kräver ny autentisering med en säker metod som passar kontot. Kontrollera ägarskap/behörighet vid beställning och hämtning; skydda mot gissade export-ID:n och obehörig hämtning. Be inte användaren skicka lösenord, API-nycklar eller rutinmässigt ID-kopior i chatt/mejl.
- Leverera en lättläst sammanställning, strukturerade uppgifter (exempelvis JSON) och relevanta befintliga filer. Inventera samtliga datakällor: konto, aktuell profil/CV, ansökningar och svar, matchningar, chattar, relevanta aktivitets-/statusuppgifter och personuppgifter i AI-bedömningar inklusive relevanta historiska versioner och privat arbetsmaterial som fortfarande behandlas. Exportera inte redan gallrade filer eller återskapa dem från backup för detta ändamål.
- Registerutdrag är mer än att hämta CV eller göra en databasdump. Ta även med tillämplig information om ändamål, uppgiftskategorier, mottagare, lagringstider/kriterier, källor där relevant, rättigheter och klagomål till IMY samt information om profilering/automatiserade beslut i den utsträckning som krävs. Skilj rätten till tillgång från dataportabilitet; en JSON-fil uppfyller inte ensam alla informationskrav.
- Bedöm andra personers rättigheter innan chattar, företagsanteckningar eller gemensamma underlag lämnas ut. Gör avgränsade maskeringar där det behövs; undanta inte all konversationshistorik slentrianmässigt och exportera aldrig andra personers hela profiler, hemligheter eller interna åtkomstnycklar.
- Skapa exportpaket privat och tillfälligt, med kortlivad behörig hämtning och automatisk fysisk radering efter en dokumenterad kort tidsfrist. Bestäm exakt tidsfrist före införandet. Visa skapande, klart, fel och utgånget paket; tillåt nytt försök utan dubbla obegränsat kvarvarande paket. Skicka inte exportinnehåll till externa analys-/AI-tjänster för formatering. Logga minimala tekniska uppgifter, inte innehållet.
- Rättelse: låt användaren redigera profil/CV och anmäla fel i matchningsunderlaget. Hantera uppdatering av härledda AI-bedömningar och eventuell information till mottagare enligt tillämpliga krav; gammal bedömning får inte fortsätta visas som aktuell efter rättat underlag.
- Kontoradering: tydlig konsekvensbeskrivning och säker bekräftelse med ny autentisering. Återanvänd och granska befintlig funktion före ny implementation. Omfatta konto, sessioner/åtkomst, profil, CV, media, exportpaket och relaterade uppgifter som ska raderas. Enbart dold profil eller raderat Auth-konto räcker inte. Hantera delade data, säkerhetskopior och separat motiverat bevarande enligt L12; informera vad som eventuellt behålls, varför och hur länge. L12:s normala lagringstider är inte ett generellt hinder mot tidigare radering.
- Erbjud kontakt för tillgång, rättelse, radering, begränsning, invändning och dataportabilitet där tillämpligt. Utse intern ansvarig och bevaka begäranden utan onödigt dröjsmål, normalt inom en månad. Automatiken får inte ersätta individuell prövning när det behövs. Verifiera identitet proportionerligt utan onödig insamling.

#### Klar när

- Jämför exporten mot en dokumenterad datainventering med fiktiva ungdoms-/företagskonton; profil/CV ensamt är inte godkänt. Kontrollera begriplig sammanställning, JSON, svenska tecken, filer och rättighetsinformation.
- Negativa tester: anonym, annan ungdom, annat företag, utgången länk, gammal session, dubbla jobb, fel under skapande/hämtning och samtidig kontoradering. Inga tredjepartsuppgifter eller hemligheter läcker; tillfälliga paket städas faktiskt även efter fel.
- Verifiera rättelse och hantering av inaktuella bedömningar samt självbetjäningsradering inklusive filer/åtkomst och dokumenterade undantag. Kontaktväg och intern rutin fungerar även när automatiken eller inloggningen inte gör det.
- Implementerat: —
- Verifierat: Dokumentationskrav genomgångna; ingen export/radering eller kontokonfiguration ändrad i denna leverans.
- Återstår / blockerare: Datainventering, kontaktadress/ansvarig, exakt exportpaketsfrist, rättighetsbedömning, implementation och verifiering.

<a id="l14"></a>
### L14 Verifiera leverantörsavtal och produktionskonton

- [ ] Klar
- Prioritet: P1, före behandling av riktiga användaruppgifter i skarp tjänst
- Global ordning: 22.3
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: Implementations-/kontrollägare reserveras separat.
- Samordning: L10 (Vercel/lansering), L12 (lagring/backup), F20 (integritetstext), L13 (export/radering hos leverantörer). Slutlig avtalspart/personuppgiftsansvar för UF-verksamheten fastställs separat; kontots visningsnamn eller en framtida ägarandel avgör inte i sig GDPR-rollen.

#### Känt från användaren – ännu inte kontoverifierat

- Supabase, Vercel, OpenAI och Mapbox står i användarens namn; extern utvecklare har även owner-roll hos Supabase/Vercel. Separata personliga inloggningar, tvåfaktorsautentisering och minsta nödvändiga behörighet är målet; delade lösenord är inte ett teamupplägg. Utred behovet av dubbla owner-roller.
- Produktionsdatabasen anges ligga i West EU (Ireland). Kontrollera primär lagring, filer, backup, supportåtkomst, CDN, loggar och underleverantörer separat; EU-region är inte en garanti att all behandling stannar inom EU/EES.
- Vercel är Hobby och ska flyttas till Pro. Verifiera flytt och tillämpligt DPA före skarp behandling; kontrollera även tjänstevillkorens begränsning av Hobby till personlig icke kommersiell användning. Gratis tjänst innebär inte automatiskt icke kommersiell verksamhet.
- Ny OpenAI-organisation/kundupplägg planeras, liksom flytt/separering av Mapbox. Ett nytt personligt inloggningskonto är inte i sig ett rättsligt krav; kontrollera rätt organisation/projekt, avtalspart, fakturering och åtkomst. Flytta/rotera projektnycklar säkert utan driftavbrott och håll dev/produktion separata.
- Användaren uppger ingen separat besöksstatistik, felövervakning eller spårning. Verifiera kod, beroenden, plattformsinställningar, cookies och kartans nätverksanrop; tekniska loggar kan ändå behandla personuppgifter.
- Användaren minns inte DPA-acceptans. Status är inte verifierad, inte konstaterat saknat avtal. Fastställ om DPA ingår i tillämpliga standardvillkor eller kräver separat anslutning; signera inte dubbelt av slentrian.

#### Kontroller före lansering

- Dokumentera per leverantör: tjänst och ändamål, datafält som skickas, roll(er), rätt kund/avtalspart, tillämpligt DPA med version/datum/acceptansunderlag, underleverantörer, behandlingsländer, överföringsmekanismer och eventuell ytterligare bedömning, åtkomst, lagring samt export-/raderingsmöjligheter. Publicerade standardavtal är inte bevis på att rätt avtal gäller för kontot.
- Supabase: verifiera aktuellt avtal för respektive organisation, region och behandling utanför regionen. Vercel: verifiera Pro-kundupplägg/DPA, serverregioner och logginnehåll; abonnemangsbyte ensamt gör inte tjänsten GDPR-anpassad.
- OpenAI: stäng av frivillig delning av indata/utdata, feedback och utvärderings-/finjusteringsdata för MatchnWorks produktionsprojekt. Rekommenderad produktionsinställning är API call logging avstängd; felsökning med fiktiva data kan ske avgränsat i dev. Kontrollera verklig effekt och aktuella villkor. Datadelning för träning, dashboardloggar, säkerhetsloggar och API-funktioners lagring är separata frågor; avstängd loggning innebär inte noll lagring.
- Granska kodens AI-anrop, inklusive `store: false` där det stöds och passar funktionen, eventuell promptcache och andra lagringsfunktioner. Minimera skickade uppgifter; identitetsfält kan finnas i fri CV-/PDF-text trots att strukturerade fält utelämnas. Kontrollera logglagring, geografisk behandling och avtalsvillkor innan information till användare fastställs.
- Egna felsökningsloggar ska prioritera request-ID, felkod, tid och annan minimal teknisk metadata; undvik CV-text, chattinnehåll, hemligheter och hela AI-payloads. Metadata kan också vara personuppgifter och behöver avgränsad åtkomst/lagring.
- Mapbox: verifiera roll/DPA och vilka IP-, plats-, sök- och telemetriuppgifter som faktiskt skickas. Framtida mejlleverantör läggs till innan den används med riktiga uppgifter.
- Referenser att återkontrollera vid genomförandet: https://supabase.com/legal/customer-resources/data-processing-addendum ; https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq ; https://vercel.com/legal/dpa ; https://vercel.com/docs/plans/hobby ; https://openai.com/policies/data-processing-addendum/ ; https://developers.openai.com/api/docs/guides/your-data ; https://www.mapbox.com/legal/dpa .

#### Klar när

- Avtals- och dataflödesförteckningen är genomgången mot faktiska konton, kod och inställningar. Konkreta luckor är lösta eller innebär dokumenterad lanseringsblockerare; rekommendationer får inte markeras som redan utförda.
- Bekräfta rätt organisation/projekt, nycklarnas miljöseparering, åtkomst, Vercel Pro/DPA och OpenAI-inställningar utan att lägga hemligheter i dokument eller rapporter. Underbygg integritetstextens uppgifter om mottagare, träning, lagring och tredjeland.
- Implementerat: —
- Verifierat: Endast planering och tidigare genomläsning av offentliga leverantörsvillkor; inga signerade avtal, abonnemang eller privata kontoinställningar verifierade genom denna dokumentationsleverans.
- Återstår / blockerare: Rätt avtalspart/UF-ansvar, faktisk konto-/DPA-kontroll, planerade organisationsflyttar, inställningar och kod-/dataflödesgranskning.

## Designaudit 2026-10-22 – kort

Kort skapade 2026-10-25 från [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md). Audit-dokumentet har fynd, filer och mått; korten nedan har status och ansvar. Följ AGENTS.md och reservera ett kort innan arbetet börjar. Ordningen följer audit-dokumentets förslag: DA-04 → DA-05 → DA-06 som ett designsystemblock, DA-12 parallellt en vy i taget, därefter P3-punkterna. Korten är placerade sist i den gemensamma ordningen (61–72) och kan prioriteras om.

Fynd som enligt audit-dokumentet hör till befintliga kort har inga egna kort utan ligger som tillägg där: DA-03, DA-10 och DA-17 i [D05](#d05), DA-07 i [D07](#d07), DA-08 och DA-09 i [F20](#f20).

<a id="da-01"></a>
### DA-01 Landningssidans illustrationer är tomma under 1024px

- [x] Klar
- Prioritet: P1
- Global ordning: 61
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: `claude/da01-platform-visuals-20261022`, [PR #95](https://github.com/vilgotdidrikson/youth-job-mvp/pull/95), mergad till dev `50d6a49`.
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-01), som har fynd, filer och mått.
- Åtgärd: Ge varje SVG-instans i plattformssektionen egna gradient-id så att mobilillustrationerna inte pekar på gradienter i den dolda desktopkolumnen.
- Klar när: Alla fem mobilillustrationer visar sina gradienter vid 375 och 800px; inga dubblerade id.
- Samordning / beroenden: Se reservationen DA-01 under Gemensam prioriteringsordning (implementation, test och verifiering i driftsatt dev 2026-10-22).
- Implementerat: Se Branch/PR.
- Verifierat: Se Branch/PR.
- Återstår / blockerare: —

<a id="da-02"></a>
### DA-02 Favicon, appikoner, delningsbild och sidtitlar

- [x] Klar
- Prioritet: P1
- Global ordning: 62
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: branch `Max`, se reservationen DA-02 under Gemensam prioriteringsordning.
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-02), som har fynd, filer och mått.
- Åtgärd: Ersätt standardfavicon, lägg till appikoner, manifest och delningsbild samt egna sidtitlar för publika sidor.
- Klar när: Varje publik sida har egen titel, ikon-, manifest- och delningslänkar fungerar och pekar på publikt nåbara adresser.
- Samordning / beroenden: Kontroll i driftsatt dev (inklusive att `og:image` är publikt nåbar) återstår; se reservationen.
- Implementerat: Se Branch/PR.
- Verifierat: Se Branch/PR. Verifierat i driftsatt dev 2026-10-26 (Max / Claude), Chromium vid 375 px, 54/54: egen titel på `/`, `/features`, `/pricing`, `/login`, `/signup`, `/forgot-password` och `/privacy` (sju olika); favicon, SVG-ikon, Apple-ikon, manifest och delningsbild svarar 200 med rätt typ på publik adress; manifestets ikoner svarar 200.
- Återstår / blockerare: Fysisk mobil/appinstallation är inte provad.

<a id="da-04"></a>
### DA-04 Samla färgtokens och ta bort hårdkodade och drivande färger

- [ ] Klar
- Prioritet: P2
- Global ordning: 63
- Status: Pågår
- Ansvarig: Max / Claude
- Branch/PR: branch `Max`; reserverad före kodarbete 2026-10-25 (DA-04, DA-05 och DA-06 som ett designsystemblock enligt audit-dokumentet, på användarens uttryckliga begäran). Ingen databasändring.
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-04), som har fynd, filer och mått.
- Åtgärd: Bestäm värdena i `app/styles/theme.css` (ett värde för `--color-surface-soft` och de saknade tokens som används), ta bort tokenblocket på `.mnw-product` och lokala `--ink`/`--muted`/`--rose`/`--accent`, ersätt hex-värden fil för fil med början i chatten (avvikande palett) och `product-design.css`, och lägg till ett kontrollskript som larmar om antalet hex-värden utanför `theme.css` ökar.
- Klar när: Bara `theme.css` definierar färgvärden (undantag: SVG-illustrationer och kartan), chattens palett stämmer med resten och tokenkontrollen körs.
- Samordning / beroenden: Görs före DA-05 och DA-06. Profilbyggets tokens i `components/profile-steps/profile-steps.module.css` flyttas hit när DA-04 införs.
- Implementerat: Nya tokens i `app/styles/theme.css` (`--color-rose`, `--color-rose-track`, `--color-brand-accent`, `--color-brand-on-rose`, `--color-divider`, `--color-dashed`, `--color-ring`, `--color-plum-900`, `--color-success-strong`, `--color-text-muted-strong`, `--color-warning`, `--color-warning-soft`, `--color-white`). Tokenblocket på `.mnw-product` borttaget; produktytor som använde den överskrivna `--color-surface-soft` använder nu `--color-rose` (samma rosa som förut), marknadssidorna behåller `--color-surface-soft`. Lokala `--ink`/`--muted`/`--rose`/`--accent` borttagna ur modulerna och profilbyggets `--pb-*` pekar på theme-tokens. 727 hexvärden som exakt motsvarade en token ersatta med `var(--…)` i 27 filer (vitt efter sammanhang: bakgrund `--color-surface`, annars `--color-white`). Chattens avvikande palett (`#4e3341`, `#927887`, `#ac4066`) följer nu brand-paletten. Kontrollskript `scripts/check-design-tokens.mjs` (`npm run check:design-tokens`) med baslinje `scripts/design-token-baseline.json` som underkänner fler färgvärden per fil eller fler olika textstorlekar, radier och vikter.
- Verifierat: TypeScript, produktionsbygge, riktad ESLint, `check:design-tokens`, `test:profile-steps`, `test:job-practical`, `test:company-public-profile`, `test:accessibility` och `test:job-discovery`. Visuell jämförelse mellan produktionsbyggen före och efter (webpack, lokalt, kopplade till DevStaging, fiktiva konton raderade efteråt) på 15 sidor (publika sidor, ungdomens upptäck/ansökningar/chattar/profil/profilsteg/notiser och företagets annonser/annonsbyggare/inställningar) vid 375 och 1280 px: 0,00–1,31 % pixlar skiljer, och differensbilderna visar att det bara är dämpad text och ikoner som blivit något mörkare (DA-06) samt chattens text; bakgrunder, kanter och layout är oförändrade.
- Återstår / blockerare: 555 färgvärden utanför `theme.css` återstår (från cirka 1 280), främst äldre neutrala gråtoner och enstaka värden i `globals.css`, `video.module.css`, chatten och äldre vyer, samt inline-färger i TSX. Att mappa dem mot paletten ändrar utseendet och görs vy för vy tillsammans med DA-12; sänk baslinjen med `--update` efter varje migrering. Kontroll i driftsatt dev.

<a id="da-05"></a>
### DA-05 Inför skala för typografi, vikter, radier och skuggor

- [ ] Klar
- Prioritet: P2
- Global ordning: 64
- Status: För granskning
- Ansvarig: Max / Claude
- Branch/PR: branch `Max`; reserverad före kodarbete 2026-10-25 (DA-04, DA-05 och DA-06 som ett designsystemblock enligt audit-dokumentet, på användarens uttryckliga begäran). Ingen databasändring.
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-05), som har fynd, filer och mått.
- Åtgärd: Lägg till skalan för textstorlekar, vikter, radier och skuggor i `theme.css` enligt förslaget i audit-dokumentet och migrera till den tillsammans med DA-04.
- Klar när: Ny och ändrad CSS använder bara skalans värden, och antalet olika textstorlekar och radier minskar för varje migrerad fil (mäts med DA-04:s kontrollskript).
- Samordning / beroenden: Beroende: DA-04.
- Implementerat: Skalan för textstorlekar, spårning, vikter, radier och skuggor finns i `theme.css` enligt audit-dokumentet. `check:design-tokens` räknar olika textstorlekar (140), radier (57) och vikter (10) och underkänner om antalet ökar.
- Verifierat: TypeScript, produktionsbygge, riktad ESLint, `check:design-tokens`, `test:profile-steps`, `test:job-practical`, `test:company-public-profile`, `test:accessibility` och `test:job-discovery`.. Kontroll i driftsatt dev 2026-10-26: inloggade och publika sidor renderar utan avvikelser i proven ovan. `check:design-tokens` fallerar på dev av senare ändringar i andra punkters filer (`app/applications/applications-design.css` +6 färger, `components/brand-logo.module.css`, fler textstorlekar och vikter), så kriteriet om att ny CSS bara använder skalan är inte uppfyllt i dev.
- Återstår / blockerare: Samordna med ägarna av `applications-design.css` (N19) och `brand-logo.module.css` (D07) så att de nya värdena använder skalan, och sänk baslinjen. Migrering av äldre värden sker i DA-12.

<a id="da-06"></a>
### DA-06 Rätta textfärger som inte klarar WCAG AA

- [x] Klar
- Prioritet: P2
- Global ordning: 65
- Status: Klar
- Ansvarig: Max / Claude
- Branch/PR: branch `Max`; reserverad före kodarbete 2026-10-25 (DA-04, DA-05 och DA-06 som ett designsystemblock enligt audit-dokumentet, på användarens uttryckliga begäran). Ingen databasändring.
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-06), som har fynd, filer och mått.
- Åtgärd: Gör `--color-text-muted` mörkare (`#7f616d`), använd `--color-text-subtle` bara för ikoner, kanter, platshållare och stor text, och höj minsta textstorlek till 12px (DA-16).
- Klar när: All brödtext når 4.5:1 mot sin faktiska bakgrund, kontrollerat med Lighthouse eller axe på publika sidor och ett urval inloggade sidor.
- Samordning / beroenden: Samordna med F23 (tillgänglighet) och L08. Beroende: DA-04.
- Implementerat: `--color-text-muted` mörkare (`#896a76` → `#7f616d`), även där värdet tidigare var hårdkodat. `--color-text-subtle` används inte längre för brödtext (ögonbryn, statistikkälla, prisnot, bottenmeny, byggarens etiketter och hjälptexter flyttade till dämpad text); kvar bara för platshållare och dekorativa tecken. Därtill rättat: profilhuvudets initial och grå texter, annonsbyggarens ögonbryn, startsidans copyrightrad och funktionssidans ögonbryn på rosa.
- Verifierat: TypeScript, produktionsbygge, riktad ESLint, `check:design-tokens`, `test:profile-steps`, `test:job-practical`, `test:company-public-profile`, `test:accessibility` och `test:job-discovery`. Visuell jämförelse mellan produktionsbyggen före och efter (webpack, lokalt, kopplade till DevStaging, fiktiva konton raderade efteråt) på 15 sidor (publika sidor, ungdomens upptäck/ansökningar/chattar/profil/profilsteg/notiser och företagets annonser/annonsbyggare/inställningar) vid 375 och 1280 px: 0,00–1,31 % pixlar skiljer, och differensbilderna visar att det bara är dämpad text och ikoner som blivit något mörkare (DA-06) samt chattens text; bakgrunder, kanter och layout är oförändrade. Kontrastskanning (egen Playwright-kontroll av varje synlig textnod mot dess faktiska bakgrund; liten text 4.5:1, stor text 3:1) på samma 15 sidor vid 375 px: 33 text under AA före, 2 efter. De två återstående är inga brödtextfel: startsidans vita logotyp ligger på WebGL-gradienten som skannern inte kan läsa, och tankstrecket mellan ålders-/lönefälten är dekorativt. axe color-contrast i driftsatt dev 2026-10-26 (Max / Claude) med fiktiva QA-konton (raderade): publika sidor 7/7 utan anmärkning; inloggade sidor för ungdom (swipe, ansökningar, notiser, chattar, profil, annons) och företag (annonser, annonsbyggare, företagsuppgifter, chattar, notiser) vid 375 och 1280 px utan anmärkning utom chattens avatar-initialer, 3,8:1 vid 12,5 px. Rättat på branch `Max` (`--color-text-muted-strong`, 5,3:1); axe utan anmärkning på `/chats` lokalt efter rättningen. Efter merge till dev (`1e4f49d`): axe utan anmärkning på `/chats` för ungdom och företag vid 375 och 1280 px i driftsatt dev, och publika sidor 7/7.
- Återstår / blockerare: Startsidans logotyp mot gradienten bedöms i D05. Ej provat med fysisk mobil.

<a id="da-11"></a>
### DA-11 Serverrendera marknadssidorna och ladda Mapbox-CSS bara med karta

- [ ] Klar
- Prioritet: P2
- Global ordning: 66
- Status: För granskning
- Ansvarig: Max / Claude
- Branch/PR: branch `Max`; reserverad före kodarbete 2026-10-26 enligt användarens beställning att genomföra kort från designauditen. Startsidans innehåll, animationer och D05:s tillägg (DA-03, DA-10, DA-17) ingår inte; bara uppdelning i server- och klientkomponenter. Ingen databasändring.
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-11), som har fynd, filer och mått.
- Åtgärd: Gör `app/page.tsx`, `app/features/page.tsx` och `app/pricing/page.tsx` till serverkomponenter med egen `metadata` och flytta bara de interaktiva delarna till små klientkomponenter. Flytta importen av Mapbox-CSS från `app/globals.css` till kartkomponenten.
- Klar när: Sidorna visar sin text utan JavaScript, har egen metadata och Mapbox-CSS laddas bara på sidor med karta. Lighthouse mobil jämförs före och efter i driftsatt dev.
- Samordning / beroenden: Samordna startsidan med D05.
- Implementerat: `app/page.tsx`, `app/features/page.tsx` och `app/pricing/page.tsx` är serverkomponenter med egen `metadata` (startsidan: titel och canonical; funktioner/priser: titel och beskrivning från befintlig sidtext). Segmentlayouterna som bara satte titlar är borttagna. Klientdelar: `app/landing-hero.tsx` (animerad rubrik och sessionsberoende knappar) och `app/pricing/pricing-plans.tsx` (kundtypsväxeln med planer); bakgrund, plattformsvisning, tidslinje och räknare var redan klientkomponenter. Startsidans rubrik börjar fullt utskriven så att serverns HTML visar den, `NumberTicker` serverrenderar slutvärdet, och en `<noscript>`-stil visar scrollanimerad text utan JavaScript. `components/ui/platform-visuals.tsx` är en klientmodul så att mobil- och desktopkopian får egna SVG-id:n (annars återkom DA-01-felet). Mapbox-CSS importeras i `components/job-map.tsx` i stället för `app/globals.css`; kartkontrollernas regel fick högre specificitet eftersom Mapbox-CSS nu laddas efter appens CSS. `test:map-fallback` stubbar CSS-importen. Texter, länkar och animationer i övrigt är oförändrade. Rättat 2026-10-26 efter Lighthouse: startsidans `alternates.canonical: "/"` gav en relativ canonical-länk (ingen `NEXT_PUBLIC_SITE_URL` i dev) och SEO 92; raden är borttagen på branch `Max`.
- Verifierat: TypeScript, ESLint (inga nya varningar), produktionsbygge (webpack), `test:accessibility`, `test:map-fallback` och `test:local-fonts`. Lokala produktionsbyggen före och efter i Chromium: skärmbilder av `/`, `/features`, `/pricing`, `/login` och `/kartan` (omdirigering) vid 375 och 1280 px är pixelidentiska (0,00 %); utan JavaScript visar startsidan nu rubriken, statistikrubriken, siffrorna (24,9 % och 206 500) och manifestet, som tidigare saknades; funktions- och prissidan oförändrade. Mapbox-CSS finns inte i någon stilmall på `/`, `/features`, `/pricing`, `/login`, `/signup` eller `/privacy`, bara i `/kartan`s chunk. Prisväxeln byter rubrik och visar företagsavsnitten, rubrikanimationen skriver nästa rubrik, räknarna når slutvärdet och inga sidfel. Kartkontrollerna behåller appens radie och knappstorlek när Mapbox-CSS laddas efter appens CSS (kontrollerat med byggets stilmallar, inte med inloggad karta). `check:design-tokens` fallerar redan på dev av andra punkters filer (`applications-design.css`, `brand-logo.module.css`); den här ändringen tillför inga nya värden. Efter merge till dev (`1e4f49d`), driftsatt dev 2026-10-26: utan JavaScript visar `/` rubrik, statistik (24,9 %, 206 500) och manifest; egna titlar och beskrivningar på `/features` och `/pricing`; ingen Mapbox-stilmall på `/`, `/features`, `/pricing`, `/login`, `/signup` eller `/privacy`; skärmbilder vid 375 och 1280 px identiska med lokalt bygge (0,00–0,01 %). Lighthouse mobil (Chromium, tre körningar per sida, lokala webpack-byggen av dev före `a1b06d8` och efter `1e4f49d` mot DevStaging, eftersom föregående driftsättning inte längre finns): `/` prestanda 70–91 → 91–92, LCP 3,47–3,70 → 3,39–3,43 s, CLS 0,018 → 0,011; `/features` LCP 3,38–3,39 → 3,16–3,32 s; `/pricing` oförändrat (91–93 → 92), 1–5 KB mindre per sida; tillgänglighet 100 före och efter. Startsidans SEO sjönk 100 → 92 av canonical-länken; efter rättningen 100 (lokalt). Driftsatt dev före rättningen: `/` 93/SEO 92, `/features` 96/100, `/pricing` 95/100.
- Återstår / blockerare: Canonical-rättningen (branch `Max`) ska in i dev och SEO kontrolleras där; därefter Klar. Inloggad visuell kontroll av `/kartan` med karta är inte gjord (kartans reglage kontrollerade mot byggets stilmallar).

<a id="da-12"></a>
### DA-12 Flytta äldre inline-stilar till CSS-moduler och ta bort överskrivningar

- [ ] Klar
- Prioritet: P2
- Global ordning: 67
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-12), som har fynd, filer och mått.
- Åtgärd: Migrera en vy i taget till en CSS-modul med DA-04/DA-05-tokens och ta bort motsvarande `!important`- och `[style*=]`-överskrivningar i `app/product-design.css` i samma PR. Börja med `app/company/page.tsx` och ta `components/youth-onboarding-flow.tsx` sist.
- Klar när: Varje migrerad vy saknar inline-färger och -avstånd, och dess överskrivningar är borta ur `product-design.css`.
- Samordning / beroenden: Löper parallellt med DA-04/DA-05, en vy per leverans. Berör filer som ägs av andra punkter; samordna per vy. Visuell riktning: [företagsdemons hierarki och gruppering](DESIGN_AUDIT_2026-10-22_1.md#demo-design-direction), inom befintlig omfattning och med auditens visuella kontroller vid vymigrering. Befintliga produktregler, navigation och tillgänglighetskrav bevaras.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="da-13"></a>
### DA-13 Gör prissidans huvudknapp till primär knapp

- [x] Klar
- Prioritet: P3
- Global ordning: 68
- Status: Klar
- Ansvarig: William / Claude
- Branch/PR: [PR #111](https://github.com/vilgotdidrikson/youth-job-mvp/pull/111), merge `ba70209`. Statusen synkad 2026-10-26 från audit-dokumentet, där genomförande och verifiering i driftsatt dev redovisas (commit `2c92874`).
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-13), som har fynd, filer och mått.
- Åtgärd: Använd den markerade stilen för den rekommenderade planen (flagga `highlighted` i `lib/pricing-data.ts`) och minska tomrummet under kortet på mobil. Ändra inte prisförklaringen.
- Klar när: Rekommenderad plan har primär knapp och mobilvyn saknar stort tomrum.
- Samordning / beroenden: Prisförklaringen hör till F06 (blockerad).
- Implementerat: Se implementationsuppdateringen under [DA-13 i audit-dokumentet](DESIGN_AUDIT_2026-10-22_1.md#da-13).
- Verifierat: Enligt audit-dokumentet: TypeScript, ESLint, produktionsbygge och Chromium-kontroll vid 375 och 1280 px, lokalt och i driftsatt dev efter merge.
- Återstår / blockerare: Ej kontrollerat i Safari/Firefox eller på fysisk telefon.

<a id="da-14"></a>
### DA-14 Rätta autentiseringssidornas kort, pil och textsymboler

- [x] Klar
- Prioritet: P3
- Global ordning: 69
- Status: Klar
- Ansvarig: William / Claude
- Branch/PR: [PR #112](https://github.com/vilgotdidrikson/youth-job-mvp/pull/112), merge `8c2be47`. Statusen synkad 2026-10-26 från audit-dokumentet, där genomförande och verifiering i driftsatt dev redovisas (commit `2c92874`).
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-14), som har fynd, filer och mått.
- Åtgärd: Under 480px: ta bort kortets ram och skugga så att formuläret använder hela bredden. Visa logotypen ovanför rubriken (DA-07/D07). Ta bort ”↗” på skickaknapparna eller använd `UiIcon name="arrow"`, och ersätt textsymboler med `UiIcon` på marknads- och autentiseringssidorna.
- Klar när: Formulären använder hela bredden på mobil, och inga knappar visar en symbol som antyder extern länk.
- Samordning / beroenden: Rollvalet lämnas till F23.
- Implementerat: Se implementationsuppdateringen under [DA-14 i audit-dokumentet](DESIGN_AUDIT_2026-10-22_1.md#da-14).
- Verifierat: Enligt audit-dokumentet: TypeScript, ESLint, produktionsbygge och Chromium-kontroll vid 375 och 1280 px, lokalt och i driftsatt dev efter merge.
- Återstår / blockerare: Ej kontrollerat i Safari/Firefox eller på fysisk telefon.

<a id="da-15"></a>
### DA-15 Korta och variera funktionssidan

- [ ] Klar
- Prioritet: P3
- Global ordning: 70
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-15), som har fynd, filer och mått.
- Åtgärd: Ge varje funktion en egen ikon, gruppera korten i två kolumner från 640px och inled varje målgruppsavsnitt med en riktig produktbild i stället för ett tolfte kort. Alternativt slå ihop sidan med startsidan och prissidan.
- Klar när: Funktionssidan har varierade ikoner, kortare scroll på mobil och visar produkten.
- Samordning / beroenden: Samordna produktbild med D05.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="da-16"></a>
### DA-16 Större text och tryckytor på mobil

- [ ] Klar
- Prioritet: P3
- Global ordning: 71
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-16), som har fynd, filer och mått.
- Åtgärd: Gör varje tryckbart element minst 44×44px (padding räcker) och använd aldrig mindre än 12px för synlig text, bland annat i sidfötter, upptäck-filter, CV-banner och kortchips.
- Klar när: Inga tryckytor under 44px och ingen synlig text under 12px vid 375px på publika sidor och upptäck.
- Samordning / beroenden: Samordna med L08 och DA-06.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="da-18"></a>
### DA-18 Ska utloggade besökare kunna se publicerade jobb?

- [ ] Klar
- Prioritet: Beslut
- Global ordning: 72
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Källa: [docs/DESIGN_AUDIT_2026-10-22_1.md](DESIGN_AUDIT_2026-10-22_1.md#da-18), som har fynd, filer och mått.
- Åtgärd: Besluta om en skrivskyddad förhandsvisning av några publicerade annonser för utloggade (utan ansökan). Gäller bara publicerat annonsinnehåll, aldrig ungdomsdata.
- Klar när: Ett dokumenterat produkt- och integritetsbeslut finns. Kod påbörjas först efter beslutet.
- Samordning / beroenden: Beslutas tillsammans med F26/N19, som definierar vilken jobbinformation som är publik.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n24"></a>
### N24 Företagets egna kompletteringsfrågor före matchning

- [ ] Klar
- Prioritet: P2
- Global ordning: 29.1, samordnas med F12/N19.
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n24-company-questions-20261027`, reserverad före kodarbete från dev `e05bd3a`. Kärnleverans: manuell fråga, frivilligt svar/avstående, notis och rapportering med befintlig ansöknings-/gallringsgrund. Profilåteranvändning inväntar fortsatt F12/N19:s dataskyddsbeslut; inga nya AI-anrop vid frågesändning.
- Åtgärd: Lägg Ställ en kompletteringsfråga på en befintlig skickad ansökan. Företaget kan skriva en egen jobbrelevant fråga till just den sökanden utan att matcha eller öppna fri chatt. Skilj från annonsens befintliga högst tre ansökningsfrågor och automatiska kompletteringar. Ungdomen får en notis/länk till rätt ansökan och svarar eller avstår under Ansökningar. Företaget läser uttryckligen skickade svar i samma jobbspecifika ansökningsunderlag.
- Regler: Endast ansvarigt företag och rätt inskickad ansökan, med ägar-/mottagarkontroll även i API/RPC/RLS. Ingen allmän kandidatkontakt eller profilåtkomst. Stoppa nya frågor/svar vid återkallad ansökan eller blockerad kontakt och följ befintlig annonsstatus-/delningshantering. En fråga, ett svar eller avstående skapar aldrig matchning; inget svar/låg matchgrad/saknad video får dölja eller neka ansökan. Bevara versions-/källsammanhang och redan delade svar.
- Profilåteranvändning: Följ F12/N19 – fråga efter svar om ungdomen vill spara granskade generella fakta i profilen för återanvändning. Inget förvalt ja, inget sparande vid nej/uteblivet val och ingen automatisk delning till andra företag eller omskrivning av CV/skickade ansökningar.
- Klar när: Företag skickar fråga före matchning, rätt ungdom får notis, kan svara/avstå, och rätt företag kan läsa svaret utan att match/chatt har skapats. Inga upprepade kända frågor eller tysta profiluppdateringar; följ upp inaktuell/motstridig uppgift. Verifiera anonym, fel företag, fel jobb/ungdom, återkallelse/blockering, dubbelklick/återförsök, versionskonflikter och notisens lässtatus på dator/mobil.
- Avgränsning beslutad för denna implementation: 500 tecken/fråga, högst två obesvarade och fem frågor totalt per ansökan, högst 20 frågor per företag/rullande 24 timmar och minst 60 sekunder mellan nya frågor på samma ansökan. Frågor ändras/ersätts inte efter sändning; tidigare svar bevaras. Paus stoppar nya frågor, stängning stoppar nya frågor/svar; historik följer befintlig behörighet/gallring. Olämpliga frågor ska kunna rapporteras med serverlagrad avgränsad snapshot.
- Ursprunglig planering före implementation: Bestäm och dokumentera begränsningar för antal/längd/takt, hantering av obesvarade/ersatta frågor, annonsens stängning och rapportering av olämpliga frågor. Återanvänd befintliga fråge-/notis-/delningsflöden och håll AI utanför manuell frågesändning. Dataskyddsavstämning samordnas med N19/F12/L05.
- Kodreferens: `d62e34fbfb72ea4021deb8f3c4f4a63575c4db38`, målbranch `dev`; källträdet matchar det verifierade lokala bygget.
- Slutgranskning 2026-10-27: `codex/n24-bulk-replies-20261027`, publicerad före rättningen från dev `3409f18`. Reproducerat att sex automatiska + fem företagsfrågor inte kunde avstås från i samma skickning (22023); även 11 långa svenska svar överskred den gamla bytegränsen. Migration `20261027140402_n24_combined_question_answers.sql` införd i DevStaging: högst 11 avståenden och 80 KB totalt, med oförändrade 1500 tecken per svar och ägar-/livscykelkontroller. Det utökade rollbacktestet passerar med båda bulkfallen. Sju grupper totalt.
- Implementerat 2026-10-27: Manuella frågor på vald skickad ansökan, befintligt frivilligt svar/avstående och riktade notiser utan match/chatt. Servern kontrollerar ägare, verifiering, status, blockering och livscykel samt längd/antal/takt. Stabil begäransnyckel gör återförsök idempotenta; skickad frågetext är oföränderlig. Ungdomen kan rapportera frågan och admin ser en avgränsad serversnapshot. Frågor/svar ligger i befintlig application_followups och omfattas av L12; inga nya AI-anrop vid frågesändning. Migration `20261027134933_n24_company_application_questions.sql` införd i DevStaging. Se [N24.md](N24.md).
- Verifierat: Sex grupper riktiga DevStaging-rollbackprov passerar före/efter migrationen: rätt/fel roller och ansökan, idempotens/dublett/taktgränser, riktad notis, frivilligt svar/avstående utan match eller profiländring, blockering/verifieringsändring/paus/stängning/återkallelse, rapportering och bevarad avgränsad evidens efter L12-gallring. Befintliga N02- (38 kontroller), L05- (12 grupper) och L12-prov (9 grupper) passerar, där L05/L12 kördes med nya migrationen. `test:company-questions` kör faktiska UI-callbacks och installerad SDK med simulerad HTTP; stabil retry-nyckel, dubbelklick, fel scope, avmontering, rapport-RPC och stängd frågas läsläge kontrolleras. Supplement-, moderations-, annonskandidat- och ansökningsöversiktsregressioner, riktad ESLint och standardproduktionsbygge/TypeScript/56 routes passerar. Inga nya säkerhetsadvisories. Noll kvarvarande N24-QA-konton/frågor; automatisk gallring är avstängd.
- Återstår: Inloggad visuell kontroll på dator/mobil, notisöppning/lässtatus över hela flödet och verkliga flerparts-/samtidighetsprov. Exakta textdubletter stoppas; semantiskt likvärdiga/kända fakta kräver fortsatt F12/N19 och arbetsgivarens granskning av underlaget. Valet för profilsparning/återanvändning inväntar befintlig dataskyddsavstämning och är inte implementerat här; svar sparas enbart för ansökan. Ingen ny live-HTTP-/browseracceptans påstås. N24 markeras inte Klar.


<a id="n25"></a>
### N25 Välj annons före kandidatgranskning

- [ ] Klar
- Prioritet: P2
- Global ordning: 32.1, samordnas med N03/F04, F05/F26/N19 och DA-12.
- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch/PR: `codex/n25-ad-candidates-20261027`, publicerad reservation `a491bc8` före kodarbete. Tidigare planbeslut: [PR #120](https://github.com/vilgotdidrikson/youth-job-mvp/pull/120), merge `9469ab7`.
- Reservation före kodarbete 2026-10-27: `codex/n25-ad-candidates-20261027`, från dev `2af9031`. Avgränsad annonsbaserad kandidatvy med befintliga datakällor och säkerhetsgränser, samordnad med auditens visuella riktning. Öppna PR:er kontrollerade; inget annat aktivt produktarbete övertas. Avsteg från tidigare ej påbörjade kort: N23 kräver aktiveringsklar videogallring; N20/N21 och profilutökningar inväntar befintlig dataskyddsavstämning; L02/L03 kräver konfigurerad e-postleverans respektive pris/fakturauppgifter; L13/L14 har kvarstående inventerings-/verksamhetsbeslut. N25 inför inga nya persondatafält, externa tjänster eller AI-anrop.
- Åtgärd: Låt företaget först välja en egen annons i annonsöversikten och därefter granska endast de kandidater som har skickat en ansökan till den annonsen. Visa annonsens titel som tydlig kontext och en enkel väg tillbaka till annonserna. Ett generellt kandidatregister eller en blandad lista över alla annonser ska inte vara standardingången. Behåll eventuell samlad översikt enbart som ett uttryckligt separat val om det behövs.
- Avgränsning: Samma ungdom kan söka flera annonser; varje ansökan, CV-/delningsunderlag, fråga, matchning, konversation och anställningsstatus behåller sitt jobb- och ansökningssammanhang. Annonsbyte ska rensa föregående kandidat och inaktuellt underlag direkt. Senare inkomna svar får inte visas under fel annons. Utkast och annonser utan sökande får begripliga tomvyer; pausade/stängda annonser behåller behörig historik enligt befintliga regler.
- Regler: Återanvänd befintliga jobb-/ansökningsrelationer och ägar-/åtkomstkontroller även i API/RPC/RLS. Ett UI-filter är inte en behörighetsgräns. Ingen kandidat får falla bort på grund av låg matchgrad, saknad AI-bedömning, okänd uppgift eller utebliven frivillig video. Återkallade ansökningar och blockerad kontakt följer redan beslutade regler i F26/N19/N24.
- Design: En vald annons, en tydlig kandidatlista och ett läsbart ansökningsunderlag. Få textnivåer, rymliga kontroller och återhållna etiketter; undvik upprepade kontextpaneler, småtexter och statistik som inte hjälper den aktuella uppgiften. Samordna med auditens [visuella riktning](DESIGN_AUDIT_2026-10-22_1.md#demo-design-direction), DA-05/DA-12/DA-16. Förenkling får inte dölja nödvändigt samtycke, status, källa, fel eller åtkomstinformation.
- Klar när: Företaget kan välja mellan minst två egna annonser och får rätt sökande, antal och ansökningsunderlag per annons, inklusive samma ungdom på två jobb. Annonsbyte, tom annons, direktlänk/omladdning, snabb växling med sena svar och återgång fungerar på dator/mobil med tangentbord. Fel företag, anonym, fel jobb-/ansöknings-ID och återkallad åtkomst är negativt testade. Befintliga CV-, matchnings-, chatt- och anställningsflöden behåller rätt sammanhang.
- Kodreferens: `5499f872611f4460206b22c6c6be07d54728d6e6`, målbranch `dev`; samma källträd som det lokalt verifierade bygget.
- Implementerat 2026-10-27: Annonsval före kandidatlistan, direktlänk från egna annonskort, titel/antal per valt jobb, jobbspecifik sökning och tillbaka/byt annons. Kandidater hämtas först efter val av egen annons i stället för parallellt för alla jobb. Kontrollerad läsning med konto-/jobbnyckel, timeout, retry och skydd mot sena svar; CV stängs vid ändrat underlag och hämtas med tidsgräns. Beslut, delningsunderlag, bedömningar, chatt och uppföljning behåller jobb-/ungdomspar. Endast faktiskt skickade ansökningar visas, utan AI-/videofilter. Befintliga dolda äldre swipe-/chattrenderare ersätts av den separata arbetsytan. Inga nya AI-anrop, migrationer, externa integrationer eller RLS-ändringar. Se [N25.md](N25.md).
- Verifierat 2026-10-27: `test:ad-candidates` kör riktiga komponent-/hookcallbacks och installerad SDK mot simulerad transport: två annonser/samma ungdom, scopebyte före effekter, sent svar, kontobyte, timeout/retry, återkallad åtkomst, eget/annat jobb, skickad kontra oskickad ansökan, CV-payload och dubbelt beslutsförsök. `test:company-navigation`, `test:recruitment-review`, `test:job-drafts`, riktad ESLint utan fel (befintlig img-varning) och standardproduktionsbygge med TypeScript/56 routes passerar. Riktiga läsprov avbröts utan slutresultat vid sessions-/användningsavbrottet; de räknas inte som godkända backendtester.
- Återstår: Inloggad visuell kontroll på 375/1280 px och fysisk mobil/tangentbord, fullständigt verkligt flerannonsflöde inklusive negativa API-/RLS-prov och återkallad åtkomst. Tidigare L05/L12-verifiering återanvänds som bakgrund, inte som nytt N25-acceptanstest. Ingen ny testkohort eller fil skapad i denna leverans. N25 markeras inte Klar.
