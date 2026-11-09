"use client";

import { createClient, type UserAttributes } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export type AccountSessionCleanup = () => Promise<boolean>;
export interface AccountChangeOptions { expectedUserId?: string; signal?: AbortSignal }
export interface AccountChangeResult { cleanup: AccountSessionCleanup | null }
export class AccountSettingsError extends Error {
  cleanup: AccountSessionCleanup | null = null;
  constructor(message: string, public readonly unconfirmed = false) { super(message); this.name = "AccountSettingsError"; }
}
const normalizeEmail = (value: string) => value.trim().toLowerCase();
export function validAccountEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}

/** Uses only this account's temporary session. Never mutates or signs out the shared client. */
async function changeAccount(currentPassword: string, attributes: UserAttributes, options: AccountChangeOptions = {}): Promise<AccountChangeResult> {
  if (!currentPassword || currentPassword.length > 1024) throw new AccountSettingsError("Ange ditt nuvarande lösenord.");
  const signal = options.signal ?? AbortSignal.timeout(30_000);
  signal.throwIfAborted();
  const shared = getSupabaseClient();
  const initial = await shared.auth.getUser();
  signal.throwIfAborted();
  const user = initial.data.user;
  if (initial.error || !user?.id || !user.email || user.is_anonymous) throw new AccountSettingsError("Din session kunde inte verifieras. Logga in igen.");
  if (options.expectedUserId && options.expectedUserId !== user.id) throw new AccountSettingsError("Kontot har ändrats. Öppna inställningarna igen.");
  if (attributes.email && normalizeEmail(user.email) === attributes.email) throw new AccountSettingsError("Ange en annan e-postadress än den du redan använder.");
  const temporary = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `mnw-account-check-${crypto.randomUUID()}` },
    global: { fetch: (url, init) => {
      // Cleanup must still work when the mutation was cancelled. It gets its own deadline.
      const path = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      return fetch(url, { ...init, signal: /\/logout(?:\?|$)/.test(path) ? AbortSignal.timeout(10_000) : signal })
        .catch(() => { throw new Error("Kontots verifieringsanrop kunde inte genomföras."); });
    } },
  });
  if (temporary === shared || temporary.auth === shared.auth) throw new AccountSettingsError("Kontot kunde inte verifieras säkert. Försök igen.");
  let sessionCreated = false, startedWrite = false;
  let failure: AccountSettingsError | null = null, cleanup: AccountSessionCleanup | null = null;
  const closeSession: AccountSessionCleanup = async () => {
    try { const result = await temporary.auth.signOut({ scope: "local" }); return !result.error; } catch { return false; }
  };
  try {
    sessionCreated = true;
    const verified = await temporary.auth.signInWithPassword({ email: user.email, password: currentPassword });
    signal.throwIfAborted();
    if (verified.error || verified.data.user?.id !== user.id) {
      throw new AccountSettingsError(verified.error?.status === 429 ? "För många försök. Vänta en stund." : "Ditt nuvarande lösenord kunde inte verifieras. Kontrollera det och försök igen.");
    }
    const current = await shared.auth.getUser();
    signal.throwIfAborted();
    if (current.error || current.data.user?.id !== user.id || current.data.user.email !== user.email) throw new AccountSettingsError("Kontot har ändrats. Öppna inställningarna igen.");
    startedWrite = true;
    const result = await temporary.auth.updateUser(attributes, attributes.email ? {
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    } : undefined);
    signal.throwIfAborted();
    if (result.error || result.data.user?.id !== user.id) throw new AccountSettingsError(
      result.error?.status === 429 ? "För många försök. Vänta en stund innan du försöker igen." : "Ändringen kunde inte bekräftas. Kontrollera kontots status innan du försöker igen.", true);
  } catch (error) {
    failure = error instanceof AccountSettingsError ? error : new AccountSettingsError(startedWrite
      ? "Ändringen kunde inte bekräftas. Kontrollera kontots status innan du försöker igen."
      : "Kontot kunde inte verifieras just nu. Försök igen.", startedWrite);
  } finally {
    if (sessionCreated && !await closeSession()) cleanup = closeSession;
  }
  if (failure) { failure.cleanup = cleanup; throw failure; }
  return { cleanup };
}

export async function changeAccountPassword(currentPassword: string, newPassword: string, options?: AccountChangeOptions): Promise<AccountChangeResult> {
  if (newPassword.length < 8 || newPassword.length > 1024) throw new AccountSettingsError("Det nya lösenordet måste innehålla mellan 8 och 1024 tecken.");
  return changeAccount(currentPassword, { password: newPassword }, options);
}
export async function requestAccountEmailChange(currentPassword: string, newEmail: string, options?: AccountChangeOptions): Promise<AccountChangeResult> {
  const email = normalizeEmail(newEmail);
  if (!validAccountEmail(email)) throw new AccountSettingsError("Ange en giltig e-postadress.");
  return changeAccount(currentPassword, { email }, options);
}

/** Refresh only the requested account's authoritative active and pending email. */
export async function readAccountEmail(userId: string, signal: AbortSignal): Promise<{ email: string; pendingEmail: string }> {
  signal.throwIfAborted();
  const { data, error } = await getSupabaseClient().auth.getUser();
  signal.throwIfAborted();
  if (error || data.user?.id !== userId || !data.user.email) throw new AccountSettingsError("Kontots e-poststatus kunde inte verifieras. Öppna inställningarna igen.");
  return { email: data.user.email, pendingEmail: data.user.new_email ?? "" };
}
