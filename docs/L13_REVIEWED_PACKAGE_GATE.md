# L13 – granskningsgräns före paketering

Reserverad före kodarbete 2026-10-30: Vilgot / Codex, `codex/l13-reviewed-package-gate-20261030`, från dev efter #159. Koppla aktuell intern insamling till befintlig paketbyggare via uttryckligt granskat underlag och fingerprint som avvisar inaktuell/kontofrämmande granskning. Ingen automatisk juridisk bedömning av fritext, granskning via vanlig klient eller publik exportaktivering. L13 fortsatt Pågår.


## Leverans

lib/server/reviewed-personal-data-export.ts kopplar ett aktuellt internt granskningsunderlag till befintlig paketbyggare via explicit PersonalDataReviewApproval. Granskningen anger konto, fingerprint, granskare/tid, kategoriernas granskade projektioner och varje fils beslut. Funktionens anropare MÅSTE auktorisera en betrodd granskare eller granskad serverpolicy; vanlig användarinmatning får aldrig bli approval. Ingen sådan API eller granskningsvy byggs här.

Fingerprint är deterministisk SHA-256 över aktuella värden och filbytes, oberoende av ordning på objektfält. Typ/längdmarkeringar, begränsade JSON-/filbudgetar, djup/nodgräns, cykelkontroll och avvisade getters/prototyper/icke-JSON-tal används. Filbytes är inte delade minnesbuffertar. Proxytraps är ingen sandbox: serverägda objekt krävs. Fingerprint är en intern bindning, INTE en autentiseringsbiljett, signatur eller bevis att en granskare har behörighet.

Ändrat underlag ger stale_review. Kontot måste matcha i underlag/insamling/granskning; granskartid måste följa insamlingen och föregå paketskapandet. En kategori med olästa/otillgängliga eller tomt definierade källor får inte markeras included/not_applicable. Den måste fortsatt vara requires_review/unavailable. Detta är avsiktligt konservativt: även externt tillförd information behöver först representeras i ett nytt underlag, inte användas för att kringgå täckningskontrollen.

Varje originalfil måste motsvaras av ett granskningsbeslut med samma ägare, bucket, namn och MIME. En inkluderad fils bytes måste vara identiska med originalet; saknad fil kan inte uppgraderas till inkluderad och godtyckliga filer kan inte läggas till. Granskare kan hålla inne filbytes med requires_review/unavailable. Maskerade eller på annat sätt ändrade filer stöds inte i denna första filgräns. Kategoriernas granskade data kan däremot vara avgränsade/redigerade; rätt till utlämnande och korrekt maskering måste bedömas av den betrodda granskningen, inte av fingerprinten.

Endast approval-kategorier och filbeslut når paketbyggaren; råa insamlade rader kopieras aldrig automatiskt. Paketbyggarens inventerings-, hemlighets-, storleks- och arkivvägsskydd bevaras. En kategori kan ha granskad filmetadata medan en enskild fil fortfarande requires_review; paketets filstatus markerar då att det behöver kompletteras.

## Verifierat

31 riktade prov passerar med fiktiva uppgifter och faktisk ZIP-extraktion: granskat eget innehåll/bytes bevaras, rå privata sentinel-data utesluts, ändrad post/fil avvisas, objektfältordning är stabil, konto/granskare/tid kontrolleras, olästa/otillgängliga/tomma källor kan inte godkännas, filer kan inte läggas till/tas bort/bytas eller återupplivas och filbytes kan hållas inne. Getters, toJSON, cykler, otillåtna värden, delade buffertar och för stort djup avvisas.

Paketets 76 regressioner, riktad ESLint, TypeScript, diff-check och produktionsbygge/57 routes passerar. Ett första test försökte markera filmetadata-kategorin requires_review trots ett explicit filbeslut; det stred mot paketbyggarens befintliga kontrakt och fixturen rättades. Ingen produktsäkerhetsregel släpptes för testet. Inga riktiga användare, filer, AI-anrop eller databasändringar ingår. Befintlig metadataBase-varning kvarstår.

## Återstår

Behörighetskontrollerad granskningsprocess eller verifierade automatiska fältpolicyer, faktisk innehålls-/tredjepartsbedömning, fullständiga källor och dokumentformat, aktuell sessionsauktorisering, exportbeställning, privat lagring, säker nedladdning och gallring. Fingerprint validerar samma redan insamlade underlag; den upptäcker inte nya databasändringar som ännu inte samlats in och skapar inte snapshotisolering. Ingen publik export aktiveras.

Leveransstatus finns här; gemensamma ATGARDSPLAN.md lämnas oförändrad enligt publiceringsbegränsningen. L13 fortsatt Pågår. Produktion är orörd.
