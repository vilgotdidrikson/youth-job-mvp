import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { processApplicationAnalysisJobs } from "@/lib/application-analysis-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return new NextResponse(null, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, aiKey = process.env.GROQ_API_KEY;
  if (!url || !key || !aiKey) return NextResponse.json({ error: "Worker temporarily unavailable" }, { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: valid, error } = await client.rpc("validate_matching_worker_token", { p_token: token });
  if (error) return new NextResponse(null, { status: 503 });
  if (valid !== true) return new NextResponse(null, { status: 401 });
  try { return NextResponse.json(await processApplicationAnalysisJobs(client, aiKey)); }
  catch { return NextResponse.json({ error: "Worker temporarily unavailable" }, { status: 503 }); }
}
