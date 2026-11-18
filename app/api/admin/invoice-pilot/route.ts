import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isInvoicePilotDev } from "@/lib/invoice-pilot";
import { TwoFactorSessionError, verifyTwoFactorSession } from "@/lib/server/two-factor-session";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Authorization, X-Account-Id" };
const roles = ["company", "youth"] as const;
const failure = (status: number, error: string) => Response.json({ error }, { status, headers });

async function handle(request: Request, remove: boolean) {
  if (!isInvoicePilotDev()) return failure(404, "Fakturatestet finns i dev.");
  if (request.headers.get("sec-fetch-site") === "cross-site") return failure(403, "Begäran kunde inte godkännas.");
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const userId = request.headers.get("x-account-id");
  if (!token || token.length > 16384 || !userId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) return failure(401, "Logga in som admin.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret) return failure(503, "Fakturatestet är tillfälligt otillgängligt.");

  const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  const user = createClient(url, key, { auth, global: { headers: { Authorization: `Bearer ${token}` } } });
  const service = createClient(url, secret, { auth });
  try {
    await verifyTwoFactorSession(user, service, userId, token, request.signal);
    const fixtures = await user.rpc("hire_invoice_pilot_accounts");
    if (fixtures.error) return failure(fixtures.error.code === "42501" ? 403 : 503, "Fakturatestet kräver ett adminkonto med tvåfaktor.");
    if (remove) {
      if (!Array.isArray(fixtures.data) || fixtures.data.length > 2) throw Error("Unexpected fixture scope");
      const removed = await Promise.all(fixtures.data.map(({ id }) => service.auth.admin.deleteUser(id)));
      if (removed.some(item => item.error)) return failure(503, "Rensningen kunde inte slutföras. Försök igen.");
      return Response.json({ removed: removed.length }, { headers });
    }
    if (!Array.isArray(fixtures.data)) throw Error("Invalid fixture response");
    if (fixtures.data.length) return failure(409, "Rensa dina tidigare testkonton innan du skapar nya.");

    const credentials = await createPair(user, service, userId);
    return Response.json(credentials, { status: 201, headers });
  } catch (reason) {
    if (reason instanceof TwoFactorSessionError) return failure(reason.status, reason.message);
    return failure(503, "Testkontona kunde inte skapas. Rensa eventuella testkonton och försök igen.");
  }
}

async function createPair(user: SupabaseClient, service: SupabaseClient, owner: string) {
  const accounts: { id: string; role: "company" | "youth"; email: string; password: string }[] = [];
  try {
    for (const role of roles) {
      const email = `mnw-invoice-${role}-${owner}@example.invalid`;
      const password = randomBytes(24).toString("base64url");
      const { data, error } = await service.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { role },
        app_metadata: { invoice_pilot_owner: owner, invoice_pilot_role: role, hire_invoice_test: role === "company" },
      });
      if (error || !data.user) throw Error("Could not create synthetic account");
      accounts.push({ id: data.user.id, role, email, password });
    }
    const ready = await user.rpc("prepare_hire_invoice_pilot_accounts", { p_company: accounts[0].id, p_youth: accounts[1].id });
    if (ready.error || typeof ready.data !== "string") throw Error("Could not prepare synthetic recruitment");
    return { accounts: accounts.map(({ role, email, password }) => ({ role, email, password })), chat: `/chats?match=${ready.data}` };
  } catch (error) {
    await Promise.allSettled(accounts.map(account => service.auth.admin.deleteUser(account.id)));
    throw error;
  }
}
export const POST = (request: Request) => handle(request, false);
export const DELETE = (request: Request) => handle(request, true);
