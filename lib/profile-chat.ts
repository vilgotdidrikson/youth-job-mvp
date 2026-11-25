import { preferredJobCategories } from "./job-categories";
import { LANGUAGE_LEVELS, validateRecruitmentProfile, type RecruitmentProfile } from "./recruitment-profile";
import { createEmptyStructuredCv, structuredCvFromForm, type StructuredCvData } from "./structured-cv";

export const profileChatFields = {
  roles: ["Vilka typer av jobb är du nyfiken på?", "Skriv en roll per rad.", "Vad vill du gärna göra under en arbetsdag?"],
  locations: ["Var vill du jobba?", "Skriv en ort eller stadsdel per rad.", "Vilka områden fungerar för din vardag?"],
  motivation: ["Vad vill du göra eller lära dig på jobbet?", "", "Vad lockar dig med de arbetsuppgifterna?"],
  availability: ["När kan du jobba?", "Berätta till exempel om dagar, tider eller tidigaste start.", "Finns det någon tid du brukar kunna jobba?"],
  tools: ["Vilka verktyg eller andra praktiska saker kan du?", "Skriv en kunskap per rad.", "Vad har du använt för att klara en uppgift?"],
  licences: ["Har du något körkort, intyg eller annan behörighet?", "Skriv en uppgift per rad.", "Finns det någon behörighet du har fått via skolan eller fritiden?"],
  languages: ["Vilka språk kan du använda?", "Skriv språk och nivå, till exempel Svenska – Modersmål, ett per rad.", "Hur skulle du beskriva din nivå i de språk du nämner?"],
  experience: ["Vad har du gjort på jobb, i skolan eller på fritiden?", "Skriv en erfarenhet per rad, gärna vad du gjorde och var.", "Vad gjorde du själv i uppgiften?"],
  education: ["Vad har du studerat eller vad studerar du nu?", "Skriv en utbildning per rad.", "Vad heter utbildningen eller inriktningen?"],
  strength: ["Vilken styrka vill du visa med ett eget exempel?", "", "Vad gjorde du i en situation som visar den styrkan?"],
  context: ["I vilken situation använde du den styrkan?", "", "Var hände det och vilken uppgift hade du?"],
  action: ["Vad gjorde du själv i den situationen?", "", "Vilka steg tog du?"],
} as const;

export type ProfileChatField = keyof typeof profileChatFields;
export type ProfileChatDraft = Partial<Record<ProfileChatField, string>>;
export const profileChatKeys = Object.keys(profileChatFields) as ProfileChatField[];
export const profileChatTextLimit = 1000;
const lines = (value: string | undefined) => (value ?? "").split(/\n/).map(item => item.trim()).filter(Boolean);

export function readProfileChatDraft(raw: unknown): ProfileChatDraft {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Record<string, unknown>;
  return Object.fromEntries(profileChatKeys.flatMap(key => {
    const entry = value[key];
    return typeof entry === "string" && entry.length <= profileChatTextLimit ? [[key, entry]] : [];
  }));
}

export function hasProfileChatAnswer(field: ProfileChatField, profile: RecruitmentProfile, cv?: StructuredCvData | null) {
  switch (field) {
    case "roles": return profile.preferences.roles.length > 0;
    case "locations": return profile.preferences.locations.length > 0;
    case "motivation": return Boolean(profile.preferences.motivation);
    case "availability": return Boolean(profile.availability.notes || profile.availability.days.length || profile.availability.periods.length || profile.availability.startDate || profile.availability.hours);
    case "tools": return profile.qualifications.tools.length > 0;
    case "licences": return profile.qualifications.licences.length > 0;
    case "languages": return profile.qualifications.languages.length > 0 || Boolean(cv?.languages.length);
    case "experience": return Boolean(cv?.workExperience.length || cv?.otherExperience.length || cv?.projects.length);
    case "education": return Boolean(cv?.education.length);
    default: return profile.examples.length > 0;
  }
}

function appendDistinct<T>(prior: T[], added: T[], key: (item: T) => string) {
  const seen = new Set(prior.map(item => key(item).trim().toLocaleLowerCase("sv")));
  return [...prior, ...added.filter(item => {
    const normalized = key(item).trim().toLocaleLowerCase("sv");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  })];
}

function chatLanguageEntries(raw: string | undefined) {
  return (raw ?? "").split(/\n|\s+\/\s+/).map(entry => entry.trim()).filter(Boolean).map(evidence => {
    const [language, level = ""] = evidence.split(/\s+[–—-]\s+/, 2);
    return { language, level, evidence };
  });
}

export function profileFromChat(profile: RecruitmentProfile, draft: ProfileChatDraft) {
  const roles = appendDistinct(profile.preferences.roles, lines(draft.roles), String);
  const languageEntries = chatLanguageEntries(draft.languages).map(({ language, level }) => ({ language, level }));
  const example = { strength: draft.strength?.trim() ?? "", context: draft.context?.trim() ?? "", action: draft.action?.trim() ?? "" };
  return validateRecruitmentProfile({
    ...profile,
    availability: { ...profile.availability, ...(draft.availability?.trim() ? { notes: draft.availability.trim() } : {}) },
    preferences: {
      ...profile.preferences,
      roles,
      ...(roles.length > profile.preferences.roles.length ? { categoryIds: [...new Set([...(profile.preferences.categoryIds ?? []), ...preferredJobCategories(roles)])] } : {}),
      locations: appendDistinct(profile.preferences.locations, lines(draft.locations), String),
      motivation: draft.motivation?.trim() || profile.preferences.motivation,
    },
    qualifications: {
      ...profile.qualifications,
      tools: appendDistinct(profile.qualifications.tools, lines(draft.tools), String),
      licences: appendDistinct(profile.qualifications.licences, lines(draft.licences), String),
      languages: appendDistinct(profile.qualifications.languages, languageEntries, item => item.language),
    },
    examples: Object.values(example).some(Boolean) ? appendDistinct(profile.examples, [example], item => JSON.stringify(item)) : profile.examples,
  });
}

export function cvFromProfileChat(draft: ProfileChatDraft, existing?: StructuredCvData | null): StructuredCvData {
  const cv = existing ?? createEmptyStructuredCv();
  const added = structuredCvFromForm({
    other_entries: lines(draft.experience).map(title => ({ title })),
    educations: lines(draft.education).map(school => ({ school })),
    certificate_entries: lines(draft.licences).map(name => ({ name })),
    skills_text: lines(draft.tools).join("\n"),
  });
  const languages = chatLanguageEntries(draft.languages).flatMap(({ language: name, level: rawLevel, evidence }) => {
    if (!rawLevel) return [];
    const normalized = rawLevel.toLocaleLowerCase("sv");
    const canonicalLevel = LANGUAGE_LEVELS.find(item => item.toLocaleLowerCase("sv") === normalized) as StructuredCvData["languages"][number]["level"];
    const level = canonicalLevel ?? (normalized === "goda kunskaper" ? "God" : normalized === "mycket goda kunskaper" ? "Mycket god" : undefined);
    return [{ name, ...(level ? { level } : {}), evidence, abilities: level ? [] : [rawLevel] }];
  });
  return {
    ...cv,
    otherExperience: appendDistinct(cv.otherExperience, added.otherExperience, item => item.title ?? ""),
    education: appendDistinct(cv.education, added.education, item => item.description || item.school || ""),
    certifications: appendDistinct(cv.certifications, added.certifications, item => item.name ?? ""),
    skills: appendDistinct(cv.skills, added.skills, item => item.name),
    languages: appendDistinct(cv.languages, languages, item => item.name),
  };
}
