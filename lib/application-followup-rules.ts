import type { CandidateAssessment } from "./candidate-assessment";

const sensitive = /ålder|födelse|kön|etni|relig|häls|diagnos|funktions|medborg|nationalitet|gravid|sexuell|personnummer|politisk|facklig|familj|civilstånd/i;
const normalizeLabel = (label: string) => label.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

/** Unknown is missing evidence, never a negative decision. Traits are not inferred. */
export function missingApplicationCriteria(assessment: CandidateAssessment, existing: string[] = [], source = ""): string[] {
  const knownStart = /^Kan börja arbeta: \d{4}-\d{2}-\d{2}$/m.test(source);
  const seen = new Set(existing.map(normalizeLabel));
  const eligible = assessment.criteria.filter(({ label, status, weight, category }) => {
    const startOnly = /(?:börja|start|tillträde|omgående)/i.test(label) && !/(?:helg|kväll|arbetstid|tider|skift)/i.test(label);
    return status === "unknown" && weight > 0 && !["trait", "trainable"].includes(category)
      && !sensitive.test(label) && !(knownStart && startOnly);
  }).sort((a, b) => Number(b.required) - Number(a.required));

  const questions: string[] = [];
  for (const { label } of eligible) {
    const key = normalizeLabel(label);
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(label);
    if (questions.length === 3) break;
  }
  return questions;
}
