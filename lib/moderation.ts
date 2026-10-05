"use client";

import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";

export async function blockConversationUser(conversationId: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("block_conversation_user", {
    p_conversation_id: conversationId,
  });
  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Kunde inte blockera användaren."));
  }
  return String(data);
}
