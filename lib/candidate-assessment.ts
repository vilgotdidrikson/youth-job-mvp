import { applicationSourceInput } from "./application-evidence";
import { minimizeMatchingText, matchingIdentities, isExcludedMatchingText } from "./matching-input-policy";
import { selfReportedTraitEvidence, isPersonalTrait } from "./trait-evidence";
import { fixedCriterionEvidence } from "./fixed-match-rules";

export type CriterionStatus = "fulfilled" | "unfulfilled" | "unknown";
export interface MatchCriterion { id: string; label: string; category: string; weight: number; required: boolean }
export interface AssessedCriterion extends MatchCriterion { status: CriterionStatus; evidence: string | null }
export interface CandidateAssessment {
  inputStatus?: "minimized" | "review_required";
  policyVersion?: number;
  disclosureRevision?: number;
  score: number | null;
  coverage: number;
  confidence: "low" | "medium" | "high";
  criteria: AssessedCriterion[];
  strengths: string[];
  gaps: string[];
  conflicts: string[];
  explanation: string;
  source: "ai" | "rules" | "insufficient";
}

export function matchingCriteria(raw: unknown): MatchCriterion[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).flatMap((item, index) => {
    if (!item || typeof item.label !== "string" || !item.label.trim()) return [];
    return [{ id: `c${index}`, label: item.label.trim().slice(0, 200), category: isPersonalTrait(item.label) ? "trait" : isExcludedMatchingText(item.label) ? "excluded" : String(item.category ?? "merit"),
      // Knowledge explicitly trainable on the job is never a reason to lower suitability.
      weight: ["trainable", "trait"].includes(item.category) || isPersonalTrait(item.label) || isExcludedMatchingText(item.label) ? 0 : item.required === true ? 3 : 2, required: item.required === true }];
  });
}

export function candidateSourceDetails(profile: Record<string, unknown>) {
  const base = applicationSourceInput(profile);
  const answers = profile.answers && typeof profile.answers === "object" ? Object.values(profile.answers) : [];
  const followups = Array.isArray(profile.followup_answers) ? profile.followup_answers : [];
  const supplements = followups.flatMap((item) => item && typeof item.answer === "string" && item.answer.trim() ? [`Kompletteringssvar: ${item.answer.trim()}`] : []);
  const combined = [...supplements, ...answers.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => `Ansökningssvar: ${item}`), base]
    .join("\n");
  return minimizeMatchingText(combined, matchingIdentities(profile));
}

export function candidateSource(profile: Record<string, unknown>): string { return candidateSourceDetails(profile).text; }

/** Rules already decide these criteria; never pay to ask AI for an ignored answer. */
export function criteriaRequiringAi(criteria: MatchCriterion[], source: string): MatchCriterion[] {
  return criteria.filter(item => item.weight > 0 && !["trait", "trainable"].includes(item.category)
    && !isPersonalTrait(item.label) && !isExcludedMatchingText(item.label) && fixedCriterionEvidence(item.label, source) === null);
}

export function assessCandidate(criteria: MatchCriterion[], raw: unknown, source: string): CandidateAssessment {
  const results = Array.isArray(raw) ? raw : [];
  const evaluated = criteria.map((criterion): AssessedCriterion => {
    const trait = criterion.category === "trait" || isPersonalTrait(criterion.label);
    const fixed = trait ? selfReportedTraitEvidence(criterion.label, source) : fixedCriterionEvidence(criterion.label, source);
    const value = isExcludedMatchingText(criterion.label) ? null : trait ? fixed : fixed ?? results.find((entry) => entry && entry.id === criterion.id);
    const quote = typeof value?.evidence === "string" ? value.evidence.trim() : "";
    const grounded = quote.length >= 8 && quote.length <= 1500 && source.includes(quote);
    const status: CriterionStatus = grounded && ["fulfilled", "unfulfilled"].includes(value?.status) ? value.status : "unknown";
    return { ...criterion, weight: trait || isExcludedMatchingText(criterion.label) ? 0 : criterion.weight, category: trait ? "trait" : criterion.category, status, evidence: grounded && (status !== "unknown" || (fixed?.status === "unknown" && fixed.evidence)) ? quote : null };
  });
  const total = evaluated.reduce((sum, criterion) => sum + criterion.weight, 0);
  const known = evaluated.filter((criterion) => criterion.status !== "unknown").reduce((sum, criterion) => sum + criterion.weight, 0);
  const fulfilled = evaluated.filter((criterion) => criterion.status === "fulfilled").reduce((sum, criterion) => sum + criterion.weight, 0);
  const coverage = total ? Math.round(known / total * 100) : 0;
  const score = known ? Math.round(fulfilled / known * 100) : null;
  const confidence = coverage >= 80 ? "high" : coverage >= 40 ? "medium" : "low";
  const strengths = evaluated.filter((item) => item.status === "fulfilled" && item.weight > 0).map((item) => item.label);
  const gaps = evaluated.filter((item) => item.status === "unknown" && item.weight > 0).map((item) => item.label);
  const conflicts = evaluated.filter((item) => item.status === "unfulfilled" && item.weight > 0).map((item) => item.label);
  const explanation = score === null ? "Inga viktade faktakriterier har kunnat bedömas. Läs tillgängliga belägg och CV och gör en egen bedömning."
    : `Underlaget täcker ${coverage} % av kriteriernas vikt.${gaps.length ? " Övriga kriterier saknar tillräcklig information." : ""} Arbetsgivaren fattar alltid beslutet.`;
  return { score, coverage, confidence, criteria: evaluated, strengths, gaps, conflicts, explanation, source: known ? results.length ? "ai" : "rules" : "insufficient" };
}

/** Internal context may be broad; company-visible facts must be grounded in both
 * the actual provider source and the explicitly disclosed source. */
export function assessDisclosedCandidate(criteria: MatchCriterion[], raw: unknown, internalSource: string, disclosedSource: string): CandidateAssessment {
  const grounded = Array.isArray(raw) ? raw.filter(item => item && typeof item.evidence === "string" && internalSource.includes(item.evidence.trim())) : [];
  return assessCandidate(criteria,grounded,disclosedSource);
}
