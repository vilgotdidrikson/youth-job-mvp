import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PersonalDataSessionError, verifyPersonalDataSession } from "./personal-data-session";

export class TwoFactorSessionError extends Error {
  constructor(public readonly status: 401 | 403 | 503) { super(status === 403 ? "Bekräfta med tvåfaktor för den här åtgärden." : "Säkerhetssessionen kunde inte verifieras."); }
}
/** Proof of THIS active AAL2 session only. Always add the action's own role/record authorization. */
export async function verifyTwoFactorSession(userClient: SupabaseClient, sessionClient: SupabaseClient, userId: string, token: string, signal?: AbortSignal): Promise<void> {
  const active = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10_000)]);
  if (active.aborted) throw new TwoFactorSessionError(503);
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { onAbort = () => reject(new TwoFactorSessionError(503)); active.addEventListener("abort", onAbort, { once: true }); });
  try {
    active.throwIfAborted();
    await Promise.race([cancelled, (async () => {
    const { data, error } = await userClient.auth.getClaims(token);
    active.throwIfAborted();
    if (error || data?.claims?.sub !== userId) throw new TwoFactorSessionError(401);
    if (data.claims.aal !== "aal2") throw new TwoFactorSessionError(403);
    await verifyPersonalDataSession(userClient, sessionClient, userId, token, active);
    })()]);
  } catch (error) {
    if (error instanceof TwoFactorSessionError) throw error;
    throw new TwoFactorSessionError(error instanceof PersonalDataSessionError && error.code === "invalid_session" ? 401 : 503);
  } finally { active.removeEventListener("abort", onAbort); }
}
