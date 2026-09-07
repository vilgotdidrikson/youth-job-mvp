import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SIGNED_URL_TTL_SECONDS = 5 * 60;

type YouthDocument = { url?: unknown; type?: unknown };

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uploadedCvPath(documents: unknown, youthUserId: string): string | null {
  if (!Array.isArray(documents)) return null;
  const document = (documents as YouthDocument[]).find((item) => item?.type === "cv" && typeof item.url === "string");
  const path = typeof document?.url === "string" ? document.url : null;
  // Stored paths must remain inside the candidate's private folder. Old public URLs are never proxied.
  if (!path || /^https?:\/\//i.test(path) || !path.startsWith(`${youthUserId}/`) || !path.toLowerCase().endsWith(".pdf")) return null;
  return path;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anonKey) return NextResponse.json({ error: "Du måste vara inloggad för att öppna ett CV." }, { status: 401 });
  if (!serviceKey) return NextResponse.json({ error: "CV-visning är inte konfigurerad. Kontakta supporten." }, { status: 503 });

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Din session är inte längre giltig." }, { status: 401 });
  const body = await request.json().catch(() => null) as { jobId?: unknown; youthUserId?: unknown } | null;
  if (!isUuid(body?.jobId) || !isUuid(body?.youthUserId)) return NextResponse.json({ error: "Ogiltig kandidat eller annons." }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const companyUserId = userData.user.id;
  const [{ data: account }, { data: job }, { data: application }, { data: match }, { data: youthProfile, error: profileError }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", companyUserId).maybeSingle(),
    admin.from("jobs").select("id").eq("id", body.jobId).eq("company_user_id", companyUserId).maybeSingle(),
    admin.from("swipe_actions").select("id").eq("job_id", body.jobId).eq("youth_user_id", body.youthUserId).eq("decision", "interested").maybeSingle(),
    admin.from("matches").select("id").eq("job_id", body.jobId).eq("youth_user_id", body.youthUserId).eq("company_user_id", companyUserId).maybeSingle(),
    admin.from("youth_profiles").select("documents").eq("user_id", body.youthUserId).maybeSingle(),
  ]);

  if (account?.role !== "company") return NextResponse.json({ error: "Endast företagskonton kan öppna kandidaters CV." }, { status: 403 });
  // Authorization is evaluated entirely on the server for the same owned listing.
  if (!job || (!application && !match)) return NextResponse.json({ error: "Du har inte behörighet att öppna den här kandidatens CV." }, { status: 403 });
  if (profileError) return NextResponse.json({ error: "Kunde inte hämta kandidatens CV just nu." }, { status: 502 });

  const path = uploadedCvPath(youthProfile?.documents, body.youthUserId);
  if (!path) return NextResponse.json({ error: "Kandidaten har inget uppladdat PDF-CV." }, { status: 404 });
  const { data, error } = await admin.storage.from("youth-documents").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "CV:t kunde inte hämtas. Det kan ha tagits bort av kandidaten." }, { status: 404 });
  return NextResponse.json(
    { url: data.signedUrl, expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
