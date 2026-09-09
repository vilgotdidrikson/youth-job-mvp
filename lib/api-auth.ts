import { createClient, type User } from "@supabase/supabase-js";
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

  // Keep the application key and the user's JWT in their respective headers.
  // In particular, an sb_publishable_* key is not itself a JWT.
  const authResponse = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const user = authResponse.ok ? await authResponse.json() as User : null;
  if (!user?.id) {
    console.warn("Protected API authentication failed.", { endpoint, status: authResponse.status });
    return { response: Response.json({ error: "Din session har gått ut. Logga in igen och försök på nytt." }, { status: 401 }) } as const;
  }

  const supabase = createClient(url, anonKey, {
    accessToken: async () => token,
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_api_quota", { p_endpoint: endpoint, p_limit: limits[endpoint] });
  if (quotaError) return { response: Response.json({ error: "Kunde inte kontrollera tjänstegränsen." }, { status: 503 }) } as const;
  if (!allowed) return { response: Response.json({ error: "Du har nått gränsen för den här AI-funktionen. Försök igen om en stund." }, { status: 429 }) } as const;
  return { user, token } as const;
}
