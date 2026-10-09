import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { renderStructuredCv, type StructuredCvData } from "@/lib/structured-cv";

import { uploadedCvPath } from "@/lib/cv-document-path";
import { requireApiUser } from "@/lib/api-auth";
import { withVerifiedExperience, type VerifiedExperience } from "@/lib/recruitment-types";

const SIGNED_URL_TTL_SECONDS = 5 * 60;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "candidate-cv", ["company"]);
  if ("response" in auth) return auth.response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anonKey, {
    accessToken: async () => auth.token,
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const body = await request.json().catch(() => null) as { jobId?: unknown; youthUserId?: unknown } | null;
  if (!isUuid(body?.jobId) || !isUuid(body?.youthUserId)) return NextResponse.json({ error: "Ogiltig kandidat eller annons." }, { status: 400 });

  const { data: youthProfile, error: profileError } = await userClient.rpc("get_candidate_assessment_input", {
    p_job_id: body.jobId, p_youth_user_id: body.youthUserId,
  });
  if (profileError || !youthProfile) return NextResponse.json({ error: "Du saknar åtkomst till kandidatens CV." }, { status: 403 });
  const path = uploadedCvPath(youthProfile?.documents, body.youthUserId);
  if (path) {
    const { data, error } = await userClient.storage.from("youth-documents").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return NextResponse.json({ error: "CV:t kunde inte hämtas. Det kan ha tagits bort av kandidaten." }, { status: 404 });
    return NextResponse.json(
      { kind: "pdf", url: data.signedUrl, expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const storedText = typeof youthProfile?.cv_text === "string" ? youthProfile.cv_text.trim() : "";
  const structuredText = !storedText && youthProfile?.cv_structured
    ? renderStructuredCv(youthProfile.cv_structured as StructuredCvData).trim()
    : "";
  const { data: experiences, error: experienceError } = await userClient.rpc("get_verified_experience", { p_youth_user_id: body.youthUserId, p_job_id: body.jobId });
  if (experienceError) return NextResponse.json({ error: "Kunde inte läsa kandidatens bekräftade erfarenhet." }, { status: 503 });
  const text = withVerifiedExperience(storedText || structuredText, (experiences ?? []) as VerifiedExperience[]);
  if (!text) return NextResponse.json({ error: "Kandidaten har ännu inte skapat något CV." }, { status: 404 });
  return NextResponse.json({ kind: "text", text }, { headers: { "Cache-Control": "private, no-store" } });
}
