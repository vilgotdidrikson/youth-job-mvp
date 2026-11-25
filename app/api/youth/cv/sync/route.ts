import { NextRequest, NextResponse } from "next/server";
import { extractCvFacts } from "@/lib/cv-generation";
import { requireApiUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "cv-generate", ["youth"]);
  if ("response" in auth) return auth.response;
  try {
    const raw = await request.text();
    if (raw.length > 30_000) return NextResponse.json({ error: "CV-texten är för lång." }, { status: 413 });
    let body: { text?: unknown };
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Ogiltig CV-text." }, { status: 400 }); }
    if (typeof body?.text !== "string" || !body.text.trim() || body.text.length > 20_000) return NextResponse.json({ error: "Ange en CV-text på högst 20 000 tecken." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Kunde inte uppdatera profilfakta just nu. Din text finns kvar." }, { status: 503 });
    const structured = await extractCvFacts(body.text, request.signal);
    return NextResponse.json({ structured });
  } catch {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    return NextResponse.json({ error: "Kunde inte uppdatera profilfakta. Din text finns kvar, försök igen." }, { status: 502 });
  }
}
