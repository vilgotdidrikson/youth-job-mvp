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
  "Customer service": ["customer", "service", "kassa", "kund", "support"],
  Teamwork: ["team", "group", "samarbete", "collabor"],
  Sales: ["sales", "sell", "retail", "butik", "shop"],
  Communication: ["communicat", "social", "talk", "speak", "present"],
  "Time management": ["schedule", "time", "plan", "organize", "struktur"],
  Responsibility: ["respons", "reliable", "trust", "ansvar"],
  Childcare: ["child", "kids", "barn", "youth leader"],
  "Food service": ["cafe", "restaurant", "kitchen", "barista", "server"],
  "Event support": ["event", "festival", "conference", "arrangement"],
  Administration: ["excel", "office", "admin", "data", "register"],
  "Social media": ["instagram", "tiktok", "content", "so-me", "social media"],
};

const ACTION_VERBS_EN = [
  "Supported",
  "Organized",
  "Assisted",
  "Coordinated",
  "Handled",
  "Contributed to",
];

const ACTION_VERBS_SV = [
  "Stottade",
  "Organiserade",
  "Hjalpte till med",
  "Koordinerade",
  "Ansvarade for",
  "Bidrog till",
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function gatherUserText(prompt?: string, messages?: CvChatMessage[]): string {
  const chat = (messages || [])
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");
  return compactText(`${prompt || ""} ${chat}`.trim());
}

function inferSkills(profile: YouthProfile, text: string): string[] {
  const source = text.toLowerCase();
  const inferred = Object.entries(SKILL_KEYWORDS)
    .filter(([, keys]) => keys.some((key) => source.includes(key)))
    .map(([skill]) => skill);

  const explicitFromPrompt = (text.match(/skills?\s*:\s*([^.]+)/i)?.[1] || "")
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return unique([...profile.skills, ...inferred, ...explicitFromPrompt]).slice(0, 10);
}

function inferKeywords(
  targetRole: string | undefined,
  targetJobType: JobType | "any",
  skills: string[],
): string[] {
  const keywords = [...skills];
  if (targetRole) {
    keywords.push(targetRole);
  }
  if (targetJobType !== "any") {
    keywords.push(targetJobType);
  }
  if (targetJobType === "summer") {
    keywords.push("seasonal");
    keywords.push("flexible");
  }
  if (targetJobType === "part-time") {
    keywords.push("evening shifts");
    keywords.push("weekends");
  }
  if (targetJobType === "temporary") {
    keywords.push("fast onboarding");
    keywords.push("adaptable");
  }
  return unique(keywords).slice(0, 14);
}

function inferExperienceHints(
  text: string,
  interests: string[],
  profileExperience: string[],
): string[] {
  const hintsFromText = text
    .split(/[.!?\n]/)
    .map((chunk) => compactText(chunk))
    .filter(
      (chunk) =>
        /worked|work|volunteer|helped|project|intern|practice|event|school|job|summer|experience|ansvar|praktik|sommarjobb/i.test(
          chunk,
        ) && chunk.length > 16,
    )
    .slice(0, 5);
  const hints = unique([...profileExperience, ...hintsFromText]).slice(0, 6);

  if (hints.length > 0) {
    return hints;
  }

  if (interests.length > 0) {
    return interests.slice(0, 3).map((interest) => `Active interest in ${interest}.`);
  }

  return ["Contributed to school and community activities."];
}

function buildExperienceBullets(
  experienceHints: string[],
  language: CvLanguage,
): string[] {
  const verbs = language === "sv" ? ACTION_VERBS_SV : ACTION_VERBS_EN;
  return experienceHints.map((hint, index) => {
    const sentence = hint.replace(/^[\-*]\s*/, "").replace(/\.$/, "");
    return `${verbs[index % verbs.length]} ${sentence}.`;
  });
}

function resolveToneText(tone: CvTone, language: CvLanguage): string {
  if (language === "sv") {
    if (tone === "confident") return "malinriktad och driven";
    if (tone === "friendly") return "positiv och samarbetsinriktad";
    return "ansvarsfull och professionell";
  }
  if (tone === "confident") return "goal-oriented and driven";
  if (tone === "friendly") return "positive and team-friendly";
  return "reliable and professional";
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
  const toneText = resolveToneText(tone, language);
  const roleText =
    targetRole || (language === "sv" ? "deltidsarbete" : "part-time opportunities");
  const topSkills = skills.slice(0, 4).join(", ");
  const availability = profile.availability || (language === "sv" ? "flexibel" : "flexible");
  const city = profile.city || "Sweden";

  if (language === "sv") {
    return `${profile.name || "Kandidat"} ar en ${toneText} ungdom i ${city} som soker ${roleText}. Stark inom ${topSkills || "samarbete och service"} med tillganglighet: ${availability}.`;
  }
  const typeText = targetJobType === "any" ? "part-time and temporary work" : targetJobType;
  return `${profile.name || "Candidate"} is a ${toneText} youth based in ${city} seeking ${roleText} (${typeText}). Strong in ${topSkills || "teamwork and service"} with availability: ${availability}.`;
}

function buildSuggestions(input: {
  profile: YouthProfile;
  skills: string[];
  experienceHints: string[];
  targetRole?: string;
}): string[] {
  const suggestions: string[] = [];
  if (input.skills.length < 4) {
    suggestions.push("Add at least 2-3 more concrete skills.");
  }
  if (input.experienceHints.length < 2) {
    suggestions.push("Describe one school project or volunteer activity with outcomes.");
  }
  if (!input.profile.availability) {
    suggestions.push("Add exact availability (e.g., weekdays after 16:00, weekends).");
  }
  if (!input.targetRole) {
    suggestions.push("Set a target role to tailor the CV for matching.");
  }
  return suggestions;
}

function computeQualityScore(input: {
  profile: YouthProfile;
  skills: string[];
  experienceHints: string[];
  targetRole?: string;
  text: string;
}): number {
  let score = 0;
  if (input.profile.name) score += 15;
  if (input.profile.city) score += 10;
  if (input.profile.age) score += 8;
  if (input.profile.availability) score += 12;
  if (input.profile.experience.length > 0) score += 10;
  if (input.skills.length >= 4) score += 18;
  if (input.experienceHints.length >= 2) score += 18;
  if (input.targetRole) score += 9;
  if (/\d/.test(input.text)) score += 10;
  return Math.min(100, score);
}

export function generateCv(input: CvGenerateInput): CvGenerateOutput {
  const language = input.language || "en";
  const tone = input.tone || "professional";
  const targetJobType = input.targetJobType || "any";
  const sourceText = gatherUserText(input.prompt, input.messages);
  const targetRole =
    compactText(input.targetRole || input.profile.targetRole || "") || undefined;
  const skills = inferSkills(input.profile, sourceText);
  const experienceHints = inferExperienceHints(
    sourceText,
    input.profile.interests,
    input.profile.experience || [],
  );
  const experienceBullets = buildExperienceBullets(experienceHints, language);
  const summary = buildSummary({
    profile: input.profile,
    language,
    tone,
    skills,
    targetRole,
    targetJobType,
  });
  const keywords = inferKeywords(targetRole, targetJobType, skills);
  const suggestions = buildSuggestions({
    profile: input.profile,
    skills,
    experienceHints,
    targetRole,
  });
  const qualityScore = computeQualityScore({
    profile: input.profile,
    skills,
    experienceHints,
    targetRole,
    text: sourceText,
  });

  const name = input.profile.name || "Youth Candidate";
  const city = input.profile.city || "Sweden";
  const interests = input.profile.interests.length
    ? input.profile.interests
    : language === "sv"
      ? ["Service", "Butik", "Larande"]
      : ["Service", "Retail", "Learning"];
  const availability =
    input.profile.availability ||
    (language === "sv" ? "Flexibel enligt overenskommelse" : "Flexible by agreement");
  const ageLine = input.profile.age
    ? language === "sv"
      ? `${input.profile.age} ar`
      : `${input.profile.age} years old`
    : "";

  const headings =
    language === "sv"
      ? {
          title: "CV",
          summary: "Profil",
          skills: "Nyckelkompetenser",
          experience: "Erfarenhet och projekt",
          education: "Utbildning",
          interests: "Intressen",
          availability: "Tillganglighet",
          references: "Referenser",
          keywords: "Sokord for matchning",
        }
      : {
          title: "CV",
          summary: "Profile",
          skills: "Core Skills",
          experience: "Experience and Projects",
          education: "Education",
          interests: "Interests",
          availability: "Availability",
          references: "References",
          keywords: "Matching Keywords",
        };

  const contactEmail = `${name.toLowerCase().replace(/\s+/g, ".")}@mail.com`;
  const roleLine = targetRole
    ? `${language === "sv" ? "Soker roll" : "Target Role"}: ${targetRole}`
    : "";
  const educationLine =
    language === "sv"
      ? "Pagaende gymnasiestudier (eller motsvarande)."
      : "Ongoing upper-secondary studies (or equivalent).";
  const referencesLine =
    language === "sv"
      ? "Referenser lamnas pa begaran."
      : "References available on request.";

  const content = [
    headings.title,
    "==============================",
    name,
    ageLine ? `${city}, Sweden | ${ageLine}` : `${city}, Sweden`,
    `${language === "sv" ? "Kontakt" : "Contact"}: ${contactEmail} | +46 70 000 00 00`,
    roleLine,
    "",
    headings.summary,
    "------------------------------",
    summary,
    "",
    headings.skills,
    "------------------------------",
    ...skills.map((skill) => `- ${skill}`),
    "",
    headings.experience,
    "------------------------------",
    ...experienceBullets.map((bullet) => `- ${bullet}`),
    "",
    headings.education,
    "------------------------------",
    `- ${educationLine}`,
    "",
    headings.interests,
    "------------------------------",
    ...interests.map((interest) => `- ${interest}`),
    "",
    headings.availability,
    "------------------------------",
    availability,
    "",
    headings.references,
    "------------------------------",
    referencesLine,
    "",
    headings.keywords,
    "------------------------------",
    keywords.join(", "),
  ].join("\n");

  const highlights = [
    skills.length >= 5 ? "Skill coverage is strong." : "Add more role-specific skills.",
    experienceHints.length >= 3
      ? "Experience signals are clear."
      : "Add one more concrete experience example.",
    qualityScore >= 80
      ? "CV quality is high for MVP matching."
      : "Improve details to increase match quality.",
  ];

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
    input.profile.interests,
    input.profile.experience || [],
  );

  const missingFields: string[] = [];
  if (extractedSkills.length < 4) missingFields.push("skills");
  if (extractedExperienceHints.length < 2) missingFields.push("experience");
  if (!input.profile.availability && !/week|helg|kvall|evening|weekend/i.test(text)) {
    missingFields.push("availability");
  }
  if (!/apply|role|jobb|position|assistant|cashier|barista|lager|store/i.test(text)) {
    missingFields.push("target role");
  }

  const replyParts: string[] = [];
  if (extractedSkills.length > 0) {
    replyParts.push(
      `Great, I captured these strengths: ${extractedSkills.slice(0, 5).join(", ")}.`,
    );
  } else {
    replyParts.push(
      "Tell me a few specific strengths (for example customer service, teamwork, social media).",
    );
  }

  if (missingFields.includes("experience")) {
    replyParts.push(
      "What is one concrete example where you helped, organized, or solved something at school, work, or volunteering?",
    );
  } else if (missingFields.includes("availability")) {
    replyParts.push("What exact days or times can you work?");
  } else if (missingFields.includes("target role")) {
    replyParts.push("What role do you want to target first?");
  } else {
    replyParts.push(
      "Nice input. You can now generate a tailored CV, or share one measurable result to improve it further.",
    );
  }

  return {
    reply: replyParts.join(" "),
    missingFields,
    extractedSkills,
    extractedExperienceHints,
  };
}
