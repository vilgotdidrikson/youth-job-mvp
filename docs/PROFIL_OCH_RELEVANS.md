# Jobbprofil, relevans och matchning

Beslutad av Vilgot 2026-10-18. Detta är en byggspecifikation; status, reservation och leveransbevis följs i `ATGARDSPLAN.md`. All utveckling sker i dev/DevStaging. Ingen premiumfunktion eller debitering aktiveras genom beslutet. Tillägget om jobbspecifikt ansökningsunderlag nedan är ett beslutat krav 2026-10-18, inte en uppgift om redan genomförd implementation eller verifiering.

## Gemensamma jobbtyper (N17)

- Fri annonstitel och rättningsbar gemensam jobbtyp. Normalisering bevarar originaltexten och arbetar med stabila ID:n, inte användarens exakta stavning.
- Cafémedarbetare, caféjobb och cafépersonal hör till Caféarbete. Barista kan ha Caféarbete som bred kategori och behålla sin inriktning; underroller är inte automatiskt identiska krav på kompetens.
- Håll företagets bransch separat från arbetsrollen: ekonom på ett café är ekonomiarbete, inte caféarbete. Flerrollsannonser måste hanteras uttryckligt utan att utöka till orelaterade kategorier.
- Föreslå kategori från titel och rollbeskrivning, visa exempelvis ”Jobbet visas under Caféarbete · Ändra”. Företaget kan rätta. Vid osäkerhet: kort lokalt val, inte en tyst felklassificering eller blockerande lång lista. Bevara uttryckligt rättat val vid nästa AI-bearbetning.
- Samma begrepp används för annons, ungdomens önskemål och sökfilter. Synonymer tolkas även i fri text som ”söker caféjobb”. Okända roller får finnas kvar och upptäckas; kategori utan stöd ska inte uppfinnas.
- Planera kompatibel läsning av gamla fria kategorier och kopiering/redigering. Ingen oåterkallelig omskrivning av användarens original.

## Flöde och annonslivscykel (N16/N18)

- Företaget behöver inte bestämma antal anställningar per annons. Paus och avslutning styrs manuellt. Ingen minskning/automatisk stängning/återpublicering vid registrerad eller bekräftad anställning.
- Uttryckliga filter är hårda val. Profilönskemål är mjuka preferenser: jobbtyp, plats och känd tillgänglighet prioriterar utan att dölja alla andra möjligheter. Saknade preferenser ger ett användbart allmänt flöde.
- Nybörjare ska kunna hitta sitt första jobb. Erfarenhet/styrkor är inte ett generellt behörighetskrav. Gissa inte restid från ortsnamn eller exakt schema från anställningsformen; använd bara tillförlitliga uppgifter som finns.
- Behöriga aktiva annonser, tidigare val/ansökningar och blockeringsregler hanteras före rangordning. Ovisat prioriteras; redan sökt/bortvalt återkommer inte automatiskt. Ett kort som bara visats är inte ett permanent avböjande.
- Bland relevanta ovisade annonser prioriteras ny publicering med variation mellan företag. Specificera deterministisk ordning, unik annons över flera adresser och stabil paginering innan implementation. Ett direkt jobb-länkval får inte kringgå filter eller behörighet.
- Publiceringsdatum skiljs från eventuell framtida bekräftelse ”vi söker fortfarande”. Varken vanlig textändring eller anställning ger automatiskt nytt flödesdatum.
- Visa kort begriplig relevansförklaring som bygger på verkliga val. Ingen popularitetsrankning eller premiumboost i denna leverans. Betalda lyft och automatisk hantering av gamla annonser hålls i idébanken tills reglerna är beslutade.

## Matchningsgranskning (F26)

