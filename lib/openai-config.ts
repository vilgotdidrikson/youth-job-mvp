/** Server-side text settings. Only the official OpenAI API is used. */
export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

export function openaiTextOptions(maxCompletionTokens: number) {
  const model = process.env.OPENAI_TEXT_MODEL?.trim()
    || process.env.OPENAI_CV_MODEL?.trim()
    || "gpt-4.1-mini";
  return { model, max_completion_tokens: maxCompletionTokens, store: false as const };
}
