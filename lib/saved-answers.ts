import type { SupabaseClient } from "@supabase/supabase-js";
import { readRecruitmentProfile, validateSavedAnswers, type SavedAnswer } from "./recruitment-profile";

/** Shared by web and a future mobile client: rules and the versioned profile write. */
export const SAVE_ANSWER_PROMPT = "Vill du spara det här svaret i din profil så att det kan återanvändas i framtida ansökningar?";

/** Working times and start dates go stale; they are kept current under "När jag kan jobba". */
export function canSaveAnswer(question: string, label = ""): boolean {
  return !/(börja|start|tillträde|omgående|helg|arbetstid|tillgäng|kväll|dagtid|skift)/i.test(`${question} ${label}`);
}
export const savedAnswerSource = (jobId: string, key: string) => `${jobId}:${key}`;

/** One saved fact per answered question; saving again replaces the earlier text. */
export function withSavedAnswer(current: SavedAnswer[], entry: SavedAnswer): SavedAnswer[] {
  return validateSavedAnswers([...current.filter(item => item.source !== entry.source), entry]);
}
export function savedAnswerEntry(text: string, question: string, source: string, today = new Date()): SavedAnswer {
  return { text: text.trim(), question: question.trim().slice(0, 300), savedAt: today.toISOString().slice(0, 10), source };
}

export class SavedAnswerError extends Error {}
const bounded = (signal: AbortSignal) => AbortSignal.any([signal, AbortSignal.timeout(15_000)]);

export async function loadSavedAnswers(client: SupabaseClient, ownerId: string, signal: AbortSignal) {
  const { data, error } = await client.from("youth_profiles").select("recruitment_profile,recruitment_profile_version").eq("user_id", ownerId).abortSignal(bounded(signal)).single();
  if (error || !data) throw new SavedAnswerError("Profilen kunde inte hämtas. Försök igen.");
  return { answers: readRecruitmentProfile(data.recruitment_profile).savedAnswers ?? [], version: (data.recruitment_profile_version as number | null) ?? 0 };
}

/** Reads the current list and writes against that exact version, so a concurrent profile change is never overwritten. */
export async function changeSavedAnswers(client: SupabaseClient, ownerId: string, change: (current: SavedAnswer[]) => SavedAnswer[], signal: AbortSignal): Promise<SavedAnswer[]> {
  const active = bounded(signal);
  const account = await client.auth.getUser();
  if (account.error || account.data.user?.id !== ownerId) throw new SavedAnswerError("Kontot har ändrats. Öppna sidan för rätt konto igen.");
  const current = await loadSavedAnswers(client, ownerId, active);
  const next = change(current.answers);
  const { data, error } = await client.rpc("save_my_recruitment_profile", { p_section: "savedAnswers", p_value: next, p_expected_version: current.version }).abortSignal(active);
  if (error) throw new SavedAnswerError(["PT409", "40001"].includes(error.code ?? "") ? "Profilen ändrades samtidigt. Försök igen." : "Uppgiften kunde inte sparas i profilen. Försök igen.");
  return readRecruitmentProfile((data as { profile?: unknown } | null)?.profile).savedAnswers ?? next;
}
