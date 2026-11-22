# F12 / F20 / D07 – kravinformation och hjälp

- Ansvarig: Vilgot / Codex
- Branch: `codex/f12-f20-d07-help-20261111`
- Status: Pågår; reserverad före kodarbete.
- F12: återhämtningsbar, annonsbunden läsning av befintlig publik kravinformation. Ingen ny analys eller fråge-/profildelning.
- F20: offentlig hjälp och konsekventa ingångar från registrering, integritetsvy och kontoinställningar.
- D07: gemensamma benämningar/kontaktadress och sakliga instruktioner om befintliga CV-/ansökningsvägar.
- Slutlig juridisk saktext och pausad AI-/profilåteranvändning ingår inte. Inga nya databaskällor eller mailutskick.

## Leverans

F12: kravinformationen lämnar laddningsläge även vid ett kastat nätverksfel, kan läsas igen och uppdateras. Svar hör till rätt annons och aktuellt konto; bara annonsens publika text visas. Fel och avbrott förändrar inte ansökan eller svaren.

F20: /help ger hjälp med konto, CV, ansökningar och arbetsgivarens vyer. Den nås utan konto från marknadssidfot, inloggning/registrering och integritetsvy samt från kontoinställningar för ungdom, företag och uppdragsgivare. Hjälpsidan använder marknadsnavigation även för inloggade.

D07: samma benämningar för Hjälp och kontakt respektive Integritet och AI samt befintlig gemensam kontaktadress. CV-hjälpen skiljer privat arbetsutkast från färdigt CV och redan delat underlag; inga löneutbetalningar eller automatiska stödmejl utlovas.

## Verifiering

- Före/efter-prov: den gamla kravkomponenten saknar återförsök efter kastat nätverksfel; den nya passerar.
- 15 modell-/SDK-prov över simulerad transport: publik fältprojektion, rätt annons/konto, begränsat format, timeout, avbrott och fel. Komponentprov med faktiska callbacks och simulerade hooks/DOM: läslås, uppdatering, sena svar, avmontering och effektrepetition.
- Kompletterings-, delnings-, profil-, företagsnavigations- och autentiseringsregressioner, TypeScript, riktad lint, designtokens och produktionsbygge kontrolleras inför publicering.

Slutlig juridisk saktext/villkor (F20/L15), F12:s bredare profilåteranvändning och inloggad mobil-/webbacceptans återstår. Dessa tre kort markeras inte Klar genom denna avgränsade leverans.

## F20 – granskningsunderlag för sluttexterna

| Var texten ska visas | Befintligt beteende att beskriva | Uppgifter som behöver bekräftas |
|---|---|---|
| Registrering för arbetssökande | Länken före kontoskapandet leder till information om profil och ansökan. | Ansvarig och kontaktväg, ändamål och grund samt hur användare mellan 15 och 17 år ska få informationen och godkänna vad som krävs. |
| Registrering för företag | Länken leder till information om företagskontot, verifiering och kandidatvyn. | Ansvarsfördelning, slutliga användarvillkor och hur företagens egna uppgifter om personuppgiftsbehandling ska lämnas till sökande. |
| AI-hjälp för CV | CV-hjälpen är valbar. Användaren får granska och redigera förslaget före sparning. | Vilka leverantörer som får vilka uppgifter, var de behandlas och vilka lagringstider som faktiskt gäller. |
| Ansökan och kandidatvyn | Sökande kan se vad som delas. Kompletteringsfrågor är frivilliga. Arbetsgivaren fattar rekryteringsbeslutet. | Slutlig text om matchningsanalysen, arbetsgivarens hantering och ansvarsfördelningen mellan MatchnWork och arbetsgivaren. |
| Kontoinställningar och hjälp | Båda rollerna når integritetsinformation och ärendeflödet. Hjälpsidan har en kontaktväg för den som saknar konto. | Fastställd text om tillgång, rättelse, radering och lagring, inklusive vilka källor och filer som kräver handläggning. |

Förslag till text i en specifik annons när arbetsgivaren har fyllt i sina uppgifter:

> [Arbetsgivare] tar emot underlaget för den här ansökan för att hantera rekryteringen. Du kan fråga [kontakt] om hur arbetsgivaren hanterar dina uppgifter. I [arbetsgivarens integritetsinformation] kan du läsa vilken behandling som görs, hur länge uppgifterna sparas och hur du når arbetsgivaren.

Fyll i och granska företagsuppgifterna samt besluten i L14 och L15 innan texten används som slutlig information.

## F20 – samlat textunderlag för granskning

| Moment | Text om funktion och mottagare | Beslut eller bevis inför skarp publicering |
|---|---|---|
| Konto och profil | MatchnWork använder kontouppgifter för inloggning, profil, support och säkerhet. Uppgifter hämtas från användaren och tjänstens kontohändelser. Frågor skickas till den befintliga kontaktvägen. | Fastställ den juridiska aktörens identitet och kontakt, grund per ändamål och information för minderåriga. |
| Ansökan | Företaget tar emot underlaget för den aktuella ansökan och fattar eventuella rekryteringsbeslut. Vid återkallelse spärras åtkomsten i tjänsten. | Fastställ ansvar per moment, relevant grund, vilka företagsspecifika upplysningar som visas före delning och innehållet i eventuell artikel 26-sammanfattning. |
| Valbar AI-bedömning | Den som aktiverar bedömning kan få underlaget analyserat för framtida ansökningar. Leverantören kan behandla relevanta delar. Avstängt val stoppar nya analyser. Företaget fattar beslutet. | Bekräfta produktionens mottagare, faktisk lagring, överföringar och rättslig grund. Granska konsekvensbedömning och klassificering i L15. |
| Lagring | Föreslagen normalfrist är sex månader efter avslut för ansökningsunderlag och tolv månader för avslutade rättighetsärenden. Utdragets nedladdningsåtkomst i tjänsten är en timme. | Kontrollera aktiverade jobb, undantag, säkerhetskopior och leverantörsfrister enligt L12–L15 innan frister beskrivs som löften om faktisk radering. |
| Rättigheter | Ansökan om tillgång, rättelse, radering, invändning, begränsning och dataportabilitet finns i ärendevyn. Mejl fungerar som ingång utan konto. Granskad leverans kräver ny verifiering. | Gå igenom vem som svarar för varje behandling och hur klagomål till IMY, identitetskontroll och företagets kontakt kommuniceras. |

Förslag till text om grundregler i plattformen inför villkorsgranskningen: företaget använder underlaget för den aktuella rekryteringen, hanterar det i enlighet med den information företaget har lämnat och fattar själv rekryteringsbesluten. MatchnWork tillhandahåller konto, kontaktväg och teknisk hantering av ansökningar. Separata villkorsversioner och avtalsaccept hör till L15.

Bakgrund för granskningen: [IMY:s vägledning om ändamål, mottagare, lagring och ansvar](https://www.imy.se/globalassets/dokument/vagledningar/en-praktisk-guide.pdf).
