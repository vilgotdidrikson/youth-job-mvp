import { demoJobs, type DemoJob } from "./demo-data";
export type YouthJob = DemoJob & {
  minAge: number;
  schedule: string;
  start: string;
  question: string;
};
export const youthJobs: YouthJob[] = [
  ...demoJobs.map((job, i) => ({
    ...job,
    minAge: i === 2 ? 15 : i === 3 ? 18 : 16,
    schedule: i === 3 ? "Kvällar" : "Helger",
    start: "Enligt överenskommelse",
    question:
      i === 1
        ? "Vad tycker du om att hjälpa kunder med?"
        : "Vad lockar dig med det här jobbet?",
  })),
  {
    id: "park",
    title: "Sommarvärd i parken",
    company: "Parkkompis",
    area: "Kungsholmen",
    category: "Utomhus",
    hours: "Vardagar under sommarlovet",
    age: "Från 15 år",
    minAge: 15,
    schedule: "Sommar",
    start: "Till sommarlovet",
    description:
      "Ett sommarjobb med rörelse och människor. Tillsammans med en handledare hjälper du till att göra parken välkomnande för besökare.",
    tasks: [
      "Hjälpa besökare att hitta rätt",
      "Förbereda enklare utomhusaktiviteter",
      "Plocka skräp och hålla ordning",
    ],
    tags: ["Sommarjobb", "Handledare på plats"],
    tone: "leaf",
    mark: "p.",
    question: "Hur trivs du med att arbeta utomhus?",
  },
  {
    id: "sports",
    title: "Hjälpledare på idrottsläger",
    company: "Rörelseklubben",
    area: "Nacka",
    category: "Barn & idrott",
    hours: "Dagtid under skollov",
    age: "Från 16 år",
    minAge: 16,
    schedule: "Sommar",
    start: "Till nästa lägerperiod",
    description:
      "Var med och skapa roliga dagar för barn. Du stöttar ordinarie ledare och får introduktion inför lägret.",
    tasks: [
      "Förbereda lekar och övningar",
      "Stötta ledarna under aktiviteter",
      "Hjälpa till vid raster och mellanmål",
    ],
    tags: ["Lovjobb", "Jobba i team"],
    tone: "court",
    mark: "r.",
    question:
      "Har du något intresse eller någon erfarenhet du vill använda på lägret?",
  },
  {
    id: "cinema",
    title: "Biovärd",
    company: "Kvartersbion",
    area: "Vasastan",
    category: "Event & förening",
    hours: "Kvällar och helger",
    age: "Från 18 år",
    minAge: 18,
    schedule: "Kvällar",
    start: "Enligt överenskommelse",
    description:
      "Du är en del av filmkvällen, från det första hej:et till eftertexterna. Vi söker en serviceinriktad kollega till vårt lilla bioteam.",
    tasks: [
      "Välkomna gäster och kontrollera biljetter",
      "Hjälpa till i kiosken",
      "Förbereda salongen inför nästa film",
    ],
    tags: ["Extrajobb", "Service"],
    tone: "lilac",
    mark: "b.",
    question: "Vad skulle du göra för att en gäst ska känna sig välkommen?",
  },
  {
    id: "bakery",
    title: "Helgkollega på bageri",
    company: "Morgonbröd",
    area: "Årsta",
    category: "Café & restaurang",
    hours: "Lördagar och söndagar",
    age: "Från 16 år",
    minAge: 16,
    schedule: "Helger",
    start: "Enligt överenskommelse",
    description:
      "Nybakat bröd och ett trevligt bemötande gör morgonen bättre. Vi söker en kollega till helgförsäljningen och lär dig på plats.",
    tasks: [
      "Packa bröd och bakverk",
      "Möta kunder tillsammans med teamet",
      "Fylla på och hålla fint i butiken",
    ],
    tags: ["Ingen erfarenhet krävs", "Helgjobb"],
    tone: "coffee",
    mark: "m.",
    question: "Hur skulle ett bra kundmöte se ut för dig?",
  },
];
export type DemoProfile = {
  age: number;
  area: string;
  availability: string[];
  bio: string;
  experience?: string;
  strengths?: string;
  interest?: string;
};
export const initialYouthProfile: DemoProfile = {
  age: 18,
  area: "Södermalm",
  availability: ["Helger", "Kvällar"],
  bio: "Jag går på gymnasiet, gillar att träffa människor och söker mitt första extrajobb. På fritiden hjälper jag till i min idrottsförening.",
};
export type YouthFilters = {
  category: string;
  area: string;
  schedule: string;
  suitableAge: boolean;
};
export const emptyYouthFilters: YouthFilters = {
  category: "Alla",
  area: "Alla",
  schedule: "Alla",
  suitableAge: false,
};
export function filterYouthJobs(
  search: string,
  filters: YouthFilters,
  age: number,
) {
  const query = search.trim().toLocaleLowerCase("sv");
  return youthJobs.filter(
    (job) =>
      `${job.title} ${job.company} ${job.area}`
        .toLocaleLowerCase("sv")
        .includes(query) &&
      (filters.category === "Alla" || job.category === filters.category) &&
      (filters.area === "Alla" || job.area === filters.area) &&
      (filters.schedule === "Alla" || job.schedule === filters.schedule) &&
      (!filters.suitableAge || age >= job.minAge),
  );
}

export const demoProfileQuestions = [
  {
    text: "Hej Alex! Vi bygger din profil. Vilken typ av jobb lockar dig?",
    options: ["Café & service", "Butik & kundmöten", "Idrott & aktiviteter"],
  },
  {
    text: "Bra! Vad har du gjort tidigare?",
    options: [
      "Jag söker mitt första jobb",
      "Jag har hjälpt till i en förening",
      "Jag har haft ett sommarjobb",
    ],
  },
  {
    text: "När passar det dig att jobba?",
    options: ["Helger", "Efter skolan", "Under sommarlovet"],
  },
  {
    text: "Sista frågan! Vad beskriver dig bäst?",
    options: [
      "Social och hjälpsam",
      "Noggrann och ansvarstagande",
      "Nyfiken och snabblärd",
    ],
  },
];

export function buildDemoProfile(
  profile: DemoProfile,
  answers: string[],
): DemoProfile {
  return {
    ...profile,
    availability: [
      answers[2] === "Under sommarlovet" ? "Sommar" : answers[2] || "Helger",
    ],
    experience: answers[1] || "",
    strengths: answers[3] || "",
    interest: answers[0] || "",
    bio: `Jag går på gymnasiet och söker jobb inom ${(answers[0] || "service").toLocaleLowerCase("sv")}. ${answers[1] || ""}. Jag är ${(answers[3] || "nyfiken").toLocaleLowerCase("sv")} och kan jobba ${(answers[2] || "helger").toLocaleLowerCase("sv")}.`,
  };
}
