/** Server-side text settings. Only the official OpenAI API is used. */
export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

export type AiWorkload = "matching" | "application" | "job";

export function openaiTextOptions(maxCompletionTokens: number, workload: AiWorkload = "matching") {
  // Separate task overrides prevent the CV model from changing matching settings.
  const override = workload === "matching" ? process.env.OPENAI_MATCH_MODEL
    : workload === "job" ? process.env.OPENAI_JOB_MODEL : process.env.OPENAI_APPLICATION_MODEL;
  const model = override?.trim() || "gpt-6-luna";
  const reasoningModel = /^(gpt-[56]|o[134])/.test(model);
  const effort = workload === "matching" ? "medium" as const : "none" as const;
  return { model, max_completion_tokens: workload === "matching" && reasoningModel ? Math.max(6000, maxCompletionTokens) : maxCompletionTokens,
    store: false as const,
    ...(reasoningModel ? { reasoning_effort: effort } : {}),
    ...(!reasoningModel || effort === "none" ? { temperature: workload === "job" ? 0.35 : 0 } : {}) };
}
