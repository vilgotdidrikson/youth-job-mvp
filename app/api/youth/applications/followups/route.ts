import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiUser } from "@/lib/api-auth";
import { analyzeApplicationFollowups } from "@/lib/analyze-application-followups";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "application-followups", ["youth"], { deferQuota: true });
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.jobId)) return NextResponse.json({ error: "Ogiltig ansökan." }, { status: 400 });
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => auth.token, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = await analyzeApplicationFollowups(client, body.jobId, auth.user.id);
  return NextResponse.json(result, { status: "error" in result ? 403 : 200 });
}
