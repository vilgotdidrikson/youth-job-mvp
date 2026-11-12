import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { requireApiUser } from "@/lib/api-auth";
import { CV_FEEDBACK_INSTRUCTIONS, cvContactNotices, parseCvFeedback, type CvFeedbackResult } from "@/lib/cv-feedback";
import { minimizeMatchingText } from "@/lib/matching-input-policy";
import { OPENAI_API_BASE_URL, openaiTextOptions } from "@/lib/openai-config";
import { pdfCvSource } from "@/lib/pdf-cv-source";
import { reportServerFailure } from "@/lib/server-failures";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Optional review of the youth's own uploaded CV. Nothing is stored and the file is never changed. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "cv-feedback", ["youth"]);
  if ("response" in auth) return auth.response;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Förbättringsförslag är tillfälligt otillgängliga. Ditt CV är sparat som vanligt." }, { status: 503 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => auth.token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { data: profile, error } = await supabase.from("youth_profiles").select("full_name,address,postal_code,documents").eq("user_id", auth.user.id).single();
    if (error || !profile) return NextResponse.json({ error: "Profilen kunde inte läsas. Försök igen." }, { status: 503 });
    const pdf = await pdfCvSource(supabase, profile.documents, auth.user.id);
    // A stored file is not proof that it could be read: say so instead of returning empty feedback.
    if (pdf.status !== "read") return NextResponse.json({ status: pdf.status, items: [], notices: [] } satisfies CvFeedbackResult);
    const identities = [profile.full_name, profile.address, profile.postal_code, auth.user.email, auth.user.phone].filter((value): value is string => typeof value === "string" && value.trim().length >= 3);
    // Contact details and excluded topics are removed locally before anything is sent.
    const source = minimizeMatchingText(pdf.text, identities).text;
    const notices = cvContactNotices(pdf.text);
    // Removal markers are not CV content; too little real text gives nothing to review.
    if (source.replace(/\[[^\]]*borttagen\]/g, "").replace(/[\s,]+/g, " ").trim().length < 40) return NextResponse.json({ status: "read", items: [], notices } satisfies CvFeedbackResult);
    const ai = new OpenAI({ baseURL: OPENAI_API_BASE_URL, apiKey: key, timeout: 35000, maxRetries: 0 });
    const response = await ai.chat.completions.create({ ...openaiTextOptions(1200, "application"), response_format: { type: "json_object" }, messages: [
      { role: "system", content: CV_FEEDBACK_INSTRUCTIONS },
      { role: "user", content: JSON.stringify({ cv: source }) },
    ] }, { signal: request.signal });
    const items = parseCvFeedback(JSON.parse(response.choices[0]?.message?.content ?? "{}"));
    return NextResponse.json({ status: "read", items, notices } satisfies CvFeedbackResult);
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    reportServerFailure("cv_feedback_failed", error);
    return NextResponse.json({ error: "Förslagen kunde inte hämtas just nu. Ditt CV är oförändrat. Försök igen." }, { status: 502 });
  }
}
