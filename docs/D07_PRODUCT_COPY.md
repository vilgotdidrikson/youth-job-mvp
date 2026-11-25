# D07 – produkttexter och kontaktvägar

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/d07-product-copy-review-20261102`
- Offentlig reservation före kodarbete från dev `9a16642`; öppna PR:er kontrollerade.
- Slutför kvarvarande D07-textarbete: antal, rollanpassad tillbaka-länk, aktuellt varumärke/kontakt, kort onboarding/manuellt CV och sakliga produktlöften. Ingen layoutövertagning av D05/DA-04, ingen AI/databas/produktion. Verifiering och kvarvarande acceptans dokumenteras här.

## Slutfört textarbete

- Singular/plural i företagets kandidatantal och ungdomens CV-besked: 0/2 ansökningar, 1 ansökan. Frivilliga kompletteringar beskrivs som kan kompletteras.
- Annonsens tillbaka-länk följer skyddad kontoroll i både normal- och felvy: företag → Mina annonser, privat uppdragsgivare → Dina uppdrag, ungdom → Upptäck. Behörigheter och ansökningslogik ändras inte.
- Prissidans kvarvarande hej@employo.se ersätts med bekräftad info@matchnwork.se. Detta utser ingen ny särskild integritetsansvarig eller ärendeinkorg.
- Kort registrering skiljs från senare CV; manuellt CV, AI-hjälp och uppladdat CV beskrivs som alternativ. Texten lovar inte längre stöd genom löneutbetalningen, kännedom om individen eller automatisk kandidatsortering/screening. Webbläsare på mobil/dator preciseras utan löfte om en native-app. Employer branding ersätts med svensk etikett.
- Äldre employo-nycklar i lokal-/sessionslagring bevaras av kompatibilitetsskäl; de är inga synliga varumärkestexter. Inga data raderas eller migreras.

## Verifiering

Genomläst slutlig diff mot D07:s namngivna textkriterier. Riktad ESLint utan nya problem och diff-check passerar. Sju körda kontroller av antal 0/1/2 och alla tre roller/okänd roll använder den verkliga gemensamma formatteraren. Befintliga company-navigation och manual-cv-prov passerar. Standardproduktionsbygge med TypeScript passerar. Ingen ny AI, databas, behörighet, layout eller produktion.

Textkriteriernas kodarbete är slutfört i denna leverans. Inloggad visuell acceptans och tidigare logotyp-/appinstallationsacceptans har inte körts här; de påstås inte vara godkända. D07 kan därför inte okvalificerat räknas som fullständigt accepterad enbart genom denna leverans. Den globala åtgärdsplanen lämnas byteidentisk; utförd textdel och kvarvarande acceptans framgår här och i PR.
