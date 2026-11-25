type ConversationTarget = { id: string; match_id?: string | null; job_id?: string | null };
type ChatRequest = { conversationId?: string | null; matchId?: string | null; jobId?: string | null };

export function chatRequestKey(request: ChatRequest): string {
  if (request.conversationId) return `conversation:${request.conversationId}`;
  if (request.matchId) return `match:${request.matchId}`;
  return request.jobId ? `job:${request.jobId}` : "";
}

/** A recruitment link must select its exact candidate even when the ad has many chats. */
export function isRequestedConversation(conversation: ConversationTarget, request: ChatRequest): boolean {
  if (request.conversationId) return conversation.id === request.conversationId;
  if (request.matchId) return conversation.match_id === request.matchId;
  return Boolean(request.jobId && conversation.job_id === request.jobId);
}
