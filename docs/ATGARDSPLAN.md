# MatchnWork gemensam åtgärdsplan

Gemensam arbetslista för de kommande två veckorna. Följ den globala ordningen nedan. P1 måste åtgärdas före lansering, P2 prioriteras därefter och P3 tas när kärnflödena är säkrade. F = befintlig funktionalitet, N = ny funktion, D = design och text.

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

| Ordning | ID | Prioritet | Åtgärd | Status | Ansvarig |
|---|---|---|---|---|---|
| 1 | [F01](#f01) | P1 | Gör profilbyggaren tillgänglig | Pågår | Vilgot / Codex |
| 2 | [F02](#f02) | P1 | Stoppa påhittade fakta i AI CV | Ej påbörjad | — |
| 3 | [F03](#f03) | P1 | Samordna CV text och strukturerade profilfakta | Ej påbörjad | — |
| 4 | [F04](#f04) | P1 | Rätta företagets första navigation | Ej påbörjad | — |
| 5 | [F05](#f05) | P1 | Gör matchningsanalysen begriplig och användbar | Ej påbörjad | — |
| 6 | [F06](#f06) | P1 | Förklara pris och anställningsavgift | Ej påbörjad | — |
| 7 | [F07](#f07) | P1 | Bevara bilden i sparade annonsutkast | Ej påbörjad | — |
| 8 | [N01](#n01) | P1 | Redigera hela publicerade annonsen | Ej påbörjad | — |
| 9 | [N02](#n02) | P1 | Återkalla ansökan och väntande intresse | Ej påbörjad | — |
| 10 | [D01](#d01) | P2 | Rätta knapparna i profilintroduktionen | Ej påbörjad | — |
| 11 | [F08](#f08) | P2 | Tydliggör verifieringsunderlag och handläggning | Ej påbörjad | — |
| 12 | [F09](#f09) | P2 | Anpassa publicering till verifieringsstatus | Ej påbörjad | — |
| 13 | [F10](#f10) | P2 | Återanvänd redan sparade uppgifter | Ej påbörjad | — |
| 14 | [F12](#f12) | P2 | Förbättra kompletteringsfrågornas innehåll | Ej påbörjad | — |
| 15 | [F11](#f11) | P2 | Visa vad AI överför till annonsfälten | Ej påbörjad | — |
| 16 | [F22](#f22) | P2 | Validera inmatning nära fälten | Ej påbörjad | — |
| 17 | [F13](#f13) | P2 | Rätta status för väntande ansökningar | Ej påbörjad | — |
| 18 | [F14](#f14) | P2 | Gör notiser och lässtatus användbara | Ej påbörjad | — |
| 19 | [N03](#n03) | P2 | Visa annonsutkast i översikten | Ej påbörjad | — |
| 20 | [D02](#d02) | P2 | Håll chattens skrivfält inom vyn | Ej påbörjad | — |
| 21 | [F20](#f20) | P2 | Gör integritet villkor och hjälp lätta att nå | Ej påbörjad | — |
| 22 | [F23](#f23) | P2 | Ge val och dialoger korrekt tillgänglighet | Ej påbörjad | — |
| 23 | [F15](#f15) | P2 | Förenkla ungdomens första steg | Ej påbörjad | — |
| 24 | [F16](#f16) | P2 | Ge ett stabilt nästa steg efter färdigt CV | Ej påbörjad | — |
| 25 | [N08](#n08) | P2 | Erbjud CV utan obligatorisk AI | Ej påbörjad | — |
| 26 | [N04](#n04) | P2 | Öppna en läsbar företagsprofil från annonsen | Ej påbörjad | — |
| 27 | [N05](#n05) | P2 | Lägg till strukturerade praktiska jobbuppgifter | Ej påbörjad | — |
| 28 | [F17](#f17) | P2 | Samla anställningsflödet i en tydlig ingång | Ej påbörjad | — |
| 29 | [N07](#n07) | P2 | Ångra det senaste bortvalet i swipe | Ej påbörjad | — |
| 30 | [N06](#n06) | P2 | Utöka jobbsökningen med relevanta val | Ej påbörjad | — |
| 31 | [F18](#f18) | P2 | Förbättra sparande i profilredigeringen | Ej påbörjad | — |
| 32 | [F24](#f24) | P2 | Gör kartans reservvy användbar | Ej påbörjad | — |
| 33 | [N09](#n09) | P2 | Spara CV utkast på kontot | Ej påbörjad | — |
| 34 | [D05](#d05) | P2 | Förklara produkten direkt på startsidan | Ej påbörjad | — |
| 35 | [D09](#d09) | P3 | Placera feedback vid rätt åtgärd | Ej påbörjad | — |
| 36 | [F25](#f25) | P3 | Slå samman likvärdiga förmåner | Ej påbörjad | — |
| 37 | [D03](#d03) | P3 | Ge kriteriernas textfält mer plats | Ej påbörjad | — |
| 38 | [D06](#d06) | P3 | Gör status och profilprogress begripliga | Ej påbörjad | — |
| 39 | [D04](#d04) | P3 | Öka padding på kartans kortknapp | Ej påbörjad | — |
| 40 | [D07](#d07) | P3 | Rätta mikrocopy och varumärkestext | Ej påbörjad | — |
| 41 | [F21](#f21) | P3 | Förtydliga konto och företagsuppgifter | Ej påbörjad | — |
| 42 | [F19](#f19) | P3 | Gör filterdialogens beteende tydligt | Ej påbörjad | — |
| 43 | [D08](#d08) | P3 | Gör tomvyer och sidbredder konsekventa | Ej påbörjad | — |
| 44 | [N10](#n10) | P3 | Ge grundläggande kontoval | Ej påbörjad | — |

## Nya funktioner

<a id="n01"></a>
### N01 Redigera hela publicerade annonsen

- [ ] Klar
- Prioritet: P1
- Global ordning: 8
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
- Global ordning: 9
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Ge ungdomar möjlighet att ta bort väntande intresse innan automatisk sändning och återkalla en skickad ansökan med tydlig status. Visa vad som händer med en eventuell match eller chatt.
- Klar när: Användaren kan ändra sig och får ingen oavsiktligt skickad ansökan.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n03"></a>
### N03 Visa annonsutkast i översikten

- [ ] Klar
- Prioritet: P2
- Global ordning: 19
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Lägg en synlig Återuppta utkast-post bland företagets annonser med titel, aktuell del och senast sparat. Skilj utkast från publicerade, pausade och stängda annonser. Koppla till bildsparandet i F07.
- Klar när: Ett sparat utkast går att hitta utan att välja Ny annons.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n08"></a>
### N08 Erbjud CV utan obligatorisk AI

- [ ] Klar
- Prioritet: P2
- Global ordning: 25
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Visa Skriv själv som ett tydligt val från början, med samma sparade fakta och redigering som AI-guiden. AI ska vara en valfri hjälp och PDF-uppladdning ett separat alternativ.
- Klar när: Ungdomen kan skapa och färdigställa CV utan att generera AI-text.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n04"></a>
### N04 Öppna en läsbar företagsprofil från annonsen

- [ ] Klar
- Prioritet: P2
- Global ordning: 26
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
- Global ordning: 27
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Komplettera annonsen med start eller flexibelt startläge, schema eller omfattning, anställningsperiod, sista ansökningsdag och antal tjänster. Håll det enkelt och tillåt Ej bestämt där det är rimligt.
- Klar när: Ungdomen kan jämföra arbetstid och tidsram utan att leta i fri text.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="n07"></a>
### N07 Ångra det senaste bortvalet i swipe

- [ ] Klar
- Prioritet: P2
- Global ordning: 29
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
- Global ordning: 30
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
- Global ordning: 33
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
- Global ordning: 44
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

- [ ] Klar
- Prioritet: P1
- Global ordning: 1
- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch/PR: `fix/f01-profile-builder-20261013`
- Åtgärd: Åtgärda hämtningen i profilbyggaren så att tillgänglighet, kunskaper och egna exempel går att öppna. Ge fungerande återförsök och en väg tillbaka vid fel.
- Klar när: Profilbyggaren öppnas utan hämtningsfel och ett tillfälligt fel går att återhämta utan dataförlust.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f02"></a>
### F02 Stoppa påhittade fakta i AI CV

- [ ] Klar
- Prioritet: P1
- Global ordning: 2
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: AI får inte göra våren 2026 till exakta månader, ändra flytande svenska till modersmål eller lägga till en obekräftad yrkestitel. Bevara osäkerhet och använd bara uppgifter som ungdomen lämnat.
- Klar när: CV och profil innehåller inga nya sakuppgifter utan användarens uttryckliga godkännande.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f03"></a>
### F03 Samordna CV text och strukturerade profilfakta

- [ ] Klar
- Prioritet: P1
- Global ordning: 3
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Låt användaren granska och rätta både CV-text och profilfakta i samma flöde. En rättad text får inte lämna motsägande datum eller språknivåer i profilen som används för matchning.
- Klar när: Samma faktauppgifter används i CV, profil och matchningsunderlag; fria formuleringar kan fortfarande redigeras.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f04"></a>
### F04 Rätta företagets första navigation

- [ ] Klar
- Prioritet: P1
- Global ordning: 4
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

- [ ] Klar
- Prioritet: P1
- Global ordning: 5
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Utred varför bedömningen inte blir läsbar och säkerställ att beräkningen slutförs eller visar ett hanterbart fel. Visa Beräknar, Klart eller Kunde inte uppdateras, senaste uppdatering och återförsök.
- Klar när: Företaget kan läsa ett färdigt underlag eller förstå och återhämta ett fel; en avstängd knapp blir inte ett oklart slutläge.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f06"></a>
### F06 Förklara pris och anställningsavgift

- [ ] Klar
- Prioritet: P1
- Global ordning: 6
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Beskriv den avsedda avgiften, vad som utlöser den, vem som faktureras och när. Gör gratis konto och eventuell avgift vid anställning begripliga på prissidan och före anställningsregistrering. Förklara också en aktiv rekrytering och 20 kandidater, inklusive vad som händer vid gränsen.
- Klar när: Företaget kan förstå hela prismodellen innan ett avgiftsutlösande steg. Visa bara gränser som faktiskt gäller.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f07"></a>
### F07 Bevara bilden i sparade annonsutkast

- [ ] Klar
- Prioritet: P1
- Global ordning: 7
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Spara omslagsbilden och beskärningen tillsammans med resten av annonsutkastet. Använd inte en generell Utkast sparat-bekräftelse om någon del saknas; ange då exakt vad som återstår att spara.
- Klar när: Bild, text och praktiska uppgifter finns kvar när utkastet återöppnas efter omladdning.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f08"></a>
### F08 Tydliggör verifieringsunderlag och handläggning

- [ ] Klar
- Prioritet: P2
- Global ordning: 11
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
- Global ordning: 12
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Anpassa knapp, förhandsvisning och bekräftelse till om företaget är godkänt. Före godkännande ska det framgå om annonsen sparas eller väntar på publicering och om den publiceras automatiskt efter beslut.
- Klar när: Ingen vy lovar omedelbar publicering när annonsen fortfarande väntar på verifiering.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f10"></a>
### F10 Återanvänd redan sparade uppgifter

- [ ] Klar
- Prioritet: P2
- Global ordning: 13
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
- Global ordning: 14
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
- Global ordning: 15
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
- Global ordning: 16
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Hindra omvända löneintervall och orimliga åldersspann innan förhandsvisning och sparande. Ge begripliga svenska feltexter där appen styr dem och tydlig datumhjälp utan att förutsätta webbläsarens lokala format.
- Klar när: Fel kan rättas vid rätt fält utan att en missvisande annons visas.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f13"></a>
### F13 Rätta status för väntande ansökningar

- [ ] Klar
- Prioritet: P2
- Global ordning: 17
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
- Global ordning: 18
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Skriv person eller företag och jobb i match- och meddelandenotiser. Öppna rätt konversation direkt. Återställ lässtatus och badges när motsvarande händelse är hanterad; skilj historiska händelser från kvarvarande uppgifter. Ge diskret CV-påminnelse för väntande intresse.
- Klar när: Notiser leder till rätt ärende och signalerar bara det som fortfarande behöver uppmärksamhet.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f20"></a>
### F20 Gör integritet villkor och hjälp lätta att nå

- [ ] Klar
- Prioritet: P2
- Global ordning: 21
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Lägg tydliga ingångar till befintlig integritetsinformation, AI-användning, villkor och kontakt på publika sidor och vid registrering samt konsekvent i båda rollerna. Förklara hur CV och profil används.
- Klar när: Relevant information och hjälp är åtkomliga där användaren fattar beslut; den nödvändiga saktexten är genomgången.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f23"></a>
### F23 Ge val och dialoger korrekt tillgänglighet

- [ ] Klar
- Prioritet: P2
- Global ordning: 22
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
- Global ordning: 23
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Låt kort onboarding leda direkt till jobbupptäckt med en diskret möjlighet att bygga profil senare. Förklara att CV behövs för att skicka ansökan, medan övriga profildelar och kompletteringsfrågor är valfria.
- Klar när: Ungdomen kan börja utforska utan ytterligare obligatorisk profilintroduktion eller stopp i swipeflödet.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f16"></a>
### F16 Ge ett stabilt nästa steg efter färdigt CV

- [ ] Klar
- Prioritet: P2
- Global ordning: 24
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Ta bort tidsstyrd navigation som gör succésrutans ansökningslänk svår att använda. Låt användaren själv välja nästa steg eller gå direkt till ansökningarna med tydlig bekräftelse på vad som skickats.
- Klar när: Bekräftelsen och dess länkar hinner läsas och användas.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f17"></a>
### F17 Samla anställningsflödet i en tydlig ingång

- [ ] Klar
- Prioritet: P2
- Global ordning: 28
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
- Global ordning: 31
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Låt användaren stanna vid den del som redigeras efter sparande. Använd sparknappar per del eller en tydlig gemensam sparfunktion. Skilj ifylld information från faktiskt sparad information i progressen.
- Klar när: Sparbekräftelsen är korrekt och användaren tappar inte sin plats.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="f24"></a>
### F24 Gör kartans reservvy användbar

- [ ] Klar
- Prioritet: P2
- Global ordning: 32
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
- Global ordning: 36
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
- Global ordning: 41
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
- Global ordning: 42
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Välj ett konsekvent beteende: direkt filtrering med tydlig stängning eller tillämpning med möjlighet att avbryta. Visa aktiva filter och gör rensning lätt att hitta.
- Klar när: Det är tydligt om stängning behåller eller avbryter valen.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

## Design och text

<a id="d01"></a>
### D01 Rätta knapparna i profilintroduktionen

- [ ] Klar
- Prioritet: P2
- Global ordning: 10
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: På /profile/build?welcome=1 ska Bygg din profil ha text och pil på samma rad. Centrera texten i Skapa den senare vertikalt och ge knapparna konsekvent höjd, mellanrum och padding.
- Klar när: Ingen pilrad eller stor tom yta under sekundärtexten.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d02"></a>
### D02 Håll chattens skrivfält inom vyn

- [ ] Klar
- Prioritet: P2
- Global ordning: 20
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Beräkna chattens höjd med hänsyn till navigation och sidrubrik. Låt meddelandeytan skrolla separat och håll skrivfält samt Skicka åtkomliga, även på liten skärm och när tangentbordet visas.
- Klar när: Skrivfältet hamnar inte nedanför den tillgängliga vyn.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —

<a id="d05"></a>
### D05 Förklara produkten direkt på startsidan

- [ ] Klar
- Prioritet: P2
- Global ordning: 34
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
- Global ordning: 35
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
- Global ordning: 37
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
- Global ordning: 38
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
- Global ordning: 39
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
- Global ordning: 40
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
- Global ordning: 43
- Status: Ej påbörjad
- Ansvarig: —
- Branch/PR: —
- Åtgärd: Visa ett relevant nästa steg i tom chattsida i stället för Välj en matchning när ingen finns. Samordna marginaler och innehållsbredder mellan upptäck, profil, ansökningar och chatt, med avsiktliga undantag för tvåspaltsvyer.
- Klar när: Tomvyer ger användbar väg vidare och layouten känns sammanhängande.
- Implementerat: —
- Verifierat: —
- Återstår / blockerare: —
