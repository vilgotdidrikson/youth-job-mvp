import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export class AccountReauthenticationError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 409 | 429 | 502, message: string) {
    super(message);
    this.name = "AccountReauthenticationError";
  }
}
const unavailable = () => new AccountReauthenticationError(502, "Kontot kunde inte verifieras just nu. Försök senare.");

/** Both clients must be server-created with public application credentials.
 * userClient carries the requesting token. verificationClient MUST be a separate,
 * non-persistent client without that token; it is locally signed out below.
 * This returns an identity for the current operation, never a reusable grant or
 * replacement for authorization/fresh-session checks on a later download.
 */
export async function reauthenticateAccount(
  userClient: SupabaseClient, verificationClient: SupabaseClient,
  expectedUserId: string, password: string, totpCode?: string, signal?: AbortSignal,
): Promise<User> {
  if (userClient === verificationClient || userClient.auth === verificationClient.auth) throw unavailable();
  if (typeof expectedUserId !== "string" || !expectedUserId || typeof password !== "string" || !password || password.length > 1024) {
    throw new AccountReauthenticationError(400, "Bekräfta kontot och lösenordet.");
  }
  const active = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const check = () => { if (active.aborted) throw unavailable(); };
  async function identity() {
    try {
      check();
      const { data, error } = await userClient.auth.getUser();
      check();
      if (error || !data.user || data.user.is_anonymous) throw new AccountReauthenticationError(401, "Din session är inte giltig.");
      if (data.user.id !== expectedUserId) throw new AccountReauthenticationError(409, "Kontot har ändrats. Öppna inställningarna för rätt konto igen.");
      return data.user;
    } catch (error) {
      if (error instanceof AccountReauthenticationError) throw error;
      throw unavailable();
    }
  }
  const initial = await identity();
  if (!initial.email) throw new AccountReauthenticationError(403, "Kontot kan inte verifieras med lösenord här.");
  if (totpCode !== undefined && (typeof totpCode !== "string" || !/^\d{6}$/.test(totpCode))) throw new AccountReauthenticationError(400, "Ange en sexsiffrig tvåfaktorskod.");
  let verifiedFactorId: string | null = null;
  try {
    check();
    const { data, error } = await verificationClient.auth.signInWithPassword({ email: initial.email, password });
    check();
    if (error) {
      const status = error.status === 429 ? 429 : !error.status || error.status >= 500 ? 502 : 403;
      throw new AccountReauthenticationError(status, status === 429 ? "För många försök. Vänta en stund." : status === 502 ? "Lösenordet kunde inte verifieras just nu. Försök senare." : "Lösenordet stämmer inte.");
    }
    if (data.user?.id !== initial.id) throw new AccountReauthenticationError(403, "Lösenordet stämmer inte.");
    // Both identities come from Auth, never request metadata. A freshly added
    // factor in the password response must not be missed by an earlier read.
    const factors = [...(initial.factors ?? []), ...(data.user.factors ?? [])].filter(factor => factor.status === "verified");
    if (factors.length) {
      const factor = factors.find(item => item.factor_type === "totp");
      if (!factor || !totpCode) throw new AccountReauthenticationError(403, "Bekräfta med kontots autentiseringsapp. Om du saknar tillgång till den, kontakta supporten.");
      const result = await verificationClient.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totpCode });
      check();
      if (result.error) throw new AccountReauthenticationError(result.error.status === 429 ? 429 : result.error.status && result.error.status < 500 ? 403 : 502,
        result.error.status === 429 ? "För många kodförsök. Vänta en stund." : "Tvåfaktorskoden kunde inte verifieras. Försök med en aktuell kod.");
      if (result.data?.user?.id !== initial.id || !result.data.access_token) throw unavailable();
      // Explicit JWT validates the upgraded identity/factors at Auth rather than
      // treating a local AAL claim as a durable authorization grant.
      const assurance = await verificationClient.auth.mfa.getAuthenticatorAssuranceLevel(result.data.access_token);
      check();
      if (assurance.error || assurance.data.currentLevel !== "aal2") throw unavailable();
      verifiedFactorId = factor.id;
    }
  } catch (error) {
    if (error instanceof AccountReauthenticationError) throw error;
    throw unavailable();
  } finally {
    // A failed transport may still have installed a session in the SDK.
    try {
      const { error } = await verificationClient.auth.signOut({ scope: "local" });
      if (error) throw unavailable();
    } catch { throw unavailable(); }
  }
  const current = await identity();
  if (current.email !== initial.email) throw new AccountReauthenticationError(409, "Kontot har ändrats. Försök igen från inställningarna.");
  const currentFactors = current.factors?.filter(factor => factor.status === "verified") ?? [];
  if ((verifiedFactorId || currentFactors.length) && !currentFactors.some(factor => factor.factor_type === "totp" && factor.id === verifiedFactorId)) throw new AccountReauthenticationError(409, "Kontots tvåfaktorinställningar har ändrats. Bekräfta kontot igen.");
  return current;
}
