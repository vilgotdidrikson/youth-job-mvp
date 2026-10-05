/** Server-side model configuration shared by the job and application flows. */
export function groqTextOptions(maxCompletionTokens: number) {
  const model = process.env.GROQ_TEXT_MODEL?.trim() || "openai/gpt-oss-120b";
  return { model, max_completion_tokens: maxCompletionTokens,
    ...(model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" as const } : {}) };
}
