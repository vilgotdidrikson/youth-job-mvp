import type { StructuredCvData } from "./structured-cv";

export type CvInterviewArea = keyof Pick<StructuredCvData, "personalInfo" | "profile" | "workExperience" | "education" | "projects" | "skills" | "certifications" | "languages" | "otherExperience">;

export interface CvInterviewQuestion {
  id: string;
  text: string;
  purpose: string;
}

export interface CvInterviewAreaConfig {
  key: CvInterviewArea;
  label: string;
  opening: CvInterviewQuestion;
  followups: CvInterviewQuestion[];
  minAnswers: number;
  maxAnswers: number;
}

export const CV_INTERVIEW_AREAS: CvInterviewAreaConfig[] = [
  {
    key: "profile", label: "egenskaper",
    opening: { id: "profile_strength", text: "Vilka är dina bästa egenskaper?", purpose: "konkreta styrkor" },
    followups: [
      { id: "profile_example", text: "Kan du ge ett kort exempel där en av styrkorna märktes?", purpose: "belägg för styrkor" },
    ], minAnswers: 1, maxAnswers: 2,
  },
  {
    key: "workExperience", label: "arbetslivserfarenhet",
    opening: { id: "work_overview", text: "Berätta om jobb, praktik, volontärarbete eller ansvar du har haft.", purpose: "översikt över all erfarenhet" },
    followups: [
      { id: "work_employer_role", text: "Vad hette arbetsgivaren och vilken roll hade du?", purpose: "arbetsgivare och roll" },
      { id: "work_tasks", text: "Vad gjorde du konkret i rollen?", purpose: "konkreta arbetsuppgifter och ansvar" },
      { id: "work_period", text: "När och ungefär hur länge gjorde du detta?", purpose: "period och längd" },
      { id: "work_tools_team", text: "Vilka verktyg använde du, och arbetade du själv eller i team?", purpose: "verktyg och arbetssätt" },
      { id: "work_result", text: "Finns något resultat eller någon lärdom som är värd att lyfta?", purpose: "resultat och lärdom" },
      { id: "work_more", text: "Har du någon ytterligare erfarenhet som bör vara med?", purpose: "fler erfarenheter" },
    ], minAnswers: 1, maxAnswers: 6,
  },
  {
    key: "education", label: "utbildning",
    opening: { id: "education_overview", text: "Berätta om din skola, utbildning eller kurser.", purpose: "skola, program och status" },
    followups: [
      { id: "education_program", text: "Vilket program eller vilken inriktning går eller gick du?", purpose: "program och inriktning" },
      { id: "education_period", text: "Vilken ort och vilka år gäller utbildningen?", purpose: "ort och period eller examensår" },
      { id: "education_relevance", text: "Finns relevanta kurser eller prestationer?", purpose: "relevanta utbildningsmeriter" },
      { id: "education_more", text: "Har du gått någon annan kurs eller utbildning?", purpose: "ytterligare utbildning" },
    ], minAnswers: 1, maxAnswers: 4,
  },
  {
    key: "skills", label: "kompetenser",
    opening: { id: "skills_overview", text: "Vilka konkreta färdigheter eller digitala verktyg kan du använda?", purpose: "tekniska, digitala och övriga kompetenser" },
    followups: [
      { id: "skills_evidence", text: "Var eller hur har du använt de färdigheterna?", purpose: "belägg för varje kompetens" },
    ], minAnswers: 1, maxAnswers: 2,
  },
  {
    key: "certifications", label: "certifikat och meriter",
    opening: { id: "merits_overview", text: "Har du certifikat, stipendier, priser eller andra meriter?", purpose: "relevanta certifikat och meriter" },
    followups: [
      { id: "merits_details", text: "Vad heter meriten, vilket år och varför fick du den?", purpose: "namn, år, utfärdare och anledning" },
    ], minAnswers: 1, maxAnswers: 2,
  },
  {
    key: "languages", label: "språk",
    opening: { id: "languages_overview", text: "Vilka språk kan du och ungefär hur väl?", purpose: "språk och naturlig nivå" },
    followups: [
      { id: "languages_abilities", text: "Kan du tala, skriva och förstå språken du nämnde?", purpose: "förmåga att tala, skriva och förstå" },
    ], minAnswers: 1, maxAnswers: 2,
  },
  {
    key: "otherExperience", label: "övrig relevant erfarenhet",
    opening: { id: "other_overview", text: "Finns föreningsliv, idrott, ledarskap eller annat ansvar att lyfta?", purpose: "relevanta övriga erfarenheter" },
    followups: [
      { id: "other_details", text: "Vad gjorde du konkret och under vilken period?", purpose: "roll, uppgifter och period" },
      { id: "other_relevance", text: "Vad lärde du dig eller vilket ansvar hade du?", purpose: "ansvar och relevanta lärdomar" },
    ], minAnswers: 1, maxAnswers: 3,
  },
];

export function getInterviewArea(key: CvInterviewArea) {
  return CV_INTERVIEW_AREAS.find((area) => area.key === key) ?? CV_INTERVIEW_AREAS[0];
}

export function getQuestion(area: CvInterviewAreaConfig, id: string) {
  return [area.opening, ...area.followups].find((question) => question.id === id);
}
