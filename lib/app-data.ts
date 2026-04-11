"use client";

import { getSupabaseClient } from "@/lib/supabase";
import { mockJobs } from "@/lib/mock-jobs";
import type {
  ChatMessage,
  Conversation,
  JobPost,
  MatchRecord,
  SwipeAction,
  SwipeDecision,
  YouthCvProfile,
} from "@/lib/types";

interface CandidateInterest {
  youthUserId: string;
  jobId: string;
  createdAt: string;
}

const KEYS = {
  youthCv: "workspot_youth_cv_profiles",
  jobs: "workspot_jobs",
  swipes: "workspot_swipes",
  matches: "workspot_matches",
  conversations: "workspot_conversations",
  messages: "workspot_messages",
  companyInterest: "workspot_company_interest",
};

function getNowIso() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

const AI_QUESTIONS = [
  "Berätta kort om dig själv och vad du gillar att göra.",
  "Vilka arbetsuppgifter känner du dig trygg med redan idag?",
  "Har du någon erfarenhet från skola, sport, hobby eller volontärarbete?",
  "När kan du jobba under veckan eller lov?",
  "Vilken typ av jobb vill du helst börja med?",
] as const;

export function getAiInterviewQuestions() {
  return [...AI_QUESTIONS];
}

function buildCvText(input: {
  fullName: string;
  city: string;
  age: number | null;
  answers: string[];
  skills: string[];
  targetRoles: string[];
}) {
  const [intro, strengths, experience, availability, goals] = input.answers;

  return [
    `${input.fullName} (${input.age ?? "-"})`,
    `${input.city}`,
    "",
    "Profil",
    intro || "Motiverad ungdom som söker första arbetsmöjlighet.",
    "",
    "Styrkor",
    strengths || "Service, teamwork och vilja att lära.",
    "",
    "Erfarenhet",
    experience || "Skolprojekt, hobbyaktiviteter och ansvar i vardagen.",
    "",
    "Tillgänglighet",
    availability || "Flexibel enligt överenskommelse.",
    "",
    "Måljobb",
    goals || input.targetRoles.join(", ") || "Deltidsjobb / sommarjobb",
    "",
    "Kompetenser",
    input.skills.join(", ") || "Kommunikation, samarbete, punktlighet",
  ].join("\n");
}

function buildApplicationText(input: { fullName: string; targetRoles: string[]; answers: string[] }) {
  const intro = input.answers[0] || "Jag är motiverad och vill gärna ta ansvar.";
  const strengths = input.answers[1] || "Jag trivs med service och samarbete.";
  const preferred = input.targetRoles.join(", ") || "deltidsjobb och sommarjobb";

  return `Hej!\n\nJag heter ${input.fullName} och söker ${preferred}. ${intro}\n\n${strengths} Jag lär mig snabbt och ser fram emot att bidra i teamet.\n\nVänliga hälsningar,\n${input.fullName}`;
}

export async function upsertYouthCvProfile(profile: YouthCvProfile) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("youth_cv_profiles").upsert(profile, { onConflict: "user_id" });
    if (error) throw error;
  } catch {
    const list = readLocal<YouthCvProfile[]>(KEYS.youthCv, []);
    const next = list.filter((item) => item.user_id !== profile.user_id);
    next.push({ ...profile, updated_at: getNowIso() });
    writeLocal(KEYS.youthCv, next);
  }
}

export async function getYouthCvProfile(userId: string): Promise<YouthCvProfile | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("youth_cv_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch {
    const list = readLocal<YouthCvProfile[]>(KEYS.youthCv, []);
    return list.find((item) => item.user_id === userId) ?? null;
  }
}

export function generateCvFromInterview(input: {
  userId: string;
  fullName: string;
  age: number | null;
  city: string;
  targetRoles: string[];
  skills: string[];
  interests: string[];
  workingTime: string[];
  experience: string;
  answers: string[];
}): YouthCvProfile {
  return {
    user_id: input.userId,
    full_name: input.fullName,
    age: input.age,
    city: input.city,
    target_roles: input.targetRoles,
    skills: input.skills,
    interests: input.interests,
    working_time: input.workingTime,
    experience: input.experience,
    cv_text: buildCvText(input),
    application_text: buildApplicationText({
      fullName: input.fullName,
      targetRoles: input.targetRoles,
      answers: input.answers,
    }),
    updated_at: getNowIso(),
  };
}

