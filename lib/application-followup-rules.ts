import type { CandidateAssessment } from "./candidate-assessment";

const sensitive = /ålder|födelse|kön|etni|relig|häls|diagnos|funktions|medborg|nationalitet|gravid|sexuell|personnummer|politisk|facklig|familj|civilstånd/i;
/** Unknown is missing evidence, never a negative decision. Traits are not inferred. */
export function missingApplicationCriteria(assessment: CandidateAssessment, existing: string[] = []): string[] {
  return assessment.criteria.filter((item) => item.status === "unknown" && item.weight > 0 && !["trait", "trainable"].includes(item.category) && !sensitive.test(item.label) && !existing.some((label) => label.trim().replace(/\s+/g, " ").toLowerCase() === item.label.trim().replace(/\s+/g, " ").toLowerCase()))
    .sort((a, b) => Number(b.required) - Number(a.required)).slice(0, 3).map((item) => item.label);
}
