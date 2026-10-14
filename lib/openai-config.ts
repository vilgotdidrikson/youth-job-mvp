/** Server-side text settings. Only the official OpenAI API is used. */
export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

export type AiWorkload = "matching" | "application" | "job";

// Include dated snapshots, but never confuse speech models with text models.
export function currentTextModel(override?: string): string {
  const model = override?.trim() || "gpt-6-luna";
  return /^gpt-(?:4o(?:-mini)?|4\.1(?:-mini)?)(?:-\d{4}-\d{2}-\d{2})?$/.test(model) ? "gpt-6-luna" : model;
}

export function openaiResponseOptions(maxOutputTokens: number, override?: string) {
  const model = currentTextModel(override);
  const reasoning = /^(gpt-[56]|o[134])/.test(model);
  const effort = /^gpt-6(?:\.1)?-astra|^gpt-6\.1-sol/.test(model) ? "low" as const : "none" as const;
  return { model, store: false as const,
    max_output_tokens: reasoning && effort !== "none" ? Math.max(6000, maxOutputTokens) : maxOutputTokens,
    ...(reasoning ? { reasoning: { effort } } : {}),
    ...(!reasoning || effort === "none" ? { temperature: 0 } : {}) };
}

export function currentRealtimeModel(override?: string, mini = false): string {
  const model = override?.trim();
  if (!model) return mini ? "gpt-realtime-2.1-mini" : "gpt-realtime-2.1";
  if (/^(?:tts-1(?:-hd)?|gpt-4o-mini-tts(?:-\d{4}-\d{2}-\d{2})?)$/.test(model)) return "gpt-realtime-2.1-mini";
  if (/^gpt-(?:realtime(?:-mini)?|4o(?:-mini)?-realtime(?:-preview)?)(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return model.includes("mini") ? "gpt-realtime-2.1-mini" : "gpt-realtime-2.1";
  return model;
}

export function openaiTextOptions(maxCompletionTokens: number, workload: AiWorkload = "matching") {
  // Separate task overrides prevent the CV model from changing matching settings.
  const override = workload === "matching" ? process.env.OPENAI_MATCH_MODEL
    : workload === "job" ? process.env.OPENAI_JOB_MODEL : process.env.OPENAI_APPLICATION_MODEL;
  const model = currentTextModel(override);
  const reasoningModel = /^(gpt-[56]|o[134])/.test(model);
  const effort = workload === "matching" ? "medium" as const : "none" as const;
  return { model, max_completion_tokens: workload === "matching" && reasoningModel ? Math.max(6000, maxCompletionTokens) : maxCompletionTokens,
    store: false as const,
    ...(reasoningModel ? { reasoning_effort: effort } : {}),
    ...(!reasoningModel || effort === "none" ? { temperature: workload === "job" ? 0.35 : 0 } : {}) };
}
