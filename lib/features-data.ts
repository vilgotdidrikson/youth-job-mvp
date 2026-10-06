import type { IconName } from "@/components/ui-icon";

export interface FeatureItem {
  icon: IconName;
  title: string;
  body: string;
}

export const youthFeatures: FeatureItem[] = [
  { icon: "file", title: "AI-CV", body: "Skapa ett professionellt CV genom att bara berätta om dig själv." },
  { icon: "discover", title: "Swipea jobb", body: "Upptäck jobb på ett enkelt och modernt sätt." },
  { icon: "discover", title: "Smart jobbmatchning", body: "Få jobb rekommenderade utifrån dina erfarenheter, intressen och önskemål." },
  { icon: "map", title: "Karta", body: "Se jobb nära dig och hitta möjligheter i ditt område." },
  { icon: "chat", title: "Direktkontakt", body: "Matcha med företag och prata direkt i chatten." },
  { icon: "info", title: "Komplettera ansökan", body: "Ansök direkt och komplettera frivilligt med uppgifter som saknas." },
];

export const companyFeatures: FeatureItem[] = [
  { icon: "briefcase", title: "Lägg upp jobb", body: "Publicera en jobbannons på några minuter." },
  { icon: "discover", title: "AI-matchning", body: "AI hjälper er hitta kandidater som passar jobbet." },
  { icon: "info", title: "AI-screening", body: "Få en snabb överblick över de mest relevanta kandidaterna." },
  { icon: "filter", title: "Kandidatfilter", body: "Sök bland ansökningar efter kandidatens namn eller jobbet de har sökt." },
  { icon: "chat", title: "Kandidatchatt", body: "Kommunicera direkt med kandidater från plattformen." },
  { icon: "activity", title: "Rekryteringsstatus", body: "Följ kontakten med kandidaten och uppdatera status genom rekryteringen." },
  { icon: "briefcase", title: "Företagsprofil", body: "Visa upp ert företag och varför ungdomar ska vilja jobba hos er." },
  { icon: "heart", title: "Employer branding", body: "Bygg en starkare relation till nästa generation av medarbetare." },
];

export const individualFeatures: FeatureItem[] = [
  { icon: "briefcase", title: "Engångsjobb", body: "Lägg enkelt ut små jobb i ditt område." },
  { icon: "map", title: "Lokal matchning", body: "Hitta ungdomar nära dig." },
  { icon: "chat", title: "Snabb kontakt", body: "Få svar och prata direkt med personer som är intresserade." },
  { icon: "activity", title: "Dina uppdrag", body: "Samla dina publicerade uppdrag och avsluta dem när de är klara." },
];

export const aiCapabilities: string[] = [
  "Skapa CV",
  "Förbättra CV",
  "Matcha jobb",
  "Identifiera saknade ansökningsuppgifter",
  "Screena kandidater",
  "Skriva jobbannonser",
];

export const processSteps: string[] = [
  "Profil",
  "Jobb",
  "Match",
  "Chatt",
  "Intervju",
  "Anställning",
];
