/** Shared profile data and validation, reusable by a future mobile client. */
export const DAYS = { mon: "Måndag", tue: "Tisdag", wed: "Onsdag", thu: "Torsdag", fri: "Fredag", sat: "Lördag", sun: "Söndag" };
export const PERIODS = { day: "Dagtid", evening: "Kväll", night: "Natt", holidays: "Skollov" };
export const STRENGTHS = { service: "Kundbemötande", teamwork: "Samarbete", responsibility: "Ansvar", initiative: "Initiativ", learning: "Lära nytt" };
export const LANGUAGE_LEVELS = ["Grundläggande", "God", "Mycket god", "Flytande", "Modersmål"];
export interface RecruitmentProfile {
  availability: { days: string[]; periods: string[]; startDate: string; hours: string; notes?: string };
  preferences: { roles: string[]; locations: string[]; travelMinutes: string; motivation: string };
  examples: { strength: string; context: string; action: string }[];
  qualifications: { licences: string[]; tools: string[]; languages: { language: string; level: string }[] };
}
export type ProfileSection = keyof RecruitmentProfile;
export const PROFILE_SECTIONS: { key: ProfileSection; title: string; description: string; prompt: string }[] = [
  { key: "availability", title: "När jag kan jobba", description: "Dagar, tider och startdatum", prompt: "Hjälp företag att se om arbetstiderna passar dig." },
  { key: "preferences", title: "Vad jag söker", description: "Jobb, plats och motivation", prompt: "Berätta vilka jobb du är nyfiken på och vad du vill lära dig." },
  { key: "examples", title: "Styrkor i praktiken", description: "Egna exempel från jobb, skola eller fritid", prompt: "Ett litet exempel kan säga mycket. Du behöver inte ha haft ett jobb." },
  { key: "qualifications", title: "Kunskaper och språk", description: "Verktyg, körkort och språknivåer", prompt: "Lägg till det du faktiskt kan. Det är okej att fortfarande lära sig." },
];
export function emptyRecruitmentProfile(): RecruitmentProfile {
  return { availability: { days: [], periods: [], startDate: "", hours: "" }, preferences: { roles: [], locations: [], travelMinutes: "", motivation: "" }, examples: [], qualifications: { licences: [], tools: [], languages: [] } };
}
export function validateRecruitmentProfile(raw: unknown): RecruitmentProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Ogiltiga profiluppgifter.");
  const data = raw as Record<string, unknown>;
  const text = (value: unknown, max: number): string => { if (typeof value !== "string" || value.length > max) throw new Error("Kontrollera textens längd och försök igen."); return value.trim(); };
  const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ogiltiga profiluppgifter."); return value as Record<string, unknown>; };
  const list = (value: unknown, max: number, length = 80): string[] => { if (!Array.isArray(value) || value.length > max) throw new Error("För många uppgifter."); return [...new Set(value.map(item => text(item, length)).filter(Boolean))]; };
  const a = object(data.availability), p = object(data.preferences), q = object(data.qualifications);
  const days = list(a.days, 7), periods = list(a.periods, 4), startDate = text(a.startDate, 10), hours = text(a.hours, 2);
  if (days.some(day => !(day in DAYS)) || periods.some(period => !(period in PERIODS)) || (startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || new Date(`${startDate}T00:00:00Z`).toISOString().slice(0,10) !== startDate)) || (hours && (!/^\d{1,2}$/.test(hours) || Number(hours) > 60))) throw new Error("Kontrollera dagar, startdatum och antal timmar.");
  const travelMinutes = text(p.travelMinutes, 3);
  if (travelMinutes && (!/^\d{1,3}$/.test(travelMinutes) || Number(travelMinutes) > 180)) throw new Error("Ange högst 180 minuters restid.");
  if (!Array.isArray(data.examples) || data.examples.length > 5 || !Array.isArray(q.languages) || q.languages.length > 8) throw new Error("För många exempel eller språk.");
  const examples = data.examples.map(value => { const e = object(value), strength = text(e.strength, 30), context = text(e.context, 200), action = text(e.action, 1000); if (!strength || !context || !action) throw new Error("Ange både situation och vad du gjorde i exemplet."); return { strength, context, action }; });
  const languages = q.languages.map(value => { const l = object(value), language = text(l.language, 60), level = text(l.level, 30); if (!language || !level) throw new Error("Ange språk och nivå."); return { language, level }; });
  return { availability: { days, periods, startDate, hours, ...(a.notes !== undefined ? {notes:text(a.notes,1000)} : {}) }, preferences: { roles: list(p.roles, 8), locations: list(p.locations, 8), travelMinutes, motivation: text(p.motivation, 1000) }, examples, qualifications: { licences: list(q.licences, 8), tools: list(q.tools, 12), languages } };
}
export function readRecruitmentProfile(raw: unknown): RecruitmentProfile {
  try { return validateRecruitmentProfile(raw); } catch { return emptyRecruitmentProfile(); }
}
export function completedProfileSections(profile: RecruitmentProfile): ProfileSection[] {
  return PROFILE_SECTIONS.filter(({key}) => {
    if (key === "availability") return profile.availability.days.length || profile.availability.periods.length || profile.availability.startDate || profile.availability.hours || profile.availability.notes;
    if (key === "preferences") return profile.preferences.roles.length || profile.preferences.locations.length || profile.preferences.motivation || profile.preferences.travelMinutes;
    if (key === "examples") return profile.examples.length;
    return profile.qualifications.licences.length || profile.qualifications.tools.length || profile.qualifications.languages.length;
  }).map(({key}) => key);
}
/** Facts remain self-reported. Examples never certify a personality trait. */
export function recruitmentProfileSource(raw: unknown): string {
  const profile = readRecruitmentProfile(raw), lines: string[] = [];
  const a = profile.availability;
  if (a.days.length) lines.push(`Tillgängliga veckodagar: ${a.days.map(day => DAYS[day as keyof typeof DAYS]).join(", ")}`);
  if (a.days.includes("sat") && a.days.includes("sun")) lines.push("Jag kan arbeta helger");
  if (a.periods.includes("evening")) lines.push("Jag kan arbeta kvällar");
  if (a.periods.length) lines.push(`Tillgängliga tider: ${a.periods.map(period => PERIODS[period as keyof typeof PERIODS]).join(", ")}`);
  if (a.startDate) lines.push(`Kan börja arbeta: ${a.startDate}`);
  if (a.notes) lines.push(`Egna uppgifter om arbetstider: ${a.notes}`);
  if (a.hours) lines.push(`Önskad arbetstid: ${a.hours} timmar per vecka`);
  const p = profile.preferences;
  if (p.roles.length) lines.push(`Söker jobb inom: ${p.roles.join(", ")}`);
  if (p.locations.length) lines.push(`Önskade arbetsorter: ${p.locations.join(", ")}`);
  if (p.travelMinutes) lines.push(`Önskad maximal restid: ${p.travelMinutes} minuter`);
  if (p.motivation) lines.push(`Egen motivation: ${p.motivation}`);
  for (const licence of profile.qualifications.licences) lines.push(licence === "B-körkort" ? "Jag har B-körkort" : `Självuppgiven behörighet: ${licence}`);
  if (profile.qualifications.tools.length) lines.push(`Självuppgivna verktyg och kunskaper: ${profile.qualifications.tools.join(", ")}`);
  for (const l of profile.qualifications.languages) lines.push(`Språk: ${l.language}, självuppgiven nivå ${l.level}`);
  for (const e of profile.examples) lines.push(`Eget exempel på ${STRENGTHS[e.strength as keyof typeof STRENGTHS] ?? e.strength}: Situation: ${e.context}. Vad jag gjorde: ${e.action}`);
  return lines.join("\n");
}