- Jämför innebörden i krav med kandidatens godkända uppgifter. ”Punktlig” och ”bra på att passa tider” är likvärdiga formuleringar. Ett yrkesnamn som fotbollstränare bevisar däremot inte punktlighet, ansvar eller ledarskap.
- Visa varje jobbkrav med relevanta belägg och tydlig skillnad mellan stöd, uttrycklig motsägelse och okänd uppgift. Saknad uppgift är aldrig samma sak som underkänd. Krav, meriter och sådant som kan läras på jobbet hålls isär; ett självuppgivet belägg är inte oberoende verifiering.
- Relevanta egna exempel visas med källa och märks Självuppgivet. Likvärdiga formuleringar får förstås, men exemplen får inte bli verifierade personlighetsomdömen eller personlighetspoäng. Systemet intygar inte personlighet.
- Låt kriterier och belägg dominera framför procenttalet. Eventuell matchprocent visas sekundärt och alltid tillsammans med täckningsgrad och förklaring av vad som faktiskt kunnat bedömas. Befintlig beräkning skiljer poäng på bedömda kriterier från underlagstäckning; detta är inte bevis på att presentationen redan följer beslutet. Granska missvisande höga siffror vid tunt underlag. Likvärdiga fakta ska ge samma bedömning oberoende av formulering eller textlängd.
- Ingen ansökan får automatiskt nekas eller döljas på grund av matchningsgrad eller saknad video. Detta gäller även listor, filter, sorterings-/urvalslogik och servervägar; arbetsgivaren gör den mänskliga bedömningen. Ungdomens egna uttryckliga jobbfilter enligt N18 är en annan funktion.
- Råa intervjusvar, avvisade AI-förslag, tidigare ersatta fakta och känsliga attribut får inte tillföras som kandidatmeriter. Företaget fattar beslutet. Video analyseras inte av AI.
- Testa synonympar, negationer, motsägelser, svagt underlag, relevanta följdsvar, ändrade profiler och text utan belägg. Kontrollera både synligt underlag och verkligt API-/regelresultat. F05:s slutförande innebär inte att denna kvalitetsgranskning redan passerat.

## AI-underlag med bevarad bredd (F26/N19, beslut 2026-10-19)

- Matchningen ska få allt godkänt innehåll som är väsentligt för det aktuella jobbet: relevant innehåll i granskat CV (inklusive fritext), jobbprofil, erfarenheter och arbetsuppgifter, utbildning, projekt/föreningsarbete, kunskaper, språk, behörigheter, godkända egna exempel, jobbönskemål, tillgänglighet, tidigaste start och uttryckligen delade ansökningssvar. Ta även med jobbets beskrivning, arbetsuppgifter, krav och praktiska förutsättningar. Underlaget får inte reduceras till ett fåtal förvalda fält eller tappa relevanta detaljer för att grund-CV:t är kort.
- Bevara sammanhang, källor, perioder, negationer och osäkerhet. Fritext är inte i sig förbjuden; rensa riktat i stället för att slopa hela avsnitt. Godkänt underlag betyder inte att känsliga uppgifter får användas.
- Känsliga personuppgifter ska hållas utanför matchningsanropet: etniskt ursprung, politiska åsikter, religiös/filosofisk övertygelse, fackligt medlemskap, hälsa/diagnoser, sexualliv/sexuell läggning, genetiska uppgifter och biometriska uppgifter för entydig identifiering. Uppgifter om lagöverträdelser hanteras separat och ska också hållas utanför. Namn, kontaktuppgifter, personnummer, exakt bostadsadress och foto behövs inte för denna bedömning och ska inte skickas med.
- CV och postnummer är inte i sig känsliga personuppgifter enligt GDPR:s särskilda kategorier, men CV-fritext kan innehålla eller indirekt avslöja sådana uppgifter. Kontrollera och minimera före överföring till AI-leverantören; en prompt om att ignorera uppgifter efter överföringen räcker inte. Välj och verifiera metod vid implementationen. Ofullständig PDF-läsning eller osäker rensning får inte framställas som ett fullständigt granskat underlag; erbjud rättelse/komplettering och tydlig status.
- Geografisk närhet får ingå som praktisk uppgift. Beräkna ungefärligt avstånd från postnummerområde till aktuell arbetsplats (hantera flera adresser enligt N14); skicka i första hand det härledda avståndet till AI:n i stället för postnummer, exakt adress eller bostadskoordinater. Redovisa att det är en uppskattning, inte faktisk restid. Saknad/otillförlitlig plats ger okänd närhet. Dra inga slutsatser om personlighet, etnicitet, ekonomi eller arbetsförmåga från bostadsområde och anta inte pendlingsmöjlighet enbart av avstånd.
- Skilj AI:ns interna relevanta underlag från företagets åtkomst: ett rikt AI-underlag ger inte generell företagsåtkomst till jobbprofilen. Företaget ser det jobbspecifika underlaget enligt delningsreglerna nedan. Rensning inför AI-anrop ändrar inte tyst original-CV:t; granskad delning av dokumentet hanteras separat.
- Privata utkast, råa intervju-/chattsamtal, avvisade/ogranskade förslag och video ingår inte i matchningsanropet. Godkända relevanta fakta från profilguiden och uttryckligen delade ansökningssvar får däremot användas.
- AI-bedömning ska ingå i varje skickad ansökan och visas när företaget öppnar ansökan. AI:n ska inte rangordna kandidater, styra kandidatlistans ordning, dölja ansökningar eller fatta beslut om avslag/anställning. Vid AI-fel skickas ansökan enligt ordinarie behörighets-/CV-regler; visa att bedömningen är tillfälligt otillgänglig och möjliggör nytt försök. Arbetsgivaren granskar och beslutar.
- Rättslig grund och konsekvensbedömning återstår att fastställa före lansering; detta produktbeslut innebär inte juridiskt klartecken.

