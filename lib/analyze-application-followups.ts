import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { matchingJobContext } from "./matching-job-context";
import { requestMatchingEvidence } from "./matching-provider";
import { matchingCriteria, candidateSource, candidateSourceDetails, assessCandidate, criteriaRequiringAi } from "./candidate-assessment";
import { candidateAssessmentHash } from "./candidate-assessment-hash";
import { queueApplicationFollowups } from "./queue-application-followups";
import { pdfCvSource } from "./pdf-cv-source";
import { verifiedApplicationAnswers } from "./application-evidence";

export async function analyzeApplicationFollowups(client: SupabaseClient, jobId: string, youthId: string) {
  const { data: context, error } = await client.rpc("get_my_application_followup_input", { p_job_id: jobId });
  if (error || !context) return { queued: 0, error: "Kunde inte läsa ansökan." };
  if (!context.available) return { queued: 0, unavailable: true };
  if (context.question_batch_version === context.profile_version) return { queued: 0, cached: true };
  // The user-scoped RPC above authorizes this exact application first. Internal
  // criteria are then read only on the server, never returned to the youth client.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { queued: 0, temporary: true };
  const server = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: matchProfile, error: criteriaError } = await server.from("job_match_profiles")
    .select("weighted_criteria").eq("job_id", jobId).eq("profile_version", context.profile_version).eq("status", "approved").maybeSingle();
  if (criteriaError || !matchProfile) return { queued: 0, temporary: true };
  const pdf = await pdfCvSource(client, context.profile?.documents, youthId);
  if (pdf.status === "unreadable") return { queued: 0, temporary: true };
  const criteria = matchingCriteria(matchProfile.weighted_criteria);
  let input;
  try { input = candidateSourceDetails({ ...context.profile, pdf_cv_text: pdf.text }); }
  catch { return { queued: 0, temporary: true, inputStatus: "review_required" }; }
  if (input.status === "review_required") return { queued: 0, inputStatus: input.status };
  const source = input.text;
  const jobContext=matchingJobContext(context.profile ?? {});
  const key = process.env.OPENAI_API_KEY;
  let hash = candidateAssessmentHash(source, criteria, pdf.status, context.profile_version, input.status, Number(context.profile?.disclosure_revision ?? 0),jobContext);
  if (context.analysis_hash === hash) return { queued: 0, cached: true };
  if (!key) return { queued: 0, temporary: true };
  const leaseArgs = { p_job_id: jobId, p_youth_user_id: youthId, p_input_hash: hash };
  const { data: lease, error: leaseError } = await client.rpc("claim_application_followup_analysis", leaseArgs);
  if (leaseError) return { queued: 0, temporary: true };
  if (!lease?.claimed) return { queued: 0, cached: lease?.reason === "cached", processing: lease?.reason === "busy" };
  try {
    const { data: quota, error: quotaError } = await client.rpc("consume_api_quota", { p_endpoint: "application-followups", p_limit: 20 });
    if (quotaError || !quota) return { queued: 0, temporary: true };
    let raw: unknown = [];
    let staticEvidence: unknown = [];
    const questions = (context.questions ?? []).filter((question: {id:string}) => !context.answers?.[question.id]?.trim() && !(context.omitted_question_ids ?? []).includes(question.id));
    // An outage must not turn already-present information into new questions.
    const aiCriteria = criteriaRequiringAi(criteria, source);
    if (source && (aiCriteria.length || questions.length)) {
      try {
        const result = await requestMatchingEvidence(key, source, aiCriteria, questions, jobContext);
        raw = result.criteria;
        staticEvidence = result.answers;
        if (!Array.isArray(raw)) return { queued: 0, temporary: true };
      } catch { return { queued: 0, temporary: true }; }
    }
    const answers = verifiedApplicationAnswers(staticEvidence, questions, source);
    if (Object.keys(answers).length) {
      const { data:evidenceResult, error: evidenceError } = await client.rpc("apply_my_application_evidence_snapshot", {p_job_id:jobId,p_answers:answers,p_source_hash:hash,p_source_updated_at:context.source_updated_at});
      if (evidenceError) return {queued:0,temporary:true};
      if (evidenceResult?.stale) return {queued:0,stale:true};
      hash = candidateAssessmentHash(candidateSource({...context.profile,answers:{...context.answers,...answers},pdf_cv_text:pdf.text}),criteria,pdf.status,context.profile_version, input.status, Number(context.profile?.disclosure_revision ?? 0),jobContext);
    }
    return await queueApplicationFollowups(client, jobId, youthId, context.profile_version, assessCandidate(criteria, raw, source), hash, context.source_updated_at, source);
  } finally {
    await client.rpc("release_application_followup_analysis", leaseArgs);
  }
}
