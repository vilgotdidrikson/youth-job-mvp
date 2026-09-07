import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { COMPLETE_QUESTION, INTERVIEW_QUESTIONS } from "@/lib/voice-interview";
import { requireApiUser } from "@/lib/api-auth";

export const runtime = "nodejs";
// Bounded by the question bank; no personal speech or recordings enter this cache.
const audioCache = new Map<string, Promise<ArrayBuffer>>();
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, "voice-speech");
  if ("response" in auth) return auth.response;
  const id = request.nextUrl.searchParams.get("id");
  const question = [...INTERVIEW_QUESTIONS, COMPLETE_QUESTION].find((item) => item.id === id);
  if (!question) return new NextResponse(null, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return new NextResponse(null, { status: 503 });
  let audio = audioCache.get(question.id);
  if (!audio) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 1 });
    audio = client.audio.speech.create({
      model: "gpt-4o-mini-tts", voice: "marin", input: question.text,
      instructions: "Tala svenska med naturligt svenskt uttal. Varm och tydlig samtalston, som när du pratar med en ung vuxen. Jämnt, ledigt tempo. Korta naturliga pauser, inga dramatiska betoningar eller utdragna ord. Läs bara frågan.",
      response_format: "mp3", speed: 1.05,
    }).then((response) => response.arrayBuffer());
    audioCache.set(question.id, audio);
  }
  try {
    return new NextResponse(await audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400, s-maxage=604800", "X-Content-Type-Options": "nosniff" } });
  } catch {
    audioCache.delete(question.id);
    return new NextResponse(null, { status: 502 });
  }
}
