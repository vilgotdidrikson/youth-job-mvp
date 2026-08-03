"use client";

import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  MessageSender,
  OnboardingMessage,
  OnboardingSession,
  SaveYouthProfileInput,
  YouthProfile,
} from "@/lib/types";

const ONBOARDING_QUESTIONS = [
  "Tell us a bit about yourself and what kind of work feels interesting.",
  "What strengths or skills do you already have?",
  "Do you have any school, hobby, volunteer, or work experience?",
  "Where would you like to work and when are you available?",
  "What kind of roles do you want to apply for first?",
] as const;

function splitListFromText(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickWritableKeys<T extends Record<string, unknown>>(payload: T, existing: Record<string, unknown> | null) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);

  if (!existing) {
    return Object.fromEntries(entries);
  }

  const allowed = new Set(Object.keys(existing));
  return Object.fromEntries(entries.filter(([key]) => allowed.has(key)));
}

async function requireYouthUser() {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);

  if (!user?.id || profile?.role !== "youth") {
    throw new Error("This action requires a youth account.");
  }

  return user;
}

export function getOnboardingQuestionPrompts(): string[] {
  return [...ONBOARDING_QUESTIONS];
}

export async function getOrCreateOnboardingSession(): Promise<OnboardingSession> {
  const user = await requireYouthUser();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_onboarding_sessions")
    .select("*")
    .eq("youth_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch onboarding session.", error);
    throw new Error(error.message);
  }

  if (data && !data.completed_at && data.status !== "completed") {
    return data as OnboardingSession;
  }

  const { data: created, error: createError } = await supabase
    .from("ai_onboarding_sessions")
    .insert({
      youth_user_id: user.id,
      status: "in_progress",
    })
    .select("*")
    .single();

  if (createError) {
    console.error("Failed to create onboarding session.", createError);
    throw new Error(createError.message);
  }

  return created as OnboardingSession;
}

export async function getOnboardingMessages(sessionId: string): Promise<OnboardingMessage[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_onboarding_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch onboarding messages.", error);
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    id: String(row.id ?? ""),
    session_id: String(row.session_id ?? sessionId),
    sender: (row.sender === "assistant" ? "assistant" : "user") as MessageSender,
    message_text: typeof row.message_text === "string" ? row.message_text : "",
  }));
}

export async function addOnboardingMessage(
  sessionId: string,
  sender: MessageSender,
  messageText: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("ai_onboarding_messages").insert({
    session_id: sessionId,
    sender,
    message_text: messageText,
  });

  if (error) {
    console.error("Failed to add onboarding message.", error);
    throw new Error(error.message);
  }
}

export async function completeOnboardingSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("ai_onboarding_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("Failed to complete onboarding session.", error);
    throw new Error(error.message);
  }
}

export async function getYouthProfile(userId?: string): Promise<YouthProfile | null> {
  const user = userId ? { id: userId } : await requireYouthUser();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("youth_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch youth profile.", error);
    throw new Error(error.message);
  }

  return (data ?? null) as YouthProfile | null;
}

async function persistYouthProfile(payload: SaveYouthProfileInput): Promise<YouthProfile> {
  const user = await requireYouthUser();
  const supabase = getSupabaseClient();
  const existing = await getYouthProfile(user.id);
  const writablePayload = pickWritableKeys(
    {
      user_id: user.id,
      ...payload,
    },
    existing,
  );

  if (!Object.keys(writablePayload).length || (Object.keys(writablePayload).length === 1 && "user_id" in writablePayload)) {
    return existing ?? ({ user_id: user.id } as YouthProfile);
  }

  const query = existing
    ? supabase.from("youth_profiles").update(writablePayload).eq("user_id", user.id).select("*").single()
    : supabase.from("youth_profiles").insert(writablePayload).select("*").single();

  const { data, error } = await query;

  if (error) {
    console.error("Failed to save youth profile.", error);
    throw new Error(error.message);
  }

  return data as YouthProfile;
}

export async function saveYouthProfileDraft(input: {
  name: string;
  dateOfBirth: string;
  address: string;
  postalCode: string;
  city: string;
  skills: string[];
  experience: string;
  education: string;
  languages: string;
  certificates: string;
  extracurriculars: string;
}): Promise<YouthProfile> {
  return persistYouthProfile({
    full_name: input.name || null,
    date_of_birth: input.dateOfBirth || null,
    address: input.address || null,
    postal_code: input.postalCode || null,
    city: input.city || null,
    strengths: input.skills,
    work_experience: splitListFromText(input.experience),
    education: splitListFromText(input.education),
    languages: splitListFromText(input.languages),
    certificates: input.certificates || null,
    extracurriculars: input.extracurriculars || null,
  });
}

