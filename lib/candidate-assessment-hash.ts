import { createHash } from "node:crypto";
import type { MatchCriterion } from "./candidate-assessment";
import { groqTextOptions } from "./groq-config";

export function candidateAssessmentHash(source: string, criteria: MatchCriterion[], pdfStatus: string, profileVersion: number) {
  return createHash("sha256").update(JSON.stringify({ source, criteria, engine: 6, pdfStatus, profileVersion, aiConfigured: Boolean(process.env.GROQ_API_KEY), model: groqTextOptions(3600).model, relativeStartDay: criteria.some(item=>/omgående|omedelbart|snarast|direkt/i.test(item.label)) ? new Date().toISOString().slice(0,10) : null })).digest("hex");
}