export async function getJobs(): Promise<JobPost[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch {
    const local = readLocal<JobPost[]>(KEYS.jobs, []);
    const seeded: JobPost[] = mockJobs.map((job) => ({
      id: job.id,
      company_user_id: "seed-company",
      company_name: job.company,
      title: job.title,
      city: job.city,
      job_type: job.type,
      pay: job.pay,
      description: job.description,
      tags: job.tags,
      is_active: true,
    }));

    const merged = [...seeded, ...local];
    const uniqueById = new Map<string, JobPost>();
    merged.forEach((item) => uniqueById.set(item.id, item));
    return [...uniqueById.values()];
  }
}

export async function getCompanyJobs(companyUserId: string): Promise<JobPost[]> {
  const jobs = await getJobs();
  return jobs.filter((job) => job.company_user_id === companyUserId);
}

export async function createJob(input: Omit<JobPost, "id" | "is_active">): Promise<JobPost> {
  const payload: JobPost = {
    id: createId(),
    ...input,
    is_active: true,
  };

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("jobs").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  } catch {
    const list = readLocal<JobPost[]>(KEYS.jobs, []);
    list.unshift(payload);
    writeLocal(KEYS.jobs, list);
    return payload;
  }
}

async function getSwipeActions(): Promise<SwipeAction[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("swipe_actions").select("*");
    if (error) throw error;
    return data;
  } catch {
    return readLocal<SwipeAction[]>(KEYS.swipes, []);
  }
}

async function upsertSwipe(action: Omit<SwipeAction, "id">) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("swipe_actions").upsert(action, {
      onConflict: "youth_user_id,job_id",
      ignoreDuplicates: false,
    });
    if (error) throw error;
  } catch {
    const list = readLocal<SwipeAction[]>(KEYS.swipes, []);
    const next = list.filter((item) => !(item.youth_user_id === action.youth_user_id && item.job_id === action.job_id));
    next.push({ id: createId(), ...action });
    writeLocal(KEYS.swipes, next);
  }
}

async function getMatchesRaw(): Promise<MatchRecord[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("matches").select("*");
    if (error) throw error;
    return data;
  } catch {
    return readLocal<MatchRecord[]>(KEYS.matches, []);
  }
}

async function upsertConversation(match: MatchRecord) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("conversations").upsert(
      {
        match_id: match.id,
        youth_user_id: match.youth_user_id,
        company_user_id: match.company_user_id,
        job_id: match.job_id,
        last_message_at: getNowIso(),
      },
      { onConflict: "match_id" },
    );
    if (error) throw error;
  } catch {
    const list = readLocal<Conversation[]>(KEYS.conversations, []);
    const existing = list.find((item) => item.match_id === match.id);

    if (!existing) {
      list.unshift({
        id: createId(),
        match_id: match.id,
        youth_user_id: match.youth_user_id,
        company_user_id: match.company_user_id,
        job_id: match.job_id,
        last_message_at: getNowIso(),
      });
      writeLocal(KEYS.conversations, list);
    }
  }
}

async function ensureMatch(youthUserId: string, companyUserId: string, jobId: string) {
  const existing = (await getMatchesRaw()).find(
    (item) => item.youth_user_id === youthUserId && item.company_user_id === companyUserId && item.job_id === jobId,
  );

  if (existing) {
    await upsertConversation(existing);
    return existing;
  }

  const payload: MatchRecord = {
    id: createId(),
    youth_user_id: youthUserId,
    company_user_id: companyUserId,
    job_id: jobId,
    status: "matched",
    created_at: getNowIso(),
  };

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("matches").insert(payload).select("*").single();
    if (error) throw error;
    await upsertConversation(data);
    return data;
  } catch {
    const list = readLocal<MatchRecord[]>(KEYS.matches, []);
    list.unshift(payload);
    writeLocal(KEYS.matches, list);
    await upsertConversation(payload);
    return payload;
  }
}

export async function saveYouthSwipe(youthUserId: string, job: JobPost, decision: SwipeDecision) {
  const action = {
    youth_user_id: youthUserId,
    job_id: job.id,
    decision,
    created_at: getNowIso(),
  };

  await upsertSwipe(action);

  if (decision === "interested") {
    const companyInterested = await getCompanyInterests(job.company_user_id);
    const companyLike = companyInterested.find((item) => item.jobId === job.id && item.youthUserId === youthUserId);

    if (companyLike) {
      await ensureMatch(youthUserId, job.company_user_id, job.id);
    }
  }
}

