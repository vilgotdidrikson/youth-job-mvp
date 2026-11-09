# N06/F19/N18 – sammanhängande sökning och jobbflöde

- Status: För granskning
- Ansvarig: Vilgot / Codex
- Branch: `codex/n06-f19-n18-discovery-20261109`
- Bas: dev `e8e1d6069e3003864ed70701362f3fac9182aeeb`; inga öppna dev-PR:er vid kontroll 2026-11-09.
- Reserverad före kodarbete på användarens beställning om tre punkter per leverans. N06: lönefilter med uttryckligt belopp/enhet och tydlig okändhantering, gemensamt för kort/karta. F19: redigera filter lokalt och tillämpa atomärt; stängning/Escape/avbryt behåller tidigare val; aktiva filter/rensning. N18: använd strukturerad redan angiven arbetstid för mjuk relevans och fyll kortsidor från återstående jobb, utan tomt flöde efter första sidans bortval.
- Fortsätt egna N06/N18 och reservera lediga F19; inget övertagande av Max designarbete. Tidigare punkter har kvar dokumenterade gransknings-/aktiverings-/profil-/AI-/prisberoenden. Ingen ny datakategori, lagring, AI, migration, RLS eller produktion. Visuell ombyggnad skjuts upp enligt användarens instruktion; återanvänd befintliga komponenter och tokens.
- Verifiera verklig domänlogik och sid-/dialogcallbacks med fiktiva värden; redovisa separat vad som inte kan verifieras i riktig browser/mobil. Markera inte hela punkter Klar utan verifierad acceptans.


## Leverans – PR #184

### N06 – jämförbar lön i sökningen

- Val för timlön/månadslön och valfri minsta annonserad lägstalön. Återanvänder annonsbyggarens befintliga strikta belopps-/enhetsläsare och valideringsgränser. Ingen omräkning mellan timme/månad, tolkning av vag kravtext eller ny AI.
- Intervall bedöms efter lägsta beloppet. Enbart ”upp till” anger ingen lägstalön: ett tak under önskat belopp avvisas; övriga fall behandlas som okända när användaren tillåter detta. Känd annan enhet eller känd för låg lägstalön räknas aldrig som okänd.
- Valet att ta med okända uppgifter omfattar nu även jämförbar lön. Kort och kartlista visar varför ett inkluderat jobb har okänt löneunderlag. Samma matchningsfunktion och URL-parametrar används i båda vyerna; felaktiga/ogiltiga parametrar normaliseras bort. Inga nya profiluppgifter samlas in. Befintlig åldersavgränsning i feed bevaras.

### F19 – transaktionell filterdialog

- Dialogval är lokala till Tillämpa filter. Kryss, Avbryt, Escape och klick utanför dialogen behåller tidigare filter. Även Rensa filter i dialogen kräver tillämpning. Rensa utanför dialogen rensar direkt och atomärt.
- Valideringsfel visas vid lönevalet och hindrar tillämpning. Samma sändningscallback körs bara en gång även vid två snabba submit. Avmonterade dialogcallbacks kan inte skriva tillbaka val.
- Aktiva chips visar lönetyp/belopp tillsammans. Radering av lönetyp tar även bort beloppet; radering av centrum tar även bort radien. Ingen delvis uppdaterad filtergrupp.
- Återanvänder befintlig ModalDialog med fokus-/Escape-/bakgrundsbeteende och befintlig CSS-modul. Textinput använder samma kontrollstil som select och befintlig 16 px-token. Ingen visuell ombyggnad eller övertagande av designarbete.

### N18 – fortsatt flöde och strukturerad arbetstid

- Filter och redan valda kort avgränsar först underlaget; den synliga sidan fylls sedan från kvarvarande jobb. Efter första 20 valen visas nästa kvarvarande kort direkt. Resultatantal och Visa fler använder samma kvarvarande underlag. Misslyckad sparning återställer jobbets ursprungliga plats.
- Strukturerade kvälls-/helg-/vardagstider kan ge en liten mjuk relevanssignal från redan angiven tillgänglighet. Strukturerade uppgifter väger före gamla exakta kravfraser; fritext tolkas inte till nya fakta. Delvis överlapp beskrivs som överlapp, inte säkerställd lämplighet. Okänt ger ingen negativ poäng.
- Tidigare ordning för ovisat/sett, företagsvariation, nyhet, hårda filter och spärrar för redan ansökta/dolda/otillgängliga annonser bevaras. Ingen AI-bedömning eller automatisk rekryteringsåtgärd införs.

## Faktisk verifiering 2026-11-09

- `test:discovery-filters` kör verkliga domänfunktioner och faktiska filter-/modal-/swipe-callbacks med simulerade React-hooks, DOM och transport. Löneenheter, intervall/lägsta/tak, okända/motstridiga uppgifter, felaktiga URL-värden, URL-rundtur, validering, atomär rensning, Avbryt/Escape/bakgrund/innerklick, dubbelsubmit och frikopplade callbacks passerar.
- Verklig swipe-sida med 45 fiktiva jobb: 20 beslut följs direkt av kort 21; antal, Visa fler, misslyckat beslut och atomärt byte/rensning verifierade.
- Före/efter: `DISCOVERY_PAGE_REF=e8e1d6069e3003864ed70701362f3fac9182aeeb node scripts/test-discovery-filters.mjs` faller på tidigare sidans tomma kortlista efter beslut 20. Samma test passerar mot ändrad sida. Detta är komponentprov, inte browserbevis.
- `test:job-search`, `test:job-discovery`, `test:discovery-undo`, `test:job-fields`, `test:job-practical`, `test:map-fallback`, `test:job-categories`, TypeScript, riktad ESLint för ändrade kod-/testfiler, diffkontroll och standardbygge passerade. Bygget har befintlig metadataBase-varning.
- Ingen ny live-QA-data, profil-/backend-/schema-/RLS-/miljöändring eller kontakt med mottagare. Generella tillgänglighetstestets tidigare företagsfliksavvikelse ligger utanför dessa filer och har inte körts om som en godkänd kontroll.

## Återstående acceptans

- Inloggad browser/mobil, verklig tangentbords-/fokusvisning och faktisk kort/karta-navigering behöver verifieras. DOM-/transportprov är inte den verifieringen; huvudpunkterna kryssas inte Klar.
- Lönefilter lovar jämförelse av uttryckligt annonserade belopp. Det omfattar inte vaga lönetexter, OB/provision, valutaomräkning eller garanterad slutlig lön. Valda filter är sökval, inget sparat privat CV-/profilmaterial.
- PR: https://github.com/vilgotdidrikson/youth-job-mvp/pull/184. Slutlig commit och dev-deployment redovisas i PR:n.
