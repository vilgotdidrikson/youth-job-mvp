import { sendMessage } from "./chat";

/** Retry the same own text with the same primary key after an uncertain response.
 * No automatic retry, upsert, or cross-account outbox. Lifetime: this workspace. */
export function createChatTextSender(ownerId: string, send = sendMessage, timeoutMs = 20_000) {
  const attempts = new Map<string, string>();
  let stopped = false, pending: AbortController | null = null;
  return {
    async send(conversationId: string, text: string): Promise<boolean> {
      if (stopped || pending) return false;
      const key = JSON.stringify([conversationId, text]);
      const requestId = attempts.get(key) ?? crypto.randomUUID();
      attempts.set(key, requestId);
      const controller = new AbortController(); pending = controller;
      let onAbort: () => void = () => {};
      const cancelled = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error("Sändningen kunde inte bekräftas. Texten finns kvar. Försök igen för att kontrollera samma meddelande."));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await Promise.race([cancelled, send(conversationId, text, { expectedUserId: ownerId, requestId, signal: controller.signal })]);
        if (stopped || controller.signal.aborted) return false;
        attempts.delete(key);
        return true;
      } finally { clearTimeout(timer); controller.signal.removeEventListener("abort", onAbort); if (pending === controller) pending = null; }
    },
    stop() { stopped = true; pending?.abort(); attempts.clear(); },
  };
}
