# Testa video i dev

Miljö: https://youth-job-mvp-dev.vercel.app. Använd enbart fiktiva QA-konton och eget fiktivt material. N22 avvecklar profilvideo; N12/N13:s separata chattvideo finns kvar. Detta är testinstruktioner, inte ett påstående att manuella testfall redan passerat. Leveransbevis finns i docs/N22.md.

## Profilvideo ska inte finnas

1. Öppna ungdomens profil och Din jobbprofil: ingen videoram. Öppna Bygg profil: fem steg, CV följs av Vad jag söker. Video räknas inte som saknad del.
2. Återuppta med en gammal sparad video-markör och öppna `/profile/build?after=video`: kom vidare till jobbönskemål utan videoskapande.
3. Öppna gamla `/video/record`, `?return=build` och `?mode=upload` utan chatt. De visar en förklaring, ingen kamera eller filväljare. Ingen kameraförfrågan får göras.
4. Företagets kandidatvy har ingen profilvideospelare. Äldre profilvideodelningar i en befintlig chatt visas som avvecklade, utan uppspelningsbegäran. Meddelandena ligger kvar.

## Separat chattvideo

5. Öppna en befintlig matchad QA-chatt som ungdom. Verktygen är Spela in video och Välj video, inte Dela profilvideo. Spela in öppnar en separat sida med den aktuella chatten som mottagare.
6. Välj Öppna kamera: speglad förhandsvisning, ingen inspelning före Starta inspelning. Testa stäng utan inspelning, nekad behörighet och filuppladdning som alternativ.
7. Spela in, stoppa och granska. Prova ta om, avbryt, 60-sekundersstopp och navigering bort; kamera/mikrofon ska stängas. Skicka en kort film uttryckligt och kontrollera ljud/bild från mottagaren. Spegling gäller egen förhandsvisning, inte mottagarens film.
8. Välj MP4/WebM/MOV på högst 30 MB och 60 sekunder. Granska före Skicka vald video. Testa fel format, för lång/stor fil, avbruten uppladdning, nätfel och återförsök. Skickat meddelande ska inte dupliceras.
9. Ta bort en egen separat video: meddelandet ligger kvar, ny uppspelning nekas. Prova rapportering med tydligt fiktiv förklaring och kontrollera rapportreferens som behörig admin. Blockering stoppar nya delningar/uppspelningslänkar. Separata filer påverkas inte av avvecklingen av profilvideo.
10. Prova iPhone/Safari, Android/Chrome och avsedda datorwebbläsare, stående/liggande, tangentbord, långsamt nät och bakgrund/återgång.

## Backend och begränsningar

- `scripts/test-video-rls.sql` är aktuellt test för N22: direkt profilmetadata/-pekare, gamla delningar och filåtkomst ska nekas även från äldre klienter. Testet är rollback-baserat och skapar inga riktiga videobytes. Filradering ska göras via Storage API, inte SQL.
- Uppspelningslänkar har fem minuters livslängd. Redan utfärdade länkar kan fungera tills dess; nedladdade externa kopior kan inte återkallas.
- Den historiskt namngivna privata bucketens innehåll är nu chattvideo och avstängda äldre profilfiler i väntan på avgränsad städning. Bucketnamnet ändras inte och bucket blir inte publik.
- Längd kontrolleras i webbläsaren/deklareras i metadata; servern avkodar inte filmen. MOV/WebM-codecs kan skilja mellan webbläsare; fel ska ge en begriplig återhämtning.
- Rapporter sparar referenser, inte en dold kopia av bytes. N22 raderar inte befintliga filer. Fysisk gallring och beslutade 14 dagar från skickande hör till L12 och är ännu inte infört genom N22.
- Frivillig ansökningsvideo enligt N23 är ännu en separat uppgift. Saknad video ska aldrig stoppa ansökan.

## L12 videodel (2026-10-18)

Se [L12_VIDEO.md](L12_VIDEO.md) för införda åtkomstgränser och det avstängda gallringsjobbet. Klienten hämtar nu video autentiserat med no-store och lokal Blob-URL; nya signerade videolänkar ska nekas. Kör `npm run test:video-retention` och rollback-testet `scripts/test-video-retention.sql` utöver N22-regressionerna. Verklig Storage-radering, signer-/hämtnings-HTTP-anrop, parallella klienter och visuell uppspelning återstår. Den automatiska granskningen stoppade det tillfälliga filtestets driftsättning; schemat är inte aktiverat och N23 är fortfarande Ej påbörjad.