async function getCompanyInterests(companyUserId: string): Promise<CandidateInterest[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("company_interest_actions")
      .select("*")
      .eq("company_user_id", companyUserId)
      .eq("decision", "interested");

    if (error) throw error;

    return data.map((row) => ({
      youthUserId: row.youth_user_id as string,
      jobId: row.job_id as string,
      createdAt: row.created_at as string,
    }));
  } catch {
    return readLocal<CandidateInterest[]>(KEYS.companyInterest, []);
  }
}

async function addCompanyInterest(companyUserId: string, youthUserId: string, jobId: string, decision: SwipeDecision) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("company_interest_actions").upsert(
      {
        company_user_id: companyUserId,
        youth_user_id: youthUserId,
        job_id: jobId,
        decision,
        created_at: getNowIso(),
      },
      { onConflict: "company_user_id,job_id,youth_user_id" },
    );
    if (error) throw error;
  } catch {
    const list = readLocal<CandidateInterest[]>(KEYS.companyInterest, []);
    const next = list.filter((item) => !(item.youthUserId === youthUserId && item.jobId === jobId));
    if (decision === "interested") {
      next.push({ youthUserId, jobId, createdAt: getNowIso() });
    }
    writeLocal(KEYS.companyInterest, next);
  }
}

export async function getCompanyCandidateFeed(companyUserId: string) {
  const jobs = await getCompanyJobs(companyUserId);
  const swipes = await getSwipeActions();
  const interestedSwipes = swipes.filter((item) => item.decision === "interested");

  return interestedSwipes
    .map((swipe) => {
      const job = jobs.find((item) => item.id === swipe.job_id);
      if (!job) return null;

      return {
        youthUserId: swipe.youth_user_id,
        job,
      };
    })
    .filter((item): item is { youthUserId: string; job: JobPost } => Boolean(item));
}

export async function companyRespondToCandidate(params: {
  companyUserId: string;
  youthUserId: string;
  job: JobPost;
  interested: boolean;
}) {
  await addCompanyInterest(
    params.companyUserId,
    params.youthUserId,
    params.job.id,
    params.interested ? "interested" : "skip",
  );

  if (!params.interested) return null;

  const swipes = await getSwipeActions();
  const youthInterested = swipes.some(
    (item) =>
      item.youth_user_id === params.youthUserId && item.job_id === params.job.id && item.decision === "interested",
  );

  if (!youthInterested) return null;

  return ensureMatch(params.youthUserId, params.companyUserId, params.job.id);
}

export async function getConversationsForUser(userId: string): Promise<Conversation[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`youth_user_id.eq.${userId},company_user_id.eq.${userId}`)
      .order("last_message_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch {
    return readLocal<Conversation[]>(KEYS.conversations, [])
      .filter((item) => item.youth_user_id === userId || item.company_user_id === userId)
      .sort((a, b) => (a.last_message_at ?? "").localeCompare(b.last_message_at ?? "") * -1);
  }
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  } catch {
    return readLocal<ChatMessage[]>(KEYS.messages, [])
      .filter((item) => item.conversation_id === conversationId)
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  }
}

export async function sendMessage(params: {
  conversationId: string;
  senderUserId: string;
  body: string;
}) {
  const payload: ChatMessage = {
    id: createId(),
    conversation_id: params.conversationId,
    sender_user_id: params.senderUserId,
    body: params.body,
    created_at: getNowIso(),
  };

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("messages").insert(payload);
    if (error) throw error;

    await supabase
      .from("conversations")
      .update({ last_message_at: getNowIso() })
      .eq("id", params.conversationId);
  } catch {
    const list = readLocal<ChatMessage[]>(KEYS.messages, []);
    list.push(payload);
    writeLocal(KEYS.messages, list);

    const conversations = readLocal<Conversation[]>(KEYS.conversations, []);
    const next = conversations.map((item) =>
      item.id === params.conversationId ? { ...item, last_message_at: getNowIso() } : item,
    );
    writeLocal(KEYS.conversations, next);
  }
}
