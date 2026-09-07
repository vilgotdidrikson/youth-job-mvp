import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const limits = {
  "voice-session": 5,
  "voice-turn": 30,
  "voice-speech": 60,
  "cv-generate": 10,
  "job-generate": 20,
} as const;

export type ProtectedEndpoint = keyof typeof limits;

export async function requireApiUser(request: NextRequest, endpoint: ProtectedEndpoint) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("access_token");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return { response: Response.json({ error: "Du måste vara inloggad." }, { status: 401 }) } as const;

  const supabase = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { response: Response.json({ error: "Din session är inte längre giltig." }, { status: 401 }) } as const;

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_api_quota", { p_endpoint: endpoint, p_limit: limits[endpoint] });
  if (quotaError) return { response: Response.json({ error: "Kunde inte kontrollera tjänstegränsen." }, { status: 503 }) } as const;
  if (!allowed) return { response: Response.json({ error: "Du har nått gränsen för den här AI-funktionen. Försök igen om en stund." }, { status: 429 }) } as const;
  return { user: data.user, token } as const;
}
