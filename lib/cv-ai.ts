import { JobType, YouthProfile } from "@/lib/types";

export type CvLanguage = "sv" | "en";
export type CvTone = "professional" | "friendly" | "confident";

export interface CvChatMessage {
  role: "assistant" | "user";
  content: string;
}

export interface CvGenerateInput {
  profile: YouthProfile;
  prompt?: string;
  messages?: CvChatMessage[];
  targetRole?: string;
  targetJobType?: JobType | "any";
  language?: CvLanguage;
  tone?: CvTone;
}

export interface CvGenerateOutput {
  summary: string;
  content: string;
  qualityScore: number;
  highlights: string[];
  keywords: string[];
  suggestions: string[];
  language: CvLanguage;
  tone: CvTone;
  targetRole?: string;
}

export interface CvChatReply {
  reply: string;
  missingFields: string[];
  extractedSkills: string[];
  extractedExperienceHints: string[];
}

const SKILL_KEYWORDS: Record<string, string[]> = {
  Kundservice: ["kund", "service", "kassa", "support", "customer"],
  Samarbete: ["team", "samarbete", "group", "collabor"],
  Kommunikation: ["kommunikation", "talk", "speak", "social"],
  Ansvarstagande: ["ansvar", "reliable", "trust", "respons"],
  "Tidshantering": ["time", "schema", "plan", "organize"],
  "Mat och servering": ["cafe", "barista", "restaurant", "kitchen", "servering"],
  "Sociala medier": ["instagram", "tiktok", "content", "social media"],
};

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function gatherUserText(prompt?: string, messages?: CvChatMessage[]): string {
  const chat = (messages || [])
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");
  return compactText(`${prompt || ""} ${chat}`);
}

function inferSkills(profile: YouthProfile, text: string): string[] {
  const lower = text.toLowerCase();
  const inferred = Object.entries(SKILL_KEYWORDS)
    .filter(([, keys]) => keys.some((key) => lower.includes(key)))
    .map(([skill]) => skill);
  return unique([...(profile.skills || []), ...inferred]).slice(0, 10);
}

function inferExperienceHints(
  text: string,
  interests: string[],
  profileExperience: string[],
  language: CvLanguage,
): string[] {
  const hintsFromText = text
    .split(/[.!?\n]/)
    .map((chunk) => compactText(chunk))
    .filter((chunk) => chunk.length > 15)
    .slice(0, 4);
  const hints = unique([...(profileExperience || []), ...hintsFromText]).slice(0, 6);
  if (hints.length > 0) return hints;
  if (interests.length > 0) {
    return language === "sv"
      ? interests.slice(0, 3).map((interest) => `Intresse för ${interest}`)
      : interests.slice(0, 3).map((interest) => `Interest in ${interest}`);
  }
  return language === "sv"
    ? ["Bidragit i skol- och fritidsaktiviteter"]
    : ["Contributed in school and community activities"];
}

function buildSummary(input: {
  profile: YouthProfile;
  language: CvLanguage;
  tone: CvTone;
  skills: string[];
  targetRole?: string;
  targetJobType: JobType | "any";
}): string {
  const { profile, language, tone, skills, targetRole, targetJobType } = input;
  const city = profile.city || (language === "sv" ? "Sverige" : "Sweden");
  const toneText =
    language === "sv"
      ? tone === "confident"
        ? "målinriktad"
        : tone === "friendly"
          ? "positiv"
          : "professionell"
      : tone === "confident"
        ? "goal-oriented"
        : tone === "friendly"
          ? "positive"
          : "professional";
  const roleText =
    targetRole ||
    (language === "sv" ? "deltids- och tillfälliga jobb" : "part-time and temporary jobs");
  const typeText =
    targetJobType === "any"
      ? language === "sv"
        ? "deltids- och tillfälliga jobb"
        : "part-time and temporary jobs"
      : targetJobType;
  const topSkills = skills.slice(0, 4).join(", ");
  const availability =
    profile.availability || (language === "sv" ? "flexibel enligt överenskommelse" : "flexible");

  if (language === "sv") {
    return `Jag är en ${toneText} ungdom i ${city} som söker ${roleText} (${typeText}). Jag är stark inom ${topSkills || "service och samarbete"} och har tillgänglighet: ${availability}.`;
  }
  return `I am a ${toneText} youth in ${city} seeking ${roleText} (${typeText}). I am strong in ${topSkills || "service and teamwork"} and available: ${availability}.`;
}

function computeQualityScore(input: {
  profile: YouthProfile;
  skills: string[];
  experienceHints: string[];
  targetRole?: string;
}): number {
  let score = 0;
  if (input.profile.name) score += 15;
  if (input.profile.city) score += 10;
  if (input.profile.age) score += 8;
  if (input.profile.availability) score += 12;
  if ((input.profile.experience || []).length > 0) score += 10;
  if (input.skills.length >= 3) score += 18;
  if (input.experienceHints.length >= 2) score += 18;
  if (input.targetRole) score += 9;
  return Math.min(100, score);
}

