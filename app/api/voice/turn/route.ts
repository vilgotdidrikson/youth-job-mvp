import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { CV_INTERVIEW_AREAS } from "@/lib/cv-interview";
import { appendInterviewAnswer, createEmptyStructuredCv, structuredCvToLegacy, type StructuredCvData } from "@/lib/structured-cv";
import { COMPLETE_QUESTION, INTERVIEW_INSTRUCTIONS, INTERVIEW_QUESTIONS, interviewDecisionSchema, remainingQuestions, selectNextQuestion, type InterviewProgress, type InterviewTurn } from "@/lib/voice-interview";
import { requireApiUser } from "@/lib/api-auth";

export const runtime = "nodejs";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "", timeout: 25_000, maxRetries: 1 });
interface InterviewState extends InterviewProgress {
  lastQuestion?: string;
  structuredCv: StructuredCvData;
  conversation: InterviewTurn[];
}
function parseState(value: FormDataEntryValue | null): InterviewState {
  const empty: InterviewState = { currentArea: "profile", answerCounts: {}, askedQuestionIds: [], coveredQuestionIds: [], skippedAreas: [], conversation: [], structuredCv: createEmptyStructuredCv() };
  if (typeof value !== "string") return empty;
  const parsed = JSON.parse(value);
  if (!CV_INTERVIEW_AREAS.some((area) => area.key === parsed.currentArea) || !parsed.structuredCv?.profile || !Array.isArray(parsed.askedQuestionIds)) throw new Error("Invalid interview state");
  return { ...empty, ...parsed, conversation: Array.isArray(parsed.conversation) ? parsed.conversation.slice(-20) : [] };
}
function reply(state: InterviewState, next: ReturnType<typeof selectNextQuestion>, transcript?: string) {
  const question = next ?? COMPLETE_QUESTION;
  if (next) state.currentArea = next.area;
  state.askedQuestionIds = [...new Set([...state.askedQuestionIds, question.id])];
  state.lastQuestion = question.text;
  const legacy = structuredCvToLegacy(state.structuredCv);
  return NextResponse.json({ transcript, state, structured: state.structuredCv, complete: !next, nextQuestion: question.text,
    audioUrl: `/api/voice/speech?id=${question.id}&v=2`,
    answers: { strengths: legacy.strengths.join("\n"), languages: legacy.languages.join("\n"), work_experience: legacy.workExperience.join("\n"), education: legacy.education.join("\n"), certificates: legacy.certificates.join("\n") },
  });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "voice-turn");
  if ("response" in auth) return auth.response;
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Röstintervjun är inte tillgänglig just nu." }, { status: 503 });
  try {
    const form = await request.formData();
    const rawState = form.get("state");
    if (typeof rawState === "string" && rawState.length > 80_000) return NextResponse.json({ error: "Samtalet är för långt. Fortsätt till CV:t." }, { status: 413 });
    const state = parseState(rawState);
    if (form.get("start") === "true") {
      const initial = form.get("structuredCv");
      if (typeof initial === "string") {
        const data = JSON.parse(initial);
        state.structuredCv = createEmptyStructuredCv(data.personalInfo ?? {});
        state.structuredCv.profile.targetRoles = Array.isArray(data.profile?.targetRoles) ? data.profile.targetRoles : [];
      }
      return reply(state, INTERVIEW_QUESTIONS[0]);
    }
    if (form.get("finish") === "true") return reply(state, null);
    if (form.get("skip") === "true") {
      state.skippedAreas = [...new Set([...(state.skippedAreas ?? []), state.currentArea])];
      return reply(state, selectNextQuestion(state));
    }
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size < 100) return NextResponse.json({ error: "Ingen inspelning kunde tas emot. Svara igen." }, { status: 400 });
    if (audio.size > 8_000_000) return NextResponse.json({ error: "Svaret är för långt. Dela upp det i kortare svar." }, { status: 413 });
    const transcription = await openai.audio.transcriptions.create({ file: audio, model: "gpt-4o-mini-transcribe", language: "sv" }, { signal: request.signal });
    const transcript = transcription.text.trim();
    if (transcript.length < 2) return NextResponse.json({ error: "Jag hörde inget tydligt svar. Försök igen." }, { status: 422 });
    state.conversation.push({ question: state.lastQuestion ?? "", answer: transcript });
    state.structuredCv = appendInterviewAnswer(state.structuredCv, state.currentArea, transcript);
    state.answerCounts[state.currentArea] = (state.answerCounts[state.currentArea] ?? 0) + 1;
    const remaining = remainingQuestions(state);
    const response = await openai.responses.create({
      model: process.env.OPENAI_VOICE_INTERVIEW_MODEL ?? "gpt-4o-mini", store: false,
      instructions: INTERVIEW_INSTRUCTIONS,
      input: JSON.stringify({ source: state.structuredCv, conversation: state.conversation, questions: INTERVIEW_QUESTIONS, allowed: remaining.map((question) => question.id) }),
      text: { format: { type: "json_schema", name: "interview_decision", strict: true, schema: interviewDecisionSchema(remaining.map((question) => question.id)) } }, max_output_tokens: 1200, temperature: 0,
    }, { signal: request.signal });
    if (response.status !== "completed") throw new Error("Incomplete interview decision");
    const decision = JSON.parse(response.output_text) as { coverage: Record<string, boolean>; next_question_id: string };
    state.coveredQuestionIds = [...new Set([...(state.coveredQuestionIds ?? []), ...Object.keys(decision.coverage).filter((id) => decision.coverage[id])])];
    return reply(state, selectNextQuestion(state, decision.next_question_id), transcript);
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("Voice interview failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Kunde inte behandla ditt svar. Försök igen." }, { status: 502 });
  }
}
