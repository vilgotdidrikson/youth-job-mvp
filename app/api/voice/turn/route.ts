import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { CV_INTERVIEW_AREAS, getInterviewArea, getQuestion, type CvInterviewArea } from "@/lib/cv-interview";
import { appendInterviewAnswer, createEmptyStructuredCv, structuredCvToLegacy, type StructuredCvData } from "@/lib/structured-cv";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
const interviewModel = process.env.OPENAI_VOICE_INTERVIEW_MODEL ?? "gpt-4o-mini";

interface InterviewState {
  currentArea: CvInterviewArea;
  answerCounts: Partial<Record<CvInterviewArea, number>>;
  askedQuestionIds: string[];
  lastQuestion?: string;
  structuredCv: StructuredCvData;
}

function parseState(value: FormDataEntryValue | null): InterviewState {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Partial<InterviewState>;
      const currentArea = CV_INTERVIEW_AREAS.find((area) => area.key === parsed.currentArea)?.key;
      if (currentArea && parsed.structuredCv) {
        return {
          currentArea,
          answerCounts: parsed.answerCounts && typeof parsed.answerCounts === "object" ? parsed.answerCounts : {},
          askedQuestionIds: Array.isArray(parsed.askedQuestionIds) ? parsed.askedQuestionIds.filter((id): id is string => typeof id === "string").slice(-60) : [],
          lastQuestion: typeof parsed.lastQuestion === "string" ? parsed.lastQuestion : undefined,
          structuredCv: parsed.structuredCv,
        };
      }
    } catch {
      // Invalid drafts restart safely without reusing partial model output.
    }
  }
  return { currentArea: CV_INTERVIEW_AREAS[0].key, answerCounts: {}, askedQuestionIds: [], structuredCv: createEmptyStructuredCv() };
}

