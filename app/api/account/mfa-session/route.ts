import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { TwoFactorSessionError, verifyTwoFactorSession } from "@/lib/server/two-factor-session";

const headers = { "Cache-Control": "no-store", "Vary": "Authorization, X-Account-Id", "X-Content-Type-Options": "nosniff" };
/** A status proof, never a grant to read privacy cases or other people's records. */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
  const userId = request.headers.get("x-account-id") ?? "";
  if (!token || token.length > 16384 || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId)) return NextResponse.json({ error: "Logga in igen." }, { status: 401, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !serviceKey) return NextResponse.json({ error: "Säkerhetskontrollen är inte tillgänglig." }, { status: 503, headers });
  try {
    const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
    const user = createClient(url, key, { auth, global: { headers: { Authorization: `Bearer ${token}` } } });
    // Same narrowly scoped boolean RPC as the existing export-session check.
    const sessions = createClient(url, serviceKey, { auth });
    await verifyTwoFactorSession(user, sessions, userId, token, request.signal);
    return NextResponse.json({ verified: true }, { headers });
  } catch (error) {
    const status = error instanceof TwoFactorSessionError ? error.status : 503;
    return NextResponse.json({ error: status === 403 ? "Bekräfta med tvåfaktor för den här åtgärden." : "Säkerhetssessionen kunde inte verifieras." }, { status, headers });
  }
}
