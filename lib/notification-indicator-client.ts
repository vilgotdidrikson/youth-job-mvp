"use client";
import { getSupabaseClient } from "@/lib/supabase";
import { equalIndicatorPreferences, parseIndicatorPreferences, readIndicatorPreferences, type IndicatorPreferences, type IndicatorPreferenceState } from "./notification-indicator-preferences";
export class IndicatorPreferencesError extends Error {
  constructor(message: string, public readonly uncertain = false) { super(message); }
}
const changed = () => new IndicatorPreferencesError("Kontot har ändrats. Öppna inställningarna för rätt konto igen.");
async function wait<T>(task: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted(); let cancel = () => {};
  try { return await Promise.race([task(), new Promise<never>((_, reject) => { cancel = () => reject(new IndicatorPreferencesError("Kontrollen tog för lång tid. Försök läsa inställningarna igen.")); signal.addEventListener("abort", cancel, { once: true }); if (signal.aborted) cancel(); })]); }
  finally { signal.removeEventListener("abort", cancel); signal.throwIfAborted(); }
}
async function current(owner: string, signal: AbortSignal) {
  const result = await wait(() => getSupabaseClient().auth.getUser(), signal);
  if (result.error || result.data.user?.id !== owner || result.data.user.is_anonymous) throw changed();
}
async function request(token: string, method: "GET" | "PUT", signal: AbortSignal, preferences?: IndicatorPreferences) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!}/auth/v1/user`, { method, signal, cache: "no-store",
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(method === "PUT" ? { body: JSON.stringify({ data: { notification_indicators: preferences } }) } : {}) });
  if (!response.ok) throw new IndicatorPreferencesError("Inställningarna kunde inte läsas eller bekräftas.");
  return await response.json() as { id?: string; is_anonymous?: boolean; user_metadata?: unknown };
}
async function bind(owner: string, signal: AbortSignal) {
  await current(owner, signal);
  const session = await wait(() => getSupabaseClient().auth.getSession(), signal);
  if (session.error || session.data.session?.user.id !== owner || !session.data.session.access_token) throw changed();
  const token = session.data.session.access_token;
  const user = await request(token, "GET", signal);
  if (user?.id !== owner || user.is_anonymous) throw changed();
  await current(owner, signal);
  return { token, user };
}
export async function loadIndicatorPreferences(owner: string, signal: AbortSignal): Promise<IndicatorPreferenceState> {
  const active = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  try { return readIndicatorPreferences((await bind(owner, active)).user.user_metadata); }
  catch (error) { if (error instanceof IndicatorPreferencesError) throw error; throw new IndicatorPreferencesError("Inställningarna kunde inte läsas. Försök läsa dem igen."); }
}
export async function saveIndicatorPreferences(owner: string, value: IndicatorPreferences, signal: AbortSignal): Promise<IndicatorPreferenceState> {
  const snapshot = parseIndicatorPreferences(value), active = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
  const { token } = await bind(owner, active);
  active.throwIfAborted();
  // A captured access token cannot retarget a later signed-in account. Never
  // update/refresh shared Auth storage or revoke the original session here.
  try {
    const user = await request(token, "PUT", active, snapshot);
    if (user?.id !== owner || user.is_anonymous) throw changed();
    const receipt = readIndicatorPreferences(user.user_metadata);
    if (!receipt.configured || !equalIndicatorPreferences(receipt.preferences, snapshot)) throw changed();
    const checked = await request(token, "GET", active);
    if (checked?.id !== owner || checked.is_anonymous) throw changed();
    const result = readIndicatorPreferences(checked.user_metadata);
    if (!result.configured || !equalIndicatorPreferences(result.preferences, snapshot)) throw changed();
    await current(owner, active);
    return result;
  } catch { throw new IndicatorPreferencesError("Sparningen kunde inte bekräftas. Kontrollera sparningen innan du försöker igen.", true); }
}
