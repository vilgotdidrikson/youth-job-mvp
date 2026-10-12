"use client";

import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { getMyConversationContacts, getMyConversations } from "@/lib/chat";

export interface BlockedContact { userId: string; name: string; createdAt: string; }

export async function getBlockedContacts(userId: string): Promise<BlockedContact[]> {
  const { data, error } = await getSupabaseClient().from("user_blocks")
    .select("blocked_user_id, created_at").eq("blocker_user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(getSupabaseErrorMessage(error, "Kunde inte hämta blockerade kontakter."));
  if (!data?.length) return [];
  // Reuse the authorized contact names; never read another user's private profile.
  const [conversations, contacts] = await Promise.all([getMyConversations(userId), getMyConversationContacts()]);
  const names = new Map(contacts.map(contact => [contact.conversation_id, contact.other_name]));
  return data.map(block => {
    const conversation = conversations.find(item =>
      (item.youth_user_id === userId ? item.company_user_id : item.youth_user_id) === block.blocked_user_id);
    return { userId: block.blocked_user_id, createdAt: block.created_at,
      name: conversation ? names.get(conversation.id) ?? "Blockerad kontakt" : "Blockerad kontakt" };
  });
}

export async function unblockContact(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("unblock_user", { p_blocked_user_id: userId });
  if (error) throw new Error(getSupabaseErrorMessage(error, "Kunde inte häva blockeringen."));
}

export async function blockConversationUser(conversationId: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("block_conversation_user", {
    p_conversation_id: conversationId,
  });
  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Kunde inte blockera användaren."));
  }
  return String(data);
}
