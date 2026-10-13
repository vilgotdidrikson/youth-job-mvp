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
import { reviewedCvPayload, cvReviewSnapshot, syncRecruitmentCvLanguages } from "./cv-fact-review";
import { renderStructuredCv, structuredCvFromForm, structuredCvToLegacy, type StructuredCvData } from "@/lib/structured-cv";

const ONBOARDING_QUESTIONS = [
  "Berätta kort om dig själv och vilken typ av jobb du söker.",
  "Vilka styrkor har du, och kan du ge ett konkret exempel?",
  "Berätta om jobb, praktik, volontärarbete eller annat ansvar du har haft.",
  "Vilken utbildning går eller har du gått, och finns relevanta kurser eller skolprojekt?",
  "Har du gjort något eget projekt, UF-företag eller föreningsprojekt som visar vad du kan?",
  "Vilka konkreta kompetenser eller verktyg har du faktiskt använt?",
  "Har du certifikat, stipendier, priser, ledarskap eller andra meriter?",
  "Vilka språk kan du, på vilken nivå, och kan du tala, skriva och förstå dem?",
  "Finns det idrott, föreningsliv, hobbyer eller annat ansvar som stärker ditt CV?",
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
  if (payload.cv_structured && existing) {
    for (const key of ["cv_structured", "cv_text", "languages", "work_experience", "education", "strengths", "certificates", "extracurriculars"]) {
      if (!(key in existing)) throw new Error("Profilen saknar stöd för samordnade CV-fakta. Din text finns kvar.");
    }
    if ("recruitment_profile" in existing) payload = { ...payload, recruitment_profile: syncRecruitmentCvLanguages(existing.recruitment_profile, existing.cv_structured, payload.cv_structured) } as SaveYouthProfileInput;
  }
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

/**
 * Collapses whitespace in a name so " Anna   Ek " and "Anna Ek" are stored
 * identically, and a value made up only of whitespace becomes an empty string.
 */
export function normalizeFullName(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export const MISSING_FULL_NAME_MESSAGE = "Skriv ditt fullständiga namn för att fortsätta.";

export async function saveReviewedCvToProfile(text: string, cv: StructuredCvData, approval: string | null, generatedDocument?: import("./types").YouthDocument): Promise<YouthProfile> {
  const payload = reviewedCvPayload(text, cv, approval);
  const user = await requireYouthUser();
  const existing = await getYouthProfile(user.id);
  if (!existing) throw new Error("Profilen kunde inte hämtas. Din text finns kvar.");
  for (const key of Object.keys(payload)) if (!(key in existing)) throw new Error("Profilen saknar stöd för samordnade CV-fakta. Din text finns kvar.");
  const documents = (Array.isArray(existing.documents) ? existing.documents : []).filter((doc) => doc.type !== "generated_cv");
  if (generatedDocument) documents.push(generatedDocument);
  const client = getSupabaseClient();
  const { data, error } = await client.from("youth_profiles").update({ ...payload, documents,
    ...("recruitment_profile" in existing ? { recruitment_profile: syncRecruitmentCvLanguages(existing.recruitment_profile, existing.cv_structured, cv) } : {}),
  }).eq("user_id", user.id).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Kunde inte spara CV och profilfakta.");
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
  const existing = await getYouthProfile();
  // CV facts are edited and approved together in the CV editor. Account edits
  // must not overwrite them with a stale copy of the separate profile form.
  const cvFacts = existing?.cv_text?.trim() ? {} : { strengths: input.skills, work_experience: splitListFromText(input.experience), education: splitListFromText(input.education), languages: splitListFromText(input.languages), certificates: input.certificates || null, extracurriculars: input.extracurriculars || null };
  return persistYouthProfile({
    full_name: normalizeFullName(input.name) || null,
    date_of_birth: input.dateOfBirth || null,
    address: input.address || null,
    postal_code: input.postalCode || null,
    city: input.city || null,
    ...cvFacts,
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
  // Validated here as well as in the form: the profile is written straight to
  // Supabase, so this is the last gate before a nameless row is persisted.
  const fullName = normalizeFullName(input.full_name);
  if (!fullName) throw new Error(MISSING_FULL_NAME_MESSAGE);

  const birthDate = new Date(`${input.date_of_birth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayHasPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!birthdayHasPassed) age -= 1;

  return persistYouthProfile({
    full_name: fullName,
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
  const structured = structuredCvFromForm({
    full_name: input.fullName,
    city: input.city,
    desired_roles: input.targetRoles,
    profile_details: input.answers[0],
    strengths: [input.answers[1], ...input.skills].filter(Boolean).join(", "),
    work_experience: input.answers[2] || input.experience,
    education: input.answers[3],
    projects_text: input.answers[4],
    skills_text: [input.answers[5], ...input.skills].filter(Boolean).join(", "),
    certificates: input.answers[6],
    languages: input.answers[7],
    extracurriculars: input.answers[8] || input.interests.join(", "),
  });
  const legacy = structuredCvToLegacy(structured);
  const cvText = renderStructuredCv(structured);
  const intro = input.answers[0] || "";
  const roleGoal = input.targetRoles.join(", ");

  const coverLetterTemplate = [
    "Hej!",
    "",
    `Jag heter ${input.fullName || "ung kandidat"} och är intresserad av ${roleGoal || "att börja jobba"}.`,
    intro,
    input.answers[1] || input.skills.join(", "),
    "",
    "Vänliga hälsningar,",
    input.fullName || "",
  ].join("\n");

  return {
    full_name: input.fullName || null,
    age: input.age ? Number(input.age) : null,
    city: input.city || null,
    merits: input.interests,
    strengths: legacy.strengths,
    work_experience: legacy.workExperience,
    education: legacy.education,
    languages: legacy.languages,
    desired_roles: input.targetRoles,
    desired_locations: input.city ? [input.city] : [],
    employment_preferences: input.workingTime,
    cv_text: cvText,
    cv_structured: structured,
    cover_letter_template: coverLetterTemplate,
    onboarding_completed: true,
    cv_generated: true,
  };
}

export async function saveGeneratedCvToProfile(profileData: SaveYouthProfileInput): Promise<YouthProfile> {
  return persistYouthProfile(profileData);
}

export async function saveVoiceCvToProfile(input: StructuredCvData): Promise<YouthProfile> {
  const legacy = structuredCvToLegacy(input);
  const cvText = renderStructuredCv(input);
  return persistYouthProfile({
    strengths: legacy.strengths,
    languages: legacy.languages,
    work_experience: legacy.workExperience,
    education: legacy.education,
    certificates: legacy.certificates.join("\n") || null,
    extracurriculars: legacy.extracurriculars.join("\n") || null,
    cv_structured: input,
    cv_text: cvText || "CV skapat genom röstintervju.",
    cv_generated: true,
  });
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
  cv_structured?: StructuredCvData;
  cv_uploaded?: boolean;
  documents?: import("./types").YouthDocument[];
  certificates?: string;
  extracurriculars?: string;
  profile_image?: string;
}): Promise<void> {
  const fullName = normalizeFullName(input.full_name);
  if (!fullName) throw new Error(MISSING_FULL_NAME_MESSAGE);

  await persistYouthProfile({
    full_name: fullName,
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
    cv_structured: input.cv_structured ?? null,
    documents: input.documents ?? [],
    certificates: input.certificates || null,
    extracurriculars: input.extracurriculars || null,
    profile_image_url: input.profile_image || null,
    onboarding_completed: true,
    cv_generated: (input.cv_text ?? "").trim().length > 0,
    cv_uploaded: input.cv_uploaded ?? false,
    ...(input.cv_structured && input.cv_text ? reviewedCvPayload(input.cv_text, input.cv_structured, cvReviewSnapshot(input.cv_text, input.cv_structured)) : {}),
  });
}
