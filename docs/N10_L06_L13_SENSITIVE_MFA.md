# N10/L06/L13 – tvåfaktor vid känsliga kontoåtgärder

- Ansvarig: Vilgot / Codex
- Branch: `codex/n10-l06-l13-sensitive-mfa-20261109`, PR #191
- Status: För granskning; reservation publicerad före kodarbete.
- N10: kodfält i raderings-/exportformulär, värden från inskickat formulär och omedelbar tömning. Ingen kod eller hemlighet sparas i egen lagring eller loggar.
- L06: serverhjälparen kräver befintlig verifierad TOTP före kontoradering. Enbart lösenord räcker inte för ett sådant konto. Faktor/identitet läses från Auth; användarmetadata eller klientens önskemål ger ingen behörighet.
- L13: samma kontroll före skapande och återhämtning av exportprov. Aktiv ursprungssession och tidigare kvot-, fil-, konto- och gallringskontroller bevaras. Exportprovet förblir ett ofullständigt dev-prov bakom befintliga flaggor.
- Verifiering sker i separat tillfällig session med offentliga applikationsuppgifter. Uppgraderat token kontrolleras uttryckligen hos Auth. Endast verifieringssessionen loggas ut med lokal scope; misslyckad städning stoppar åtgärden. Den delade inloggningen ersätts inte.
- Ny eller ändrad verifierad faktor under försöket får inte passera med tidigare lösenordsbevis. Avbruten begäran får inte fortsätta från kodkontrollen till auktoriserad åtgärd. Okänt raderingsresultat följer befintlig kontroll via ny inloggning.

## Verifiering

- `test:account-reauthentication`: befintliga kontoprov samt 53 nya prov med verkliga handlers, serverhjälpare, installerad SDK och lokalt signerade test-JWT. Auth/RPC simuleras. De tre vägarna nekar saknad/felaktig kod, ny faktor, ändrad faktor, främmande verifierad identitet, svag AAL, otillgänglig Auth, för många försök och misslyckad sessionsstädning före känsligt arbete. Avbrott efter kodsvar stoppar fortsatt verifiering. Korrekt kod kan återhämta ett innehållsfritt statusresultat.
- Baslinjeprovet mot föregående serverhjälpare faller på att saknad kod inte avvisas. Detta är lokal reproduktion av serverhjälparens kontrakt, ingen live-radering eller demonstration av hosted Auth-bypass.
- Regressioner: raderingsflöde, exportkontroll/-klient, återhämtning, exportnedladdning, personuppgiftsgranskning, TOTP och kontoinställningar. Formulär-/DOM- och fjärrgränser simuleras; riktig browserrendering påstås inte.
- Tidberoende testtoken i den tidigare TOTP-regressionen har fått en stabil utgångstid för att undvika ett sekundskifte mellan två jämförelser. Produktens tokenhantering ändras inte av detta.
- TypeScript, riktad ESLint och fullständigt Next-bygge kontrolleras före merge. Driftsättningsresultat dokumenteras i PR.

## Återstår

- Fysisk autentiseringsapp och fullständigt inloggat webbläsarprov av radering/export med fiktiva konton. Agenten skapar eller raderar inga verkliga faktorer/konton i denna leverans.
- Full obligatorisk admin-MFA, faktorval vid flera verifierade appar och återställning vid borttappad app ingår inte. Den första verifierade TOTP-faktorn används, som i den tidigare kontoverifieringen. Ett konto som endast har annan verifierad faktortyp nekas här utan nedgradering till enbart lösenord.
- Inga nya roller, databas-/RLS-regler, produktionsinställningar eller juridiska beslut. N10/L06/L13 markeras inte Klar genom denna delimplementation.
