import type { CandidateAssessment } from "./candidate-assessment";
import { applicationStartDateEvidence, knownQualificationKey, isStartDateCriterion } from "./fixed-match-rules";

const sensitive = /ålder|födelse|kön|etni|relig|häls|diagnos|funktions|medborg|nationalitet|gravid|sexuell|personnummer|politisk|facklig|familj|civilstånd/i;
function normalizeLabel(label: string) {
  const normalized = label.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  return knownQualificationKey(normalized) ?? normalized;
}

/** Unknown is missing evidence, never a negative decision. Traits are not inferred. */
export function missingApplicationCriteria(assessment: CandidateAssessment, existing: string[] = [], source = ""): string[] {
  const knownStart = applicationStartDateEvidence(source) !== null;
  const seen = new Set(existing.map(normalizeLabel));
  const eligible = assessment.criteria.filter(({ label, status, weight, category }) => {
    return status === "unknown" && weight > 0 && !["trait", "trainable"].includes(category)
      && !sensitive.test(label) && !(knownStart && isStartDateCriterion(label));
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
