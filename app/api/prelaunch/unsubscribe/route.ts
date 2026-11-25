import { prelaunchDb } from "@/lib/prelaunch-server";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.token !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.token)) return Response.json({ error: "Ogiltig länk." }, { status: 400 });
    const { error } = await prelaunchDb().from("prelaunch_signups").update({ unsubscribed_at: new Date().toISOString() }).eq("unsubscribe_token", body.token).is("unsubscribed_at", null);
    if (error) throw error;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Kunde inte avregistrera. Försök igen senare." }, { status: 503 }); }
}
