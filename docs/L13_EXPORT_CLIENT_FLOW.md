# L13 – kontobunden klientnedladdning

- Status: För granskning; L13 som helhet Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-export-client-flow-20261102`
- Offentlig reservation före kodarbete: `eba57c9`, från aktuell dev efter #167. Öppna PR:er kontrollerade.

## Samlad leverans

Avstängd exportprovskontroll i ungdomens, företagets och privatpersonens kontoinställningar. Komponenten visas bara när NEXT_PUBLIC_EXPORT_PREVIEW_UI är exakt true och databas-URL är den sedan tidigare fastställda DevStaging-URL:n. Inga flaggor ändras. Serverns oberoende dev-/lagringsspärrar gäller fortfarande. Senare miljöbyte kräver verifierad projektmappning; denna PR ändrar inte miljöer.

Dialogen återanvänder ModalDialog och befintliga formulär-/knappstilar, fokusretur, tryckytor och mobilbredd. Den förklarar uttryckligen att paketet är ofullständigt. Lösenord töms vid skickning/stängning; ingen credential sparas i lokal lagring. Synkron ref-spärr stoppar dubbelklick. Stängning, kontobyte och avmontering avbryter väntan. Blob-URL frigörs efter 30 sekunder, vid kontobyte eller avmontering.

Klienten tar en tokensnapshot och skickar endast Authorization-header samt konto/lösenord i JSON till befintlig serverroute. Lokal session är inte ett behörighetsbevis; servern verifierar identitet och lösenord. Redirects nekas, credentials/cookie-forwarding avstås och cache förbjuds. Samma konto och token måste finnas kvar efter mottagning. Filtyp, fast serverfilnamn, ofullständig täckningsmarkering, utgångstid, deklarerad/faktisk storlek (max 64 MiB) och ZIP-signatur kontrolleras före Blob-utlämning. Signaturen får sträcka sig över flera nätverkschunkar. Rå serverfeltext visas inte. Hängande sessions-/streamväntan är avbrytbar. Svar på inaktuella anrop får inte starta en nedladdning efter avbrott.

## Faktiskt verifierat

- test:account-export: 18 lokala klientprov med simulerad Auth/HTTP, inklusive fel konto före lösenordsskickning, kontobyte, säkra statusfel, ogiltiga headers/filnamn/storlekar/utgång, faktisk bytegräns, delad ZIP-signatur och avbruten hängande stream.
- test:export-preview-download: 53 befintliga integrerade server-/SDK-/ZIP-prov passerar.
- test:profile-journey inklusive verklig SDK-transport mot simulerad datakälla passerar. Ingen ny profilskrivning införs.
- TypeScript, riktad ESLint och diff-check passerar. React-granskning omfattar stabila refs, avbrytning/avmontering, kontonycklad instans, namngiven modal, live-status, lösenordslabel och gemensamma mobilstilar.

## Begränsningar och nästa steg

Inga flags/exporträttigheter, databas-/Storage-inställningar, cron eller produktion ändras. Ingen faktisk webbläsar-/mobilnedladdning eller UI-callbacktest med riktig DOM påstås. Särskilt Safari, tangentbord, avbrott, nedladdningsstart och fokus ska verifieras innan aktivering. Framgångsmeddelandet säger endast att nedladdning startats, inte att operativsystemet har sparat filen.

Fullständigt innehåll och verksamhetsinformation, asynkron beställning/status, återhämtning av tidigare paket, övervakad städkörning, faktisk autentiserad helkedja och samtidighet återstår. Detta är ett avstängt dev-prov, inte ett fullständigt registerutdrag eller ett nytt lanseringsbeslut. Global åtgärdsplan lämnas byteidentisk; leveranschecklista finns här och i PR.
