# L13 – ny kontoverifiering

Reserverad före kodarbete 2026-10-29: Vilgot / Codex, `codex/l13-fresh-account-verification-20261029`, från dev 35ac321. Aktuell dev/öppna PR:er och åtgärdsplan kontrollerade. Återanvänd kontoraderingens lösenordsverifiering som gemensam serverdel inför export, med konto före/efter, separat verifieringsklient och lokal avslutning av tillfällig session. Ingen export aktiveras, inga nya behörigheter eller produktionsändringar. L13 fortsatt Pågår.


## Problem och beteende

Kontoraderingens tidigare lösenordskontroll skapade en separat Auth-session utan att avsluta den uttryckligen. Den kontrollerade identiteten före lösenordet, men läste inte om begärande konto efter verifieringen. Den nya gemensamma serverdelen kontrollerar ursprunglig identitet före och efter, verifierar lösenordet för serverns egen e-postadress och avslutar en skapad verifieringssession med scope=local. Originalklienten loggas aldrig ut av hjälpfunktionen. Misslyckad sessionsstädning stoppar åtgärden före serviceklient, filradering eller kontoradering.

`reauthenticateAccount(userClient, verificationClient, expectedUserId, password)` i lib/server/account-reauthentication.ts kräver två separata serverkonstruerade klienter (även separata Auth-instansobjekt). Begärandeklienten bär originaltoken. Verifieringsklienten ska sakna originaltoken och använda persistSession=false, autoRefreshToken=false och detectSessionInUrl=false. Samma klient/Auth-instans avvisas. Kontoraderings-API:t använder hjälpen; övrig fil-/admin-/notifikationslogik är bevarad.

Fel konto, anonym/saknad identitet, konto utan e-post, fel lösenord, frekvensgräns, transportfel, misslyckad städning och ändrad identitet/e-post efter verifieringen ger fasta fel. Ingen rå leverantörstext, lösenord eller verifieringstoken returneras eller loggas. Tillfälliga credentials stannar i den isolerade SDK-klienten.

## Verifierat

- `npm run test:account-reauthentication`: 24 riktade kontroller passerar. Verifierar anropsordning, isolering, lokalt scope, felidentitet före/efter, ogiltig indata, lösenords-/städningsfel, ändrad e-post samt faktisk installerad Supabase-SDK mot simulerad HTTP. Logout använder verifieringstoken med scope=local och originaltoken används i båda getUser-anropen. Verifieringsklientens session är därefter tom.
- `npm run test:account-deletion-flow`: faktisk DELETE-handler, klient och dialogprov passerar, utökat med nekad städning/kontobyte efter verifiering före privilegierad åtkomst. Originalhandlern från parent-commit återkördes via separat fixture och gav 204 där den nya cleanup-regressionen kräver 502. Ingen produktfil byttes ut under regressionen. Testknappen MNW_ACCOUNT_HANDLER_FIXTURE används endast i lokalt testskript.
- `test:server-failures`: 42 sekretesskontroller passerar, inklusive kontoraderingen. `test:account-recovery` passerar för sessioner/återställning/routning. Riktad ESLint, TypeScript, diff-check och produktionsbygge/57 routes passerar. Simulerade offlinefel i sessionsproven och befintlig metadataBase-varning är väntade och räknas inte som livefel.

Auth-/HTTP-svaren är simulerade; ingen ny live-session, kontoradering eller databasändring ingår i denna leverans. Befintliga tidigare liveprov ersätter inte liveverifiering av den nya städningen.

## Gräns inför export

Det returnerade User-objektet är en intern identitet för den aktuella åtgärden, inte en signerad biljett eller återanvändbar autentiseringsgrant. Exportbeställning och senare hämtning måste fortfarande auktoriseras och kopplas till rätt aktuellt konto/session. getUser är inte full kontroll av återkallade session_id eller en garanti att gamla access-token genast spärrats. Supabase local logout avslutar verifieringssessionens refresh-förmåga; access-token kan leva till sin utgång. Se [Supabase sign-out scopes](https://supabase.com/docs/guides/auth/signout).

Om ett nätverkssvar går förlorat innan den nya sessionen blivit känd för SDK:n kan hjälpen inte garantera städning av en eventuell serversession. Misslyckad städning blockerar åtgärden; ingen lyckad export/radering påstås. Verifieringsklientens transporter och hela framtida exportjobb behöver fortsatt avgränsade tidsgränser och sessionspolicy. Andra autentiseringsmetoder än e-post/lösenord är inte införda genom detta.

Kvarstår inom L13: liveverifiering av den nya städningen, komplett innehålls-/rättighetsgranskning, återstående datakällor/filer, nyautentiserat export-UI/API, säker hämtning och exakt paketfrist/automatisk gallring. Ingen export aktiveras. Produktion är orörd.
