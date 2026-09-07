import { getSupabaseClient } from "@/lib/supabase";

export async function authenticatedHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function authenticatedAudioUrl(path: string): Promise<string> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) return path;
  return `${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(session.access_token)}`;
}
