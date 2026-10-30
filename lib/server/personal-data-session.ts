import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export class PersonalDataSessionError extends Error {
  constructor(public readonly code: "invalid_session" | "unavailable" | "cancelled") {
    super("Sessionen kunde inte verifieras för export. Logga in igen och försök på nytt.");
    this.name = "PersonalDataSessionError";
  }
}
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

/** Verify the SAME request token used to construct userClient. Both clients are
 * server-created; sessionClient has service credentials and only invokes the
 * fixed boolean RPC. No token/session row is returned, cached or logged.
 * Check again immediately before a later download; this is not a lasting grant.
 */
export async function verifyPersonalDataSession(
  userClient: SupabaseClient, sessionClient: SupabaseClient,
  subjectId: string, accessToken: string, signal?: AbortSignal,
): Promise<string> {
  if (!uuid(subjectId) || typeof accessToken !== "string" || !accessToken || accessToken.length > 16384) throw new PersonalDataSessionError("invalid_session");
  if (!sessionClient || userClient === sessionClient || userClient.auth === sessionClient.auth) throw new PersonalDataSessionError("unavailable");
  const active = signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000);
  async function wait<T>(operation: () => PromiseLike<T>): Promise<T> {
    if (active.aborted) throw new PersonalDataSessionError("cancelled");
    let cancel: (() => void) | undefined;
    try {
      const result = await Promise.race([operation(), new Promise<never>((_, reject) => {
        cancel = () => reject(new PersonalDataSessionError("cancelled"));
        active.addEventListener("abort", cancel, { once: true });
        if (active.aborted) cancel();
      })]);
      if (active.aborted) throw new PersonalDataSessionError("cancelled");
      return result;
    } finally { if (cancel) active.removeEventListener("abort", cancel); }
  }
  try {
    // Explicit token arguments avoid reading a cached or unrelated SDK session.
    // getClaims validates the signature/expiration; getUser checks live identity.
    const { data, error } = await wait(() => userClient.auth.getClaims(accessToken));
    const claims = data?.claims;
    if (error || !claims || claims.sub !== subjectId || !uuid(claims.session_id) || claims.role !== "authenticated" || claims.is_anonymous === true || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000) throw new PersonalDataSessionError("invalid_session");
    const { data: identity, error: identityError } = await wait(() => userClient.auth.getUser(accessToken));
    if (identityError || !identity.user || identity.user.is_anonymous || identity.user.id !== subjectId) throw new PersonalDataSessionError("invalid_session");
    const { data: exists, error: sessionError } = await wait(() => sessionClient.rpc("is_personal_data_session_active", { p_subject_id: subjectId, p_session_id: claims.session_id }).abortSignal(active));
    if (sessionError) throw new PersonalDataSessionError("unavailable");
    if (exists !== true || claims.exp <= Date.now() / 1000) throw new PersonalDataSessionError("invalid_session");
    return claims.session_id;
  } catch (error) {
    if (error instanceof PersonalDataSessionError) throw error;
    throw new PersonalDataSessionError("unavailable");
  }
}
