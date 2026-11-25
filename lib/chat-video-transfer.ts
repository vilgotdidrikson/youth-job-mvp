import { revokeVideo, sendVideoMessage, uploadVideo, type YouthVideo } from "./video-client";

export interface VideoTransferState {
  phase: "ready" | "uploading" | "sending" | "revoking";
  hasPending: boolean;
  error: string;
  note: string;
}

/** One account/conversation, one in-memory upload and message UUID. No automatic retry. */
export function createChatVideoTransfer(ownerId: string, conversationId: string, update: (state: VideoTransferState) => void, {
  upload = uploadVideo, send = sendVideoMessage, revoke = revokeVideo,
  uploadTimeoutMs = 120_000, writeTimeoutMs = 20_000,
} = {}) {
  let stopped = false;
  let busy = false;
  let pending: YouthVideo | null = null;
  let messageId = crypto.randomUUID();
  let controller: AbortController | null = null;
  let state: VideoTransferState = { phase: "ready", hasPending: false, error: "", note: "" };
  const publish = (patch: Partial<VideoTransferState>) => {
    state = { ...state, ...patch, hasPending: !!pending };
    if (!stopped) update(state);
  };
  const step = async <T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> => {
    if (stopped) throw new Error("Videoflödet har stängts.");
    const task = new AbortController(); controller = task;
    let onAbort: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error("Försöket kunde inte bekräftas. Förhandsvisningen finns kvar. Försök igen."));
      task.signal.addEventListener("abort", onAbort, { once: true });
    });
    const timer = setTimeout(() => task.abort(), timeoutMs);
    try {
      const result = await Promise.race([cancelled, run(task.signal)]);
      task.signal.throwIfAborted();
      if (stopped) throw new Error("Videoflödet har stängts.");
      return result;
    } finally {
      clearTimeout(timer); task.signal.removeEventListener("abort", onAbort);
      if (controller === task) controller = null;
    }
  };
  return {
    async send(file: File, duration: number): Promise<boolean> {
      if (stopped || busy) return false;
      busy = true; publish({ phase: pending ? "sending" : "uploading", error: "", note: "" });
      try {
        if (!pending) pending = await step(signal => upload(file, duration, ownerId, conversationId, signal), uploadTimeoutMs);
        if (stopped) return false;
        publish({ phase: "sending" });
        const video = pending;
        if (!video) return false;
        await step(signal => send(conversationId, ownerId, messageId, video, signal), writeTimeoutMs);
        if (stopped) return false;
        pending = null; messageId = crypto.randomUUID();
        publish({ note: "Videon är skickad." });
        return true;
      } catch {
        publish({ error: "Försöket kunde inte bekräftas. Förhandsvisningen finns kvar. Försök igen." });
        return false;
      } finally { busy = false; publish({ phase: "ready" }); }
    },
    async discard(): Promise<boolean> {
      if (stopped || busy || !pending) return false;
      busy = true; publish({ phase: "revoking", error: "", note: "" });
      try {
        const video = pending;
        await step(signal => revoke(video, signal), writeTimeoutMs);
        if (stopped) return false;
        pending = null; messageId = crypto.randomUUID();
        publish({ note: "Videon är återkallad. Om ett tidigare skickförsök nådde chatten kan videon inte längre spelas upp." });
        return true;
      } catch { publish({ error: "Kunde inte bekräfta att videon återkallats. Försök igen." }); return false; }
      finally { busy = false; publish({ phase: "ready" }); }
    },
    cancelUpload() { if (state.phase === "uploading") controller?.abort(); },
    stop() { stopped = true; controller?.abort(); },
  };
}
