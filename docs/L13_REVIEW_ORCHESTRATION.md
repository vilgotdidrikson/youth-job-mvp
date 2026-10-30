# L13 – sammanhängande serverinsamling

Reserverad före kodarbete 2026-10-30: Vilgot / Codex, `codex/l13-review-orchestration-20261030`, från dev efter #158. Aktuell dev och öppna PR:er kontrollerade. Koppla ny kontoverifiering, vanlig/privat insamling och egna CV-filer i en intern granskningsoperation med gemensam avbrytning och slutlig identitetskontroll. Inga råa uppgifter till paketbyggare/UI, ingen exportaktivering eller ny databasbehörighet. L13 fortsatt Pågår.


## Leverans

preparePersonalDataReview i lib/server/personal-data-review.ts kopplar befintliga serverdelar i ordning: ny lösenordsverifiering med isolerad sessionsstädning → vanlig/valfri privat datainsamling → CV-filer från ungdomens egna dokumentposter → slutlig Auth-kontroll. Ingen service-/CV-läsning startar före lyckad verifiering. Rollen hämtas från skyddad profiles-rad i insamlingen, aldrig user_metadata. Saknad/felaktig profil avbryter; övriga explicita källfel/täckningsstatusar bevaras.

Gemensam 120-sekunders väntbudget och avbrytningssignal gäller hela operationen. Sena svar efter avbrott startar inte nästa steg; inget delpaket lämnas ut vid fel/slutligt kontobyte. Råa oväntade fel ersätts med fasta felkoder och ingen privat feltext loggas. Auth-klientens redan påbörjade verifiering/städning kan fortsätta efter att väntan avslutats; den underliggande SDK-transporten stoppas inte alltid. Befintlig sessionsstädnings-/revokeringsbegränsning gäller fortsatt.

Resultatet är ett internt pending-granskningsunderlag med datainsamling och eventuella egna CV-bytes. Vanlig klient används alltid för de ordinarie källorna; separat valfri serverklient används endast för de två fasta privata källorna. Utan den kvarstår dessa not_collected. CV hämtas endast för skyddad ungdomsroll. Företag/privatperson får cvScope=not_requested_for_role, inte ett påstående att deras övriga filer saknas eller är undantagna.

16 nya prov passerar för anropsordning, roll, fel i varje steg, främmande/saknad profil, slutlig identitet, avbrott och sena svar. Ett prov kör verklig orchestrator och alla verkliga hjälpfunktioner tillsammans med simulerad Auth/Data API/Storage: lösenord och lokal städning kommer först, 34 vanliga källor samlas in och egna PDF-bytes bevaras. Första testladdningen saknade JSON-modulinterop i testtranspileringen; den rättades och hela slutkörningen passerar. Ingen produktbehörighet ändrades.

De befintliga 120 insamlings-, 29 fil- och 24 verifieringsproven passerar också (totalt 189 namngivna kontroller inklusive de 16 nya). Riktad ESLint, TypeScript, diff-check och slutbygge/57 routes passerar. Befintlig metadataBase-varning kvarstår. Inga livekonton, autentiserade Storage-anrop, AI-anrop eller databasändringar ingår.

## Återstår och status

Flödet är non_transactional: olika källor kan avse olika tidpunkter. Slutlig getUser är inte full sessionsrevokering eller snapshotisolering. Ingen innehålls-/rättighetsgranskning görs automatiskt och råa uppgifter skickas inte till paketbyggare eller användare. Fullständiga fil-/datakällor, konsekvent insamling, aktuell sessionsauktorisering, innehållsgranskning, exportbeställning/nedladdning, privat lagring och gallring återstår. Ingen sida/API importerar den nya operationen. L13 fortsatt Pågår.

Leveransstatus dokumenteras här. Den gemensamma ATGARDSPLAN.md lämnas oförändrad enligt föregående publiceringsbegränsning; denna ändring innebär inte att L13 är Klar. Produktion är orörd.
