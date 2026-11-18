import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { OPENAI_API_BASE_URL, openaiTextOptions } from "@/lib/openai-config";
import { profileChatFields, profileChatKeys, type ProfileChatField } from "@/lib/profile-chat";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "cv-generate", ["youth"]);
  if ("response" in auth) return auth.response;
  const raw = await request.text();
  let field: ProfileChatField;
  try {
    const candidate = raw.length <= 100 ? JSON.parse(raw).field : null;
    if (!profileChatKeys.includes(candidate)) throw new Error();
    field = candidate;
  } catch {
    return NextResponse.json({ error: "Ogiltigt profilfält." }, { status: 400 });
  }
  const fallback = profileChatFields[field][2];
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ question: fallback });
  try {
    // The model sees only the product's generic field label, never an answer or draft.
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: OPENAI_API_BASE_URL, timeout: 7000, maxRetries: 0 });
    const result = await ai.chat.completions.create({
      ...openaiTextOptions(120, "application"),
      messages: [
        { role: "system", content: "Skriv en enda kort, öppen följdfråga på svenska om ämnet. Anta inga tidigare erfarenheter, ställ inga frågor om identitet, kontaktuppgifter, hälsa eller känsliga uppgifter och lägg inte till exempel eller fakta om användaren. Svara enbart med frågan." },
        { role: "user", content: profileChatFields[field][0] },
      ],
    }, { signal: request.signal });
    const message = result.choices[0]?.message.content?.trim() ?? "";
    const question = /^[^\n<>?]{8,140}\?$/u.test(message) && message !== profileChatFields[field][0]
      && !/namn|nummer|adress|hälsa|diagnos|familj|religion|politik|mail/iu.test(message) ? message : fallback;
    return NextResponse.json({ question });
  } catch {
    return NextResponse.json({ question: fallback });
  }
}
