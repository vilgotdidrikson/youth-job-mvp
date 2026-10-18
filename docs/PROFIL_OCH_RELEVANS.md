# Jobbprofil, relevans och matchning

Beslutad av Vilgot 2026-10-18. Detta är en byggspecifikation; status, reservation och leveransbevis följs i `ATGARDSPLAN.md`. All utveckling sker i dev/DevStaging. Ingen premiumfunktion eller debitering aktiveras genom beslutet.

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
- Skilj uppfyllt, uttryckligen motsagt och okänt. Saknad uppgift är aldrig samma sak som underkänd. Krav, meriter och sådant som kan läras på jobbet hålls isär.
- Självuppgivna personliga egenskaper och godkända exempel visas med källa och tydlig karaktär av egen uppgift. De ger inte poäng tills ett nytt uttryckligt beslut fattats. Systemet intygar inte personlighet.
- Befintlig beräkning skiljer poäng på bedömda kriterier från underlagstäckning. Granska begriplighet och risk för missvisande höga siffror med tunt underlag. Likvärdiga fakta ska ge samma bedömning oberoende av formulering eller textlängd.
- Råa intervjusvar, avvisade AI-förslag, tidigare ersatta fakta och känsliga attribut får inte tillföras som kandidatmeriter. Företaget fattar beslutet. Video analyseras inte av AI.
- Testa synonympar, negationer, motsägelser, svagt underlag, relevanta följdsvar, ändrade profiler och text utan belägg. Kontrollera både synligt underlag och verkligt API-/regelresultat. F05:s slutförande innebär inte att denna kvalitetsgranskning redan passerat.

## Profilen är grunden; CV är ett urval (N19)

| Del | Innehåll och användning |
| --- | --- |
| Godkänd jobbprofil | Erfarenheter, utbildning, kunskaper, språk, egna exempel, önskemål och tillgänglighet. Tillgängligt för behörig matchning enligt befintliga synlighetsregler. |
| Grund-CV | Ett kort, generellt och granskat urval av profilens uppgifter. Samma version används tills ungdomen ändrar den. Inte automatiskt olika CV för olika ansökningar. |
| Arbetsmaterial | Intervjusvar och ofärdiga/ogranskade förslag. Inte publicerade fakta, inte belägg i matchning. Förklara synlighet/sparning och låt användaren radera. |

- Huvudflödet heter Bygg din profil. Formulär, textguide och uppladdat CV är alternativa ingångar till samma datamodell; skapa inte tre separata profiler eller dubbla språk-/erfarenhetskällor.
- Återanvänd och utveckla befintlig faktagranskning och samordnad sparning (F02/F03). Godkännande gäller exakt aktuell version; återställ vid ändring. Visa vad som går till CV respektive bara profilen. Att godkänna en omformulering är inte oberoende verifiering av uppgiften.
- Gör inte nytt konto-/profilbyggande eller frivillig förbättringshjälp till ett nytt stopp i swipeflödet. Bevara regler för när ansökan kan skickas och val att fortsätta senare.
- Inga relevanta godkända profilfakta får försvinna för att CV:t kortas. Redan separat uppladdat CV kan avvika; skilj originaldokument och nytt genererat dokument och undvik motsägande publicerade fakta.

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
- Behåll originalet. Godkända kompletteringar kan tillföras profilen, ett nytt CV skapas bara genom aktivt val. Ingen tyst ersättning av originalfil eller inaktuella fakta från äldre dokument.
- Återanvänd privat PDF-läsning; redovisa läsbegränsningar och skannade/oläsbara filer. Ett lyckat uppladdningsanrop är inte ett bevis på lyckad genomläsning.

## Senare – inga aktiva bygguppdrag

- Jobbanpassade CV-versioner från godkända fakta med granskning före användning.
- Premiumlyft: placering, märkning, varaktighet och effekt inom relevanta/behöriga resultat måste bestämmas separat.
- Mer utvecklad rangordning och rättvis exponering av äldre relevanta annonser när användningsdata finns. Ingen slentrianmässig prioritering av flest ansökningar.
- Påminnelse att bekräfta fortsatt rekrytering och eventuell paus av övergivna annonser; tidsgräns, undantag och förhandsinformation återstår att besluta.

Dessa framtidsspår följs i MatchnWork-Idebank.md. Denna specifikation ändrar inte äldre orelaterade beslut om video, betalning eller e-post.