### Verifiering före Klar

- F26/N19: jämför verklig utgående AI-payload mot godkända källor. Visa med fiktiva fall att relevanta CV-detaljer, fritext, egna exempel och jobbfakta bevaras och kan ge källgrundade belägg även när de saknas i det korta grund-CV:t.
- Testa blandat innehåll i samma avsnitt: relevant arbetserfarenhet tillsammans med diagnos, religiös/politisk uppgift eller kontaktuppgift. Det otillåtna ska hållas utanför överföringen utan att relevant erfarenhet försvinner eller nya fakta uppfinns. Testa indirekta avslöjanden och dokumentera metodens begränsningar; lova inte ett ofelbart automatiskt filter.
- Testa uppskattat avstånd, saknat postnummer, flera arbetsplatser och att plats inte ger ogrundade lämplighetsomdömen. Kontrollera separat företagets åtkomst och ungdomens förhandsvisning enligt N19/L05.
- Testa att AI-fel, okänd/låg bedömning och saknad video inte stoppar eller döljer ansökan och att ingen kandidatlista rangordnas av AI-resultat.
- Status: beslutad byggspecifikation; ingen produktkod, filtrering eller dataflödesverifiering införs genom denna dokumentändring. Källstöd för kategorier och rekrytering (kontrollerat 2026-10-19): https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/kansliga-personuppgifter/ ; https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/arbetsliv/rekryteringssystem-och-kompetensdatabaser/

## Profilen är grunden; CV är ett urval (N19)

| Del | Innehåll och användning |
| --- | --- |
| Godkänd jobbprofil | Ungdomens samlade godkända uppgifter. Ingen generell företagsåtkomst. Endast relevant, godkänt underlag för det aktuella jobbet används i matchning och det avgränsade ansökningsunderlaget. |
| Grund-CV | Ett kort, generellt och granskat urval av profilens uppgifter. Samma version används tills ungdomen ändrar den. Inte automatiskt olika CV för olika ansökningar. |
| Arbetsmaterial | Intervjusvar och ofärdiga/ogranskade förslag. Inte publicerade fakta, inte belägg i matchning. Förklara synlighet/sparning och låt användaren radera. |

