# MatchnWork agentinstruktioner

## Gemensam arbetslista

Läs `docs/ATGARDSPLAN.md` innan arbete börjar. Den filen innehåller uppgifts-ID, prioritering, ansvar, status och kriterier för klart. Följ den globala ordningen, med hänsyn till beroenden och användarens uttryckliga avgränsningar. Påbörja inte nästa punkt automatiskt när användaren begränsat insatsen.

Reservera en punkt genom att publicera ansvarig och branch innan kodarbete börjar. Kontrollera aktuell dev och öppna PR:er för att undvika dubbelarbete. En lokal reservation är inte ett lås. Vid samtidig reservation eller överlappande filer ska ägarna samordna innan någon fortsätter. Ta inte över en annan persons punkt utan överenskommelse.

Arbeta på egen branch utifrån aktuell dev. Använd uppgiftens ID i commit och PR. Bevara andras ändringar och undvik force-push på gemensamma branches. Uppdatera bara berörda uppgifter i checklistan, inte hela dokumentets status.

## Status och verifiering

Använd Ej påbörjad, Pågår, För granskning, Klar eller Blockerad. Skilj alltid mellan skriven kod, lokala kontroller, införd ändring och verifierat användarflöde. Markera Klar och kryssa av först när ändringen är införd i dev och kriteriet Klar när är verifierat. Saknad miljö eller åtkomst dokumenteras som begränsning, inte som godkänt test.

Efter arbetet ska checklistan innehålla vad som ändrats, vilka kontroller som faktiskt körts, PR/commit och det som återstår. Ge en kort överlämning till användaren. Rapportera först reproducerat problem och slutligt beteende, därefter verifiering och begränsningar.

## Arkitektur och säkerhet

MatchnWork ska senare kunna få en mobilapp med React Native och Expo. Håll typer, validering och affärslogik återanvändbara utanför Next.js-vyer. Återanvänd befintliga komponenter och datakällor.

Bevara autentisering, ägarkontroller och RLS. Exponera aldrig service-role-nycklar i klienten. Ändra inte säkerhetsregler för att dölja ett hämtningsfel. Databasändringar ska vara spårbara och samordnade; gör inga orelaterade produktionsändringar.

Använd tydligt fiktiva QA-konton i dev för användartester. Hantera inte riktiga rekryteringar eller betalningar som testdata. Dela aldrig lösenord, token eller API-nycklar i rapporter eller commits.

## Omfattning för den aktuella insatsen

Endast F01 är beställd för kodarbete. Övriga punkter är planerade och ska inte implementeras i denna insats. Samarbetsdokumenten ingår i uppdraget.
