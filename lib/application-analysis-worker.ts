import type { SupabaseClient } from "@supabase/supabase-js";
import { requestMatchingEvidence } from "./matching-provider";
import { matchingCriteria, candidateSourceDetails, assessCandidate, criteriaRequiringAi } from "./candidate-assessment";
import { candidateAssessmentHash } from "./candidate-assessment-hash";
import { missingApplicationCriteria } from "./application-followup-rules";
import { pdfCvSource } from "./pdf-cv-source";

interface AnalysisJob { jobId: string; youthId: string; generation: number; lockToken: string; profile: Record<string, unknown>; criteria: unknown; version: number }

/** Server-only worker; job selection, authorization and stale-result checks live in SQL. */
export async function processApplicationAnalysisJobs(client: SupabaseClient, apiKey: string) {
  const { data, error } = await client.rpc("claim_application_analysis_jobs");
  if (error || !Array.isArray(data)) throw new Error("Queue unavailable");
  const jobs = data as AnalysisJob[];
  const results = await Promise.all(jobs.map(async job => {
    const task = { p_job: job.jobId, p_youth: job.youthId, p_generation: job.generation, p_token: job.lockToken };
    try {
      const criteria = matchingCriteria(job.criteria);
      const pdf = await pdfCvSource(client, job.profile.documents, job.youthId);
      const input = candidateSourceDetails({ ...job.profile, pdf_cv_text: pdf.text });
      const source = input.text;
      const hash = candidateAssessmentHash(source, criteria, pdf.status, job.version, input.status);
      const { data: cached, error: readError } = await client.from("candidate_assessments").select("result").eq("job_id", job.jobId).eq("youth_user_id", job.youthId).eq("job_profile_version", job.version).eq("input_hash", hash).maybeSingle();
      if (readError) throw new Error("Assessment unavailable");
      let assessment = cached?.result;
      if (!assessment) {
        let raw: unknown = [];
        const aiCriteria = criteriaRequiringAi(criteria, source);
        if (source && aiCriteria.length) {
          raw = (await requestMatchingEvidence(apiKey, source, aiCriteria)).criteria;
        }
        assessment = { ...assessCandidate(criteria, raw, source), pdfStatus: pdf.status, inputStatus: input.status, policyVersion: 9 };
      }
      // An unreadable PDF must not turn possibly-present information into new questions.
      const missing = pdf.status === "unreadable" || input.status === "review_required" ? [] : missingApplicationCriteria(assessment, [], source);
      const { data: finished, error: saveError } = await client.rpc("finish_application_analysis_job", { ...task, p_hash: hash, p_result: assessment, p_criteria: criteria, p_missing: missing });
      if (saveError) throw new Error("Save unavailable");
      return finished?.completed === true;
    } catch {
      // No CV text, provider payload or credential is written to error logs.
      await client.rpc("fail_application_analysis_job", task);
      return false;
    }
  }));
  return { processed: jobs.length, completed: results.filter(Boolean).length };
}
