# F26/N19 – uppskattat avstånd från postnummer

- Status: För granskning (leveransen), huvudkorten F26 och N19 förblir Pågår
- Ansvarig: Vilgot / Claude
- Branch: `claude/f26-n19-postal-proximity-20261112`, reservation `f0b6189` publicerad före kodarbete
- Bas: dev efter PR #210; öppna PR:er kontrollerade (endast äldre #40)

## Beslut om metod

Användaren lät Claude välja metod 2026-11-12. Vald metod är en **statisk öppen postnummertabell på servern**, inte geokodning hos Mapbox.

- Ungdomens postnummer lämnar aldrig servern. Inget nytt leverantörsflöde behöver läggas till i L14.
- Resultatet är deterministiskt och kan testas utan nätverk. Matchningen påverkas inte av en geokodningstjänsts tillgänglighet.
- Mapbox villkor för tillfällig geokodning tillåter inte att resultat lagras, vilket hade krävt ett anrop per bedömning.

Källa: GeoNames postnummerfil för Sverige, CC BY 4.0, www.geonames.org. Tabellen byggs om med `node scripts/generate-postal-places.mjs <SE.txt>` och ligger i `lib/server/postal-places-se.json` (18 887 postnummer, 1 613 punkter, 3 603 intervall, 117 kB, endast på servern).

## Precision och vad raden säger

Tabellen har precision på **postortsnivå**: alla postnummer i en postort delar punkt. Avståndet räknas därför ort mot ort, mellan ungdomens postort och annonsens arbetsorter, och redovisas i breda intervall:

| Beräknat avstånd | Text |
|---|---|
| under 10 km | samma ort eller närområde, under cirka 10 km |
| 10–25 km | cirka 10–25 km |
| 25–50 km | cirka 25–50 km |
| 50–100 km | cirka 50–100 km |
| 100 km eller mer | över 100 km |

Raden i matchningsunderlaget lyder: ”Uppskattat avstånd mellan egen postort och närmaste arbetsort: … (beräknat från postnummer, inte från adress)”. Den nämner varken postnummer, ort eller bostadsområde och drar ingen slutsats om lämplighet.

- Flera arbetsorter: den närmaste kända orten avgör.
- Okänt eller felskrivet postnummer, okänd arbetsort eller ortnamn som finns på flera platser längre än 10 km från varandra (60 namn) ger **ingen rad**. Inget avstånd gissas.
- Inom en storstad kan verkligt avstånd vara upp till ett par mil trots att raden säger ”samma ort eller närområde”. Det är en känd följd av precisionen.

## Var raden används

Raden beräknas på servern i de tre vägar som bygger matchningsunderlag: bakgrundsarbetaren, företagets bedömnings-API och ungdomens kompletteringsanalys. Den läggs i både det interna underlaget och det delade underlaget, så att ett belägg som citerar raden kan visas för företaget. Det röjer inte mer än orten, som redan ingår i ansökans praktiska uppgifter. Postnumret och adressen tas fortsatt bort av den befintliga minimeringen.

Ungdomens förhandsvisning förklarar nu att ett ungefärligt avstånd mellan postort och arbetsort används när postnummer är angivet, aldrig adressen.

Ingen databasändring, inga nya fält, ingen ny företagsåtkomst och inga nya AI-anrop. För ungdomar med känt postnummer ändras underlagets kontrollsumma, så nästa bedömning räknas om i stället för att läsas från cache.

## Faktiskt körda kontroller

- `test:approximate-distance`: 34 kontroller mot den verkliga tabellen och de verkliga källbyggarna. Tabellens källa och intervall, postnummer med och utan mellanslag, elva ogiltiga indata, ortnamn oavsett skiftläge, osäkra nycklar, intervallgränser, kända avstånd (Malmö–Lund, Stockholm–Uppsala, Göteborg–Stockholm), närmaste ort, ingen rad vid okänd indata, att raden saknar postnummer och ortnamn, att matchningstexten får raden men aldrig postnummer eller adress, och att företaget bara får ett citat när raden finns i det delade underlaget.
- Regressioner som passerar: saved-answers, application-disclosure, disclosure-loading, matching-fairness, followup-batch, assessment-progress, assessment-snapshot, application-supplement, application-withdrawal, server-failures och bakgrundsarbetarens test. Två testramverk som ersätter importer fick den nya funktionen tillagd som tom ersättare.
- TypeScript utan fel, riktad ESLint utan fel och standardproduktionsbygge passerar. Tabellen och radens text finns inte i klientpaketen.

## Begränsningar och det som återstår

- Ingen verklig modellkörning och ingen inloggad kontroll: hur modellen använder raden i en riktig bedömning ingår i [L17](ATGARDSPLAN.md#l17).
- Avståndet är fågelvägen mellan ortspunkter, inte restid eller resväg.
- Tabellen är en ögonblicksbild; nya postnummer utanför befintliga intervall ger ingen rad tills tabellen byggs om.
- `test:openai-migration` faller redan i dev (förväntar en endpoint-text som saknas i tre filer) och berörs inte av leveransen.
