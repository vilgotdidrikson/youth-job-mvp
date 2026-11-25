import { createHmac } from "node:crypto";
import { CONSENT_VERSION, validateSignup } from "@/lib/prelaunch";
import { prelaunchDb } from "@/lib/prelaunch-server";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Ogiltigt format." }, { status: 415 });
    if (Number(request.headers.get("content-length")) > 4096) return Response.json({ error: "För stor förfrågan." }, { status: 413 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Ogiltigt ursprung." }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "För stor förfrågan." }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "Ogiltigt formulär." }, { status: 400 }); }
    if (body?.website) return Response.json({ ok: true }); // Honeypot: deliberately do not store automated submissions.
    const input = validateSignup(body);
    if (!input) return Response.json({ error: "Kontrollera namn, e-post och ditt godkännande." }, { status: 400 });
    const db = prelaunchDb();
    const ip = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    const bucket = createHmac("sha256", process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!).update(ip).digest("hex");
    const { data, error } = await db.rpc("register_prelaunch_signup", { p_role: input.role, p_name: input.name, p_email: input.email, p_company: input.companyName, p_consent: CONSENT_VERSION, p_bucket: bucket });
    if (error) { console.error("Prelaunch storage failed", { code: error.code }); return Response.json({ error: "Kunde inte spara just nu. Försök igen om en stund." }, { status: 503 }); }
    if (!data) return Response.json({ error: "För många försök. Försök igen om 30 minuter." }, { status: 429, headers: { "Retry-After": "1800" } });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Prelaunch service unavailable");
    return Response.json({ error: "Intresseanmälan är tillfälligt otillgänglig. Försök igen senare." }, { status: 503 });
  }
}
