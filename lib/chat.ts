"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase-errors";
import { getSupabaseClient } from "@/lib/supabase";
import type { ChatMessage, Conversation, ConversationSummary } from "@/lib/types";

interface ConversationSeed {
  match_id: string;
  youth_user_id: string;
  company_user_id: string;
  job_id: string;
}

function normalizeConversation(row: Record<string, unknown>): Conversation {
  return {
    ...row,
    id: String(row.id ?? ""),
    match_id: typeof row.match_id === "string" ? row.match_id : null,
    youth_user_id: String(row.youth_user_id ?? ""),
    company_user_id: String(row.company_user_id ?? ""),
    job_id: typeof row.job_id === "string" ? row.job_id : null,
    last_message_at: typeof row.last_message_at === "string" ? row.last_message_at : null,
  };
}

function normalizeMessage(row: Record<string, unknown>): ChatMessage {
  return {
    ...row,
    id: String(row.id ?? ""),
    conversation_id: String(row.conversation_id ?? ""),
    sender_user_id: String(row.sender_user_id ?? ""),
    message_text: typeof row.message_text === "string" ? row.message_text : "",
  };
}

async function updateConversationTimestamp(conversationId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    logSupabaseError("conversations.update.last_message_at", error, { conversationId });
    throw new Error(getSupabaseErrorMessage(error, "Unable to update conversation timestamp."));
  }
}

async function ensureMatchedConversation(conversationId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, match_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    logSupabaseError("conversations.select.by_id", error, { conversationId });
    throw new Error(getSupabaseErrorMessage(error, "Unable to verify chat access."));
  }

  if (!data?.match_id) {
    throw new Error("Chat is only available after a match has been created.");
  }
}

export async function getOrCreateConversation(seed: ConversationSeed): Promise<Conversation> {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("match_id", seed.match_id)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("conversations.select.by_match_id", existingError, seed);
    throw new Error(getSupabaseErrorMessage(existingError, "Unable to load conversation."));
  }

  if (existing) {
    return normalizeConversation(existing as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      match_id: seed.match_id,
      youth_user_id: seed.youth_user_id,
      company_user_id: seed.company_user_id,
      job_id: seed.job_id,
      last_message_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    logSupabaseError("conversations.insert", error, seed);
    throw new Error(getSupabaseErrorMessage(error, "Unable to create conversation."));
  }

  return normalizeConversation(data as Record<string, unknown>);
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    logSupabaseError("messages.select.by_conversation", error, { conversationId });
    throw new Error(getSupabaseErrorMessage(error, "Unable to fetch messages."));
  }

  return (data ?? []).map((row) => normalizeMessage(row as Record<string, unknown>));
}

export async function sendMessage(conversationId: string, messageText: string): Promise<void> {
  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error("You must be signed in to send messages.");
  }

  await ensureMatchedConversation(conversationId);

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_user_id: user.id,
    message_text: messageText,
    created_at: new Date().toISOString(),
  });

  if (error) {
    logSupabaseError("messages.insert", error, {
      conversationId,
      sender_user_id: user.id,
    });
    throw new Error(getSupabaseErrorMessage(error, "Unable to send message."));
  }

  await updateConversationTimestamp(conversationId);
}

export async function getMyConversations(userId?: string): Promise<ConversationSummary[]> {
  const user = userId ? { id: userId } : await getCurrentUser();

  if (!user) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .or(`youth_user_id.eq.${user.id},company_user_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (conversationError) {
    logSupabaseError("conversations.select.mine", conversationError, { userId: user.id });
    throw new Error(getSupabaseErrorMessage(conversationError, "Unable to fetch conversations."));
  }

  return (conversations ?? []).map((row) => {
    const conversation = normalizeConversation(row as Record<string, unknown>);
    return {
      ...conversation,
      job_id: conversation.job_id ?? null,
      match_id: conversation.match_id ?? null,
    };
  });
}
