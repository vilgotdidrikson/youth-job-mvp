# N14/N15/F07/N03 – sammanhängande annonsflöde

- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch: `codex/n14-n15-drafts-20261108`
- Bas: dev `a8febe66692461016b154a338e5504d18195a8f2`; öppna PR:er kontrollerade, inga returnerade.
- Reservation före kodarbete 2026-11-08. Fortsätt de egna pågående punkterna N14/N15/F07/N03 och kontrollera N16:s slopade platsantal i samma flöde. Avgränsning: kontobundna bild-/textutkast, annonskopia och flera arbetsplatser samt nödvändiga rättningar. Inga AI-anrop, nya persondatafält eller produktionsändringar. Andras designuppgifter övertas inte.
- Granskningsfokus: verklig återupptagning efter omladdning, skydd av befintligt utkast vid kopiering, konflikt mellan öppna flikar och korrekt publiceringsstädning. Nuvarande dokumentation anger att flera flikar saknar konfliktlösning; undersök och rätta förlust av ett nyare utkast innan vidare acceptans.
- Planerat: riktade regressioner, bygge och riktiga browser-/DevStaging-prov med tillfälliga fiktiva konton där miljön stöder det. Ett lokalt eller simulerat prov räknas inte som live-acceptans. Huvudpunkterna markeras inte Klar utan deras fullständiga kriterier.

## Resultat

