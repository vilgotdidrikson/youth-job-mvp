# Profilflöde och informationsöversyn – 2026-10-14

Omfattning: ungdomens profil, CV, frivillig video och kompletterande jobbuppgifter. Ingen datamigrering eller ändring av behörigheter ingår.

## Informationskällor och användning

| Information | Sparas | Användning och redigering |
| --- | --- | --- |
| Kontaktuppgifter | Ägarens `youth_profiles`: namn, födelsedatum/ålder och adress | Kontoinställningar. Ålder används även i jobbflödets åldersfilter. Kontaktformuläret uppdaterar bara dessa fält; det skriver inte över CV eller kompletterande profil. |
| CV | Godkänd CV-text, `cv_structured`, kompatibilitetsfält och eventuella dokumentreferenser | CV-visning, PDF, ansökningar och faktaunderlag till matchning/komplettering. Befintlig faktagranskning och gemensamma sparväg behålls. |
| Kompletterande jobbprofil | `recruitment_profile` med `recruitment_profile_version` | Fyra delar: vad jag söker, när jag kan jobba, kompletterande kunskaper och egna exempel. Befintlig sektions-RPC kontrollerar ägare och förväntad version. Används som kompletterande faktaunderlag. |
| Profilvideo | Befintligt videoregister och privat Storage | Frivillig presentation och uttrycklig delning i chatt. Tidsbegränsade signerade länkar; ingen automatisk personlighetsanalys. |
| Pågående formulär och nästa steg | Formulärminne och befintliga lokala utkast; separat användarbunden lokal återupptagningsmarkör | Navigationshjälp. Att öppna, pausa eller hoppa över ett steg markerar inte uppgifterna som sparade. |

Matchningsunderlaget läser fortfarande både godkänt CV och kompatibilitetsfält samt kompletterande jobbprofil. Dessa lagrade former raderas eller migreras inte i denna leverans. En befintlig PDF är ett sparat dokument och ändras inte automatiskt när andra uppgifter ändras.

## Genomförda förenklingar

- Fast flöde i sex steg: CV → Video → Vad jag söker → När jag kan jobba → Kunskaper → Egna exempel. Tydligt stegantal, bygg senare, paus och aktivt val efter sparning. Video och kompletterande delar är frivilliga.
- Översikt, Din jobbprofil och Inställningar ersätter den långa ungdomsvyn. CV, video och allmän jobbprofil öppnas i varsin ram. Kontaktuppgifter redigeras under Inställningar.
- Dubbel redigering av CV-fakta i kontaktformuläret har tagits bort. Befintliga fakta finns kvar och används som förifyllning där det är relevant.
- Språk från strukturerat CV visas som CV-ägda uppgifter i kunskapsdelen; bara ytterligare språk läggs till där. Nya språknivåer får inget antaget standardvärde. Äldre sparade överlapp skrivs inte om i bakgrunden.
- Faktasammanfattningen visar läsbara etiketter och värden, utan rå JSON eller interna evidensfält. Strukturerade CV-fakta prioriteras framför äldre motsvarande fält i denna sammanfattning.
- CV-bekräftelsen ligger kvar tills användaren väljer nästa åtgärd. Kontaktändringar och kompletterande profiländringar behåller vald vy. Ramar skyddar mot stängning under sparning och varnar vid osparad CV-/profilredigering.

Namn och ort i kontot och ett redan sparat CV kan skilja sig. Kontaktvyn förklarar därför att användaren även ska kontrollera sitt CV. Automatisk omskrivning av godkänt CV skulle kunna ändra en redan avsedd presentation och görs inte.

## Kontroller och manuellt acceptanstest

Automatiserade tester täcker stegordning, länkar, återupptagningsmarkörens tillåtna värden, datumvalidering, ägarfilter och en simulerad verklig kontaktuppdatering som lämnar CV och jobbprofil orörda. Befintliga tester körs för profilhämtning, CV-faktagranskning/sparning, matchning, kompletteringsfrågor och videohantering. Simulerade transport- och kameraanrop är inte ett fysiskt kameratest.

Prova i dev med ett fiktivt ungdomskonto:

1. Välj Bygg senare och kontrollera att jobb går att utforska. Starta sedan profilbygget och kontrollera sex steg med CV först och video sedan.
2. Spara CV, vänta och kontrollera att bekräftelsen ligger kvar. Välj Ja, fortsätt respektive Nej, jag fortsätter senare. Återuppta efter sidladdning.
3. Öppna kameran: ingen inspelning före Starta. Spara eller hoppa över video och kontrollera nästa-steg-frågan. Prova kamera/mikrofon på avsedda mobil- och datorwebbläsare.
4. Öppna varje profilram. Redigera/spara och avbryt redigering. Kontrollera varningen för osparade ändringar och att vald allmän profildel ligger kvar efter sparning.
5. Ändra kontaktadress; kontrollera att CV-text, CV-fakta och kompletterande jobbprofil behålls.
6. Kontrollera chatt på vanlig stor datorskärm samt liten mobilskärm med tangentbord: större meddelandeyta, separat meddelandeskroll och åtkomligt skrivfält/Skicka.

Autentiserad visuell verifiering är ännu inte genomförd: testwebbläsarens kvarvarande inloggningsskydd blockerar åtkomst. Produktionsbygge och tester ersätter inte detta acceptanstest.
