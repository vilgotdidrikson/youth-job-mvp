"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { ChatMessage, Conversation, ConversationSummary, MatchRecord } from "@/lib/types";

function normalizeConversation(row: Record<string, unknown>): Conversation {
  return {
    ...row,
    id: String(row.id ?? ""),
    youth_user_id: String(row.youth_user_id ?? ""),
    company_user_id: String(row.company_user_id ?? ""),
    last_message_at: typeof row.last_message_at === "string" ? row.last_message_at : null,
  };
}

function normalizeMessage(row: Record<string, unknown>): ChatMessage {
  const textValue =
    typeof row.text === "string"
      ? row.text
      : typeof row.body === "string"
        ? row.body
        : null;

  return {
    ...row,
    id: String(row.id ?? ""),
    conversation_id: String(row.conversation_id ?? ""),
    sender_user_id: typeof row.sender_user_id === "string" ? row.sender_user_id : null,
    sender: typeof row.sender === "string" ? row.sender : null,
    text: textValue,
    body: textValue,
  };
}

async function updateConversationTimestamp(conversationId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    console.error("Failed to update conversation timestamp.", error);
  }
}

async function ensureMatchedConversation(conversationId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id")
    .eq("conversation_id", conversationId)
    .limit(1);

  if (error) {
    console.error("Failed to verify chat access for conversation.", error);
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error("Chat is only available after a match has been created.");
  }
}

export async function getOrCreateConversation(youthId: string, companyId: string): Promise<Conversation> {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("youth_user_id", youthId)
    .eq("company_user_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to load conversation.", existingError);
    throw new Error(existingError.message);
  }

  if (existing) {
    return normalizeConversation(existing as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      youth_user_id: youthId,
      company_user_id: companyId,
      last_message_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create conversation.", error);
    throw new Error(error.message);
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
    console.error("Failed to fetch messages.", error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => normalizeMessage(row as Record<string, unknown>));
}

export async function sendMessage(conversationId: string, text: string): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to send messages.");
  }

  await ensureMatchedConversation(conversationId);

  const supabase = getSupabaseClient();
  const attempts = [
    { conversation_id: conversationId, sender_user_id: user.id, text, created_at: new Date().toISOString() },
    { conversation_id: conversationId, sender_user_id: user.id, body: text, created_at: new Date().toISOString() },
  ];

  let lastError: Error | null = null;

  for (const payload of attempts) {
    const { error } = await supabase.from("messages").insert(payload);

    if (!error) {
      await updateConversationTimestamp(conversationId);
      return;
    }

    lastError = new Error(error.message);
    console.error("Failed to send chat message.", error);
  }

  throw lastError ?? new Error("Unable to send message.");
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
    console.error("Failed to fetch conversations.", conversationError);
    throw new Error(conversationError.message);
  }

  const normalized = (conversations ?? []).map((row) => normalizeConversation(row as Record<string, unknown>));

  if (!normalized.length) {
    return [];
  }

  const ids = normalized.map((conversation) => conversation.id);
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  if (matchError) {
    console.error("Failed to load matches for conversations.", matchError);
    throw new Error(matchError.message);
  }

  const latestMatchByConversation = new Map<string, MatchRecord>();

  for (const row of (matches ?? []) as MatchRecord[]) {
    if (row.conversation_id && !latestMatchByConversation.has(row.conversation_id)) {
      latestMatchByConversation.set(row.conversation_id, row);
    }
  }

  return normalized.map((conversation) => {
    const match = latestMatchByConversation.get(conversation.id);
    return {
      ...conversation,
      job_id: match?.job_id ?? null,
      match_id: match?.id ?? null,
    };
  });
}
