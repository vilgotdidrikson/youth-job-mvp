# L13 – dialoginteraktioner och tidsgräns

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-export-interaction-review-20261102`
- Offentlig reservation före kodarbete: `1d799fb`, från dev efter #168. Aktuell dev/öppna PR:er kontrollerade.

## Samlad verifiering och rättningar

Komponentens verkliga callbacks körs nu med kontrollerade React-hooks, Auth och DOM-objekt. 13 scenarier verifierar dubbelklick, lösenordstömning, stängning, kontobyte, avmontering, sena svar, tidsgräns, kända/okända fel, misslyckat länkklick och frigöring av Blob-URL. Inga riktiga konton eller paket används.

Tre relaterade brister är rättade: tidsgräns visar nu sanningsenligt att paketet kan ha skapats men nedladdningen inte kunde bekräftas, utan automatisk ny beställning. En sparad submit-callback efter avmontering startar inget arbete. Om browserklicket kastar ett fel tas ankaret bort och Blob-URL frigörs direkt; enbart lyckade klick får hålla URL tills den ordinarie fristen löper ut. Övriga fel-/avbrottsfall återanvänder samma städning.

Den tidigare komponenten kördes mot den nya sviten och misslyckades vid återanrop efter avmontering. Den rättade komponenten passerar samtliga 13 kontroller. Tidsgränsprovet använder verklig timeout-callback och kontrollerar den nya statusen; klickprovet injicerar ett kastat DOM-fel och kontrollerar båda städningsstegen. Detta är kontrollerade callbackprov, inte faktiskt browserbeteende.

## Faktiskt verifierat

- test:export-control: 13 komponentprov passerar.
- test:account-export: 18 klientprov passerar.
- test:export-preview-download: 53 server-/SDK-/ZIP-prov passerar.
- TypeScript, riktad ESLint och diff-check passerar. Totalt 84 namngivna kontroller.
- React-granskning: synkron dubbelklicksspärr, kontonycklad instans, avbrott, sena resultat och avmonteringsskydd. Gemensam dialog/fokusretur och befintliga formulär-/mobilstilar bevaras.

## Begränsning

Den tillgängliga lokala Playwright-installationen saknade körbar Chromium. Ingen verklig DOM-, visuell-, fysisk mobil- eller Safari-nedladdning påstås. De kontrollerna samt hela autentiserade flödet, komplett innehåll, asynkron status/återhämtning och övervakad städkörning återstår före aktivering.

Ingen flagga, serverroute, databas, Storage, cron eller produktion ändras. Exportprovet är fortsatt avstängt. Global åtgärdsplan lämnas byteidentisk; leveranschecklista finns här och i PR.

## Senare lokal browseracceptans

Chromium kunde därefter köras separat från produktberoendena. [Lokal browseracceptans](L13_LOCAL_BROWSER_ACCEPTANCE.md) redovisar 49 verkliga DOM-/nedladdningskontroller med fiktiv Auth/HTTP, inklusive mobilbredder. Begränsningen ovan beskriver läget vid #169; fysisk mobil/Safari och autentiserad backendacceptans återstår.
