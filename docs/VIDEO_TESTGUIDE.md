# Testa video i dev

Miljö: https://youth-job-mvp-dev.vercel.app. Använd fiktiva QA-konton, inte riktiga ansökningar eller filmer av andra personer. Produktionsdatabasen har inte migrerats.

## Ungdomens profil (N11)

1. Öppna Profil. Kortet En kort presentation finns i Översikt och Mitt CV. Välj Spela in profilvideo för att öppna den separata inspelningssidan, eller Välj video för att ladda upp en fil. Video är frivilligt.
2. För filuppladdning: välj MP4, WebM eller MOV, högst 30 MB och 60 sekunder. Kontrollera den lokala förhandsvisningen. Inget delas förrän du väljer Spara profilvideo.
3. Spara, ladda om sidan och välj Visa presentationsvideo. Kontrollera ljud, bild och uppspelningskontroller. Spela upp samma kandidat från företagskontots kandidatvy för en mottagen ansökan.
4. Prova fel filformat, för lång och för stor fil. Prova att avbryta uppladdningen. Den gamla sparade profilvideon ska vara kvar.
5. Ersätt videon och kontrollera från företagskontot att den aktuella videon visas. Ta bort den och kontrollera att ny uppspelning inte längre går.

## Chatt (N12)

6. Öppna en befintlig matchad QA-chatt som ungdom. Vid skrivfältet finns Spela in video, Välj video och Dela profilvideo. Spela in öppnar en separat sida med rätt chatt som mottagare. Välj video öppnar en förhandsvisningsdialog. Videon skickas först efter uttryckligt Skicka video / Skicka vald video.
7. Logga in som mottagaren och prova båda typerna. Ladda om sidan. Meddelandet ska bara finnas en gång, även efter ett återförsök vid nätverksfel.
8. Byt/ta bort profilvideon: profilvideodelningen ska följa ändringen. Separata videomeddelanden ska inte ändras. Ta bort en egen separat video och kontrollera att filen blir otillgänglig men meddelandet finns kvar.
9. Prova Anmäl video på ett tydligt fiktivt testmeddelande och ange att det är ett QA-test. Behörig admin kan öppna videoreferensen från rapporten så länge filen finns kvar. Blockering ska stoppa nya videodelningar och nya uppspelningslänkar mellan kontakterna.

## Inspelning och enheter (N13)

10. På den separata inspelningssidan: välj Öppna kamera. Tillåten kamera ska visa en speglad kamerabild med texten Kameran är redo · spelar inte in. Ingen inspelning får starta förrän du trycker Starta inspelning. Prova även Stäng kamera utan att spela in, nekad behörighet och filuppladdning som alternativ.
11. Tryck Starta inspelning och kontrollera tydlig inspelningsmarkering och timer. Stoppa, förhandsvisa, ta om och avbryt. Prova automatstopp vid 60 sekunder och navigera bort medan kameran är öppen. Kamera/mikrofon ska stängas. Spara/skicka en kort film och kontrollera från mottagaren. Speglingen gäller den egna kameravyn; filmen för mottagaren och dess kontroller behåller normal orientering.
12. Upprepa kärnflödena på iPhone/Safari, Android/Chrome och dator i de webbläsare ni avser stödja. Prova stående/liggande, tangentbord, långsamt nät och bakgrund/återgång.

## Förväntade begränsningar

- MP4 är oftast det mest kompatibla valet. MOV/WebM och inspelningscodecs kan skilja mellan webbläsare; fel ska visa en begriplig återhämtningsväg.
- Uppspelningslänkar gäller fem minuter. Förnya länken när den löpt ut. Redan utfärdade länkar kan fungera tills dess, och mottagaren kan ha laddat ned en kopia.
- Filstorlek och MIME-allowlist verkställs i lagringen. Längden kontrolleras i webbläsaren och deklareras i databasen; servern avkodar inte filmen för att mäta verklig längd.
- Anmälningar sparar meddelande- och videoreferens, inte en separat arkivkopia av filmen. Raderad video kan inte spelas upp av admin.
- Standarduppladdning kan behöva göras om efter nätavbrott. En avbruten restfil är privat och återkallas; misslyckad fysisk städning kan behöva hanteras senare.

Rapportera gärna stegnummer, webbläsare/enhet, vad du förväntade dig och vad som hände. N11–N13 markeras inte Klar enbart på grund av enhetstester eller bygge.

## Genomförd utvecklarverifiering

- Lokala validerings-/klienttester och inspelningscallbacks med simulerade media-API:er passerar. Fullt produktionsbygge, TypeScript samt CV-/matchnings-/rekryteringsregressioner passerar.
- RLS-/triggertester kördes i DevStaging; alla testskrivningar rullades tillbaka och noll videor/objektrader återstod efter testet.
- Driftsatt autentiserat webbtest kunde inte genomföras eftersom testwebbläsaren behöll ett inloggningsskydd. Det räknas inte som ett godkänt uppladdnings-, uppspelnings- eller kameratest.
- Säkerhetsrådgivaren gav inga nya videorelaterade fynd. Befintliga projektanmärkningar är utanför videoleveransen: [pg_net i public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [publikt körbar äldre SECURITY DEFINER-funktion](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [granskning av autentiserade RPC:er](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) och [läckta lösenordsskyddet](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Inga av dessa inställningar har ändrats här.
