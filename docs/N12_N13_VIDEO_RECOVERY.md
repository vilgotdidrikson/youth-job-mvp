# N12/N13 – återhämtning och kontoavgränsning i videoflödet

- Status: Pågår
- Ansvarig: Vilgot / Codex
- Branch: `codex/n12-n13-video-recovery-20261109`
- Bas: dev `30778f66be4381e409066aa42454ab6202d9ba89`; inga öppna dev-PR:er vid reservation 2026-11-09.
- Reservation publicerad före kodarbete. Fortsätt egna N12/N13: separera konto/samtal, stoppa nya sändningssteg efter avbrott/avmontering, begränsa åtkomstläsning/uppladdning/sändning och återanvänd video/meddelande-id vid osäkert svar. Möjliggör återkallelse i båda videovyerna. Återanvänd befintlig privat video, RLS och gallring; ingen migration, ny datakategori, AI eller produktion.
- SDK- och komponentprov med fiktiva värden/simulerad transport planeras. Fysisk kamera/mobil, inloggad browser och verkligt nätavbrott räknas inte som verifierade genom sådana prov. Huvudpunkterna förblir ofärdiga tills kvarvarande acceptans är verifierad.
