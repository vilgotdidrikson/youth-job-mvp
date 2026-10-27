import { createHash } from "node:crypto";
import type { MatchCriterion } from "./candidate-assessment";
import { openaiTextOptions } from "./openai-config";

export function candidateAssessmentHash(source: string, criteria: MatchCriterion[], pdfStatus: string, profileVersion: number, inputStatus = "minimized", disclosureRevision = 0, jobContext = "") {
  return createHash("sha256").update(JSON.stringify({ source, criteria, engine: 11, inputStatus, disclosureRevision, jobContext, provider: "openai", pdfStatus, profileVersion, aiConfigured: Boolean(process.env.OPENAI_API_KEY), options: openaiTextOptions(3600), relativeStartDay: criteria.some(item=>/omgående|omedelbart|snarast|direkt/i.test(item.label)) ? new Date().toISOString().slice(0,10) : null })).digest("hex");
}
