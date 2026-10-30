import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reauthenticateAccount, AccountReauthenticationError } from "./account-reauthentication";
import { collectPersonalDataForReview } from "./personal-data-collection";
import { collectAccountCvFiles } from "./personal-data-cv-binding";
import { verifyPersonalDataSession, PersonalDataSessionError } from "./personal-data-session";

export class PersonalDataReviewError extends Error {
  constructor(public readonly code: "cancelled" | "identity_changed" | "collection_failed") {
    super("Granskningsunderlaget kunde inte sammanställas säkert.");
  }
}

/** Internal pending material ONLY, never a response body or ExportPackageInput.
 * All clients are separately server-created; the optional review client is used
 * only by the fixed private reader. This is not a downloadable export grant.
 */
export async function preparePersonalDataReview(
  userClient: SupabaseClient, verificationClient: SupabaseClient,
  subjectId: string, password: string,
  options: { accessToken: string; sessionClient: SupabaseClient; signal?: AbortSignal; reviewClient?: SupabaseClient },
) {
  const stop = new AbortController();
  const active = options.signal ? AbortSignal.any([options.signal, stop.signal]) : stop.signal;
  const timer = setTimeout(() => stop.abort(), 120_000);
  async function wait<T>(operation: () => PromiseLike<T>): Promise<T> {
    if (active.aborted) throw new PersonalDataReviewError("cancelled");
    let cancel: (() => void) | undefined;
    try {
      const result = await Promise.race([operation(), new Promise<never>((_, reject) => {
        cancel = () => reject(new PersonalDataReviewError("cancelled"));
        active.addEventListener("abort", cancel, { once: true });
        if (active.aborted) cancel();
      })]);
      if (active.aborted) throw new PersonalDataReviewError("cancelled");
      return result;
    } finally { if (cancel) active.removeEventListener("abort", cancel); }
  }
  try {
    const sessionId = await wait(() => verifyPersonalDataSession(userClient, options.sessionClient, subjectId, options.accessToken, active));
    await wait(() => reauthenticateAccount(userClient, verificationClient, subjectId, password));
    const collection = await wait(() => collectPersonalDataForReview(userClient, subjectId, active, options.reviewClient));
    if (collection.subjectId !== subjectId || collection.reviewState !== "pending") throw new PersonalDataReviewError("identity_changed");
    const profile = collection.categories.flatMap(category => category.sources).find(source => source.relation === "public.profiles");
    const role = profile?.status === "collected" && profile.rows.length === 1 && profile.rows[0].id === subjectId ? profile.rows[0].role : null;
    if (typeof role !== "string" || !["youth", "company", "private"].includes(role)) throw new PersonalDataReviewError("collection_failed");
    const cv = role === "youth" ? await wait(() => collectAccountCvFiles(userClient, subjectId, active)) : null;
    const { data, error } = await wait(() => userClient.auth.getUser());
    if (error || !data.user || data.user.is_anonymous || data.user.id !== subjectId) throw new PersonalDataReviewError("identity_changed");
    const currentSession = await wait(() => verifyPersonalDataSession(userClient, options.sessionClient, subjectId, options.accessToken, active));
    if (currentSession !== sessionId) throw new PersonalDataReviewError("identity_changed");
    return {
      subjectId, sessionId, reviewState: "pending" as const, consistency: "non_transactional" as const,
      collection, cv, cvScope: cv ? "account_cv_references" as const : "not_requested_for_role" as const,
    };
  } catch (error) {
    if (active.aborted) throw new PersonalDataReviewError("cancelled");
    if (error instanceof AccountReauthenticationError || error instanceof PersonalDataReviewError || error instanceof PersonalDataSessionError) throw error;
    throw new PersonalDataReviewError("collection_failed");
  } finally { clearTimeout(timer); stop.abort(); }
}
