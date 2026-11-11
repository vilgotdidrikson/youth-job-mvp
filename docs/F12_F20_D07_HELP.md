# F12 / F20 / D07 – kravinformation och hjälp

- Ansvarig: Vilgot / Codex
- Branch: `codex/f12-f20-d07-help-20261111`
- Status: Pågår; reserverad före kodarbete.
- F12: återhämtningsbar, annonsbunden läsning av befintlig publik kravinformation. Ingen ny analys eller fråge-/profildelning.
- F20: offentlig hjälp och konsekventa ingångar från registrering, integritetsvy och kontoinställningar.
- D07: gemensamma benämningar/kontaktadress och sakliga instruktioner om befintliga CV-/ansökningsvägar.
- Slutlig juridisk saktext och pausad AI-/profilåteranvändning ingår inte. Inga nya databaskällor eller mailutskick.

## Leverans

F12: kravinformationen lämnar laddningsläge även vid ett kastat nätverksfel, kan läsas igen och uppdateras. Svar hör till rätt annons och aktuellt konto; bara annonsens publika text visas. Fel och avbrott förändrar inte ansökan eller svaren.

F20: /help ger hjälp med konto, CV, ansökningar och arbetsgivarens vyer. Den nås utan konto från marknadssidfot, inloggning/registrering och integritetsvy samt från kontoinställningar för ungdom, företag och uppdragsgivare. Hjälpsidan använder marknadsnavigation även för inloggade.

D07: samma benämningar för Hjälp och kontakt respektive Integritet och AI samt befintlig gemensam kontaktadress. CV-hjälpen skiljer privat arbetsutkast från färdigt CV och redan delat underlag; inga löneutbetalningar eller automatiska stödmejl utlovas.

## Verifiering

- Före/efter-prov: den gamla kravkomponenten saknar återförsök efter kastat nätverksfel; den nya passerar.
- 15 modell-/SDK-prov över simulerad transport: publik fältprojektion, rätt annons/konto, begränsat format, timeout, avbrott och fel. Komponentprov med faktiska callbacks och simulerade hooks/DOM: läslås, uppdatering, sena svar, avmontering och effektrepetition.
- Kompletterings-, delnings-, profil-, företagsnavigations- och autentiseringsregressioner, TypeScript, riktad lint, designtokens och produktionsbygge kontrolleras inför publicering.

Slutlig juridisk saktext/villkor (F20/L15), F12:s bredare profilåteranvändning och inloggad mobil-/webbacceptans återstår. Dessa tre kort markeras inte Klar genom denna avgränsade leverans.
