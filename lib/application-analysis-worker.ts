import type { SupabaseClient } from "@supabase/supabase-js";
import { matchingJobContext } from "./matching-job-context";
import { disclosedMatchingSource, type ApplicationDisclosure } from "./application-disclosure";
import { requestMatchingEvidence } from "./matching-provider";
import { matchingCriteria, candidateSourceDetails, assessCandidate, assessDisclosedCandidate, criteriaRequiringAi } from "./candidate-assessment";
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
      const {data:packet,error:packetError}=await client.rpc("get_application_disclosure_for_worker",{p_job_id:job.jobId,p_youth_user_id:job.youthId});
      if(packetError || !packet) throw Error("Disclosure unavailable");
      const pdf = await pdfCvSource(client, job.profile.documents, job.youthId);
      const publicSource=disclosedMatchingSource(packet as ApplicationDisclosure,pdf.text).text;
      const input = candidateSourceDetails({ ...job.profile, pdf_cv_text: pdf.text });
      const source = input.text;
      const jobContext=matchingJobContext(job.profile);
      const hash = candidateAssessmentHash(source, criteria, pdf.status, job.version, input.status, Number(job.profile.disclosure_revision ?? 0),jobContext);
      const { data: cached, error: readError } = await client.from("candidate_assessments").select("result").eq("job_id", job.jobId).eq("youth_user_id", job.youthId).eq("job_profile_version", job.version).eq("input_hash", hash).maybeSingle();
      if (readError) throw new Error("Assessment unavailable");
      let assessment = cached?.result;
      let internalAssessment = assessment;
      if (!assessment) {
        let raw: unknown = [];
        const aiCriteria = criteriaRequiringAi(criteria, source);
        if (source && aiCriteria.length) {
          raw = (await requestMatchingEvidence(apiKey, source, aiCriteria, [], jobContext)).criteria;
        }
        internalAssessment = assessCandidate(criteria,raw,source);
        assessment = { ...assessDisclosedCandidate(criteria, raw, source, publicSource), pdfStatus: pdf.status, inputStatus: input.status, policyVersion: 10, disclosureRevision: Number(job.profile.disclosure_revision ?? 0) };
      }
      // An unreadable PDF must not turn possibly-present information into new questions.
      const missing = pdf.status === "unreadable" || input.status === "review_required" ? [] : cached ? [] : missingApplicationCriteria(internalAssessment, [], source);
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
