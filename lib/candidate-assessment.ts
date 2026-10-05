import { applicationSource } from "./application-evidence";
import { fixedCriterionEvidence } from "./fixed-match-rules";

export type CriterionStatus = "fulfilled" | "unfulfilled" | "unknown";
export interface MatchCriterion { id: string; label: string; category: string; weight: number; required: boolean }
export interface AssessedCriterion extends MatchCriterion { status: CriterionStatus; evidence: string | null }
export interface CandidateAssessment {
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
    return [{ id: `c${index}`, label: item.label.trim().slice(0, 200), category: String(item.category ?? "merit"),
      // Knowledge explicitly trainable on the job is never a reason to lower suitability.
      weight: item.category === "trainable" ? 0 : item.required === true ? 3 : 2, required: item.required === true }];
  });
}

export function candidateSource(profile: Record<string, unknown>): string {
  const base = applicationSource(profile);
  const answers = profile.answers && typeof profile.answers === "object" ? Object.values(profile.answers) : [];
  return [base, ...answers.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => `Ansökningssvar: ${item}`)]
    .join("\n").slice(0, 32000);
}

export function assessCandidate(criteria: MatchCriterion[], raw: unknown, source: string): CandidateAssessment {
  const results = Array.isArray(raw) ? raw : [];
  const evaluated = criteria.map((criterion): AssessedCriterion => {
    const fixed = fixedCriterionEvidence(criterion.label, source);
    const value = criterion.category === "trait" ? null : fixed ?? results.find((entry) => entry && entry.id === criterion.id);
    const quote = typeof value?.evidence === "string" ? value.evidence.trim() : "";
    const grounded = quote.length >= 8 && quote.length <= 1500 && source.includes(quote);
    const status: CriterionStatus = grounded && ["fulfilled", "unfulfilled"].includes(value?.status) ? value.status : "unknown";
    return { ...criterion, status, evidence: grounded && status !== "unknown" ? quote : null };
  });
  const total = evaluated.reduce((sum, criterion) => sum + criterion.weight, 0);
  const known = evaluated.filter((criterion) => criterion.status !== "unknown").reduce((sum, criterion) => sum + criterion.weight, 0);
  const fulfilled = evaluated.filter((criterion) => criterion.status === "fulfilled").reduce((sum, criterion) => sum + criterion.weight, 0);
  const coverage = total ? Math.round(known / total * 100) : 0;
  const score = known ? Math.round(fulfilled / known * 100) : null;
  const confidence = coverage >= 80 ? "high" : coverage >= 40 ? "medium" : "low";
  const strengths = evaluated.filter((item) => item.status === "fulfilled").map((item) => item.label);
  const gaps = evaluated.filter((item) => item.status === "unknown" && item.weight > 0).map((item) => item.label);
  const conflicts = evaluated.filter((item) => item.status === "unfulfilled" && item.weight > 0).map((item) => item.label);
  const explanation = score === null ? "Det saknas tillräckligt underlag för en matchgrad. Bedöm kandidaten genom CV och egen kontakt."
    : `${score} % av de bedömda kriteriernas vikt är uppfylld. Underlaget täcker ${coverage} % av kriteriernas vikt.${gaps.length ? " Övriga kriterier saknar tillräcklig information." : ""} Arbetsgivaren fattar alltid beslutet.`;
  return { score, coverage, confidence, criteria: evaluated, strengths, gaps, conflicts, explanation, source: known ? results.length ? "ai" : "rules" : "insufficient" };
}