export async function saveYouthAccountDetails(input: {
  full_name: string;
  date_of_birth: string;
  city: string;
  address: string;
  postal_code: string;
  additional_addresses: Array<{ city: string; address: string; postal_code: string }>;
}): Promise<YouthProfile> {
  const birthDate = new Date(`${input.date_of_birth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayHasPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!birthdayHasPassed) age -= 1;

  return persistYouthProfile({
    full_name: input.full_name.trim(),
    date_of_birth: input.date_of_birth,
    address: input.address.trim(),
    city: input.city.trim(),
    postal_code: input.postal_code.trim(),
    additional_addresses: input.additional_addresses,
    age: Number.isFinite(age) && age >= 0 ? age : null,
    onboarding_completed: false,
  });
}

export function buildGeneratedCvData(input: {
  fullName: string;
  age: string;
  city: string;
  skills: string[];
  targetRoles: string[];
  interests: string[];
  workingTime: string[];
  experience: string;
  answers: string[];
}): SaveYouthProfileInput {
  const intro = input.answers[0] || "Motivated youth candidate ready for a first role.";
  const strengths = input.answers[1] || input.skills.join(", ");
  const experienceSummary = input.answers[2] || input.experience || "School, hobby, or volunteer experience.";
  const availability = input.answers[3] || input.workingTime.join(", ");
  const roleGoal = input.answers[4] || input.targetRoles.join(", ");

  const cvText = [
    input.fullName || "Youth candidate",
    input.city,
    "",
    "Profile",
    intro,
    "",
    "Strengths",
    strengths || "Service, teamwork, and motivation.",
    "",
    "Experience",
    experienceSummary,
    "",
    "Availability",
    availability || "Flexible availability.",
    "",
    "Preferred roles",
    roleGoal || "Part-time and summer jobs.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const coverLetterTemplate = [
    "Hej!",
    "",
    `Jag heter ${input.fullName || "ung kandidat"} och är intresserad av ${roleGoal || "att börja jobba"}.`,
    intro,
    strengths || "Jag lär mig snabbt och gillar att ta ansvar.",
    "",
    "Vänliga hälsningar,",
    input.fullName || "",
  ].join("\n");

  return {
    full_name: input.fullName || null,
    age: input.age ? Number(input.age) : null,
    city: input.city || null,
    merits: input.interests,
    strengths: input.skills,
    work_experience: splitListFromText(input.experience),
    education: [],
    languages: [],
    desired_roles: input.targetRoles,
    desired_locations: input.city ? [input.city] : [],
    employment_preferences: input.workingTime,
    cv_text: cvText,
    cover_letter_template: coverLetterTemplate,
    onboarding_completed: true,
    cv_generated: true,
  };
}

export async function saveGeneratedCvToProfile(profileData: SaveYouthProfileInput): Promise<YouthProfile> {
  return persistYouthProfile(profileData);
}

export async function saveUploadedCvToProfile(document: import("./types").YouthDocument): Promise<YouthProfile> {
  const existing = await getYouthProfile();
  const documents = [
    ...((existing?.documents ?? []).filter((item) => item.type !== "cv")),
    document,
  ];

  return persistYouthProfile({
    documents,
    cv_uploaded: true,
    onboarding_completed: true,
    cv_generated: false,
  });
}

export async function completeYouthOnboarding(input: {
  full_name: string;
  age: string;
  city: string;
  desired_roles: string[];
  strengths: string;
  work_experience: string;
  education: string;
  languages: string;
  employment_preferences: string[];
  cv_text?: string;
  cv_uploaded?: boolean;
  documents?: import("./types").YouthDocument[];
  certificates?: string;
  extracurriculars?: string;
  profile_image?: string;
}): Promise<void> {
  await persistYouthProfile({
    full_name: input.full_name || null,
    age: input.age ? Number(input.age) : null,
    city: input.city || null,
    desired_roles: input.desired_roles,
    strengths: splitListFromText(input.strengths),
    work_experience: splitListFromText(input.work_experience),
    education: splitListFromText(input.education),
    languages: splitListFromText(input.languages),
    employment_preferences: input.employment_preferences,
    desired_locations: input.city ? [input.city] : [],
    cv_text: input.cv_text ?? null,
    documents: input.documents ?? [],
    certificates: input.certificates || null,
    extracurriculars: input.extracurriculars || null,
    profile_image_url: input.profile_image || null,
    onboarding_completed: true,
    cv_generated: (input.cv_text ?? "").trim().length > 0,
    cv_uploaded: input.cv_uploaded ?? false,
  });
}