Leverans: [PR #180](https://github.com/vilgotdidrikson/youth-job-mvp/pull/180). Grundreservation publicerad före kodarbete i `127813f`. Arbetet fortsätter inom samma avgränsade annonsflöde.

### Reproducerat och ändrat

- Oförändrad dev-kod reproducerar båda dataförlusterna i IndexedDB-emulatorn: en gammal fliks autosparning skriver över ett nyare utkast, och gammal publiceringsstädning raderar ett nyare utkast.
- Lokal lagring jämför och skriver revision i en enda IndexedDB-transaktion. En innehållsfri raderingsmarkör hindrar även en gammal tom flik från att återuppliva ett publicerat utkast. Befintliga kompletta poster kan läsas utan migrering eller tyst omskrivning. Text, beskurna bildbytes och steg förblir en atomisk post.
- Hooken ordnar egna sparningar, stoppar autosparning efter en konflikt och bevarar osparad text/bild. Öppna sparat utkast kräver uttrycklig bekräftelse; avbryt bevarar den lokala redigeringen. Kopiering får inte ersätta en annan fliks nyare utkast.
- Publicering tar en ny lokal revision före uppladdning/skickande och städar bara den revisionen efter framgång. Dubbla klick i samma vy stoppas synkront. Ett senare utkast bevaras vid städningskonflikt; redan skapad annons rapporteras som skapad, inte som misslyckad publicering. Företagsidentiteten binds till formulärets konto och verifieras igen efter geografihämtning.
- Båda arbetsplatsredigerarna skickar den ursprungliga arbetsplatslistan som jämförelsevillkor. PostgreSQL jämför JSONB-listan i samma UPDATE som sparar den. En inaktuell redigering får ett konfliktmeddelande och behåller sin text; en annan ny titel behöver inte blockera en oförändrad arbetsplatslista. Ingen schema-, policy- eller behörighetsändring.
- Ungdomens arbetsplatsval får egen komponentnyckel för jobb, ungdom och läsläge. Kontobyte, sena läs-/skrivsvar och avmonterade callbacks kan inte flytta ett gammalt val till en annan vy. Gemensam läshantering ger 15 s gräns/återförsök. Osäkert sparresultat beskrivs utan att lova att servern rullat tillbaka. Historisk adress och frivillighet bevaras. Inline-avstånd har ersatts av en avgränsad CSS-modul med befintliga tokens.

### Faktisk verifiering

- `test:job-drafts`: verklig lagringsmodul med fake-indexeddb och faktiska hookcallbacks. Separata lagringsinstanser ger exakt en vinnare; gammal autosparning/kopia/radering nekas; tombstone, återläsning, bevarade bildbytes, köordning, kvot/transaktionsfel, konto-/unmount-isolering och ny publiceringsrevision provas. Detta är ingen fysisk webbläsardisk.
- `test:job-create-submission`: faktisk JSX-handler, två anrop i samma bildruta, konto, lokal revision före filuppladdning, rätt städningstoken, inget platsantalsfält och lyckad annons trots separat kriterie-/städningsvarning. Transport simulerad.
- `test:workplace-preference`: faktiska komponentcallbacks, konto-/jobb-/läslägesnycklar, dubbla klick, scopefilter, osäkert svar, bevarat val, borttagning, timeout/återförsök, läsläge/historisk adress och sena svar efter avmontering. Även arbetsplatsredigerarens ursprungliga serverlista, konflikttext/bevarad redigering, dubbelklick/stängningsspärr och avmonterad callback. HTTP simulerad.
- `test:job-copy`, `test:job-workplaces`, `test:job-edit`, `test:job-publication`, `test:job-fields`, `test:company-navigation` passerar. Publiceringstestets gamla importstub rättad till den verkliga praktiska-faktafunktionen; ingen produktregel ändrad. `check:design-tokens` passerar med 538 färgliteraler, 140 textstorlekar, 56 radier och 10 vikter. Riktad ESLint utan fel (befintlig img-varning i företagsvyn), TypeScript och standardbygge med 59 routes passerar.
- `test:live-job-workplaces`, körning `qa-workplaces-1794167699948-c608a2d9`: **34 verkliga kontroller**, exit 0 och remainingFixtureIds=[]. Riktig Auth, SDK/Data API, RLS och Storage; enda testanpassningen är att applikationens klient-singleton pekar på respektive riktig QA-session. Ingen nätverks-/databas-/Auth-mock.
- Liveprovet verifierar exakt bildhash, två adresser/primäradress, slopat användarvalt platsantal, dolt overifierat företag, annonskopia från aktiv/pausad/stängd med separata nya arbetsplats-ID:n, exakt lön och separat publik/intern kravtext. Kopiering ändrar ingen byte i originalraden; ny kopia är en separat rekrytering. Två verkliga adresspar från samma bas ger en vinnare och en vanlig begränsad konflikt. Ett nytt uttryckligt försök bevarar en ny titel. Borttagen primäradress promoverar nästa adress/koordinater. Tom lista och dubbla plats-ID:n nekas i databasen. Fel företag/ungdom nekas kopiering och direkt uppdatering.
- Första backendförsöket stoppades när fixturen försökte stänga annonsen direkt. Det normala kravet på rekryteringsresultat var korrekt; testet använder nu `recruitment_action(close_job, no_hire)`. Det avbrutna försöket räknas inte som helt godkänt. Alla tre egna konton städades även där.

### Begränsningar och blockerad fördjupning

Den lokala Chromium-processen kunde inte öppna sockets i arbetsmiljön. Ett tillfälligt konto raderades via eget konto-API; inga jobb hann skapas. Cloud-browser når driftsatt dev men inte localhost och kräver säker användaröverlämning för inloggning. Inget inloggat browser-/mobiltest påstås för denna leverans. `test:live-job-drafts` är ett förberett protokoll, inte ett godkänt fullständigt UI-prov.

Det utökade HTTP-provet för ungdomens arbetsplatsönskemål krävde verifierad QA-arbetsgivare. Automatisk säkerhetsgranskning nekade en planerad transaktion med tillfälligt adminmedlemskap för en QA-granskare, eftersom särskilt godkännande för behörighetsändringen saknades. Ingen sådan behörighet eller verifiering infördes. En lokalt skriven verifieringsmarkör korrigerades efter avslaget; den fortsatta körningen är inte godkänd evidens. Protokollet kräver nu även faktisk läsning av verifieringsstatus innan det kan fortsätta; en markör är aldrig behörighet eller verifieringsbevis. Inga alternativa privilegievägar har använts. Fördjupningens positiva preferens-/snapshot-/återkallelseprov återstår, liksom ny fysisk browseracceptans.

Lokala versionskontroller gäller uppdaterade klienter på samma origin/enhet och är ingen synkning eller serverbackup. Redan laddad äldre kod kan sakna kontrollen. Arbetsplatsvillkoret är en innehållsjämförelse av just `workplaces`, inte en allmän annonsversion; gamla annonser med tom arbetsplatslista och ändringar enbart via äldre adressfält är inte fullständigt versionsskyddade. Ingen generell serveridempotens för osäkert publiceringssvar eller samtliga samtidiga klienter påstås. N14/N15/F07/N03 behåller tidigare huvudstatus tills deras återstående användarkriterier är verifierade.


### Avbruten fördjupning och kvarvarande teststädning

Körningen `qa-workplaces-1794167939920-aadc30d4` är avbruten och räknas inte som godkänd. Processen kunde inte återupptas efter säkerhetsavslaget och dess ursprungliga QA-lösenord fanns endast i processminnet. En efterkontroll visar tre kvarvarande fiktiva konton, två ej publicerade QA-annonser och en geometrisk testbild under företagets prefix. Noll QA-adminmedlemskap finns. Inga riktiga personer, rekryteringar eller betalningar ingår.

Även ett försök att återställa just dessa QA-kontons lösenord för att använda den normala fil-/kontoraderingsvägen nekades av automatisk säkerhetsgranskning: särskilt godkännande för privilegierad lösenordsändring saknades. Inga lösenord ändrades, inga behörigheter infördes och inga ytterligare vägar runt avslagen har använts. Städningen kräver ett separat godkännande eller en redan behörig operatör som raderar testfilen och kontona i ordinarie administration.

Berörda fiktiva identiteter: företag `285bd17c-ffeb-4d16-9abd-3c89bf4771aa`, andra företaget `bed18123-b3d5-47fe-bd96-4923823dade5`, ungdom `fdc35efc-034b-40cc-9c86-0a0bf8dfd6ef`. Den normala lyckade 34-kontrollskörningen och de tidigare avbrutna försöken är städade; detta undantag gäller endast den blockerade fördjupningen.


### Slutverifiering efter samordning

Dev fick under arbetet Max leverans i PR #181 (`4aae30f`). Den har mergats in i arbetsbranchen med Git utan konflikter. Bådas ändringar i företagsvyn, paketets scripts och åtgärdsplanen är bevarade; Max design-/förmåns-/navigationsändringar har inte skrivits över. Efter integration passerar annonskopiering, arbetsplatser, lokala utkast, publiceringshandler, arbetsplatsval/redigerare, annonsredigering, gemensam företagsnavigation och Max förmånsregression. Standardbygge med TypeScript och 59 routes passerar.

Den sista backendkörningen `qa-workplaces-1794168640960-f909ecc4` passerar **35 faktiska kontroller** med slutlig produktkod: tidigare 34 fall plus att riktig Auth stoppar publicering för ett annat formulärkonto före första jobbskrivningen. Detta vanliga körläge gör ingen verifierings-/adminändring och kör inte den blockerade preferensfördjupningen. Städningsresultat och efterkontroll anges i den avslutande PR-uppdateringen. Den blockerade äldre kohortens tre konton/två dolda annonser/en testbild är fortfarande ett separat städningsundantag.

Slutkörningen avslutades med exit 0, cleanup PASS och remainingFixtureIds=[]. Separat skrivskyddad efterkontroll visar noll konton, noll annonser och noll filer för just slutkörningen. Noll QA-adminmedlemskap finns. Den blockerade äldre kohorten är uttryckligen undantagen och fortfarande i behov av godkänd städning.