function normalize(value: string) {
  return value.toLocaleLowerCase("sv-SE").replace(/[^a-zåäö0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function explicitlyHasNothingToAdd(transcript: string) {
  const answer = normalize(transcript);
  return /^(nej|nej det har jag inte|inget|inga|ingenting|vet inte)$/.test(answer)
    || /\b(har inget|har inga|inget att lägga till|kommer inte på något)\b/.test(answer);
}

async function createSpeech(text: string, signal: AbortSignal) {
  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "marin",
    input: text,
    instructions: "Tala varm, naturlig och vänlig svenska. Låt som en lugn mänsklig intervjuare, inte som en uppläsare.",
    response_format: "mp3",
    speed: 1.02,
  }, { signal });
  return Buffer.from(await speech.arrayBuffer()).toString("base64");
}

function advanceState(state: InterviewState) {
  const index = CV_INTERVIEW_AREAS.findIndex((area) => area.key === state.currentArea);
  const nextArea = CV_INTERVIEW_AREAS[index + 1];
  if (!nextArea) return { complete: true, question: "Nu har jag tillräckligt för att skapa ditt CV. Efter intervjun kan du lägga till något extra om du vill.", questionId: "complete", area: state.currentArea };
  return { complete: false, question: nextArea.opening.text, questionId: nextArea.opening.id, area: nextArea.key };
}

function responseAnswers(cv: StructuredCvData) {
  const legacy = structuredCvToLegacy(cv);
  return {
    strengths: legacy.strengths.join("\n"),
    languages: legacy.languages.join("\n"),
    work_experience: legacy.workExperience.join("\n"),
    education: legacy.education.join("\n"),
    certificates: legacy.certificates.join("\n"),
  };
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY saknas på servern." }, { status: 503 });
  const formData = await request.formData();
  const isStart = formData.get("start") === "true";
  const isSkip = formData.get("skip") === "true";
  const audio = formData.get("audio");
  if (!isStart && !isSkip && (!(audio instanceof File) || !audio.size)) return NextResponse.json({ error: "Ingen inspelning kunde tas emot." }, { status: 400 });

  try {
    const state = parseState(formData.get("state"));
    const area = getInterviewArea(state.currentArea);
    if (isStart) {
      const initialData = formData.get("structuredCv");
      if (typeof initialData === "string") {
        try { state.structuredCv = JSON.parse(initialData) as StructuredCvData; } catch { /* Keep the empty safe shape. */ }
      }
      state.askedQuestionIds = [area.opening.id];
      state.lastQuestion = area.opening.text;
      const audioBase64 = await createSpeech(area.opening.text, request.signal);
      return NextResponse.json({ answers: responseAnswers(state.structuredCv), state, structured: state.structuredCv, complete: false, nextQuestion: area.opening.text, audioBase64 });
    }

    if (isSkip) {
      const next = advanceState(state);
      state.currentArea = next.area;
      state.askedQuestionIds.push(next.questionId);
      state.lastQuestion = next.question;
      const audioBase64 = await createSpeech(next.question, request.signal);
      return NextResponse.json({ answers: responseAnswers(state.structuredCv), state, structured: state.structuredCv, complete: next.complete, nextQuestion: next.question, audioBase64 });
    }

    const transcription = await openai.audio.transcriptions.create({ file: audio as File, model: "gpt-4o-mini-transcribe", language: "sv" }, { signal: request.signal });
    const transcript = transcription.text.trim();
    const hasNothingToAdd = explicitlyHasNothingToAdd(transcript);
    if (!hasNothingToAdd) state.structuredCv = appendInterviewAnswer(state.structuredCv, area.key, transcript);
    const answerCount = (state.answerCounts[area.key] ?? 0) + 1;
    state.answerCounts[area.key] = answerCount;
    const remaining = area.followups.filter((question) => !state.askedQuestionIds.includes(question.id));
    const decisionSchema = {
      type: "object", additionalProperties: false, required: ["area_complete", "next_question_id"],
      properties: {
        area_complete: { type: "boolean" },
        next_question_id: { type: "string", enum: remaining.length ? remaining.map((question) => question.id) : ["none"] },
      },
    };
    const response = await openai.responses.create({
      model: interviewModel,
      instructions: [
        "Bedöm en svensk CV-intervju för en ung person. Du får bara bedöma täckning och välja ett tillåtet fråge-ID.",
        "Skapa, rätta eller anta aldrig fakta. Välj den enda återstående fråga vars syfte fyller den viktigaste luckan.",
        `Området är ${area.label}. Minst ${area.minAnswers} och högst ${area.maxAnswers} svar ska samlas.`,
        "Sätt area_complete när uppgifterna är konkreta nog för ett professionellt CV eller personen uttryckligen saknar relevant erfarenhet.",
      ].join(" "),
      input: `Verifierade källanteckningar: ${JSON.stringify(state.structuredCv)}\nSenaste ordagranna svar: ${transcript}\nTillåtna frågor: ${JSON.stringify(remaining)}`,
      text: { format: { type: "json_schema", name: "cv_interview_decision", strict: true, schema: decisionSchema } },
      max_output_tokens: 80,
    }, { signal: request.signal });
    const decision = JSON.parse(response.output_text) as { area_complete: boolean; next_question_id: string };
    const areaComplete = hasNothingToAdd
      || answerCount >= area.maxAnswers
      || (answerCount >= area.minAnswers && decision.area_complete)
      || !remaining.length;

    let complete = false;
    let nextQuestion: string;
    let nextQuestionId: string;
    if (areaComplete) {
      const next = advanceState(state);
      complete = next.complete;
      state.currentArea = next.area;
      nextQuestion = next.question;
      nextQuestionId = next.questionId;
    } else {
      const selected = getQuestion(area, decision.next_question_id) ?? remaining[0];
      nextQuestion = selected.text;
      nextQuestionId = selected.id;
    }
    state.askedQuestionIds.push(nextQuestionId);
    state.lastQuestion = nextQuestion;
    const audioBase64 = await createSpeech(nextQuestion, request.signal);
    return NextResponse.json({ transcript, answers: responseAnswers(state.structuredCv), state, structured: state.structuredCv, complete, nextQuestion, audioBase64 });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("Voice interview turn failed.", error);
    return NextResponse.json({ error: "Kunde inte behandla ditt svar. Försök igen." }, { status: 502 });
  }
}
