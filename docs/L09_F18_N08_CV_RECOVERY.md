# L09/F18/N08 – säkert CV-sparande och PDF-förhandsvisning

- Ansvarig: Vilgot / Codex
- Branch: `codex/l09-f18-n08-cv-recovery-20261110`
- Status: För granskning, PR #196; reserverad före kodarbete.
- L09: kontobunden PDF-uppladdning/verifiering och omedelbart reserverad förhandsvisning med avbrott/timeout.
- F18: tydlig skillnad mellan sparat CV, okänt resultat och väntande ansökningar; läsåterförsök utan dubbelt sparande.
- N08: skydd i manuellt CV-flöde, kontobyte, dubbelklick och sena svar utan nya AI-anrop.
- Befintliga profilfält, granskning/godkännande och server-/RLS-gränser bevaras. Ingen schemaändring, automatisk filradering, ny delningsregel eller produktion.

## Implementerat

- Separat klient med kontrollerad token och ungdomsroll per fas. Ägarfilter på profil, privat filreferens och kontroll av aktuell identitet runt asynkrona operationer. Den delade sessionen ersätts inte.
- Ett profilsparförsök per uppgift; vid okänd kvittens görs separat återläsning som jämför just den granskade texten/fakta eller dokumentreferensen. Utkast rensas först när sparningen bekräftats. Sparat CV skiljs från okänd status för väntande ansökningar.
- PDF-header, tillåten MIME/filändelse och 5 MB kontrolleras före uppladdning. Saknad MIME normaliseras till PDF med oförändrade bytes. Unik privat sökväg och upsert false; Storage-metadata verifieras innan profilreferensen sparas. Detta är formatkontroll, ingen säkerhetsskanning eller garanti att varje PDF kan läsas.
- Känd uppladdad fil återanvänds efter profilsparfel. Osäker uppladdning kan kontrolleras utan ny filskrivning; separat uttryckligt val sparar sedan PDF-referensen. Välj PDF igen avbryter det lokala fortsättningsförsöket. Ingen automatisk radering av filer efter osäker kvittens; övergivna filer kan därför behöva hanteras separat.
- PDF-förhandsvisning reserverar fönstret direkt och använder befintlig skyddad dokumentöppning med kontokontroll, validerad privat länk, timeout och avbrott. Uppladdningsvyn förklarar att dokumentets eget innehåll kan delas i en ansökan.
- Synkront lås, nycklat konto och avbrott stoppar dubbla klick/sena UI-svar. AI väljs fortfarande uttryckligt; genereringsbegäran binds till rätt konto och har tidsgräns. Inga nya modellpass. Efter bekräftat CV används befintlig serverväg för väntande ansökningar högst en gång; dess befintliga bakgrundsanalys bevaras utan extra klientstyrd analysomgång.

## Verifiering och begränsningar

- `test:cv-save-recovery`: verklig service/installerad SDK mot simulerad Auth/Storage/PostgREST och verkliga komponentcallbackar med kontrollerade hooks/DOM. Testar ägare/roll/token, förnyad samma-kontosession, exakt godkännande, skyddade dokument/fält, spar-/läsfel, ofullständigt svar, okänd uppladdning, återanvändning utan extra filskrivning, popup, avbrott och kontobyte.
- Manuellt CV-test med två samtidiga klick fallerar mot bas dev `ee47342` med två sparningar och passerar med en sparning efter rättningen. Det är lokal reproduktion, inga dubbla verkliga profiler eller ansökningar skapades.
- Regressioner: `test:manual-cv`, `test:profile-journey`, `test:uploaded-cv-binding`, `test:open-youth-document`, `test:cv-document`, `test:cv-pdf`, `test:cv-quality`, `test:application-overview`. TypeScript, riktad lint och fullt bygge kontrolleras före merge. PDF-testet använder verklig PDF-generering/-läsning med fiktivt innehåll.
- Full inloggad upload/granskning/sparning/ansökningsresa och fysisk mobil/webbläsare återstår. Ingen live-RLS-/Storage-behörighetskontroll påstås genom de simulerade proverna. Ingen skarp fil, profil, ansökan eller AI behandlas av agenten här.
- Befintlig databas/RLS och fältmodell bevaras. Ingen ny serverversionskontroll för samtidiga profilredigeringar i flera flikar införs. Hela L09/F18/N08 markeras inte Klar genom delimplementationen. Driftsättningsresultat anges i PR; produktion ändras inte.
