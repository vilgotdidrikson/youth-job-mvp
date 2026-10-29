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
  expectedUserId: string, password: string,
): Promise<User> {
  if (userClient === verificationClient || userClient.auth === verificationClient.auth) throw unavailable();
  if (typeof expectedUserId !== "string" || !expectedUserId || typeof password !== "string" || !password || password.length > 1024) {
    throw new AccountReauthenticationError(400, "Bekräfta kontot och lösenordet.");
  }
  async function identity() {
    try {
      const { data, error } = await userClient.auth.getUser();
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
  let temporarySession = false;
  try {
    const { data, error } = await verificationClient.auth.signInWithPassword({ email: initial.email, password });
    temporarySession = !error || !!data.user || !!data.session;
    if (error) {
      const status = error.status === 429 ? 429 : !error.status || error.status >= 500 ? 502 : 403;
      throw new AccountReauthenticationError(status, status === 429 ? "För många försök. Vänta en stund." : status === 502 ? "Lösenordet kunde inte verifieras just nu. Försök senare." : "Lösenordet stämmer inte.");
    }
    if (data.user?.id !== initial.id) throw new AccountReauthenticationError(403, "Lösenordet stämmer inte.");
  } catch (error) {
    if (error instanceof AccountReauthenticationError) throw error;
    throw unavailable();
  } finally {
    if (temporarySession) {
      try {
        const { error } = await verificationClient.auth.signOut({ scope: "local" });
        if (error) throw unavailable();
      } catch { throw unavailable(); }
    }
  }
  const current = await identity();
  if (current.email !== initial.email) throw new AccountReauthenticationError(409, "Kontot har ändrats. Försök igen från inställningarna.");
  return current;
}
