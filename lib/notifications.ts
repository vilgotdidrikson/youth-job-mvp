/**
 * Notification read state (F14). Unread notices are what still needs attention;
 * read ones are history. Opening a chat clears its match and message notices,
 * so the bell and the Meddelanden badge follow what the person has seen.
 */
import { getSupabaseClient } from "@/lib/supabase";

export interface AppNotification {
  id: string; type: string; title: string; body: string; href: string | null;
  /** Set on match, message and status notices from F14 onwards; null on older rows. */
  match_id?: string | null;
  read_at: string | null; created_at: string;
}

export function splitNotifications<T extends Pick<AppNotification, "read_at">>(items: T[]): { unread: T[]; earlier: T[] } {
  return { unread: items.filter(item => !item.read_at), earlier: items.filter(item => item.read_at) };
}

export function notificationIcon(type: string): "chat" | "briefcase" | "bell" {
  if (type === "message" || type === "match" || type === "recruitment_status") return "chat";
  if (type === "application_update" || type === "candidate_interest" || type === "employment" || type === "recruitment") return "briefcase";
  return "bell";
}

/** Returns true when something was marked, so callers refresh badges only then. Errors are non-blocking. */
export async function markMatchNotificationsRead(userId: string, matchId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient().from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", userId).eq("match_id", matchId).is("read_at", null).select("id");
  return !error && !!data?.length;
}

export async function markAllNotificationsRead(userId: string): Promise<string> {
  const stamp = new Date().toISOString();
  const { error } = await getSupabaseClient().from("notifications").update({ read_at: stamp }).eq("user_id", userId).is("read_at", null);
  if (error) throw new Error("Kunde inte markera notiserna som lästa. Försök igen.");
  return stamp;
}