export function generateCv(input: CvGenerateInput): CvGenerateOutput {
  const language = input.language || "sv";
  const tone = input.tone || "friendly";
  const targetJobType = input.targetJobType || "any";
  const targetRole = compactText(input.targetRole || input.profile.targetRole || "") || undefined;
  const sourceText = gatherUserText(input.prompt, input.messages);
  const skills = inferSkills(input.profile, sourceText);
  const experienceHints = inferExperienceHints(
    sourceText,
    input.profile.interests || [],
    input.profile.experience || [],
    language,
  );
  const summary = buildSummary({
    profile: input.profile,
    language,
    tone,
    skills,
    targetRole,
    targetJobType,
  });
  const keywords = unique([...skills, ...(targetRole ? [targetRole] : [])]).slice(0, 12);
  const qualityScore = computeQualityScore({
    profile: input.profile,
    skills,
    experienceHints,
    targetRole,
  });

  const name = input.profile.name || (language === "sv" ? "Ung kandidat" : "Youth candidate");
  const city = input.profile.city || (language === "sv" ? "Sverige" : "Sweden");
  const ageLine = input.profile.age
    ? language === "sv"
      ? `${input.profile.age} år`
      : `${input.profile.age} years old`
    : "";
  const educationLine =
    language === "sv"
      ? "Pågående gymnasiestudier (eller motsvarande)."
      : "Ongoing upper-secondary studies (or equivalent).";
  const referencesLine =
    language === "sv" ? "Referenser lämnas på begäran." : "References available on request.";
  const roleLine =
    targetRole && language === "sv"
      ? `Söker främst rollen ${targetRole}.`
      : targetRole
        ? `Mainly looking for the role ${targetRole}.`
        : "";

  const content = [
    name,
    ageLine ? `${city}. ${ageLine}.` : `${city}.`,
    roleLine,
    "",
    summary,
    "",
    language === "sv"
      ? `Kompetenser inkluderar ${skills.join(", ")}.`
      : `Skills include ${skills.join(", ")}.`,
    "",
    experienceHints.map((item) => `${item}.`).join(" "),
    "",
    educationLine,
    "",
    language === "sv"
      ? `På fritiden är intressena ${(input.profile.interests || []).join(", ")}.`
      : `Outside work, interests include ${(input.profile.interests || []).join(", ")}.`,
    "",
    language === "sv"
      ? `Tillgänglig för arbete ${input.profile.availability || "enligt överenskommelse"}.`
      : `Available to work ${input.profile.availability || "by agreement"}.`,
    "",
    referencesLine,
    "",
    keywords.join(", "),
  ].join("\n");

  const highlights =
    language === "sv"
      ? [
          skills.length >= 5 ? "Stark täckning av relevanta färdigheter." : "Lägg till fler rollspecifika färdigheter.",
          experienceHints.length >= 3
            ? "Erfarenheten är tydlig och konkret."
            : "Lägg till ytterligare ett konkret exempel på erfarenhet.",
          qualityScore >= 80
            ? "CV-kvaliteten är hög för matchning i MVP."
            : "Förbättra detaljer för bättre matchningskvalitet.",
        ]
      : [
          skills.length >= 5 ? "Skill coverage is strong." : "Add more role-specific skills.",
          experienceHints.length >= 3
            ? "Experience signals are clear."
            : "Add one more concrete experience example.",
          qualityScore >= 80
            ? "CV quality is high for MVP matching."
            : "Improve details to increase match quality.",
        ];

  const suggestions =
    language === "sv"
      ? [
          skills.length < 4 ? "Lägg till minst 2-3 konkreta färdigheter till." : "",
          experienceHints.length < 2 ? "Beskriv ett skolprojekt eller volontärarbete med resultat." : "",
          !input.profile.availability ? "Lägg till exakt tillgänglighet (t.ex. vardagar efter 16:00, helger)." : "",
        ].filter(Boolean)
      : [
          skills.length < 4 ? "Add at least 2-3 more concrete skills." : "",
          experienceHints.length < 2 ? "Describe one school project or volunteer activity with outcomes." : "",
          !input.profile.availability ? "Add exact availability (e.g., weekdays after 16:00, weekends)." : "",
        ].filter(Boolean);

  return {
    summary,
    content,
    qualityScore,
    highlights,
    keywords,
    suggestions,
    language,
    tone,
    targetRole,
  };
}

export function generateCvChatReply(input: {
  profile: YouthProfile;
  messages: CvChatMessage[];
}): CvChatReply {
  const text = gatherUserText("", input.messages);
  const extractedSkills = inferSkills(input.profile, text);
  const extractedExperienceHints = inferExperienceHints(
    text,
    input.profile.interests || [],
    input.profile.experience || [],
    "en",
  );

  const missingFields: string[] = [];
  if (extractedSkills.length < 4) missingFields.push("skills");
  if (extractedExperienceHints.length < 2) missingFields.push("experience");
  if (!input.profile.availability && !/week|helg|kväll|evening|weekend/i.test(text)) {
    missingFields.push("availability");
  }
  if (!/apply|role|jobb|position|assistant|cashier|barista|lager|store/i.test(text)) {
    missingFields.push("target role");
  }

  const replyParts: string[] = [];
  if (extractedSkills.length > 0) {
    replyParts.push(`Great, I captured these strengths: ${extractedSkills.slice(0, 5).join(", ")}.`);
  } else {
    replyParts.push("Tell me a few specific strengths (for example customer service, teamwork, social media).");
  }

  if (missingFields.includes("experience")) {
    replyParts.push("What is one concrete example where you helped, organized, or solved something at school, work, or volunteering?");
  } else if (missingFields.includes("availability")) {
    replyParts.push("What exact days or times can you work?");
  } else if (missingFields.includes("target role")) {
    replyParts.push("What role do you want to target first?");
  } else {
    replyParts.push("Nice input. You can now generate a tailored CV, or share one measurable result to improve it further.");
  }

  return {
    reply: replyParts.join(" "),
    missingFields,
    extractedSkills,
    extractedExperienceHints,
  };
}

