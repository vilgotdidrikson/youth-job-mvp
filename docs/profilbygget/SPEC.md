# Profilbygget – byggspecifikation för ny design

**Datum:** 2026-10-22 · **Bas:** `dev` `f7ecece` · **Status:** Förslag, inte reserverat. Följ `AGENTS.md`: reservera i `docs/ATGARDSPLAN.md` (ansvarig och branch) innan kodarbetet börjar, arbeta på egen branch från aktuell `dev` och redovisa faktisk verifiering.

Den här mappen innehåller den godkända designen för ungdomens profilbygge (CV → Vad jag söker → När jag kan jobba → Kunskaper → Egna exempel) och allt som behövs för att bygga den exakt.

## Innehåll i mappen

| Fil | Vad det är |
|---|---|
| `SPEC.md` | Den här filen: regler, mått, komponenter och leveransordning |
| `mobil/Steg1CV.dc.html` … `mobil/Steg5Exempel.dc.html` | Mobilskärmarna (390 px bred), en per steg |
| `desktop/DesktopSteg1.dc.html` … `desktop/DesktopSteg5.dc.html` | Desktopskärmarna (1280 px bred), en per steg |

Skärmfilerna är **referensmarkup**, inte kod att kopiera rakt in. Alla mått, färger och avstånd står som inline-`style` i dem, och interaktionen (vad som markeras, vad knappar gör) finns i `<script>`-blocket längst ner. `{{…}}` är platshållare för värden som räknas fram i skriptet. Bygg om det som React-komponenter och CSS-moduler enligt reglerna nedan.

Steg 2 heter `Main.dc.html` (mobil) och `DesktopA.dc.html` (desktop) av historiska skäl.

## Samordning före start

