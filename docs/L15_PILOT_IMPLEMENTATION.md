# L15, F20 och L12 · teknisk pilotuppföljning

Vilgot / Codex, `codex/l15-application-consent-retention`. Ansökningsbundet AI-val och 90-dagarsregeln för privat arbetsmaterial. Bygger vidare på PR #253.

## Releaseuppföljning

Avtalsbevis från stängda företagskonton får en schemalagd gallringsregel på tre år. Migreringen registrerar jobbet inaktivt så att det kan verifieras innan driftaktivering. `scripts/test-company-agreements-dev.sql` kontrollerar att ett för tidigt försök avvisas och att en gammal kvittens tas bort medan en nyare bevaras.

A–D hanteras som versionsbundna texter. Godkända formuleringar kan läggas in när kvarstående leverantörs- och behandlingsuppgifter är ifyllda. Fiktiva avtalsversioner kan provas i DevStaging utan att aktivera dem för användarna.

## Driftlarm

Kör `node scripts/check-launch-http.mjs dev --test-alert` från en servermiljö med `MNW_LAUNCH_ALERT_EMAIL` och befintliga SMTP-uppgifter. Kör sedan röktestet med `--notify` från den miljö som ansvarar för övervakningen. SMTP-acceptans visas utan adress eller lösenord. Mottagaren behöver bekräfta att testet kom till inkorgen. Releaseprovet av en enskild förhandsversion körs som `node scripts/check-launch-http.mjs review --deployment https://<deployment>.vercel.app`.
