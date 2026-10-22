import { candidateAssessmentHash } from "@/lib/candidate-assessment-hash";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { matchingJobContext } from "@/lib/matching-job-context";
import { disclosedMatchingSource, type ApplicationDisclosure } from "@/lib/application-disclosure";
import { requestMatchingEvidence } from "@/lib/matching-provider";
import { requireApiUser } from "@/lib/api-auth";
import { matchingCriteria, candidateSourceDetails, assessCandidate, assessDisclosedCandidate, criteriaRequiringAi } from "@/lib/candidate-assessment";
import { pdfCvSource } from "@/lib/pdf-cv-source";
import { queueApplicationFollowups } from "@/lib/queue-application-followups";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "candidate-analyze", ["company"]);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { jobId?: string; youthUserId?: string } | null;
  if (!body || ![body.jobId, body.youthUserId].every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ error: "Ogiltig kandidat." }, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => auth.token, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // This database authorization boundary checks verification, ownership, interest and blocking.
  const { data: profile, error: profileError } = await supabase.rpc("get_candidate_assessment_input", { p_job_id: body.jobId, p_youth_user_id: body.youthUserId });
  if (profileError || !profile) return NextResponse.json({ error: "Du saknar åtkomst till ansökan." }, { status: 403 });
  const { data: matchProfile, error } = await supabase.from("job_match_profiles").select("profile_version, weighted_criteria, status").eq("job_id", body.jobId).maybeSingle();
  if (error || !matchProfile || matchProfile.status !== "approved") return NextResponse.json({ error: "Annonsen saknar en godkänd matchprofil." }, { status: 409 });
  const criteria = matchingCriteria(matchProfile.weighted_criteria);
  const {data:packet,error:packetError}=await supabase.rpc("get_application_disclosure",{p_job_id:body.jobId,p_youth_user_id:body.youthUserId});
  if(packetError || !packet) return NextResponse.json({error:"Ansökningsunderlaget kunde inte hämtas."},{status:403});
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return NextResponse.json({error:"Bedömningen är tillfälligt otillgänglig. Ansökan finns kvar."},{status:503});
  const serverClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:internal,error:inputError}=await serverClient.rpc("get_application_matching_input",{p_job_id:body.jobId,p_youth_user_id:body.youthUserId,p_company_user_id:auth.user.id});
  if(inputError || !internal) return NextResponse.json({error:"Underlaget kunde inte läsas."},{status:403});
  const pdf = await pdfCvSource(serverClient, internal.documents, body.youthUserId!);
  let input,publicSource;
  try { input = candidateSourceDetails({ ...internal, pdf_cv_text: pdf.text }); publicSource=disclosedMatchingSource(packet as ApplicationDisclosure,pdf.text).text; }
  catch { return NextResponse.json({ error: "Underlaget behöver granskas innan automatisk bedömning. Ansökan påverkas inte." }, { status: 422 }); }
  const source = input.text;
  const jobContext=matchingJobContext(internal);
  const key = process.env.OPENAI_API_KEY;
  const hash = candidateAssessmentHash(source, criteria, pdf.status, matchProfile.profile_version, input.status, Number(internal.disclosure_revision ?? 0),jobContext);
  const { data: cached } = await serverClient.from("candidate_assessments").select("result,created_at").eq("job_id", body.jobId).eq("youth_user_id", body.youthUserId).eq("job_profile_version", matchProfile.profile_version).eq("input_hash", hash).maybeSingle();
  const currentDisclosure = async () => { const {data,error}=await supabase.rpc("get_application_disclosure",{p_job_id:body.jobId,p_youth_user_id:body.youthUserId}); return !error && data?.revision===packet.revision; };
  if (cached && pdf.status !== "unreadable") {
    if(!await currentDisclosure()) return NextResponse.json({error:"Underlaget har ändrats. Hämta ansökan igen."},{status:409});
    const followups = {queued:0};
    return NextResponse.json({ assessment: cached.result, createdAt: cached.created_at, cached: true, pdfStatus: pdf.status, followups });
  }
  let raw: unknown = [];
  const aiCriteria = criteriaRequiringAi(criteria, source);
  if (key && source && aiCriteria.length) {
    try {
      raw = (await requestMatchingEvidence(key, source, aiCriteria, [], jobContext)).criteria;
    } catch { return NextResponse.json({ assessment: { ...assessCandidate(criteria, [], publicSource), inputStatus: input.status, policyVersion: 10, disclosureRevision: Number(internal.disclosure_revision ?? 0) }, cached: false, temporary: true, pdfStatus: pdf.status }); }
  }
  const internalAssessment=assessCandidate(criteria,raw,source);
  if(!await currentDisclosure()) return NextResponse.json({error:"Underlaget har ändrats. Hämta ansökan igen."},{status:409});
  const assessment = { ...assessDisclosedCandidate(criteria, raw, source, publicSource), inputStatus: input.status, policyVersion: 10, disclosureRevision: Number(internal.disclosure_revision ?? 0) };
  if (pdf.status === "unreadable") return NextResponse.json({ assessment, cached: false, temporary: true, pdfStatus: pdf.status });
  const { error: insertError } = await serverClient.from("candidate_assessments").insert({ job_id: body.jobId, youth_user_id: body.youthUserId, company_user_id: auth.user.id,
    job_profile_version: matchProfile.profile_version, input_hash: hash, result: assessment, criteria_snapshot: criteria });
  if (insertError && insertError.code !== "23505") return NextResponse.json({ error: "Kunde inte spara bedömningen. Försök igen." }, { status: 503 });
  const followups = key && input.status === "minimized" ? await queueApplicationFollowups(supabase, body.jobId!, body.youthUserId!, matchProfile.profile_version, internalAssessment, hash, profile.source_updated_at, source) : { queued: 0 };
  return NextResponse.json({ assessment, cached: false, pdfStatus: pdf.status, followups });
}
