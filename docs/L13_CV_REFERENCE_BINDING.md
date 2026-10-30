# L13 – CV-referenser från kontots dokumentposter

Reserverad före kodarbete 2026-10-30: Vilgot / Codex, `codex/l13-cv-reference-binding-20261030`, från aktuell dev efter #157. Granska senaste design-/rekryteringsändringar och bind filinsamling till kontots egna dokumentposter. Inga klientvalda filvägar, externa URL-hämtningar eller privilegieutökningar. Innehållsgranskning och färdigt exportflöde kvarstår. L13 fortsatt Pågår.


## Granskning av #157

Sedan #156 ändrades 31 filer i dev: främst ungdomsnavigation, diskret swipe-hint med reduced-motion-hänsyn, Instagram-länk, mobil profil-/chattlayout, enhetligare anställningsregistrering, design-tokenkontroll och synkade designstatusar. F17 och D01 är För granskning. Inga nya migrationer eller exportändringar i denna jämförelse. Riktade recruitment-review-, profile-journey-, job-discovery- och design-tokenprov passerar. Detta är kod-/regressionsgranskning, inte full visuell eller fysisk mobilacceptans. Befintliga designändringar bevaras.

## Fortsättning inom L13

collectAccountCvFiles i lib/server/personal-data-cv-binding.ts läser youth_profiles(user_id,documents) med uttryckligt eget konto via användarklienten. Anropet tar inga klientvalda filvägar. Endast cv/generated_cv-referenser som slutar på .pdf förs vidare till den tidigare filhämtningen; övriga CV-format redovisas i unsupportedCvCount. Dubbla filreferenser hämtas en gång. Vanliga dokument av andra typer hämtas inte i denna del.

Identitet kontrolleras före profilläsning och av den befintliga filhämtningen före/efter bytes. Fel profilägare, saknad profil, queryfel eller ogiltiga data avbryter. Array-/dokumentgetters avvisas och enkla typ/url-värden kopieras före nätverket. Den egna dokumentlistan läses om efter hämtningen; förändrad lista kastar hela resultatet. 30 sekunders yttre väntbudget och avbrytning; queryn får signal medan Auth/andra SDK-operationer kan avslutas senare, oanvända.

Filhämtningens sökvägsskydd, användar-RLS, neutrala filnamn och bytegränser återanvänds. Externa/signerade URL:er hämtas aldrig. Historiska URL-format kan därför behöva separat hantering. En profilpost är koppling till kontot, inte bevis på att CV-innehållet saknar tredje persons uppgifter: reviewState förblir pending. Resultatet gäller manifestet, inte komplett export.

29 fil-/bindningsprov passerar: ursprungliga 20 plus egna/grupperade referenser, ej stödda format, främmande profil eller sökväg, extern URL, queryfel, dokumentändring under hämtning, getters och tom profil. Installerad SDK:s Storage-transport ingår med simulerad HTTP i tidigare filprovet; även bindningens faktiska SDK-query, konto-filter och abortsignal verifieras mot simulerad HTTP. Paketets 76 regressioner, riktad ESLint, TypeScript, diff-check och produktionsbygge/57 routes passerar. Befintlig metadataBase-varning kvarstår. Inga livekonton/filer eller databasändringar användes.

Kvarstår: faktisk Storage/RLS-verifiering av bindningen, övriga dokumentformat/media, innehållsgranskning, export-UI/API, säker hämtning och gallring. Omläsning är inte en transaktionssnapshot: ändring och återställning mellan läsningar kan missas, liksom filers ändring utan referensändring. Ingen användarexport aktiveras; produktion är orörd. L13 fortsatt Pågår.
