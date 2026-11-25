/**
 * Editing an existing listing (N01). Framework-free so web and a future mobile
 * app share the same rules. Authorization stays in updateJob and RLS.
 */
import { draftSalary, jobBuilderFields, type JobBuilderDraft } from "./job-copy";
import { draftJobCategories } from "./job-categories";
import { getJobWorkplaces } from "./job-workplaces";
import { jobPublicationState } from "./job-publication";
import { practicalPayload } from "./job-practical";
import type { InitialJobMatchProfileInput } from "./job-match-criteria";
import type { JobMatchProfile } from "./match-profiles";
import type { JobPost } from "./types";

export function textListItems(value: string): string[] {
  return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
}

/** Workplace IDs are kept so saved applicant preferences keep pointing at the same place. */
export function createEditJobDraft(job: JobPost, criteria: JobMatchProfile | null): JobBuilderDraft {
  return jobBuilderFields(job, criteria, getJobWorkplaces(job));
}

function publicFields(form: JobBuilderDraft, imageUrls: string[]) {
  return {
    title: form.title,
    description: form.description,
    requirements: form.listingRequirements ?? form.requirements,
    benefits: form.benefits,
    employment_type: form.employmentType,
    salary_per_hour: draftSalary(form),
    min_age: form.minAge ? parseInt(form.minAge, 10) : null,
    max_age: form.maxAge ? parseInt(form.maxAge, 10) : null,
    image_url: imageUrls.join(","),
    category: form.category,
    job_category_ids: draftJobCategories(form),
    job_category_manual: form.categoryManual,
    practical_details: practicalPayload(form.practical),
    workplaces: form.workplaces.map(({ id, name, address, postal_code, city }) => ({ id, name, address, postal_code, city })),
  };
}

/**
 * Only fields that differ from the loaded listing are sent, so an untouched
 * address is not geocoded again and unchanged values are not rewritten.
 */
export function jobEditUpdates(baseline: JobBuilderDraft, form: JobBuilderDraft, imageUrls: string[]) {
  const before = publicFields(baseline, baseline.imageUrls);
  const after = publicFields(form, imageUrls);
  const updates: Partial<typeof after> = {};
  for (const key of Object.keys(after) as (keyof typeof after)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) Object.assign(updates, { [key]: after[key] });
  }
  // Send the complete workplace objects (with coordinates) so updateJob can resolve them.
  if (updates.workplaces) return { ...updates, workplaces: form.workplaces };
  return updates as Omit<Partial<typeof after>, "workplaces">;
}

export function jobEditCriteria(form: JobBuilderDraft, jobId: string): InitialJobMatchProfileInput {
  return {
    jobId,
    roleSummary: form.matchRoleSummary.trim() || form.description,
    mustHaves: textListItems(form.requirements),
    trainableRequirements: textListItems(form.trainableRequirements),
    topTraits: textListItems(form.topTraits).slice(0, 5),
    candidateQuestions: form.candidateQuestions,
    aiGenerated: form.aiGenerated,
  };
}

/** A new criteria version re-queues assessments of submitted applications, so only save real changes. */
export function jobEditCriteriaChanged(baseline: JobBuilderDraft, form: JobBuilderDraft): boolean {
  // The AI flag alone is provenance, not a criteria change.
  const comparable = (draft: JobBuilderDraft) => JSON.stringify({ ...jobEditCriteria(draft, ""), aiGenerated: undefined });
  return comparable(baseline) !== comparable(form);
}

/** After the listing itself saved but criteria failed, retry only the criteria. */
export function withSavedPublicFields(baseline: JobBuilderDraft, form: JobBuilderDraft, imageUrls: string[]): JobBuilderDraft {
  return {
    ...form, imageUrls, imagePending: false,
    matchRoleSummary: baseline.matchRoleSummary, requirements: baseline.requirements,
    trainableRequirements: baseline.trainableRequirements, topTraits: baseline.topTraits,
    candidateQuestions: baseline.candidateQuestions, aiGenerated: baseline.aiGenerated,
  };
}

export function jobEditVisibility(job: Parameters<typeof jobPublicationState>[0]): string {
  switch (jobPublicationState(job)) {
    case "published": return "Annonsen är publicerad. Ändringarna syns direkt för alla som ser den.";
    case "waiting": return "Annonsen väntar på företagsverifiering. Ändringarna syns när den publiceras.";
    case "paused": return "Annonsen är pausad och förblir dold. Ändringarna gäller om du återaktiverar den.";
    case "closed": return "Annonsen är stängd och förblir dold. Ändringarna gäller om du öppnar den igen.";
    default: return "Publiceringsstatus kunde inte bekräftas. Kontrollera statusen i annonsöversikten efter sparning.";
  }
}

/** What editing does to people who already applied. Saving never changes the listing's status. */
export const JOB_EDIT_CONSEQUENCES = [
  "Befintliga ansökningar, matchningar och chattar finns kvar. Den som redan har ansökt ser den uppdaterade annonsen.",
  "Ändrar du matchkriterierna i steg 2 görs matchningsanalysen om automatiskt för inskickade ansökningar. Ändringar i annonstext, lön, bild eller plats ändrar inte befintliga analyser.",
  "Nya ansökningsfrågor gäller bara nya ansökningar. En arbetsplats som en sökande redan har valt sparas som den var vid valet.",
] as const;

export function jobEditReceipt(listingChanged: boolean, criteriaChanged: boolean): string {
  if (!listingChanged && !criteriaChanged) return "Inga ändringar att spara. Annonsen är oförändrad.";
  const parts = [listingChanged && "annonsen", criteriaChanged && "matchkriterierna"].filter(Boolean).join(" och ");
  return `Ändringarna i ${parts} är sparade.${criteriaChanged ? " Inskickade ansökningar bedöms om mot de nya kriterierna." : ""}`;
}
