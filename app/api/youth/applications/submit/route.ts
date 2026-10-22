import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiUser } from "@/lib/api-auth";
import { analyzeApplicationFollowups } from "@/lib/analyze-application-followups";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const startedAt = new Date().toISOString();
  const auth = await requireApiUser(request, "application-submit", ["youth"]);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  if (!["prepare", "answers", "drafts"].includes(body?.action) || (body.action !== "drafts" && (typeof body.jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.jobId)))) return NextResponse.json({ error: "Ogiltig ansökan." }, { status: 400 });
  if (body.action === "answers" && (typeof body.submit !== "boolean" || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers))) return NextResponse.json({ error: "Ogiltiga ansökningssvar." }, { status: 400 });
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => auth.token, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = body.action === "drafts" ? await client.rpc("submit_my_application_drafts") : body.action === "answers"
    ? await client.rpc("save_my_application_answers", { p_job_id: body.jobId, p_answers: body.answers, p_submit: body.submit })
    : await client.rpc("prepare_my_application", { p_job_id: body.jobId });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 409 });
  const result = Array.isArray(data) ? data[0] : data;
  if (body.action === "drafts" || result?.status === "submitted") after(async () => {
    try {
      const ids = body.action === "drafts" ? (await client.from("application_completions").select("job_id").eq("youth_user_id", auth.user.id).eq("status", "submitted").gte("submitted_at", startedAt).order("submitted_at").limit(10)).data?.map((item) => item.job_id) ?? [] : [body.jobId];
      await Promise.allSettled(ids.map((jobId: string) => analyzeApplicationFollowups(client, jobId, auth.user.id)));
    } catch { /* Application submission remains successful; the applications view can retry analysis. */ }
  });
  return NextResponse.json({ application: result });
}
