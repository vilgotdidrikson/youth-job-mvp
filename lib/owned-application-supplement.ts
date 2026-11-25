"use client";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import type { ApplicationCompletion, ApplicationFollowup } from "./application-completions";
import type { supplementPayload } from "./application-supplement";

type Payload = ReturnType<typeof supplementPayload>;
export type SupplementSnapshot = { application: ApplicationCompletion; followups: ApplicationFollowup[]; confirmed: boolean };
export type SupplementReceipt = { read(signal: AbortSignal): Promise<SupplementSnapshot> };
export class SupplementRequestError extends Error {}
export class SupplementWriteError extends Error {
  constructor(public readonly receipt: SupplementReceipt) { super("Sparningen kunde inte bekräftas. Kontrollera sparningen innan du skickar igen."); }
}
async function wait<T>(operation: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted(); let cancel: () => void = () => {};
  try {
    return await Promise.race([operation(), new Promise<never>((_, reject) => { cancel = () => reject(new SupplementRequestError("Kompletteringen kunde inte kontrolleras i tid. Försök läsa igen.")); signal.addEventListener("abort", cancel, { once: true }); if (signal.aborted) cancel(); })]);
  } finally { signal.removeEventListener("abort", cancel); signal.throwIfAborted(); }
}
export async function submitOwnedSupplement(ownerId: string, jobId: string, input: Payload, signal: AbortSignal): Promise<SupplementReceipt> {
  const active = AbortSignal.any([signal, AbortSignal.timeout(20_000)]), shared = getSupabaseClient();
  // Clone once: edits to a caller's draft during a request cannot change its receipt.
  const payload = structuredClone(input);
  const current = async (check: AbortSignal) => {
    const { data, error } = await wait(() => shared.auth.getUser(), check);
    if (error || data.user?.id !== ownerId) throw new SupplementRequestError("Kontot har ändrats. Öppna ansökan för rätt konto igen.");
  };
  const bind = async (check: AbortSignal) => {
    await current(check);
    const snapshot = await wait(() => shared.auth.getSession(), check), token = snapshot.data.session?.access_token;
    if (snapshot.error || !token || snapshot.data.session?.user.id !== ownerId) throw new SupplementRequestError("Kontots session kunde inte verifieras.");
    // A static request token prevents a later account switch from sending the
    // previous person's answers through a new account's shared client.
    const bound = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `mnw-supplement-${crypto.randomUUID()}` },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const owner = await wait(() => bound.auth.getUser(token), check);
    if (owner.error || owner.data.user?.id !== ownerId) throw new SupplementRequestError("Kontots session kunde inte verifieras.");
    return bound;
  };
  const bound = await bind(active);
  const application = async (client: typeof bound, check: AbortSignal) => {
    const { data, error } = await wait(() => client.from("application_completions").select("*").eq("job_id", jobId).eq("youth_user_id", ownerId).abortSignal(check).single(), check);
    if (error || data?.job_id !== jobId || data.youth_user_id !== ownerId) throw new SupplementRequestError("Ansökan kunde inte kontrolleras. Läs om ansökan innan du fortsätter.");
    return data as ApplicationCompletion;
  };
  const receipt: SupplementReceipt = { async read(signal) {
    const check = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
    const client = await bind(check);
    const [app, rows] = await Promise.all([application(client,check), wait(() => client.from("application_followups").select("*").eq("job_id", jobId).eq("youth_user_id", ownerId).order("created_at").order("id").abortSignal(check), check)]);
    if (rows.error || !Array.isArray(rows.data) || rows.data.some(row => row.job_id !== jobId || row.youth_user_id !== ownerId)) throw new SupplementRequestError("Svaren kunde inte läsas. Försök kontrollera sparningen igen.");
    await current(check);
    const followups = rows.data as ApplicationFollowup[];
    const confirmed = Object.entries(payload.answers).every(([id, answer]) => app.answers[id] === answer)
      && payload.skipIds.every(id => app.omitted_question_ids?.includes(id))
      && Object.entries(payload.followupAnswers).every(([id, answer]) => followups.some(row => row.id === id && row.status === "answered" && row.answer === answer))
      && payload.followupSkipIds.every(id => followups.some(row => row.id === id && row.status === "skipped"));
    return { application: app, followups, confirmed };
  } };
  const before = await application(bound,active);
  if (before.status !== "submitted") throw new SupplementRequestError("Ansökan är avslutad eller återkallad och kan inte kompletteras här.");
  await current(active); active.throwIfAborted();
  try {
    const { data, error } = await wait(() => bound.rpc("save_my_application_supplement", { p_job_id: jobId, p_answers: payload.answers, p_skip_ids: payload.skipIds, p_followup_answers: payload.followupAnswers, p_followup_skip_ids: payload.followupSkipIds }).abortSignal(active), active);
    if (error || typeof data?.updated !== "boolean") throw new SupplementRequestError("Sparningen kunde inte bekräftas.");
  } catch { throw new SupplementWriteError(receipt); }
  return receipt;
}
