/** Shared, UI-independent validation. Only literal source passages are accepted. */
export function verifiedApplicationAnswers(raw: unknown, questions: readonly { id: string }[], source: string): Record<string, string> {
  if (!Array.isArray(raw)) return {};
  const ids = new Set(questions.map((question) => question.id));
  const answers: Record<string, string> = {};
  for (const value of raw.slice(0, 3)) {
    if (!value || typeof value !== "object") continue;
    const { id, evidence } = value as Record<string, unknown>;
    if (typeof id !== "string" || !ids.has(id) || typeof evidence !== "string") continue;
    const quote = evidence.trim();
    if (quote.length < 8 || quote.length > 1400 || !source.includes(quote)) continue;
    answers[id] = `Uppgift från profil/CV: ${quote}`;
  }
  return answers;
}

export function applicationSource(profile: Record<string, unknown>): string {
  // Exclude identity, birth date, images, document links and other irrelevant personal data.
  const structured = profile.cv_structured && typeof profile.cv_structured === "object" ? profile.cv_structured as Record<string, unknown> : {};
  const sections = ["profile", "workExperience", "education", "skills", "languages", "certifications", "extracurriculars"];
  const structuredText = sections.flatMap((key) => structured[key] ? [`${key}: ${JSON.stringify(structured[key])}`] : []).join("\n");
  return ["cv_text", "experience", "skills", "work_experience", "education", "languages", "working_time", "employment_preferences", "certificates", "extracurriculars"]
    .flatMap((key) => {
      const value = profile[key];
      if (typeof value === "string") return value.trim() ? [`${key}: ${value.trim()}`] : [];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => `${key}: ${item}`);
      return [];
    }).concat(structuredText ? [structuredText] : []).join("\n").slice(0, 14000) +
    (typeof profile.pdf_cv_text === "string" && profile.pdf_cv_text ? `\nPDF-CV:\n${profile.pdf_cv_text.slice(0, 12000)}` : "");
}
