import OpenAI from "openai";
import { demoChatInstructions, parseDemoChat } from "@/lib/demo-chat";
import { consumeDemoChatQuota } from "@/lib/demo-chat-quota";
import { prelaunchDb } from "@/lib/prelaunch-server";
export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers });
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return fail("Ogiltigt ursprung.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return fail("Ogiltigt format.", 415);
  if (Number(request.headers.get("content-length")) > 14000)
    return fail("Samtalet är för långt.", 413);
  try {
    const raw = await request.text();
    if (raw.length > 10000) return fail("Samtalet är för långt.", 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("Ogiltigt meddelande.", 400);
    }
    const input = parseDemoChat(body);
    if (!input) return fail("Kontrollera meddelandet och försök igen.", 400);
    if (!process.env.OPENAI_API_KEY)
      return fail("AI-chatten är tillfälligt otillgänglig.", 503);
    const secret =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return fail("AI-chatten är tillfälligt otillgänglig.", 503);
    const ip = (
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-forwarded-for") ||
      "local"
    )
      .split(",")[0]
      .trim();
    const allowed = await consumeDemoChatQuota(prelaunchDb(), secret, ip);
    if (!allowed)
      return fail(
        "Demons AI-gräns är nådd. Försök senare. Högst 6 svar/minut och 30 svar/dag per nätverk.",
        429,
      );
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 22000,
      maxRetries: 0,
    });
    const response = await client.responses.create(
      {
        model: process.env.OPENAI_DEMO_CHAT_MODEL || "gpt-6-luna",
        store: false,
        max_output_tokens: 300,
        reasoning: { effort: "none" },
        instructions: demoChatInstructions(input.job),
        input: input.messages,
      },
      { signal: request.signal },
    );
    const text = response.output_text?.trim();
    if (response.status !== "completed" || !text)
      return fail("Inget svar kunde hämtas. Försök igen.", 502);
    return Response.json({ text }, { headers });
  } catch (error) {
    // Do not log message content, credentials or provider payloads.
    console.error(
      "Demo chat failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return fail(
      "AI:n kunde inte svara just nu. Ditt meddelande finns kvar; försök igen.",
      502,
    );
  }
}
