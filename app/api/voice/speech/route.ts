import { VOICE_CV_ENABLED } from "@/lib/feature-flags";
import { NextRequest, NextResponse } from "next/server";
import { synthesizeQuestion } from "@/lib/realtime-speech";
import { currentRealtimeModel } from "@/lib/openai-config";
import { COMPLETE_QUESTION, INTERVIEW_QUESTIONS } from "@/lib/voice-interview";
import { requireApiUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;
// Bounded by the question bank; no personal speech or recordings enter this cache.
const audioCache = new Map<string, Promise<ArrayBuffer>>();
export async function GET(request: NextRequest) {
  if (!VOICE_CV_ENABLED) return new NextResponse(null, { status: 404 });
  const auth = await requireApiUser(request, "voice-speech", ["youth"]);
  if ("response" in auth) return auth.response;
  const id = request.nextUrl.searchParams.get("id");
  const question = [...INTERVIEW_QUESTIONS, COMPLETE_QUESTION].find((item) => item.id === id);
  if (!question) return new NextResponse(null, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return new NextResponse(null, { status: 503 });
  const model = currentRealtimeModel(process.env.OPENAI_SPEECH_MODEL, true);
  const cacheKey = `${model}:marin:wav-v3:${question.id}`;
  let audio = audioCache.get(cacheKey);
  if (!audio) {
    // Shared generic generation is bounded independently of one caller's abort.
    audio = synthesizeQuestion(question.text, model, process.env.OPENAI_API_KEY);
    audioCache.set(cacheKey, audio);
  }
  try {
    return new NextResponse(await audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400, s-maxage=604800", "X-Content-Type-Options": "nosniff" } });
  } catch {
    audioCache.delete(cacheKey);
    return new NextResponse(null, { status: 502 });
  }
}
