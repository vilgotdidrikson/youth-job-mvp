import { createClient } from "@supabase/supabase-js";

export const PRODUCTION_SUPABASE_URL = "https://iarnopkuoqumictgnqin.supabase.co";
export function prelaunchDb() {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (configured !== PRODUCTION_SUPABASE_URL) throw new Error("Prelaunch requires Primary / MatchnWork.");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Prelaunch server credentials missing.");
  return createClient(PRODUCTION_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function prelaunchAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const db = prelaunchDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const admin = await db.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (admin.error || !admin.data) return null;
  return db;
}