- **F15/F16/F18/D01 (profilflödet, Vilgot / Codex, PR #58, För granskning):** äger profilbyggets flöde och spara/fortsätt-beteendet. Stäm av med Vilgot innan arbetet börjar, och bygg ovanpå det som är infört i `dev`.
- **F23 (tillgänglighet, pågår):** rör `app/profile/page.tsx`, flikar och dialoger. Vänta in den eller samordna filerna.
- **DA-04–DA-06 i `docs/DESIGN_AUDIT_2026-10-22.md`:** färg-, typ- och radietokens. Om de redan är införda, använd dem. Annars används värdena i tabellen nedan, samlade i en CSS-modul, aldrig som spridda hexvärden.
- **Vid konflikt gäller ATGARDSPLAN.**

## Detta får inte ändras

- **Datamodell och validering:** `lib/recruitment-profile.ts` och `lib/job-categories.ts` (fält, gränser, `validateRecruitmentProfile`).
- **Sparning:** RPC `save_my_recruitment_profile` med `p_expected_version`, felhanteringen vid versionskonflikt (40001) och de svenska felmeddelandena.
- **Osparade ändringar:** `onDirtyChange`, `onBusyChange` och "Tillbaka utan att spara"-logiken (heter nu "Avbryt" eller "Hoppa över", men varnar fortfarande vid osparade ändringar).
- **"Pausa och fortsätt senare":** finns kvar. På mobil sitter länken uppe till höger i stegrubriken (där designen har en tom yta), på desktop under stegmenyn.
- **Efter sparning:** `ProfileStepComplete` (mellanskärmen "Den här delen är sparad – nästa steg är …") behålls tills ett annat beslut finns. "Spara och fortsätt" sparar alltså först och visar sedan den skärmen, i ny stil.
- **CV-språk:** språk som finns i CV:t ändras bara i CV-redigeringen.
- **Inbäddat läge:** `RecruitmentProfileEditor embedded` på `/profile` ska fortsätta fungera.
- **Röst-CV:** ligger kvar bakom `VOICE_CV_ENABLED` och visas inte.
- **Affärslogik och typer** stannar i `lib/` (återanvänds av kommande React Native-app). Nya förslagslistor läggs som konstanter i `lib/`, inte i komponenterna.

## Designtokens (exakta värden)

| Token | Värde | Används till |
|---|---|---|
| canvas | `#fffafb` | Sidbakgrund, fältbakgrund |
| surface | `#ffffff` | Kort |
| rose | `#fce9ef` | Valda chips, segmentbakgrund, infoytor |
| rose-track | `#f4dce5` | Ofylld del av progressraden |
| border | `#f0d9e0` | Kortkanter, fältkanter, ovalda chips |
| divider | `#f6e4ea` | Linjer mellan rader i listor |
| dashed | `#e3b9c7` | Streckad kant på "+ Eget"-knappar |
| ink | `#4c303b` | Rubriker och brödtext |
| muted | `#7f616d` | Hjälptext, sekundär text (klarar 4.5:1 på alla ytor ovan) |
| brand | `#b84164` | Primärknapp, valda kanter, länkar |
| brand-on-rose | `#9c304f` | Text i valda chips på rose |
| success / success-soft | `#21855d` / `#e8f5ee` | Klara steg |

**Typografi:** Inter (redan inläst i `app/layout.tsx`).

| Element | Mobil | Desktop |
|---|---|---|
| Sidrubrik (h1) | 30 px, 600, −0.03em, radhöjd 1.15 | 36 px, 600, −0.035em, radhöjd 1.1 |
| Ingress | 15 px, muted, radhöjd 1.5 | 16 px |
| Kortrubrik (h2) | 17 px, 600 | 17 px (16 px i tvåspaltskort) |
| Fältetikett | 14–15 px, 500–600 | samma |
| Hjälptext, räknare | 13 px, muted | 13 px |
| Text i fält | 16 px (förhindrar zoom i iOS) | 15 px |

**Former och avstånd:**

- **Radier:** kort 22 px, fält och segmentkontroll 14 px (inre segment 11 px), valrutor 18 px, chips helt runda, primärknapp 16 px på mobil och 14 px på desktop.
- **Avstånd:** sidmarginal 20 px på mobil, 18 px mellan kort, kortens innermarginal 20 px på mobil och 24 px på desktop.
- **Storlekar:** alla klickbara ytor minst 44 × 44 px, primärknappen 52 px hög på mobil och 48 px på desktop.
- **Desktoplayout:** behållare 980 px, stegmeny 260 px, 56 px mellanrum, formulär max 640 px.
- **Brytpunkt:** projektets befintliga 720 px. Under den visas mobilvarianten (stegrad överst, fast knapprad i botten), över den desktopvarianten (stegmeny till vänster).

## Gemensamma komponenter

Bygg dessa först, i en egen mapp, till exempel `components/profile-builder/` med en CSS-modul:

| Komponent | Beteende |
|---|---|
| `StepHeader` | Mobil: tillbakapil, "Steg X av 5", fem progresssegment, "Pausa och fortsätt senare". Ersätter `ProfileJourneyHeader` under 720 px |
| `StepRail` | Desktop: lista med de fem stegen (klar = grön bock, aktuell = rose bakgrund, kommande = siffra i ring), länkar mellan stegen, valfri infoyta under |
| `FormCard` | Vitt kort med rubrik och valfri räknare ("3 av 8") till höger |
| `ChipGroup` | Flerval (`aria-pressed`) eller enval (`role="radiogroup"` / `role="radio"`), bock i valda chips, maxgräns som spärrar fler val |
| `TagInput` | Taggar med ×-knapp (`aria-label="Ta bort …"`), lägger till med Enter eller komma, maxgräns, förslagschips under ("+ Excel") |
| `SegmentedControl` | 2–4 lägen, valt läge vit med skugga på rose bakgrund |
| `NumberStepper` | − värde +, med min och max |
| `ChoiceTile` | Större valruta med ikon (används för tider i steg 3 och CV-sätt i steg 1) |
| `StickyActions` | Mobil: fast knapprad i botten med sekundärlänk och primärknapp. Desktop: knappar i slutet av formuläret |

Ikoner: använd `UiIcon` där ikonen finns. Saknade ikoner (sol, kväll, måne, kalender, glödlampa) läggs till i `components/ui-icon.tsx` med samma linjestil som i skärmfilerna.

## Steg för steg

### Steg 1 · CV
- **Fil:** `components/youth-cv-hub.tsx` (startvalen, rad ~265).
- **Design:** två `ChoiceTile` som radioval: "Skapa med guidat formulär" (Rekommenderat) och "Ladda upp ett CV". Primärknappen byter text efter valet: "Starta formuläret" / "Välj PDF".
- **Ingen "Hoppa över",** eftersom CV är det enda obligatoriska steget.
- Infoytan "Det här ingår" och raden "Du granskar allt innan något sparas" är ny text.

### Steg 2 · Vad jag söker
- **Fil:** `components/recruitment-profile-editor.tsx`, `section === "preferences"`.
- **Jobb:** ersätt fritextfältet och rullgardinen med en `ChipGroup` (flerval, max 8) över de 15 kategorierna i `JOB_CATEGORIES`. Chippen visar en kort etikett ("Café") men **sparar kategorins fulla `label` i `roles`**, precis som rullgardinen gör idag, så att `preferredJobCategories` fortsätter fungera. Egna formuleringar som redan finns i `roles` och inte matchar en kategori visas som egna chips. "+ Eget jobb" öppnar ett fält för fri text.
- **Orter:** `TagInput`, max 8, sparas i `locations`.
- **Resväg:** `SegmentedControl` 15 / 30 / 45 / 60+ min (60+ sparas som `"60"`). Om ett sparat värde inte är något av dessa (till exempel 10) visas ett femte läge "Annat" med ett nummerfält (0–180).
- **Vill lära mig:** textfältet som idag (max 1000) plus förslagschips som lägger till text i fältet.

### Steg 3 · När jag kan jobba
- **Fil:** samma, `section === "availability"`.
- **Dagar:** sju knappar (Mån–Sön, `aria-label` med hela dagnamnet) plus genvägarna "Vardagar" och "Helger". Sparas i `days` med nycklarna i `DAYS`.
- **Tider:** fyra `ChoiceTile` med ikon, nycklarna i `PERIODS`.
- **Startdatum:** `SegmentedControl` "Så snart som möjligt" / "Välj datum". "Så snart som möjligt" sparar tomt `startDate` (samma som idag när fältet lämnas tomt). "Välj datum" visar datumfältet.
- **Timmar per vecka:** `NumberStepper` 0–60, sparas som text i `hours`. Tomt värde visas som "–".
- **Egna tider:** textfältet `notes` som idag.

### Steg 4 · Kunskaper
- **Fil:** samma, `section === "qualifications"`.
- **Körkort och behörigheter:** `TagInput`, max 8, med förslag.
- **Verktyg och kunskaper:** `TagInput`, max 12, med förslag och hjälptexten "Ta bara med sådant du har använt på riktigt."
- **Språk från CV:t:** visas skrivskyddat i en rose yta med länken "Ändra i CV:t".
- **Extra språk:** språkfält plus nivå som `ChipGroup` (enval) med `LANGUAGE_LEVELS`. "+ Ett språk till" upp till max 8 språk totalt.
- **Förslagslistor:** nya konstanter i `lib/recruitment-profile.ts`, till exempel `LICENCE_SUGGESTIONS` och `TOOL_SUGGESTIONS`. Innehållet i skärmfilerna är exempel och ska bekräftas.

### Steg 5 · Egna exempel
- **Fil:** samma, `section === "examples"`.
- **Sparade exempel:** kompakt rad (styrka i brand-färg, situation som rubrik, "Ändra").
- **Nytt exempel:** kort med brand-färgad kant. Styrka som `ChipGroup` (enval) med `STRENGTHS` plus "+ Eget" (fri text, max 30 tecken). "Vilken situation var det?" (max 200) och "Vad gjorde du själv?" (max 1000), med hjälptexten "Beskriv din egen insats, inte bara gruppens."
- "+ Ett exempel till (X av 5)", max 5. Primärknappen heter "Spara och bli klar".

## Leveransordning

En PR per rad, var och en med egen reservation i ATGARDSPLAN:

1. Gemensamma komponenter, `StepHeader`/`StepRail` och **steg 2**. Det steget har flest nya kontroller och visar att komponenterna håller.
2. Steg 3.
3. Steg 4.
4. Steg 5.
5. Steg 1 och den nya stilen på `ProfileStepComplete`.

## Klart när (för varje leverans)

- Skärmen motsvarar skärmfilen vid 375 px och 1280 px bredd: samma struktur, mått, färger och texter.
- Sparning, versionskonflikt, osparade ändringar och "Pausa och fortsätt senare" fungerar som innan.
- Allt går att använda med tangentbord, med synligt fokus och rätt `aria-pressed` / `role="radio"`.
- Ingen horisontell scroll vid 375 px.
- Körda kontroller: `npm run lint`, TypeScript, `npm run build` och `npm run test:profile-journey`, plus manuell kontroll i deployad dev med ett fiktivt QA-konto. Redovisa vad som faktiskt kördes.

## Öppna beslut

1. Behålla mellanskärmen efter varje sparat steg, eller gå direkt till nästa steg?
2. Vilka förslag ska finnas för behörigheter, verktyg och "Vill lära mig"?
3. Är 15/30/45/60+ rätt förval för resväg?
4. Korta etiketter på jobbchippen ("Café") eller fulla kategorinamn ("Caféarbete")?

## Promptar till Claude i VS Code

**Leverans 1** (kopiera hela):

```
Läs AGENTS.md, docs/ATGARDSPLAN.md och docs/design/profilbygget/SPEC.md.

Uppgift: leverans 1 i SPEC.md – de gemensamma komponenterna, StepHeader/StepRail och steg 2 (Vad jag söker) i den nya designen.

1. Reservera arbetet i ATGARDSPLAN (ansvarig och branch) och skapa en branch från aktuell dev.
2. Läs docs/design/profilbygget/mobil/Main.dc.html och desktop/DesktopA.dc.html. De är referensmarkup: mått, färger och avstånd står som inline-style, interaktionen i script-blocket. Bygg om dem som React-komponenter med CSS-moduler enligt avsnitten "Designtokens" och "Gemensamma komponenter".
3. Ändra components/recruitment-profile-editor.tsx (section "preferences") enligt "Steg 2" i SPEC.md.
4. Följ "Detta får inte ändras" exakt. Ändra inte lib/recruitment-profile.ts eller databasen.
5. Kör lint, TypeScript, build och test:profile-journey. Visa diffen och vad du faktiskt verifierat innan du öppnar en PR.
```

**Leverans 2–5:** samma prompt, men byt "leverans 1" och skärmfilerna mot nästa rad i leveransordningen:

| Leverans | Steg | Mobilfil | Desktopfil |
|---|---|---|---|
| 2 | Steg 3 | `mobil/Steg3Tider.dc.html` | `desktop/DesktopSteg3.dc.html` |
| 3 | Steg 4 | `mobil/Steg4Kunskaper.dc.html` | `desktop/DesktopSteg4.dc.html` |
| 4 | Steg 5 | `mobil/Steg5Exempel.dc.html` | `desktop/DesktopSteg5.dc.html` |
| 5 | Steg 1 | `mobil/Steg1CV.dc.html` | `desktop/DesktopSteg1.dc.html` |
