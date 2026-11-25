import { getCurrentUser } from "./auth";
import { getMyConversations, getMyConversationContacts } from "./chat";
import { getMyMatches } from "./matching";
import type { ConversationSummary } from "./types";

export interface ChatInboxItem { conv: ConversationSummary; otherName: string; jobTitle?: string; status: string; matchId?: string }

export async function readChatInbox(ownerId: string, signal: AbortSignal): Promise<ChatInboxItem[]> {
  const [conversations, contacts, matches] = await Promise.all([
    getMyConversations(ownerId, signal), getMyConversationContacts(signal), getMyMatches({ expectedUserId: ownerId, signal }),
  ]);
  signal.throwIfAborted();
  if ((await getCurrentUser())?.id !== ownerId
    || conversations.some(row => row.youth_user_id !== ownerId && row.company_user_id !== ownerId)
    || matches.some(row => row.youth_user_id !== ownerId && row.company_user_id !== ownerId)) throw new Error("Chattarnas konto kunde inte verifieras.");
  signal.throwIfAborted();
  const contactMap = new Map(contacts.map(item => [item.conversation_id, item]));
  const matchMap = new Map(matches.map(item => [item.id, item]));
  return conversations.map(conv => ({ conv, otherName: contactMap.get(conv.id)?.other_name || "Kontakt",
    jobTitle: contactMap.get(conv.id)?.job_title || undefined, status: matchMap.get(conv.match_id ?? "")?.status || "matched", matchId: conv.match_id || undefined }));
}
