# L13 – sammanhängande lagrad nedladdning

- Status: För granskning; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-stored-download-flow-20261101`
- Offentlig reservation före kodarbete: `1538437`, från dev efter PR #166. Aktuell dev och öppna PR:er kontrollerade.

## Samlad leverans

HTTP-provet kopplar nu ihop befintlig konto-/sessionskontroll, lösenordsverifiering, insamling, privat lagring och binär nedladdning. Efter lyckad verifiering/insamling reserveras ett servergenererat export-ID. Paketet byggs med samma begränsade automatiska policy, laddas upp utan overwrite och läses sedan tillbaka från privat Storage. Storlek, SHA-256, ägare, status och utgångstid verifieras av lagringsmodulen. Slutlig session och giltighet kontrolleras igen efter filhämtningen innan några ZIP-bytes lämnas ut.

HTTP-svaret använder de kontrollerade lagrade bytesen och visar paketets verkliga expiresAt i X-MatchnWork-Export-Expires. Inga objektsökvägar, signerade länkar eller serverhemligheter skickas till klienten. Paketet är fortsatt uttryckligen ofullständigt; fritext/filer och andra väntande delar blir inte automatiskt godkända.

Upptaget aktivt paket ger 409 utan att det befintliga paketet ändras. Lagrings-/integritets-/utgångsfel nekar hela svaret. Om ett reserverat paket inte kan lämnas ut markeras det för städning med separat tvåsekunders väntbudget. Vid avbruten transport eller misslyckad kvittering ansvarar den redan införda arbetaren för övergivna byggen och sena uppladdningar. Serviceklientens Storage-transport omfattas av requestens avbrott, totalbudget och cacheförbud. Fel lösenord eller insamlingsfel reserverar inget paket.

## Fortsatt avstängt

Ingen miljöflagga, cron eller exportfunktion aktiveras. Utöver den befintliga dev-/previewspärren krävs MATCHNWORK_EXPORT_STORAGE_READY=true. Den får bara sättas efter verifierad och övervakad städkörning. Saknad flagga ger 503 före Auth eller filarbete. Flaggan är en operatörsspärr, inte automatisk bevisning att cron fungerar. Inga tabeller, RPC:er, buckets eller rättigheter ändras i denna leverans.

Reservation sker efter den befintliga verifierings-/insamlingsoperationen. En ny beställning kan därför behöva samla underlag innan den får busy. Detta är ett synkront dev-prov, inte den planerade asynkrona beställnings-/statusvyn eller stöd för senare återhämtning av samma färdiga paket.

## Faktiskt verifierat

- test:export-preview-download: 53 lokala kontroller av faktisk route/ZIP och lokal HTTP. SDK-integrationen kör alla riktiga serverhjälpare och paketering med lokalt signerad ES256-token mot simulerad Auth/Data/Storage. Framgång omfattar riktig serialisering av reservation, privat upload, ready-kvittering, återhämtning och slutlig sessionskontroll.
- Felprov omfattar upptaget paket, nekad uppladdning, korrupt lagrad fil, metadata som löper ut under läsningen och utgång precis före HTTP-svar. Inga ZIP-bytes lämnas ut vid fel. Befintliga request-, identitets-, lösenords-, kvot-, avbrotts- och sekretessprov ingår.
- Lagringsmodulens 33 och sessionsmodulens 37 regressionsprov passerar (totalt 123 lokala kontroller). TypeScript, riktad ESLint och diff-check passerar.
- Tidigare verkliga Storage-/workerprov finns i L13_LIVE_EXPORT_CLEANUP.md. Inga nya verkliga användarkonton/filer eller autentiserade fjärranrop görs här; den nya sammanhängande HTTP-kedjan är verifierad med simulerad fjärrtransport.

## Återstår

Övervakning och återkommande städkörning, asynkron beställning/status/nedladdning, gränssnitt, verklig autentiserad helkedja, separat anslutningssamtidighet och fullständigt innehåll/verksamhetsinformation. L13 markeras inte Klar. Ingen AI eller produktion. Global åtgärdsplan och befintlig Auth-katalog lämnas byteidentiska; checklistan finns här och i PR.
