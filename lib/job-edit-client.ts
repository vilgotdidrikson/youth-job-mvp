"use client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getJobById } from "@/lib/jobs";
import { getJobMatchProfile, type JobMatchProfile } from "@/lib/match-profiles";
import { createEditJobDraft } from "@/lib/job-edit";
import type { JobBuilderDraft } from "@/lib/job-copy";
import type { JobPost } from "@/lib/types";

export interface JobEditSource { job: JobPost; criteria: JobMatchProfile | null; form: JobBuilderDraft }

/** Read only. Saving goes through updateJob and saveJobMatchProfile, which re-check ownership. */
export async function loadOwnJobForEdit(jobId: string): Promise<JobEditSource> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);
  if (!user || profile?.role !== "company") throw new Error("Logga in som företag för att redigera en annons.");
  const job = await getJobById(jobId);
  if (!job || job.company_user_id !== user.id) throw new Error("Du kan bara redigera dina egna annonser.");
  const criteria = await getJobMatchProfile(jobId);
  if ((await getCurrentUser())?.id !== user.id) throw new Error("Kontot har ändrats. Öppna annonsen på nytt innan du redigerar.");
  return { job, criteria, form: createEditJobDraft(job, criteria) };
}
