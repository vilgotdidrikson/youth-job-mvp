import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";

export type ReportTargetType = "job" | "conversation" | "message" | "user" | "application_question";
export type ReportReason = "scam" | "harassment" | "discrimination" | "inappropriate" | "privacy" | "other";

export async function submitReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}): Promise<string> {
  const data = input.targetType === "application_question" ? await moderationRequest<string>("report_application_question", {
    p_question_id: input.targetId, p_reason: input.reason, p_details: input.details?.trim() || null,
  }) : await moderationRequest<string>("submit_moderation_report", {
    p_target_type: input.targetType, p_target_id: input.targetId, p_reason: input.reason,
    p_details: input.details?.trim() || null,
  });
  if (typeof data !== "string" || !data) throw new Error("Anmälan kunde inte bekräftas. Försök igen.");

  return String(data);
}

export type ModerationStatus = "open" | "reviewing" | "resolved" | "dismissed";
export interface ModerationCase {
  id: string; reporter_user_id: string | null; target_type: ReportTargetType; target_id: string;
  reason: ReportReason; details: string | null; status: ModerationStatus; created_at: string;
  target_summary: string; target_snapshot: Record<string, unknown> | null;
  reviewed_at: string | null; reviewed_by_user_id: string | null; resolution_note: string | null;
}

/** Write retries are safe because submission and review are idempotent on the server. */
async function moderationRequest<T>(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new Error("Begäran avbröts.");
  signal?.addEventListener("abort", abort, { once: true });
  let rejectAborted: (() => void) | undefined;
  const stopped = new Promise<never>((_, reject) => {
    rejectAborted = () => reject(new Error("Begäran kunde inte bekräftas i tid. Försök igen."));
    controller.signal.addEventListener("abort", rejectAborted, { once: true });
  });
  const timer = setTimeout(abort, 15_000);
  try {
    const { data, error } = await Promise.race([getSupabaseClient().rpc(name, args).abortSignal(controller.signal), stopped]);
    if (error) throw new Error(["PT409", "40001"].includes(error.code ?? "") ? "Ärendet har ändrats. Läs det senaste beslutet innan du fortsätter." : getSupabaseErrorMessage(error, "Begäran kunde inte utföras."));
    return data as T;
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", abort);
    if (rejectAborted) controller.signal.removeEventListener("abort", rejectAborted);
  }
}

export function getModerationCasework(signal: AbortSignal): Promise<ModerationCase[]> {
  return moderationRequest<ModerationCase[]>("get_moderation_casework", {}, signal).then(data => {
    if (!Array.isArray(data)) throw new Error("Anmälningarna kunde inte läsas.");
    return data;
  });
}

export function reviewModerationCase(report: ModerationCase, status: Exclude<ModerationStatus, "open">, note: string): Promise<void> {
  return moderationRequest<void>("review_moderation_report_checked", {
    p_report_id: report.id, p_status: status, p_expected_status: report.status,
    p_resolution_note: note.trim() || null,
  });
}
