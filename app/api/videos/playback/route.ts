import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { isProfileVideoPath, PROFILE_VIDEO_POLICY } from "@/lib/profile-video";

const noStore = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", Vary: "Authorization" };
const unavailable = () => NextResponse.json({ error: "Videon är inte tillgänglig." }, { status: 404, headers: noStore });

/** Direct authenticated Storage downloads can outlive an RLS change in the CDN.
 * Only this uncached POST serves bytes. Storage SELECT is service-only, while
 * both authorization reads use the caller's JWT and the ordinary video RLS. */
export async function POST(request: NextRequest) {
  if (!request.headers.get("authorization")?.match(/^Bearer\s+\S+$/i)) {
    return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401, headers: noStore });
  }
  const auth = await requireApiUser(request, "video-playback");
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { videoId?: unknown } | null;
  if (typeof body?.videoId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.videoId)) {
    return NextResponse.json({ error: "Ogiltig video." }, { status: 400, headers: noStore });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Videohämtning är inte konfigurerad." }, { status: 503, headers: noStore });
  const transport = { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(30000) }) };
  const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => auth.token, auth: authOptions, global: transport,
  });
  const readAuthorized = async () => {
    const { data, error } = await userClient.from("youth_videos")
      .select("id,owner_id,storage_path,conversation_id,mime_type,size_bytes,expires_at,revoked_at,deleted_at,cleanup_started_at")
      .eq("id", body.videoId).maybeSingle();
    if (error || !data?.conversation_id || data.revoked_at || data.deleted_at || data.cleanup_started_at ||
        !Number.isFinite(Date.parse(data.expires_at)) || Date.parse(data.expires_at) <= Date.now() ||
        !isProfileVideoPath(data.storage_path, data.owner_id) ||
        !(data.mime_type in PROFILE_VIDEO_POLICY.formats) || !Number.isFinite(data.size_bytes) || data.size_bytes <= 0 || data.size_bytes > PROFILE_VIDEO_POLICY.maxBytes) return null;
    return data;
  };
  try {
    const video = await readAuthorized();
    if (!video) return unavailable();
    // Never use a client-provided path with the service client.
    const admin = createClient(url, serviceKey, { auth: authOptions, global: transport });
    const { data, error } = await admin.storage.from(PROFILE_VIDEO_POLICY.bucket).download(video.storage_path);
    if (error || !data || data.size > PROFILE_VIDEO_POLICY.maxBytes) return unavailable();
    // A block, expiry or revocation while the bytes were being fetched wins.
    const current = await readAuthorized();
    if (!current || current.storage_path !== video.storage_path) return unavailable();
    return new NextResponse(data.stream(), { headers: { ...noStore, "Content-Type": video.mime_type, "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch {
    return NextResponse.json({ error: "Kunde inte hämta videon. Försök igen." }, { status: 503, headers: noStore });
  }
}
