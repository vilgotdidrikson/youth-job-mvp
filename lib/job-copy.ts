import { getJobWorkplaces, type JobWorkplace } from "./job-workplaces";
import type { JobPost } from "./types";
import type { JobMatchProfile } from "./match-profiles";

export interface JobBuilderDraft {
  workplaces: JobWorkplace[];
  title: string; city: string; address: string; postalCode: string;
  category: string; employmentType: string; minAge: string; maxAge: string;
  salaryFrom: string; salaryTo: string; salaryType: "timlön" | "månadslön" | "fast lön";
  salaryText: string; openPositions: string;
  description: string; benefits: string; requirements: string; listingRequirements: string | null;
  trainableRequirements: string; topTraits: string; candidateQuestions: string[];
  matchRoleSummary: string; aiGenerated: boolean;
  imageUrls: string[]; imagePending: boolean;
  copiedFromTitle: string; copyReviewed: boolean;
}
export const EMPTY_JOB_FORM: JobBuilderDraft = {
  workplaces: [], title: "", city: "", address: "", postalCode: "", category: "", employmentType: "",
  minAge: "", maxAge: "", salaryFrom: "", salaryTo: "", salaryType: "timlön", salaryText: "", openPositions: "1",
  description: "", benefits: "", requirements: "", listingRequirements: null, trainableRequirements: "", topTraits: "", candidateQuestions: [],
  matchRoleSummary: "", aiGenerated: false, imageUrls: [], imagePending: false, copiedFromTitle: "", copyReviewed: false,
};

/** Explicit editable-field allowlist: never copies recruitment identity or state. */
export function createCopyJobDraft(job: JobPost, criteria: JobMatchProfile | null, newId = () => crypto.randomUUID()): JobBuilderDraft {
  const workplaces = getJobWorkplaces(job).map(place => ({ ...place, id: newId() }));
  const first = workplaces[0];
  return {
    ...EMPTY_JOB_FORM,
    title: job.title, description: job.description, category: job.category, employmentType: job.employment_type,
    workplaces, city: first.city, address: first.address, postalCode: first.postal_code,
    minAge: job.min_age == null ? "" : String(job.min_age), maxAge: job.max_age == null ? "" : String(job.max_age),
    salaryText: job.salary_per_hour,
    openPositions: String(Number.isSafeInteger(job.open_positions) && job.open_positions! > 0 ? job.open_positions : 1),
    benefits: job.benefits, listingRequirements: job.requirements, requirements: criteria ? criteria.must_haves.join(", ") : job.requirements,
    trainableRequirements: criteria?.trainable_requirements.join(", ") ?? "",
    topTraits: criteria?.top_traits.join(", ") ?? "",
    candidateQuestions: criteria?.candidate_questions.map(item => item.question) ?? [],
    matchRoleSummary: criteria?.role_summary ?? job.description,
    imageUrls: job.image_url.split(",").map(value => value.trim()).filter(Boolean),
    copiedFromTitle: job.title, copyReviewed: false,
  };
}
export function draftSalary(form: JobBuilderDraft): string {
  if (form.salaryText.trim()) return form.salaryText.trim();
  const unit = form.salaryType === "timlön" ? "tim" : form.salaryType === "månadslön" ? "mån" : "period";
  if (form.salaryFrom && form.salaryTo) return `${form.salaryFrom}–${form.salaryTo} kr/${unit}`;
  if (form.salaryFrom) return `Från ${form.salaryFrom} kr/${unit}`;
  if (form.salaryTo) return `Upp till ${form.salaryTo} kr/${unit}`;
  return "";
}
export function validateDraftPublication(form: JobBuilderDraft): void {
  if (form.copiedFromTitle && !form.copyReviewed) throw new Error("Granska kopians datum, lön och villkor och bekräfta innan publicering.");
  if (!/^\d+$/.test(form.openPositions) || !Number.isSafeInteger(Number(form.openPositions)) || Number(form.openPositions) < 1) throw new Error("Ange minst en tjänst med ett heltal.");
  if (form.imagePending) throw new Error("Den nya bilden är inte sparad. Välj bilden igen eller välj att behålla den sparade bilden.");
}
export function hasJobDraftContent(form: JobBuilderDraft): boolean {
  return Object.entries(form).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(EMPTY_JOB_FORM[key as keyof JobBuilderDraft]));
}
