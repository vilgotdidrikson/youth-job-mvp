"use client";

import { createClient, type UserAttributes } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export type AccountSessionCleanup = () => Promise<boolean>;
export interface AccountChangeOptions { expectedUserId?: string; signal?: AbortSignal; totpCode?: string }
export interface AccountChangeResult { cleanup: AccountSessionCleanup | null }
export class AccountSettingsError extends Error {
  cleanup: AccountSessionCleanup | null = null;
  constructor(message: string, public readonly unconfirmed = false) { super(message); this.name = "AccountSettingsError"; }
}
const normalizeEmail = (value: string) => value.trim().toLowerCase();
export function validAccountEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}

/** Short-lived, account-bound session. Caller MUST close it; never publish its tokens to the shared client. */
export async function openVerifiedAccount(currentPassword: string, options: AccountChangeOptions = {}, newEmail?: string) {
  if (!currentPassword || currentPassword.length > 1024) throw new AccountSettingsError("Ange ditt nuvarande lösenord.");
  let signal = options.signal ?? AbortSignal.timeout(30_000);
  signal.throwIfAborted();
  const shared = getSupabaseClient(), initial = await shared.auth.getUser();
  signal.throwIfAborted();
  const user = initial.data.user;
  if (initial.error || !user?.id || !user.email || user.is_anonymous) throw new AccountSettingsError("Din session kunde inte verifieras. Logga in igen.");
  if (options.expectedUserId && options.expectedUserId !== user.id) throw new AccountSettingsError("Kontot har ändrats. Öppna inställningarna igen.");
  if (newEmail && normalizeEmail(user.email) === newEmail) throw new AccountSettingsError("Ange en annan e-postadress än den du redan använder.");
  const temporary = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `mnw-account-check-${crypto.randomUUID()}` },
    global: { fetch: (url, init) => {
      const path = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      return fetch(url, { ...init, signal: /\/logout(?:\?|$)/.test(path) ? AbortSignal.timeout(10_000) : signal })
        .catch(() => { throw new Error("Kontots verifieringsanrop kunde inte genomföras."); });
    } },
  });
  if (temporary === shared || temporary.auth === shared.auth) throw new AccountSettingsError("Kontot kunde inte verifieras säkert. Försök igen.");
  const close: AccountSessionCleanup = async () => {
    try { const result = await temporary.auth.signOut({ scope: "local" }); return !result.error; } catch { return false; }
  };
  const assertCurrent = async (active = signal) => {
    active.throwIfAborted(); const current = await shared.auth.getUser(); active.throwIfAborted();
    if (current.error || current.data.user?.id !== user.id || current.data.user.email !== user.email) throw new AccountSettingsError("Kontot har ändrats. Öppna inställningarna igen.");
  };
  try {
    const verified = await temporary.auth.signInWithPassword({ email: user.email, password: currentPassword });
    signal.throwIfAborted();
    if (verified.error || verified.data.user?.id !== user.id) throw new AccountSettingsError(verified.error?.status === 429
      ? "För många försök. Vänta en stund." : "Ditt nuvarande lösenord kunde inte verifieras. Kontrollera det och försök igen.");
    const factors = user.factors?.filter(factor => factor.status === "verified") ?? [];
    if (factors.length) {
      const factor = factors.find(item => item.factor_type === "totp");
      if (!factor) throw new AccountSettingsError("Kontot använder en tvåfaktormetod som inte stöds här. Kontakta supporten.");
      if (!/^\d{6}$/.test(options.totpCode ?? "")) throw new AccountSettingsError("Bekräfta även med en sexsiffrig kod från kontots autentiseringsapp.");
      await assertCurrent();
      const result = await temporary.auth.mfa.challengeAndVerify({ factorId: factor.id, code: options.totpCode! });
      signal.throwIfAborted();
      if (result.error || result.data?.user?.id !== user.id) throw new AccountSettingsError("Tvåfaktorskoden kunde inte verifieras. Använd en aktuell kod och försök igen.");
      const level = await temporary.auth.mfa.getAuthenticatorAssuranceLevel();
      if (level.error || level.data.currentLevel !== "aal2") throw new AccountSettingsError("Tvåfaktorssessionen kunde inte verifieras.");
    }
    await assertCurrent();
    return { client: temporary, user, close, assertCurrent, assertActive() { signal.throwIfAborted(); }, setSignal(next: AbortSignal) { signal = next; } };
  } catch (error) {
    const failure = error instanceof AccountSettingsError ? error : new AccountSettingsError("Kontot kunde inte verifieras just nu. Försök igen.");
    if (!await close()) failure.cleanup = close;
    throw failure;
  }
}

async function changeAccount(currentPassword: string, attributes: UserAttributes, options?: AccountChangeOptions): Promise<AccountChangeResult> {
  const verification = await openVerifiedAccount(currentPassword, options, attributes.email);
  let failure: AccountSettingsError | null = null, cleanup: AccountSessionCleanup | null = null;
  try {
    verification.assertActive();
    const result = await verification.client.auth.updateUser(attributes, attributes.email ? {
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    } : undefined);
    verification.assertActive();
    if (result.error || result.data.user?.id !== verification.user.id) throw new AccountSettingsError(
      result.error?.status === 429 ? "För många försök. Vänta en stund innan du försöker igen." : "Ändringen kunde inte bekräftas. Kontrollera kontots status innan du försöker igen.", true);
  } catch (error) {
    failure = error instanceof AccountSettingsError ? error : new AccountSettingsError("Ändringen kunde inte bekräftas. Kontrollera kontots status innan du försöker igen.", true);
  } finally { if (!await verification.close()) cleanup = verification.close; }
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
export async function readAccountEmail(userId: string, signal: AbortSignal): Promise<{ email: string; pendingEmail: string }> {
  signal.throwIfAborted(); const { data, error } = await getSupabaseClient().auth.getUser(); signal.throwIfAborted();
  if (error || data.user?.id !== userId || !data.user.email) throw new AccountSettingsError("Kontots e-poststatus kunde inte verifieras. Öppna inställningarna igen.");
  return { email: data.user.email, pendingEmail: data.user.new_email ?? "" };
}
