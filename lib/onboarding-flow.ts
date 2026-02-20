import { OnboardingStep, YouthProfile } from "@/lib/types";
import {
  CITY_RECOMMENDATIONS,
  ROLE_RECOMMENDATIONS,
  recommendationsForStep,
} from "@/lib/recommendations";

export interface OnboardingDraft {
  name: string;
  age: number | null;
  city: string;
  targetRole: string;
  interests: string[];
  skills: string[];
  availability: string;
  experience: string[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "name",
  "age",
  "city",
  "targetRole",
  "interests",
  "skills",
  "availability",
  "experience",
];

const STEP_QUESTIONS: Record<OnboardingStep, string> = {
  name: "What is your name?",
  age: "How old are you? (12-20)",
  city: "Which city do you live in?",
  targetRole: "What type of job do you want first?",
  interests: "What interests you most?",
  skills: "What are your strongest skills?",
  availability: "When can you work?",
  experience: "Any earlier experience? One short example is enough.",
};

function normalizeList(value: string): string[] {
  return value
    .split(/,|;|\/|\band\b|\boch\b/i)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseAge(text: string): number | null {
  const normalized = text.toLowerCase();
  const direct = normalized.match(/\b(1[2-9]|20)\b/);
  if (direct) {
    return Number(direct[1]);
  }

  const ageWords: Record<string, number> = {
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    tolv: 12,
    tretton: 13,
    fjorton: 14,
    femton: 15,
    sexton: 16,
    sjutton: 17,
    arton: 18,
    nitton: 19,
    tjugo: 20,
  };

  const found = Object.entries(ageWords).find(([word]) => normalized.includes(word));
  return found ? found[1] : null;
}

function parseName(text: string): string {
  const cleaned = text
    .replace(/^(my name is|i am|i'm|jag heter|name is)\s*/i, "")
    .replace(/[0-9]/g, "")
    .trim();
  return cleaned;
}

function parseCity(text: string): string {
  const lowered = text.toLowerCase();
  const known = CITY_RECOMMENDATIONS.find((city) =>
    lowered.includes(city.toLowerCase()),
  );
  if (known) return known;
  return text
    .replace(/^(i live in|from|bor i|in)\s*/i, "")
    .trim();
}

function parseRole(text: string): string {
  return text
    .replace(/^(i want|looking for|job|role|position|jobs|jobb som)\s*/i, "")
    .trim();
}

function parseRoles(text: string): string[] {
  const rawParts = normalizeList(text);
  const normalized = rawParts
    .map((part) => parseRole(part))
    .filter(Boolean);

  const matchedRecommended = ROLE_RECOMMENDATIONS.filter((role) =>
    normalized.some((entry) =>
      role.toLowerCase().includes(entry.toLowerCase()) ||
      entry.toLowerCase().includes(role.toLowerCase()),
    ),
  );
  return unique([...matchedRecommended, ...normalized]).slice(0, 8);
}

export function draftFromProfile(profile: YouthProfile): OnboardingDraft {
  return {
    name: profile.name || "",
    age: profile.age || null,
    city: profile.city || "",
    targetRole: profile.targetRole || "",
    interests: profile.interests || [],
    skills: profile.skills || [],
    availability: profile.availability || "",
    experience: profile.experience || [],
  };
}

export function isStepComplete(step: OnboardingStep, draft: OnboardingDraft): boolean {
  if (step === "name") return draft.name.trim().length >= 2;
  if (step === "age") return !!draft.age && draft.age >= 12 && draft.age <= 20;
  if (step === "city") return draft.city.trim().length >= 2;
  if (step === "targetRole") return draft.targetRole.trim().length >= 2;
  if (step === "interests") return draft.interests.length >= 1;
  if (step === "skills") return draft.skills.length >= 2;
  if (step === "availability") return draft.availability.trim().length >= 3;
  return draft.experience.length >= 1;
}

export function firstIncompleteStep(draft: OnboardingDraft): OnboardingStep | null {
  for (const step of ONBOARDING_STEPS) {
    if (!isStepComplete(step, draft)) {
      return step;
    }
  }
  return null;
}

export function completionPercent(draft: OnboardingDraft): number {
  const done = ONBOARDING_STEPS.filter((step) => isStepComplete(step, draft)).length;
  return Math.round((done / ONBOARDING_STEPS.length) * 100);
}

export function questionForStep(step: OnboardingStep): string {
  return STEP_QUESTIONS[step];
}

export function applyAnswer(input: {
  draft: OnboardingDraft;
  step: OnboardingStep;
  answer: string;
}): { accepted: boolean; hint?: string; draft: OnboardingDraft } {
  const next = { ...input.draft };
  const answer = input.answer.trim();
  if (!answer) {
    return { accepted: false, hint: "Please write a short answer.", draft: next };
  }

  if (input.step === "name") {
    const name = parseName(answer);
    if (name.length < 2) {
      return { accepted: false, hint: "Please write your full first name.", draft: next };
    }
    next.name = name;
    return { accepted: true, draft: next };
  }

  if (input.step === "age") {
    const age = parseAge(answer);
    if (!age || age < 12 || age > 20) {
      return { accepted: false, hint: "Please enter an age between 12 and 20.", draft: next };
    }
    next.age = age;
    return { accepted: true, draft: next };
  }

  if (input.step === "city") {
    const city = parseCity(answer);
    if (city.length < 2) {
      return { accepted: false, hint: "Please type your city.", draft: next };
    }
    next.city = city;
    return { accepted: true, draft: next };
  }

  if (input.step === "targetRole") {
    const roles = parseRoles(answer);
    if (roles.length === 0) {
      return { accepted: false, hint: "Pick or type a role you want.", draft: next };
    }
    next.targetRole = roles.join(", ");
    return { accepted: true, draft: next };
  }

  if (input.step === "interests") {
    const interests = unique(normalizeList(answer)).slice(0, 8);
    if (interests.length === 0) {
      return { accepted: false, hint: "Add at least one interest.", draft: next };
    }
    next.interests = interests;
    return { accepted: true, draft: next };
  }

  if (input.step === "skills") {
    const skills = unique(normalizeList(answer)).slice(0, 12);
    if (skills.length < 2) {
      return { accepted: false, hint: "Add at least two skills.", draft: next };
    }
    next.skills = skills;
    return { accepted: true, draft: next };
  }

  if (input.step === "availability") {
    if (answer.length < 3) {
      return { accepted: false, hint: "Add a short availability sentence.", draft: next };
    }
    next.availability = answer;
    return { accepted: true, draft: next };
  }

  const experience = unique(normalizeList(answer)).slice(0, 8);
  if (experience.length === 0) {
    return { accepted: false, hint: "Share one short experience.", draft: next };
  }
  next.experience = experience;
  return { accepted: true, draft: next };
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  if (index < 0 || index + 1 >= ONBOARDING_STEPS.length) return null;
  return ONBOARDING_STEPS[index + 1];
}

export function recommendations(step: OnboardingStep): string[] {
  return recommendationsForStep(step);
}
