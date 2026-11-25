import { getSupabaseClient } from "@/lib/supabase";

export interface RetentionClock {
  enforced: boolean;
  expired: boolean;
  delete_after: string;
  purged_at: string | null;
  server_now: string;
}
export interface ApplicationRetention extends RetentionClock {
  job_id: string; youth_user_id: string; job_title: string; company_name: string;
  closed_at: string; reason: "withdrawn" | "rejected" | "cancelled" | "job_closed" | "hired";
}
export interface ConversationRetention extends RetentionClock {
  conversation_id: string; last_activity_at: string; read_only_at: string; read_only: boolean;
}

/** Presentation follows the server clock plus monotonic elapsed time. Server
 * RLS/guards remain authoritative even if a page is suspended or never reloads. */
export function retentionPhase<T extends RetentionClock>(row: T, elapsedMs = 0): T {
  const now = Date.parse(row.server_now) + Math.max(0, elapsedMs);
  return { ...row,
    expired: !!row.purged_at || row.expired || (row.enforced && Date.parse(row.delete_after) <= now),
    ...("read_only_at" in row ? { read_only: !!row.purged_at || (row as unknown as ConversationRetention).read_only ||
      (row.enforced && Date.parse(String(row.read_only_at)) <= now) } : {}),
  };
}

export function nextRetentionBoundary(rows: RetentionClock[], elapsedMs: number): number | null {
  const waits = rows.filter(row => row.enforced && !row.purged_at).flatMap(row => {
    const now = Date.parse(row.server_now) + Math.max(0, elapsedMs);
    return [row.delete_after, ...("read_only_at" in row ? [String(row.read_only_at)] : [])]
      .map(date => Date.parse(date) - now).filter(wait => Number.isFinite(wait) && wait > 0);
  });
  return waits.length ? Math.min(2_147_000_000, Math.max(1, Math.min(...waits))) : null;
}

export async function getApplicationRetention(signal: AbortSignal): Promise<ApplicationRetention[]> {
  const { data, error } = await getSupabaseClient().rpc("get_my_application_retention").abortSignal(signal);
  if (error || !Array.isArray(data)) throw new Error("Lagringsstatus kunde inte hämtas. Försök igen.");
  return data as ApplicationRetention[];
}
export async function getConversationRetention(id: string, signal: AbortSignal): Promise<ConversationRetention> {
  const { data, error } = await getSupabaseClient().rpc("get_conversation_retention", { p_conversation_id: id }).abortSignal(signal);
  if (error || !Array.isArray(data) || data.length !== 1 || data[0].conversation_id !== id) throw new Error("Chattens status kunde inte hämtas. Försök igen.");
  return data[0] as ConversationRetention;
}