- Huvudflödet heter Bygg din profil. Formulär, textguide och uppladdat CV är alternativa ingångar till samma datamodell; skapa inte tre separata profiler eller dubbla språk-/erfarenhetskällor.
- Återanvänd och utveckla befintlig faktagranskning och samordnad sparning (F02/F03). Godkännande gäller exakt aktuell version; återställ vid ändring. Visa vad som går till CV, enbart egen profil respektive det aktuella jobbets ansökningsunderlag och matchning. Att godkänna en omformulering är inte oberoende verifiering av uppgiften.
- Gör inte nytt konto-/profilbyggande eller frivillig förbättringshjälp till ett nytt stopp i swipeflödet. Bevara regler för när ansökan kan skickas och val att fortsätta senare.
- Inga relevanta godkända profilfakta får försvinna för att CV:t kortas. Redan separat uppladdat CV kan avvika; skilj originaldokument och nytt genererat dokument och undvik motsägande publicerade fakta.

## Jobbspecifikt ansökningsunderlag (F26/N19, beslut 2026-10-18)

Den generella rutan **Mer om kandidaten** ska ersättas med ett **jobbspecifikt ansökningsunderlag**. Företaget får inte generell tillgång till hela jobbprofilen. Att uppgifter finns sparade eller har godkänts i profilen ger inte i sig rätt att visa dem för alla företag.

| Företaget får se för den aktuella ansökan | Avgränsning |
| --- | --- |
| Ungdomens granskade CV | Det dokument/den version ungdomen granskat och valt att dela. Uppladdat CV kan innehålla mejl, telefonnummer eller bostadsadress; detta måste framgå i förhandsvisningen. |
| Relevanta praktiska uppgifter | Exempelvis tillgänglighet, tidigaste start och ungefärligt bostadsområde. Dessa ska kunna läsas direkt som fakta utan att arbetsgivaren måste förlita sig enbart på AI. |
| Matchningsunderlag | Jobbkrav, relevanta belägg från godkända profiluppgifter, källhänvisning och skillnad mellan stöd, uttrycklig motsägelse och okänd uppgift. |
| Ansökningssvar och frivillig video | Endast sådant ungdomen uttryckligen delat för just den aktuella ansökan, med rätt mottagare och åtkomstkontroll. |

### Bostadsområde och arbetsplats är olika uppgifter

- Använd postnummer som underlag när det behövs för ungefärligt bostadsområde/närhet. Visa inte exakt bostadsadress i praktiska uppgifter, matchningsbelägg eller andra automatiskt framställda delar av ansökningsunderlaget. Lämna inte heller ut adressen via API-/databassvar eller precisa bostadskoordinater. Postnummer behöver inte exponeras ordagrant om ett ungefärligt område räcker.
- **Arbetsplatsens adress ska finnas kvar i annonsen och på kartan**, inklusive flera arbetsplatser enligt N14. Den begränsas inte av reglerna för ungdomens bostadsadress.
- Ett uppladdat original-CV kan självt innehålla exakt bostadsadress eller kontaktuppgifter. Förklara att den delade filens innehåll blir synligt; en dold kontaktsektion tar inte bort uppgifter ur PDF:en. Erbjud möjlighet att byta/rätta filen före delning. Lova inte automatisk maskning utan separat implementation och verifiering. Behåll ungdomens uttryckliga val att dela sitt granskade dokument.

### Vad som inte ingår

- Ingen generell Mer om kandidaten-vy eller åtkomst till hela jobbprofilen.
- Inga privata utkast, råa textsamtal/intervjusvar, avvisade eller ogranskade AI-förslag eller orelaterade profiluppgifter. Dessa får inte läcka genom citerade belägg, AI-sammanfattningar, alternativa endpoints, bilagereferenser eller direkta databasfrågor.
- Godkända egna exempel får användas när de är relevanta för jobbkravet, med märkningen Självuppgivet. De får inte omvandlas till verifierad personlighet eller personlighetspoäng.
- Video analyseras inte av AI. Saknad video eller låg/okänd matchningsgrad får inte automatiskt neka eller dölja ansökan. N22 tar bort permanent profilvideo; N23:s ansökningsvideo är alltid frivillig och ger ingen generell profilåtkomst.

### Ungdomens insyn och teknisk åtkomst

