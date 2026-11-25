import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { disclosedCvText, type ApplicationDisclosure } from "@/lib/application-disclosure";

import { uploadedCvPath } from "@/lib/cv-document-path";
import { requireApiUser } from "@/lib/api-auth";


const NO_STORE = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", Vary: "Authorization" };
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const denied = () => NextResponse.json({ error: "Du saknar åtkomst till kandidatens CV." }, { status: 403, headers: NO_STORE });
const missing = () => NextResponse.json({ error: "CV-filen kunde inte hämtas." }, { status: 404, headers: NO_STORE });

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

  const readDisclosure = () => userClient.rpc("get_application_disclosure", {
    p_job_id: body.jobId, p_youth_user_id: body.youthUserId,
  });
  const { data: youthProfile, error: profileError } = await readDisclosure();
  if (profileError || !youthProfile) return denied();
  const path = uploadedCvPath(youthProfile.cv?.documents, body.youthUserId);
  if (path) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return NextResponse.json({ error: "CV-hämtningen är tillfälligt otillgänglig." }, { status: 503, headers: NO_STORE });
    const storage = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(12000) }) },
    }).storage;
    try {
      const { data, error } = await storage.from("youth-documents").download(path);
      if (error || !data || data.size > MAX_PDF_BYTES || await data.slice(0, 5).text() !== "%PDF-") return missing();
      // A withdrawal or revised disclosure while fetching the original wins.
      const { data: current, error: currentError } = await readDisclosure();
      if (currentError || !current || current.revision !== youthProfile.revision ||
          uploadedCvPath(current.cv?.documents, body.youthUserId) !== path) return denied();
      return new NextResponse(data.stream(), { headers: { ...NO_STORE, "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
    } catch {
      return missing();
    }
  }

  const text = disclosedCvText(youthProfile as ApplicationDisclosure);
  if (!text) return NextResponse.json({ error: "Kandidaten har ännu inte skapat något CV." }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ kind: "text", text }, { headers: NO_STORE });
}
