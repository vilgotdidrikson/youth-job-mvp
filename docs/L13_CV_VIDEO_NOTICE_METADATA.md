# L13 – CV-, video- och notisstatus

- Status: Pågår; hela L13 Pågår.
- Ansvarig: Vilgot / Codex
- Branch: `codex/l13-cv-video-notice-metadata-20261102`
- Offentlig reservation före kodarbete från dev `afa32d2`; öppna PR:er kontrollerade.
- Tre delpunkter: egna privata CV-sessioners status/tider, egna videors livscykeltider, egna notisers skapande-/lästid. Ingen råtext, filväg, motpartsidentitet, ny insamling, aktivering, databas eller AI.

## Implementerat och verifierat 2026-11-02

1. CV-sessioner: eget sessions-/ungdoms-ID, fast in_progress/completed-status och skapande-/sluttid. Endast skyddad ungdomsroll; inga samtal eller meddelanden.
2. Videolivscykel: eget video-/ägar-ID och registrerade tider för skapande, första skickande, utgång, återkallelse, påbörjad städning och radering. Alla tre kontoroller kan få egna metadata; inga filbytes, sökvägar, MIME-/innehållsdata eller konversations-ID. Registrerad radering är ingen ny verifiering av fysisk filradering. Gallrad video återställs inte.
3. Notiser: eget notis-/konto-ID samt skapande-/lästid, för alla tre roller. Titel, text, typ, länkar och match-ID ingår inte. Null lästid bevaras utan antagande om faktisk leverans eller läsning på andra enheter.

Svenska fältnamn och CV-statusar finns även i den befintliga offline-HTML-vyn. Policyn omfattar nu 22 källor. Alla 24 kategorier förblir väntande och paketet needs_completion; dessa metadata ersätter inte fullständigt innehåll eller rättighetsbedömning.

Skrivskyddad metadata från DevStaging matchar alla 17 nya fält och nullable-tider. Inga användarrader eller fixtures lästes/skrevs. CV-statusarnas fasta värden kontrollerades även mot befintlig migration.

- Strukturerad policy: 219 prov med faktisk ZIP, exakta fält/värden, egna/främmande rader, dubbletter, fel roll för CV, olästa/tomma källor, tillåtna CV-statusar och felaktiga skalärer. Inget rått QA-innehåll följer med.
- HTTP-/SDK-kedja: 57 prov, nu med explicit kontroll av de nya metadatafilerna i faktisk ZIP för respektive kontoroll. Auth/Data/Storage-fjärrtransport är simulerad.
- Läsbar sammanställning: 86 lokala format-/ZIP-kontroller, inklusive etiketter för samtliga 22 källor. Browserdelen kördes inte om i denna leverans; layout/renderer är samma som i #173.
- Paketbyggare: 76; insamling: 120. Totalt 558 lokala kontroller passerar, liksom riktad ESLint, diff-check och standardproduktionsbygge med TypeScript.

Status: För granskning; hela L13 Pågår. Positiva autentiserade staging-/innehållsprov, fysisk mobil/Safari, fullständigt registerutdrag och övervakad gallring återstår. Metadatakontrollen är inte ett positivt live-RLS-prov. Exportflaggor och cron är fortsatt avstängda; ingen databas/RLS/bucket, produktion eller AI ändras. Global åtgärdsplan lämnas byteidentisk; scoped checklista och verifiering finns här och i PR.
