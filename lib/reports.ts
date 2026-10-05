import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase-errors";

export type ReportTargetType = "job" | "conversation" | "message" | "user";
export type ReportReason = "scam" | "harassment" | "discrimination" | "inappropriate" | "privacy" | "other";

export async function submitReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("submit_moderation_report", {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_details: input.details?.trim() || null,
  });

  if (error) {
    logSupabaseError("moderation_reports.submit", error, {
      targetType: input.targetType,
      targetId: input.targetId,
    });
    throw new Error(getSupabaseErrorMessage(error, "Kunde inte skicka anmälan."));
  }

  return String(data);
}
