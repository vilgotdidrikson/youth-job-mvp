# L08/D02 – chattens läsning och sändningsåterhämtning

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/l08-chat-recovery-20261109`
- Bas: dev `d563581cb0afa199004e73f95df74a834936e671`; öppna PR:er kontrollerade, inga returnerade.
- Reservation 2026-11-09 före kodarbete. Fortsätt egen L08/D02 med en sammanhängande chattleverans: konto-/konversationsisolering, begränsade läsningar/återförsök och bevarade meddelandeutkast vid osäkert sändningssvar. Tidigare högre punkter har kvar browser-/aktiverings-/pris-/dataskyddsberoenden enligt arbetsplanen. Ingen ny AI, persondatakategori, migration, RLS eller produktion.
- Granskningsfokus: sena list-/historiksvar, bytt konto, avmontering, timeout och sändningsförsök med samma innehåll efter osäkert svar. Återanvänd gemensam läshantering och befintliga datakällor. Ingen kontakt med riktiga mottagare; klient-/SDK-prov använder fiktiva uppgifter och simulerad transport.
- Verifiering planeras med verkliga callbacks/installerad SDK, relevanta regressioner och bygge. Fysisk mobil och inloggad browser räknas inte som verifierade genom komponentprov. Huvudpunkterna markeras inte Klar utan kvarvarande acceptans.
