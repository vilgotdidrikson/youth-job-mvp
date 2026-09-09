import { getSupabaseClient } from "@/lib/supabase";

export async function authenticatedHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseClient();
  // A session may be revoked before its expiry timestamp. Always refresh for
  // protected AI calls so the server never receives an old access token.
  const { data: { session } } = await supabase.auth.refreshSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function authenticatedAudioUrl(path: string): Promise<string> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) return path;
  return `${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(session.access_token)}`;
}
