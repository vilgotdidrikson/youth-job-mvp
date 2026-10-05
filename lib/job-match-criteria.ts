/** Shared criterion normalization, independent of web UI and Supabase. */
export interface InitialJobMatchProfileInput {
  jobId: string;
  roleSummary: string;
  mustHaves: string[];
  trainableRequirements: string[];
  topTraits: string[];
  candidateQuestions?: string[];
  aiGenerated?: boolean;
}

export function jobMatchProfilePayload(input: InitialJobMatchProfileInput) {
  const normalize = (items: string[], max: number) => {
    const clean = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
    if (clean.length > max || clean.some((item) => item.length > 200)) throw new Error(`Ange högst ${max} kriterier, med högst 200 tecken per kriterium.`);
    return clean;
  };
  const mustHaves = normalize(input.mustHaves, 8);
  const traits = normalize(input.topTraits, 5);
  const trainable = normalize(input.trainableRequirements, 7);
  const questions = normalize(input.candidateQuestions ?? [], 3);
  if (!input.roleSummary.trim() || input.roleSummary.length > 2000) throw new Error("Beskriv rollen med 1–2000 tecken.");
  return { job_id: input.jobId, status: "approved", role_summary: input.roleSummary.trim(),
    must_haves: mustHaves, trainable_requirements: trainable, top_traits: traits,
    weighted_criteria: [...mustHaves.map((label) => ({ label, category: "must_have", weight: 3, required: true })),
      ...traits.map((label) => ({ label, category: "trait", weight: 2, required: false })),
      ...trainable.map((label) => ({ label, category: "trainable", weight: 0, required: false }))],
    candidate_questions: questions.map((question, index) => ({ id: `q${index + 1}`, question, answer_type: "text" })),
    ai_generated: input.aiGenerated === true };
}

