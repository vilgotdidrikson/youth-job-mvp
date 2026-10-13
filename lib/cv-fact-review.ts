import { renderStructuredCv, structuredCvToLegacy, type StructuredCvData } from "./structured-cv";

// Shared with a future mobile client. Approval is for this exact text AND facts,
// never for a previous generation or a restored browser draft.
export function cvReviewSnapshot(text: string, cv: StructuredCvData): string {
  return JSON.stringify({ text, cv });
}

export function isCvTextAligned(text: string, cv: StructuredCvData): boolean {
  return Boolean(text.trim() && (text === renderStructuredCv(cv) || text === cv.textBasis));
}

export function reviewedCvPayload(text: string, cv: StructuredCvData, approval: string | null) {
  if (!hasApprovedCv(approval, text, cv)) throw new Error("Granska och godkänn aktuell CV-text och profilfakta innan du sparar.");
  const legacy = structuredCvToLegacy(cv);
  return { cv_text: text, cv_structured: cv, cv_generated: true,
    strengths: legacy.strengths, work_experience: legacy.workExperience, education: legacy.education,
    languages: legacy.languages, certificates: legacy.certificates.join("\n") || null,
    extracurriculars: legacy.extracurriculars.join("\n") || null };
}

export function hasApprovedCv(approval: string | null, text: string, cv: StructuredCvData): boolean {
  return Boolean(approval && isCvTextAligned(text, cv) && approval === cvReviewSnapshot(text, cv));
}

export const CV_FACT_LABELS: Record<string, string> = {
  personalInfo: "Kontaktuppgifter", profile: "Profil", workExperience: "Arbetslivserfarenhet",
  education: "Utbildning", projects: "Projekt", skills: "Kompetenser", certifications: "Meriter",
  languages: "Språk", otherExperience: "Övrig erfarenhet", name: "Namn", city: "Ort",
  phone: "Telefon", email: "E-post", linkedin: "LinkedIn", portfolio: "Portfolio",
  summary: "Profiltext", strengths: "Styrkor", traits: "Egenskaper", interests: "Intressen",
  targetRoles: "Sökta roller", differentiators: "Övriga styrkor", employer: "Arbetsgivare",
  role: "Roll", location: "Plats", startDate: "Start", endDate: "Slut", duration: "Period / längd",
  responsibilities: "Arbetsuppgifter", tools: "Verktyg", collaboration: "Samarbete",
  achievements: "Resultat / meriter", learnings: "Lärdomar", description: "Beskrivning",
  school: "Skola", program: "Program", expectedGraduation: "Planerad examen", courses: "Kurser",
  contributions: "Insats", results: "Resultat", category: "Kategori", evidence: "Belägg",
  issuer: "Utfärdare", year: "År", reason: "Beskrivning", level: "Nivå", abilities: "Förmågor",
  title: "Titel", type: "Typ", organization: "Organisation", period: "Period", details: "Uppgifter",
};

export type CvFactField = { path: string[]; label: string; value: string };
export function cvFactFields(cv: StructuredCvData): CvFactField[] {
  const fields: CvFactField[] = [];
  function visit(value: unknown, path: string[]) {
    if (typeof value === "string" || value === undefined && path.at(-1) === "level") {
      fields.push({ path, label: path.map((part) => /^\d+$/.test(part) ? String(Number(part) + 1) : CV_FACT_LABELS[part] ?? part).join(" · "), value: value ?? "" });
    } else if (Array.isArray(value)) value.forEach((item, index) => visit(item, [...path, String(index)]));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => {
      if (key !== "sourceNotes" && key !== "textBasis") visit(item, [...path, key]);
    });
  }
  visit(cv, []);
  return fields;
}

export function updateCvFact(cv: StructuredCvData, path: string[], value: string): StructuredCvData {
  const next = structuredClone(cv);
  delete next.textBasis;
  let target: unknown = next;
  for (const part of path.slice(0, -1)) target = (target as Record<string, unknown>)[part];
  (target as Record<string, unknown>)[path[path.length - 1]] = value;
  return next;
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}
const normalize = (value: string) => value.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");

export function cvSourceText(source: StructuredCvData, conversation: unknown[] = []): string {
  const answers = conversation.flatMap((turn) => turn && typeof turn === "object" && "answer" in turn && typeof turn.answer === "string" ? [turn.answer] : []);
  return [...new Set([...stringsIn(source), ...answers].map((value) => value.trim()).filter(Boolean))].join("\n");
}

// Conservative guard, not a semantic truth detector. All remaining proposals
// still require the explicit review above. Questions never count as evidence.
export function guardCvPrecision(cv: StructuredCvData, source: StructuredCvData, conversation: unknown[] = []): StructuredCvData {
  const answers = conversation.flatMap((turn) => turn && typeof turn === "object" && "answer" in turn && typeof turn.answer === "string" ? [turn.answer] : []);
  const evidence = [...stringsIn(source), ...answers].map(normalize);
  const next = structuredClone(cv);
  for (const item of [...next.workExperience, ...next.education, ...next.certifications, ...next.otherExperience]) {
    const record = item as unknown as Record<string, unknown>;
    for (const key of ["startDate", "endDate", "expectedGraduation", "duration", "year", "period"]) {
      const value = record[key];
      if (typeof value === "string" && value && !evidence.some((text) => text.includes(normalize(value)))) record[key] = "";
    }
  }
  for (const language of next.languages) {
    if (!language.level) continue;
    const name = normalize(language.name), level = normalize(language.level);
    // Require an explicit name/level pair in the same local phrase. Do not
    // borrow another language's level, or upgrade "flytande" to "modersmål".
    const supported = evidence.some((text) => text.split(/[.;\n]/).some((phrase) => {
      const index = phrase.indexOf(name);
      if (index < 0) return false;
      const suffix = phrase.slice(index + name.length);
      const nextName = next.languages.map((other) => normalize(other.name)).filter((other) => other !== name).map((other) => suffix.indexOf(other)).filter((position) => position >= 0);
      const local = suffix.slice(0, nextName.length ? Math.min(...nextName) : 80);
      return (!/\b(inte|ej|aldrig)\b/.test(local) && local.includes(level)) || normalize(phrase) === `${level} ${name}` || normalize(phrase) === name && source.languages.some((original) => normalize(original.name) === name && original.level === language.level);
    }));
    if (!supported) language.level = undefined;
  }
  return next;
}

// Preserve independently entered languages, but replace/remove every language
// that belonged to the previous CV. The CV editor is the source for those facts.
export function syncRecruitmentCvLanguages(raw: unknown, previous: StructuredCvData | null | undefined, next: StructuredCvData) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const result = structuredClone(raw) as Record<string, unknown>;
  if (!result.qualifications || typeof result.qualifications !== "object") return raw;
  const qualifications = result.qualifications as Record<string, unknown>;
  const replaced = new Set([...(previous?.languages ?? []), ...next.languages].map((item) => item.name.trim().toLocaleLowerCase("sv-SE")));
  const other = (Array.isArray(qualifications.languages) ? qualifications.languages : []).filter((item) => item && typeof item.language === "string" && !replaced.has(item.language.trim().toLocaleLowerCase("sv-SE")));
  qualifications.languages = [...other, ...next.languages.filter((item) => item.level).map((item) => ({ language: item.name, level: item.level }))].slice(0, 8);
  return result;
}