- Ungdomen ska kunna förhandsvisa vad just det sökande företaget får se för den aktuella ansökan: CV-version, praktiska uppgifter, relevanta profilbelägg, uttryckligen delade svar och eventuell video. Visa även vilka godkända uppgifter som används för matchningen och skillnaden mellan självuppgift, belägg och bedömning.
- Förhandsvisningen ska spegla verkligt delat innehåll, inte bara en förenklad UI-bild. Ändrade fakta eller delningar måste hanteras konsekvent så att förhandsvisning, CV och företagsunderlag inte motsäger varandra. Dokumentera hur redan skickat underlag uppdateras/versioneras innan detta byggs.
- Definiera en uttrycklig tillåten uppsättning jobbspecifika fält och kontrollera mottagare, företag, jobb och ansökan på server-/databasnivå. Returnera inte hela profilraden till klienten för lokal filtrering. Begränsningen ska omfatta API:er, RPC:er, direkta databasfrågor/RLS och dokument-/videolänkar, även äldre alternativa vägar.
- Intern matchningsbehandling ska också använda relevant, godkänt underlag; den är inte ett skäl att lämna ut hela profilen. Varken råa samtal eller dolda profilfält får bli en bakväg in i företagsvyn genom AI-resultatet.

### Återstående implementation och verifiering

Besluten ovan är krav. Denna dokumentändring bygger inte om UI/API, ändrar inga databasregler och verifierar inte att befintlig produkt redan uppfyller kraven. F26 äger matchning/presentation; N19 äger profilfakta, delningsurval och förhandsvisning. L05 verifierar åtkomstgränser, L07 hela flödet och L09 CV/PDF; N22/N23 styr video.

Före Klar ska testfall visa rätt underlag för rätt ansökan och neka anonym, annat företag och fel jobb/ansökan. Kontrollera verkliga nätverkssvar, direkt databas-/RPC-åtkomst och privata filvägar, inte bara dolda UI-fält. Testa att råa/avvisade/orelaterade uppgifter och exakt bostadsadress inte läcker i strukturerat underlag eller AI-belägg; hantera original-CV med kontaktuppgifter enligt delningsförhandsvisningen. Verifiera direkt läsbara praktiska fakta, självuppgiftsmärkning, sekundär procent med täckningsgrad och att låg/okänd matchning samt avstående från video aldrig automatiskt stoppar eller döljer en ansökan. Kontrollera separat att arbetsplatsens adresser fortfarande syns korrekt i annons/karta.

## CV-mall och kvalitet (N19/L09)

- Enkel svenska och tydliga standardrubriker. Kort presentation, erfarenhet, utbildning, relevanta kunskaper, språk och övriga meriter vid behov. Anpassa avsnittens tyngd efter verkligt underlag; skola/projekt/förening duger när första jobbet saknas.
- Kort presentation omkring 2–3 meningar, normalt högst 45 ord. Konkreta uppgifter/lärdomar med högst ungefär tre korta punkter per erfarenhet. Senaste erfarenhet först när perioderna går att jämföra; vaga perioder bevaras.
- Normalmål en sida för målgruppen; upp till två när innehållet motiverar det. 200–400 ord är riktmärke för AI-text, inte en anledning att fylla ut tunt underlag eller kapa fakta mitt i en mening. Ersätt nuvarande tysta renderingsgräns på 500 ord med synligt urval/kortning som användaren kan styra.
- Inga påhittade titlar, arbetsuppgifter, ansvar, siffror, datum, utbildningsinriktningar eller språknivåer. Intresse är inte erfarenhet. Ingen automatisk egenskap från yrkestitel.
- Mall och regler återanvänds för formulär, textguide, manuell redigering och valfritt nytt CV från PDF-underlag. Original-PDF formateras inte om utan användarens val.
- Verifiera faktisk PDF: kort/tunt/långt innehåll, svenska tecken, kontaktuppgifter, sidbrytningar och inga klippta meningar. Tvinga inte in onödiga uppgifter för att fylla en mall.
- Referens för allmänna råd: https://arbetsformedlingen.se/for-arbetssokande/cv-ansokan-och-intervju/skriva-cv (läst 2026-10-18; 1–2 sidor, relevans och anpassning). Detta är ett produktförslag baserat på råd, ingen certifiering.

