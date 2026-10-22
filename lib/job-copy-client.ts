"use client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { getJobById } from "@/lib/jobs";
import { getJobMatchProfile } from "@/lib/match-profiles";
import { createCopyJobDraft, type JobBuilderDraft } from "@/lib/job-copy";

/** Read only: publication continues through the normal authorized create path. */
export async function loadOwnJobCopy(jobId: string): Promise<JobBuilderDraft> {
  const user = await getCurrentUser();
  const profile = await getUserProfile(user?.id);
  if (!user || profile?.role !== "company") throw new Error("Logga in som företag för att kopiera en annons.");
  const job = await getJobById(jobId);
  if (!job || job.company_user_id !== user.id) throw new Error("Du kan bara kopiera dina egna annonser.");
  const criteria = await getJobMatchProfile(jobId);
  if ((await getCurrentUser())?.id !== user.id) throw new Error("Kontot har ändrats. Öppna annonsen på nytt innan du kopierar.");
  return createCopyJobDraft(job, criteria);
}
