import OpenAI from "openai";
import { OpenAIRealtimeWS } from "openai/realtime/ws";

const MAX_PCM_BYTES = 2_000_000;
export function pcmToWav(pcm: Buffer): Buffer {
  if (!pcm.length || pcm.length % 2 || pcm.length > MAX_PCM_BYTES) throw new Error("Invalid speech audio");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(pcm.length + 36, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// One server-only Realtime connection per generic question. No user recording,
// credentials or personal facts are sent, returned or cached by this helper.
export function synthesizeQuestion(text: string, model: string, apiKey: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const client = new OpenAI({ apiKey });
    const realtime = new OpenAIRealtimeWS({ model, options: { handshakeTimeout: 10_000 } }, client);
    const chunks: Buffer[] = [];
    let size = 0, started = false, settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); signal?.removeEventListener("abort", abort);
      realtime.close();
      if (error) { reject(error); return; }
      try {
        const wav = pcmToWav(Buffer.concat(chunks));
        resolve(Uint8Array.from(wav).buffer);
      } catch { reject(new Error("Incomplete speech audio")); }
    };
    const abort = () => finish(new Error("Speech request aborted"));
    const timer = setTimeout(() => finish(new Error("Speech request timed out")), 20_000);
    signal?.addEventListener("abort", abort, { once: true });
    realtime.on("error", () => finish(new Error("Speech service failed")));
    realtime.socket.on("close", () => finish(new Error("Speech connection closed before completion")));
    realtime.socket.on("open", () => {
      realtime.send({ type: "session.update", session: {
        type: "realtime", output_modalities: ["audio"], max_output_tokens: 1024,
        instructions: "Läs bara den angivna frågan ordagrant på svenska. Svara inte på frågan. Varm, tydlig och naturlig samtalston utan tillägg.",
        audio: { input: { turn_detection: null }, output: { voice: "marin", speed: 1.05, format: { type: "audio/pcm", rate: 24000 } } },
      } });
    });
    realtime.on("session.updated", () => {
      if (started || settled) return;
      started = true;
      realtime.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
      realtime.send({ type: "response.create" });
    });
    realtime.on("response.output_audio.delta", (event) => {
      if (settled) return;
      const chunk = Buffer.from(event.delta, "base64"); size += chunk.length;
      if (size > MAX_PCM_BYTES) { finish(new Error("Speech output limit exceeded")); return; }
      chunks.push(chunk);
    });
    realtime.on("response.done", (event) => finish(event.response.status === "completed" ? undefined : new Error("Speech generation incomplete")));
    if (signal?.aborted) abort();
  });
}