## Textguide och hjälp i formulär (N20)

- Textsamtal med en kort fråga åt gången, öppna relevanta följdfrågor och möjlighet att hoppa över, pausa, återuppta och avsluta med utkast. Återfråga inte redan besvarat. Håll flera erfarenheter åtskilda.
- Exempel: ”Jag var fotbollstränare” → ”Vad ansvarade du för?” → ”Jag planerade träningar och ledde tolv barn” → redigerbart förslag med just dessa uppgifter. En föreslagen lärdom eller egenskap måste bekräftas uttryckligt; användaren får ändra eller avvisa.
- I formulär: diskret Hjälp mig utveckla texten under aktuellt avsnitt. Hjälp/följdfråga på samma plats; ingen kedja av popups eller avbrott medan användaren skriver. Manual inmatning fungerar utan AI.
- Visa samlat resultat med relevant granskning; undvik onödig fråga för varje redan uttryckligt faktum. Ingen osynlig automatisk publicering. Bevara råtext bara som privat arbetsmaterial enligt beslutad sparpolicy.
- Återanvänd frågeområden från tidigare röstfunktion; ljud förblir avstängt. Separera logik från Next.js-vyer för framtida Expo-klient.

## Uppladdat CV (N21)

- Valfri Få förbättringsförslag efter uppladdning; befintlig uppladdning ska kunna bli klar utan granskningstjänsten.
- Ge några konkreta tips om saknade arbetsuppgifter, otydliga perioder/språknivåer, struktur och upprepningar. Ställ frågor i stället för att hitta på svar. Begränsa återkopplingens mängd och prioritera värdet.
- Behåll originalet. Godkända kompletteringar kan tillföras profilen, ett nytt CV skapas bara genom aktivt val. Ingen tyst ersättning av originalfil eller inaktuella fakta från äldre dokument. Uppmärksamma kontaktuppgifter/bostadsadress i uppladdade CV och använd samma förhandsvisning av verkligt delat innehåll som N19; dokumentets innehåll skyddas inte genom att dölja separata kontaktfält.
- Återanvänd privat PDF-läsning; redovisa läsbegränsningar och skannade/oläsbara filer. Ett lyckat uppladdningsanrop är inte ett bevis på lyckad genomläsning.

## Senare – inga aktiva bygguppdrag

- Jobbanpassade CV-versioner från godkända fakta med granskning före användning.
- Premiumlyft: placering, märkning, varaktighet och effekt inom relevanta/behöriga resultat måste bestämmas separat.
- Mer utvecklad rangordning och rättvis exponering av äldre relevanta annonser när användningsdata finns. Ingen slentrianmässig prioritering av flest ansökningar.
- Påminnelse att bekräfta fortsatt rekrytering och eventuell paus av övergivna annonser; tidsgräns, undantag och förhandsinformation återstår att besluta.

Dessa framtidsspår följs i MatchnWork-Idebank.md. Betalning och e-post ändras inte. Videobeslutet uppdaterades uttryckligen 2026-10-18 enligt N22/N23 nedan.


## Videotillägg 2026-10-18 (N22/N23)

Permanent profilvideo ska bort från profil, profilbyggande och kandidatvy. Video behålls separat i chatt. Företag ska kunna be om en jobbspecifik video i samband med ansökan, men ungdomen får avstå och ansökan ska skickas ändå. Obesvarad förfrågan, kamerafel eller uppladdningsfel får inte skapa en spärr; erbjud komplettering efter skickad ansökan utan stopp i swipeflödet. Ingen automatisk poängsänkning eller bortsortering när video saknas, och ingen AI-analys av video. Detta ersätter äldre förslag om profilvideo och obligatoriska videokrav, även för framtida premium. Fullständiga åtgärder och verifieringskrav finns i ATGARDSPLAN.md, N22/N23. Här dokumenteras beslutet; funktionen är inte implementerad genom dokumentändringen.
