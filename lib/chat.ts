"use client";

import { getCurrentUser } from "@/lib/auth";
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase-errors";
import { getSupabaseClient } from "@/lib/supabase";
import type { ChatMessage, Conversation, ConversationSummary } from "@/lib/types";

export interface ConversationContact {
  conversation_id: string;
  other_name: string;
  job_title: string | null;
}

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
    video_kind: row.video_kind === "profile" || row.video_kind === "file" ? row.video_kind : null,
    video_id: typeof row.video_id === "string" ? row.video_id : null,
  };
}


async function ensureMatchedConversation(conversationId: string, signal?: AbortSignal) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("conversations")
    .select("id, match_id")
    .eq("id", conversationId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();

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

export async function getMessages(conversationId: string, signal?: AbortSignal): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

  if (error) {
    logSupabaseError("messages.select.by_conversation", error, { conversationId });
    throw new Error(getSupabaseErrorMessage(error, "Unable to fetch messages."));
  }

  const messages = (data ?? []).map((row) => normalizeMessage(row as Record<string, unknown>));
  if (messages.some(message => message.conversation_id !== conversationId)) throw new Error("Meddelandenas samtal kunde inte verifieras.");
  return messages;
}

export function subscribeToConversationMessages(conversationId: string, onMessage: (message: ChatMessage) => void) {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      onMessage(normalizeMessage(payload.new as Record<string, unknown>));
    })
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

export async function sendMessage(conversationId: string, messageText: string, options?: { requestId: string; expectedUserId: string; signal?: AbortSignal }): Promise<void> {
  const signal = options?.signal;
  signal?.throwIfAborted();
  if (options && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.requestId)) throw new Error("Meddelandets identifierare är ogiltig.");
  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error("You must be signed in to send messages.");
  }
  if (options && user.id !== options.expectedUserId) throw new Error("Kontot har ändrats. Öppna chatten igen.");

  await ensureMatchedConversation(conversationId, signal);
  if ((await getCurrentUser())?.id !== user.id) throw new Error("Kontot har ändrats. Öppna chatten igen.");
  signal?.throwIfAborted();

  const supabase = getSupabaseClient();
  let query = supabase.from("messages").insert({
    ...(options ? { id: options.requestId } : {}),
    conversation_id: conversationId,
    sender_user_id: user.id,
    message_text: messageText,
    created_at: new Date().toISOString(),
  });
  if (signal) query = query.abortSignal(signal);
  const { error } = await query;

  if (error?.code === "23505" && options) {
    // A lost response can follow a committed insert. Confirm that exact own
    // message rather than upserting or accepting an unrelated key collision.
    let receipt = supabase.from("messages").select("id,conversation_id,sender_user_id,message_text,video_kind")
      .eq("id", options.requestId).eq("conversation_id", conversationId).eq("sender_user_id", user.id);
    if (signal) receipt = receipt.abortSignal(signal);
    const result = await receipt.maybeSingle();
    if (!result.error && result.data?.id === options.requestId && result.data.conversation_id === conversationId
      && result.data.sender_user_id === user.id && result.data.message_text === messageText && !result.data.video_kind) return;
    throw new Error("Det tidigare sändningsförsöket kunde inte bekräftas. Texten finns kvar.");
  }

  if (error) {
    logSupabaseError("messages.insert", error, {
      conversationId,
      sender_user_id: user.id,
    });
    throw new Error(getSupabaseErrorMessage(error, "Unable to send message."));
  }

}

export async function getMyConversations(userId?: string, signal?: AbortSignal): Promise<ConversationSummary[]> {
  const user = userId ? { id: userId } : await getCurrentUser();

  if (!user) {
    return [];
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from("conversations")
    .select("*")
    .or(`youth_user_id.eq.${user.id},company_user_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data: conversations, error: conversationError } = await query;

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

export async function getMyConversationContacts(signal?: AbortSignal): Promise<ConversationContact[]> {
  const supabase = getSupabaseClient();
  const query = supabase.rpc("get_my_conversation_contacts");
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) {
    logSupabaseError("conversations.contacts", error);
    throw new Error(getSupabaseErrorMessage(error, "Unable to load conversation contacts."));
  }
  return ((data ?? []) as unknown[]).map((item) => {
    const row = item as Record<string, unknown>;
    return {
      conversation_id: String(row.conversation_id ?? ""),
      other_name: typeof row.other_name === "string" ? row.other_name : "Kontakt",
      job_title: typeof row.job_title === "string" ? row.job_title : null,
    };
  });
}
