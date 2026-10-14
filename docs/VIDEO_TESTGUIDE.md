# Testa video i dev

Miljö: https://youth-job-mvp-dev.vercel.app. Använd fiktiva QA-konton, inte riktiga ansökningar eller filmer av andra personer. Produktionsdatabasen har inte migrerats.

## Ungdomens profil (N11)

1. Öppna Profil. Kortet Presentationsvideo finns i Översikt och Mitt CV. Video är frivilligt och behövs inte för att söka jobb.
2. Välj MP4, WebM eller MOV, högst 30 MB och 60 sekunder. Kontrollera den lokala förhandsvisningen. Inget delas förrän du väljer Spara profilvideo.
3. Spara, ladda om sidan och välj Visa presentationsvideo. Kontrollera ljud, bild och uppspelningskontroller. Spela upp samma kandidat från företagskontots kandidatvy för en mottagen ansökan.
4. Prova fel filformat, för lång och för stor fil. Prova att avbryta uppladdningen. Den gamla sparade profilvideon ska vara kvar.
5. Ersätt videon och kontrollera från företagskontot att den aktuella videon visas. Ta bort den och kontrollera att ny uppspelning inte längre går.

## Chatt (N12)

6. Öppna en befintlig matchad QA-chatt som ungdom. Under Skicka video kan du dela din aktuella profilvideo eller välja en separat fil. Förhandsvisa och tryck uttryckligen Skicka vald video.
7. Logga in som mottagaren och prova båda typerna. Ladda om sidan. Meddelandet ska bara finnas en gång, även efter ett återförsök vid nätverksfel.
8. Byt/ta bort profilvideon: profilvideodelningen ska följa ändringen. Separata videomeddelanden ska inte ändras. Ta bort en egen separat video och kontrollera att filen blir otillgänglig men meddelandet finns kvar.
9. Prova Anmäl video på ett tydligt fiktivt testmeddelande och ange att det är ett QA-test. Behörig admin kan öppna videoreferensen från rapporten så länge filen finns kvar. Blockering ska stoppa nya videodelningar och nya uppspelningslänkar mellan kontakterna.

## Inspelning och enheter (N13)

10. Välj Spela in med kamera. Prova att neka behörighet och sedan använda filuppladdning. Prova tillåten kamera/mikrofon, stoppa, förhandsvisa, ta om och avbryt. Inspelningen ska aldrig publiceras automatiskt.
11. Prova en inspelning till 60 sekunder, gå bort från sidan under inspelning och kontrollera att kamera/mikrofon stängs. Spara/skicka en kort inspelning och kontrollera den från mottagaren.
12. Upprepa kärnflödena på iPhone/Safari, Android/Chrome och dator i de webbläsare ni avser stödja. Prova stående/liggande, tangentbord, långsamt nät och bakgrund/återgång.

## Förväntade begränsningar

- MP4 är oftast det mest kompatibla valet. MOV/WebM och inspelningscodecs kan skilja mellan webbläsare; fel ska visa en begriplig återhämtningsväg.
- Uppspelningslänkar gäller fem minuter. Förnya länken när den löpt ut. Redan utfärdade länkar kan fungera tills dess, och mottagaren kan ha laddat ned en kopia.
- Filstorlek och MIME-allowlist verkställs i lagringen. Längden kontrolleras i webbläsaren och deklareras i databasen; servern avkodar inte filmen för att mäta verklig längd.
- Anmälningar sparar meddelande- och videoreferens, inte en separat arkivkopia av filmen. Raderad video kan inte spelas upp av admin.
- Standarduppladdning kan behöva göras om efter nätavbrott. En avbruten restfil är privat och återkallas; misslyckad fysisk städning kan behöva hanteras senare.

Rapportera gärna stegnummer, webbläsare/enhet, vad du förväntade dig och vad som hände. N11–N13 markeras inte Klar enbart på grund av enhetstester eller bygge.
