export interface CvCompletionRecord {
  cv_text?: unknown;
  cv_generated?: unknown;
  cv_uploaded?: unknown;
  documents?: unknown;
}

export function hasCompletedCv(profile: CvCompletionRecord | null | undefined): boolean {
  if (!profile) return false;
  if (typeof profile.cv_text === "string" && profile.cv_text.trim()) return true;
  if (profile.cv_generated === true || profile.cv_uploaded === true) return true;

  return Array.isArray(profile.documents)
    && profile.documents.some((document) => document
      && typeof document === "object"
      && ["cv", "generated_cv"].includes(String((document as { type?: unknown }).type)));
}
