export type CvCreationMethod = "manual" | "ai";
/** Older drafts never opt somebody into an AI call. */
export function cvCreationMethod(value: unknown): CvCreationMethod {
  return value === "ai" ? "ai" : "manual";
}
