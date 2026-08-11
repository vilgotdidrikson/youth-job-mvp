export interface FeatureItem {
  icon: string;
  title: string;
  body: string;
}

export const youthFeatures: FeatureItem[] = [
  { icon: "▤", title: "AI-CV", body: "Skapa ett professionellt CV genom att bara berätta om dig själv." },
  { icon: "⇄", title: "Swipea jobb", body: "Upptäck jobb på ett enkelt och modernt sätt." },
  { icon: "✦", title: "Smart jobbmatchning", body: "Få jobb rekommenderade utifrån dina erfarenheter, intressen och önskemål." },
  { icon: "⌖", title: "Karta", body: "Se jobb nära dig och hitta möjligheter i ditt område." },
  { icon: "◎", title: "Direktkontakt", body: "Matcha med företag och prata direkt i chatten." },
  { icon: "◈", title: "AI-intervju", body: "Förbered dig inför riktiga intervjuer med AI." },
];

export const companyFeatures: FeatureItem[] = [
  { icon: "＋", title: "Lägg upp jobb", body: "Publicera en jobbannons på några minuter." },
  { icon: "✦", title: "AI-matchning", body: "AI hjälper er hitta kandidater som passar jobbet." },
  { icon: "◈", title: "AI-screening", body: "Få en snabb överblick över de mest relevanta kandidaterna." },
  { icon: "☰", title: "Kandidatfilter", body: "Filtrera kandidater efter exempelvis plats, tillgänglighet och erfarenhet." },
  { icon: "◎", title: "Kandidatchatt", body: "Kommunicera direkt med kandidater från plattformen." },
  { icon: "▥", title: "Intervjubokning", body: "Boka intervjuer direkt med kandidater." },
  { icon: "▣", title: "Företagsprofil", body: "Visa upp ert företag och varför ungdomar ska vilja jobba hos er." },
  { icon: "◆", title: "Employer branding", body: "Bygg en starkare relation till nästa generation av medarbetare." },
];

export const individualFeatures: FeatureItem[] = [
  { icon: "＋", title: "Engångsjobb", body: "Lägg enkelt ut små jobb i ditt område." },
  { icon: "⌖", title: "Lokal matchning", body: "Hitta ungdomar nära dig." },
  { icon: "◎", title: "Snabb kontakt", body: "Få svar och prata direkt med personer som är intresserade." },
  { icon: "↗", title: "Boost", body: "Få din annons att synas mer." },
];

export const aiCapabilities: string[] = [
  "Skapa CV",
  "Förbättra CV",
  "Matcha jobb",
  "Förbereda intervjuer",
  "Screena kandidater",
  "Skriva jobbannonser",
];

export const processSteps: string[] = [
  "Profil",
  "Jobb",
  "Match",
  "Chat",
  "Intervju",
  "Anställning",
];
